#!/usr/bin/env python3
"""SDA Sabbath live translation: Afrikaans sermon -> English captions, offline, on the church PC.

  Sound desk -> Silero VAD (cut at pauses) -> Fluister (Afrikaans Whisper, CTranslate2 int8)
             -> Bible quote?  yes: the English verse itself (Afrikaans 1933/53 -> WEB/KJV)
                              no:  Adventist word list -> OPUS-MT af-en (CTranslate2 int8) -> fixes
             -> captions to SDA Sabbath (http://127.0.0.1:7790, server-sent events)

Each second of audio is recognised once (no re-decoding of a sliding window), and only whole sentences are
translated, so the words on the screen do not change after they appear.

  python livetranslate.py get-models [--asr turbo|small|base|large-v3]   download the models (once, needs internet)
  python livetranslate.py devices                                         list microphones / sound-desk inputs
  python livetranslate.py serve [--device N]                              run for SDA Sabbath
  python livetranslate.py bench sermon.wav [--ref words.txt]             accuracy and speed on a recording
  python livetranslate.py demo                                            fake captions, to test the app link
"""
import argparse, json, os, queue, re, sys, threading, time, unicodedata
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

VERSION = '1.0.0'
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, 'models')
BIBLES = os.path.normpath(os.path.join(HERE, '..', 'data', 'bibles'))
SR = 16000
ASR_SIZES = ['turbo', 'small', 'base', 'large-v3', 'medium', 'tiny']
OPUS_ZIP = 'https://object.pouta.csc.fi/OPUS-MT-models/af-en/opus-2019-12-18.zip'


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, file=sys.stderr, flush=True)


# ---------------------------------------------------------------------------------------------- text helpers
def fold(s):
    """lower case, no accents (Daniël -> daniel), letters and digits only."""
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9' ]+", ' ', s).replace("'", '')


def words(s):
    return fold(s).split()


# Book names, as in SDA Sabbath's js/core/books.js (kept here so the translator never depends on the app's code).
EN_BOOKS = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"]
AF_BOOKS = ["Genesis", "Exodus", "Levitikus", "Numeri", "Deuteronomium", "Josua", "Rigters", "Rut", "1 Samuel", "2 Samuel", "1 Konings", "2 Konings", "1 Kronieke", "2 Kronieke", "Esra", "Nehemia", "Ester", "Job", "Psalms", "Spreuke", "Prediker", "Hooglied", "Jesaja", "Jeremia", "Klaagliedere", "Esegiël", "Daniël", "Hosea", "Joël", "Amos", "Obadja", "Jona", "Miga", "Nahum", "Habakuk", "Sefanja", "Haggai", "Sagaria", "Maleagi", "Matteus", "Markus", "Lukas", "Johannes", "Handelinge", "Romeine", "1 Korintiërs", "2 Korintiërs", "Galasiërs", "Efesiërs", "Filippense", "Kolossense", "1 Tessalonisense", "2 Tessalonisense", "1 Timoteus", "2 Timoteus", "Titus", "Filemon", "Hebreërs", "Jakobus", "1 Petrus", "2 Petrus", "1 Johannes", "2 Johannes", "3 Johannes", "Judas", "Openbaring"]


def load_books():
    return EN_BOOKS, AF_BOOKS


# Afrikaans numbers as Whisper sometimes writes them ("drie", "een-en-twintig", "honderd en vyf").
_UNITS = {'een': 1, 'twee': 2, 'drie': 3, 'vier': 4, 'vyf': 5, 'ses': 6, 'sewe': 7, 'agt': 8, 'ag': 8, 'nege': 9}
_TEENS = {'tien': 10, 'elf': 11, 'twaalf': 12, 'dertien': 13, 'veertien': 14, 'vyftien': 15, 'sestien': 16,
          'sewentien': 17, 'agtien': 18, 'negentien': 19}
_TENS = {'twintig': 20, 'dertig': 30, 'veertig': 40, 'vyftig': 50, 'sestig': 60, 'sewentig': 70, 'tagtig': 80, 'negentig': 90}


def af_number(tok):
    """'21' -> 21, 'een-en-twintig' -> 21, 'eenhonderd-en-vyf' -> 105; None when not a number."""
    if tok.isdigit():
        return int(tok)
    t = tok.replace('-', '').replace(' ', '')
    total = 0
    m = re.match(r'^(een|twee|drie|vier|vyf|ses|sewe|agt|nege)?honderd(en)?', t)
    if m:
        total = _UNITS.get(m.group(1) or 'een', 1) * 100
        t = t[m.end():]
        if not t:
            return total
    if t in _TEENS:
        return total + _TEENS[t]
    if t in _TENS:
        return total + _TENS[t]
    if t in _UNITS:
        return total + _UNITS[t]
    m = re.match(r'^(een|twee|drie|vier|vyf|ses|sewe|agt|ag|nege)en(twintig|dertig|veertig|vyftig|sestig|sewentig|tagtig|negentig)$', t)
    if m:
        return total + _UNITS[m.group(1)] + _TENS[m.group(2)]
    return None


# ---------------------------------------------------------------------------------------------- the Bible
def lord(text):
    """World English Bible with "the LORD" for "Yahweh", as in the WEB's own LORD editions (WEBBE) and as preached."""
    if 'Yahweh' not in text:
        return text
    t = re.sub(r"\bO Yahweh\b", 'O LORD', text)
    t = re.sub(r"\bYahweh of Armies\b", 'Yahweh of hosts', t)
    t = re.sub(r"(^|[.!?;:\u201c\"\u2018(]\s*)Yahweh\b", lambda m: m.group(1) + 'The LORD', t)
    return re.sub(r"\bYahweh\b", 'the LORD', t).replace('the the LORD', 'the LORD')


class Bible:
    """Afrikaans 1933/53 and an English Bible from SDA Sabbath's own data, verse for verse.

    match(): is this sentence a quote of a verse?  refs(): did the preacher name a reference?"""

    def __init__(self, english='web'):
        self.EN, self.AF = load_books()
        self.af = self._load('afr53')
        self.en_id = english
        self.en = self._load(english)
        # spoken book names: "johannes", "1 johannes", "eerste johannes", plus a few common variants
        self.names = {}
        for i, n in enumerate(self.AF):
            f = ' '.join(words(n))
            self.names[f] = i
            m = re.match(r'([123]) (.*)', f)
            if m:
                self.names[{'1': 'eerste', '2': 'tweede', '3': 'derde'}[m.group(1)] + ' ' + m.group(2)] = i
        for alias, en in [('psalm', 'Psalms'), ('mattheus', 'Matthew'), ('matteüs', 'Matthew'), ('openbaringe', 'Revelation'),
                          ('handelinge van die apostels', 'Acts'), ('hooglied van salomo', 'Song of Solomon'),
                          ('die openbaring', 'Revelation')]:
            if en in self.EN:
                self.names[' '.join(words(alias))] = self.EN.index(en)
        self._name_re = re.compile(r'\b(' + '|'.join(sorted((re.escape(k) for k in self.names), key=len, reverse=True)) + r')\b')
        self._index()

    def _load(self, tid):
        books = {}
        d = os.path.join(BIBLES, tid)
        for b in range(1, 67):
            p = os.path.join(d, '%02d.json' % b)
            if os.path.exists(p):
                books[b - 1] = json.load(open(p, encoding='utf-8'))
        if not books:
            raise SystemExit('Bible "%s" not found in %s' % (tid, d))
        return books

    def set_english(self, tid):
        if tid != self.en_id:
            self.en = self._load(tid)
            self.en_id = tid

    def _index(self):
        import math
        self.verses = []          # (book, chapter, verse, token list)
        df = {}
        for b, chs in self.af.items():
            for c, vs in enumerate(chs):
                for v, text in enumerate(vs):
                    toks = words(text)
                    if not toks:
                        continue
                    self.verses.append((b, c + 1, v + 1, toks))
                    for t in set(toks):
                        df[t] = df.get(t, 0) + 1
        n = len(self.verses)
        self.idf = {t: math.log(n / k) for t, k in df.items()}
        self.inv = {}
        for i, (_, _, _, toks) in enumerate(self.verses):
            for t in set(toks):
                if df[t] <= 400:              # rare enough to point at a verse
                    self.inv.setdefault(t, []).append(i)
        self.vw = [sum(self.idf[t] for t in set(toks)) for (_, _, _, toks) in self.verses]

    def ref_text(self, b, c, v1, v2=None):
        name = self.EN[b]
        return '%s %d:%d' % (name, c, v1) + ('-%d' % v2 if v2 and v2 != v1 else '')

    def english(self, b, c, v1, v2=None):
        try:
            vs = self.en[b][c - 1]
            text = ' '.join(vs[v - 1] for v in range(v1, (v2 or v1) + 1) if 0 < v <= len(vs))
            return lord(text) if self.en_id == 'web' else text
        except (KeyError, IndexError):
            return ''

    def match(self, af_sentence, min_words=6):
        """A quote of one verse (or two running verses): (book, chapter, v1, v2, score) or None.

        Weighted overlap of words: most of the sentence must be in the verse(s), and most of the verse(s) in the
        sentence, so a sermon line that only shares a few Bible words is not taken for a quote."""
        toks = words(af_sentence)
        if len(toks) < min_words:
            return None
        sset = set(toks)
        sw = sum(self.idf.get(t, 8.0) for t in sset)
        votes = {}
        for t in sset:
            for i in self.inv.get(t, ()):
                votes[i] = votes.get(i, 0) + self.idf[t]
        if not votes:
            return None
        best = None
        for i, _ in sorted(votes.items(), key=lambda kv: -kv[1])[:40]:
            for span in (1, 2):
                if i + span > len(self.verses):
                    continue
                group = self.verses[i:i + span]
                if span == 2 and (group[1][0] != group[0][0] or group[1][1] != group[0][1]):
                    continue
                vset = set(t for g in group for t in g[3])
                both = sum(self.idf.get(t, 8.0) for t in sset & vset)
                vw = sum(self.idf[t] for t in vset)
                cover_s, cover_v = both / sw, both / vw
                # a whole verse, or most of a sentence that is clearly part of one verse (a partial quote)
                if (cover_s >= 0.72 and cover_v >= 0.55) or (cover_s >= 0.9 and cover_v >= 0.35 and len(sset & vset) >= 7):
                    score = 2 * both / (sw + vw)
                    if not best or score > best[4]:
                        best = (group[0][0], group[0][1], group[0][2], group[-1][2], score)
        return best

    def refs(self, af_sentence):
        """References the preacher names: "Johannes drie vers sestien", "Johannes 3:16", "Romeine hoofstuk 8 verse 28 tot 30"."""
        f = ' '.join(words(af_sentence.replace(':', ' vers ')))
        out = []
        for m in self._name_re.finditer(f):
            b = self.names[m.group(1)]
            rest = f[m.end():].split()[:9]
            nums, kinds, j = [], [], 0
            while j < len(rest) and len(nums) < 3:
                w = rest[j]
                if w in ('hoofstuk', 'vers', 'verse', 'tot', 'en'):
                    kinds.append(w); j += 1; continue
                n = None
                if j + 2 < len(rest) and rest[j + 1] == 'en':                   # "agt-en-twintig", "drie en twintig"
                    n = af_number(w + 'en' + rest[j + 2])
                    if n is not None:
                        j += 2
                if n is None:
                    n = af_number(w)
                if n is None:
                    break
                nums.append(n); j += 1
            if not nums:
                continue
            c = nums[0]
            if b not in self.af or c < 1 or c > len(self.af[b]):
                continue
            v1 = nums[1] if len(nums) > 1 else None
            v2 = nums[2] if len(nums) > 2 and 'tot' in kinds else None
            if v1 and not (0 < v1 <= len(self.af[b][c - 1])):
                v1 = None
            if v2 and not (v1 and v1 < v2 <= len(self.af[b][c - 1])):
                v2 = None
            q = self.EN[b] + ' %d' % c + (':%d' % v1 if v1 else '') + ('-%d' % v2 if v2 else '')
            out.append(q)
        return out


HYMN_RE = re.compile(r'\b(?:gesang|lied|lofsang|himne|hymn)(?:\s+(?:nommer|no|nr))?\s+([a-z0-9-]+(?:\s+en\s+[a-z]+)?)')


def hymns_named(af_sentence):
    out = []
    for m in HYMN_RE.finditer(fold(af_sentence)):
        tok = m.group(1).replace(' en ', 'en')
        n = af_number(tok)
        if n and 0 < n <= 920:
            out.append(n)
    return out


# ---------------------------------------------------------------------------------------------- Adventist words
class Glossary:
    def __init__(self, path=os.path.join(HERE, 'glossary.json')):
        g = json.load(open(path, encoding='utf-8'))
        self.prompt = g.get('prompt', '')
        terms = sorted(g.get('terms', {}).items(), key=lambda kv: -len(kv[0]))
        self.terms = [(re.compile(r'(?<!\w)' + re.escape(a) + r'(?!\w)', re.I), e) for a, e in terms]
        self.fixes = list(g.get('fixes', {}).items())
        self.drop = [d.lower() for d in g.get('drop', [])]

    def before(self, af):
        for rx, en in self.terms:
            af = rx.sub(en, af)
        return af

    def after(self, en):
        for a, b in self.fixes:
            en = en.replace(a, b)
        return re.sub(r'\s+', ' ', en).strip()

    def junk(self, af):
        low = af.lower()
        return any(d in low for d in self.drop)


# ---------------------------------------------------------------------------------------------- models
def cuda():
    try:
        import ctranslate2
        return ctranslate2.get_cuda_device_count() > 0
    except Exception:
        return False


def find_asr(choice=None):
    if choice and os.path.isdir(choice):
        return choice
    for s in ([choice] if choice else ASR_SIZES):
        p = os.path.join(MODELS, 'fluister-' + s)
        if os.path.isdir(p):
            return p
    raise SystemExit('No speech model. Run:  python livetranslate.py get-models')


def find_mt(choice=None):
    if choice and os.path.isdir(choice):
        return choice
    for n in ('opus-mt-af-en-sda', 'opus-mt-af-en'):      # the Bible-tuned one (finetune_mt.py) first
        p = os.path.join(MODELS, n)
        if os.path.isdir(p):
            return p
    raise SystemExit('No translation model. Run:  python livetranslate.py get-models')


class Recogniser:
    def __init__(self, path, beam=5, threads=0):
        from faster_whisper import WhisperModel
        gpu = cuda()
        self.device = 'cuda' if gpu else 'cpu'
        self.compute = 'int8_float16' if gpu else 'int8'
        if not threads:
            threads = max(1, (os.cpu_count() or 2) - 1)
        self.model = WhisperModel(path, device=self.device, compute_type=self.compute, cpu_threads=threads)
        self.path, self.beam, self.max_beam = path, beam, beam

    def __call__(self, audio, prompt):
        segs, _ = self.model.transcribe(
            audio, language='af', task='transcribe', beam_size=self.beam, initial_prompt=prompt or None,
            condition_on_previous_text=False, vad_filter=False, without_timestamps=True,
            temperature=(0.0, 0.2, 0.4, 0.6), compression_ratio_threshold=2.2, log_prob_threshold=-1.0,
            no_speech_threshold=0.6, repetition_penalty=1.05)
        out = []
        for s in segs:
            if s.no_speech_prob > 0.6 and s.avg_logprob < -0.8:
                continue
            out.append(s.text.strip())
        return ' '.join(t for t in out if t)


class Translator:
    def __init__(self, path):
        import ctranslate2, sentencepiece as spm
        gpu = cuda()
        self.tr = ctranslate2.Translator(path, device='cuda' if gpu else 'cpu', compute_type='int8_float16' if gpu else 'int8',
                                         inter_threads=1, intra_threads=2)
        self.src = spm.SentencePieceProcessor(model_file=os.path.join(path, 'source.spm'))
        self.tgt = spm.SentencePieceProcessor(model_file=os.path.join(path, 'target.spm'))
        self.path = path

    def __call__(self, sentences):
        if not sentences:
            return []
        toks = [self.src.encode(s, out_type=str) + ['</s>'] for s in sentences]
        res = self.tr.translate_batch(toks, beam_size=5, max_decoding_length=256, repetition_penalty=1.1)
        return [self.tgt.decode(r.hypotheses[0]).replace('▁', ' ').strip() for r in res]


# ---------------------------------------------------------------------------------------------- cutting at pauses
class Cutter:
    """Collects 16 kHz audio and hands over pieces that end at a pause (Silero VAD, bundled with faster-whisper).

    A piece ends after >= 0.6 s of silence; pieces are kept between 1 s and 14 s (a long run without a pause is cut
    at its quietest moment). Silence between pieces is thrown away, so nothing is recognised twice."""

    def __init__(self, max_s=14.0, pause_s=0.6):
        import numpy as np
        from faster_whisper.vad import get_speech_timestamps, VadOptions
        self.np, self.gst = np, get_speech_timestamps
        self.opts = VadOptions(threshold=0.5, min_speech_duration_ms=200, min_silence_duration_ms=int(pause_s * 1000), speech_pad_ms=200)
        self.buf = np.zeros(0, dtype=np.float32)
        self.max_n, self.pause_n = int(max_s * SR), int(pause_s * SR)
        self.since = 0

    def feed(self, chunk):
        self.buf = self.np.concatenate([self.buf, chunk.astype(self.np.float32)])
        self.since += len(chunk)
        if self.since < SR // 2 and len(self.buf) < self.max_n:     # look every half second
            return []
        self.since = 0
        return self._cut(final=False)

    def flush(self):
        return self._cut(final=True)

    def _cut(self, final):
        out = []
        while len(self.buf):
            ts = self.gst(self.buf, self.opts)
            if not ts:
                self.buf = self.buf[-SR // 2:] if not final else self.buf[:0]   # only silence (or organ): drop it
                break
            end = ts[-1]['end']
            if final:
                out.append(self.buf[ts[0]['start']:end]); self.buf = self.buf[:0]; break
            if len(self.buf) - end >= self.pause_n and end - ts[0]['start'] >= SR:
                # the last speech has ended: everything up to its end is one piece (earlier pauses joined: fewer, fuller sentences)
                out.append(self.buf[ts[0]['start']:end]); self.buf = self.buf[end:]; continue
            if len(self.buf) >= self.max_n:
                gaps = [(ts[i + 1]['start'] - ts[i]['end'], ts[i]['end']) for i in range(len(ts) - 1)]
                cut = max(gaps)[1] if gaps else self._quietest()
                out.append(self.buf[ts[0]['start'] if ts[0]['start'] < cut else 0:cut]); self.buf = self.buf[cut:]; continue
            break
        return [p for p in out if len(p) >= SR // 2]

    def _quietest(self):
        np = self.np
        lo, hi = int(self.max_n * 0.6), len(self.buf) - SR // 10
        win = SR // 20
        frames = self.buf[lo:hi][: (hi - lo) // win * win].reshape(-1, win)
        return lo + int(np.argmin((frames ** 2).mean(axis=1))) * win + win // 2


# ---------------------------------------------------------------------------------------------- the pipeline
SENT_END = re.compile(r'(?<=[.!?])\s+(?=[A-ZÀ-Ý"\'“‘(0-9])')


class Pipeline:
    """pieces of audio -> Afrikaans sentences -> captions. Recognition and translation run on their own threads."""

    def __init__(self, asr, mt, bible, gloss, emit):
        self.asr, self.mt, self.bible, self.gloss, self.emit = asr, mt, bible, gloss, emit
        self.audio_q, self.text_q = queue.Queue(), queue.Queue()
        self.pending, self.pending_t, self.context = '', 0.0, ''
        self.stats = {'audio_s': 0.0, 'asr_s': 0.0, 'mt_s': 0.0, 'lines': 0, 'verses': 0}
        self._stop = False
        threading.Thread(target=self._asr_loop, daemon=True).start()
        threading.Thread(target=self._mt_loop, daemon=True).start()

    def push(self, piece):
        self.audio_q.put(piece)

    def finish(self):
        self.audio_q.put(None)

    def _asr_loop(self):
        while True:
            try:
                piece = self.audio_q.get(timeout=1.0)
            except queue.Empty:
                # the preacher paused after words without a full stop: show them rather than wait for more
                if self.pending and time.time() - self.pending_t > 2.5:
                    self._sentences(flush=True)
                continue
            if piece is None:
                self._sentences(flush=True); self.text_q.put(None); return
            # falling behind (more than ~2 pieces waiting): lighter search until caught up, then full quality again
            self.asr.beam = 2 if self.audio_q.qsize() >= 2 else self.asr.max_beam
            t0 = time.time()
            prompt = (self.gloss.prompt + ' ' + self.context[-200:]).strip()
            text = self.asr(piece, prompt)
            self.stats['asr_s'] += time.time() - t0
            self.stats['audio_s'] += len(piece) / SR
            if not text or self.gloss.junk(text):
                continue
            self.pending = (self.pending + ' ' + text).strip()
            self.pending_t = self.pending_t or time.time()
            self._sentences(flush=self.audio_q.empty() and (len(self.pending) > 160 or time.time() - self.pending_t > 8))

    def _sentences(self, flush):
        parts = SENT_END.split(self.pending)
        done, rest = parts[:-1], parts[-1]
        if rest and (flush or re.search(r'[.!?]["”’)]?$', rest) or len(rest) > 260):
            done.append(rest); rest = ''
        self.pending = rest
        if not rest:
            self.pending_t = 0.0
        for s in done:
            s = s.strip()
            if len(s) > 1:
                self.context = (self.context + ' ' + s)[-400:]
                self.text_q.put(s)

    def _mt_loop(self):
        while True:
            s = self.text_q.get()
            if s is None:
                self.emit('done', dict(self.stats)); return
            batch = [s]
            while not self.text_q.empty() and len(batch) < 4:
                n = self.text_q.get()
                if n is None:
                    self.text_q.put(None); break
                batch.append(n)
            for af in batch:
                for q in self.bible.refs(af):
                    self.emit('ref', {'q': q, 'af': af})
                for n in hymns_named(af):
                    self.emit('hymn', {'n': n, 'af': af})
            quotes = [self.bible.match(af) for af in batch]
            todo = [i for i, q in enumerate(quotes) if not q]
            t0 = time.time()
            ens = self.mt([self.gloss.before(batch[i]) for i in todo]) if todo else []
            self.stats['mt_s'] += time.time() - t0
            en_by = dict(zip(todo, ens))
            for i, af in enumerate(batch):
                line = {'af': af, 't': time.time()}
                q = quotes[i]
                if q:
                    b, c, v1, v2, score = q
                    line['verse'] = {'ref': self.bible.ref_text(b, c, v1, v2), 'text': self.bible.english(b, c, v1, v2), 'score': round(score, 2)}
                    line['en'] = line['verse']['text']
                    self.stats['verses'] += 1
                else:
                    line['en'] = self.gloss.after(en_by.get(i, ''))
                self.stats['lines'] += 1
                self.emit('line', line)


# ---------------------------------------------------------------------------------------------- microphone
class Mic:
    def __init__(self, device, on_audio):
        import numpy as np, sounddevice as sd
        info = sd.query_devices(device, 'input')
        rate = int(info['default_samplerate'])
        try:
            sd.check_input_settings(device=device, samplerate=SR, channels=1); rate = SR
        except Exception:
            pass
        self.rate, self.name = rate, info['name']
        if rate != SR:
            from scipy.signal import resample_poly
            from math import gcd
            g = gcd(SR, rate); up, down = SR // g, rate // g
            conv = lambda x: resample_poly(x, up, down).astype(np.float32)
        else:
            conv = lambda x: x
        def cb(indata, frames, t, status):
            on_audio(conv(indata[:, 0].copy()))
        self.stream = sd.InputStream(device=device, channels=1, samplerate=rate, dtype='float32', blocksize=rate // 10, callback=cb)
        self.stream.start()

    def close(self):
        try:
            self.stream.stop(); self.stream.close()
        except Exception:
            pass


def input_devices():
    import sounddevice as sd
    out = []
    for i, d in enumerate(sd.query_devices()):
        if d['max_input_channels'] > 0:
            out.append({'id': i, 'name': d['name'], 'default': i == sd.default.device[0]})
    return out


# ---------------------------------------------------------------------------------------------- server for SDA Sabbath
ORIGIN_OK = re.compile(r'^(https://leemcq\.github\.io|https?://(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?)$')


class Hub:
    def __init__(self, args, engines=None):
        self.args, self.clients, self.lock = args, [], threading.Lock()
        self.recent = []
        self.mic = self.pipe = self.cutter = None
        self.device = args.device
        self.error = ''
        if engines:
            self.asr, self.mt, self.bible, self.gloss = engines
        else:
            log('Loading the Bible and word list…')
            self.bible, self.gloss = Bible(args.english), Glossary()
            log('Loading the speech model', find_asr(args.asr), '…')
            self.asr = Recogniser(find_asr(args.asr), beam=args.beam)
            log('Loading the translation model', find_mt(args.mt), '…')
            self.mt = Translator(find_mt(args.mt))
            self.asr(__import__('numpy').zeros(SR, dtype='float32'), '')     # warm up: the first sentence is not slow
            log('Ready on %s (%s, %s).' % (self.asr.device, os.path.basename(self.asr.path), self.asr.compute))

    def emit(self, kind, data):
        msg = 'event: %s\ndata: %s\n\n' % (kind, json.dumps(data, ensure_ascii=False))
        if kind == 'line':
            self.recent = (self.recent + [data])[-30:]
            log('AF:', data['af']); log('EN:', data['en'] + ('   [%s]' % data['verse']['ref'] if data.get('verse') else ''))
        with self.lock:
            for q in self.clients:
                q.put(msg)

    def start(self, device=None):
        self.stop()
        if device is not None:
            self.device = device
        self.cutter = Cutter()
        self.pipe = Pipeline(self.asr, self.mt, self.bible, self.gloss, self.emit)
        def on_audio(x):
            for p in self.cutter.feed(x):
                self.pipe.push(p)
        try:
            self.mic = Mic(self.device, on_audio)
            self.error = ''
            log('Listening on', self.mic.name)
        except Exception as e:
            self.error = 'Could not open the sound input: %s' % e
            self.pipe = None
            raise
        self.emit('status', self.status())

    def stop(self):
        if self.mic:
            self.mic.close(); self.mic = None
            for p in self.cutter.flush():
                self.pipe.push(p)
            self.pipe.finish()
        self.pipe = None
        self.emit('status', {'running': False})

    def status(self):
        st = self.pipe.stats if self.pipe else {}
        rtf = round(st['asr_s'] / st['audio_s'], 2) if st and st.get('audio_s') else None
        try:
            devs = input_devices()
        except Exception:
            devs = []
        return {'ok': True, 'app': 'sda-sabbath-translator', 'version': VERSION, 'running': bool(self.mic),
                'device': self.mic.name if self.mic else None, 'devices': devs, 'error': self.error,
                'asr': os.path.basename(getattr(self.asr, 'path', 'demo')), 'mt': os.path.basename(getattr(self.mt, 'path', 'demo')),
                'hw': getattr(self.asr, 'device', 'cpu'), 'english': self.bible.en_id, 'rtf': rtf,
                'behind': self.pipe.audio_q.qsize() if self.pipe else 0}


def make_handler(hub):
    class H(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def _cors(self):
            o = self.headers.get('Origin', '')
            if o and ORIGIN_OK.match(o):
                self.send_header('Access-Control-Allow-Origin', o)
                self.send_header('Vary', 'Origin')
                self.send_header('Access-Control-Allow-Private-Network', 'true')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

        def _json(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
            self.send_response(code); self._cors()
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204); self._cors(); self.send_header('Content-Length', '0'); self.end_headers()

        def do_GET(self):
            o = self.headers.get('Origin', '')
            if o and not ORIGIN_OK.match(o):
                return self._json(403, {'ok': False, 'error': 'origin not allowed'})
            if self.path.startswith('/status'):
                return self._json(200, hub.status())
            if self.path.startswith('/recent'):
                return self._json(200, hub.recent)
            if self.path.startswith('/events'):
                q = queue.Queue()
                with hub.lock:
                    hub.clients.append(q)
                self.send_response(200); self._cors()
                self.send_header('Content-Type', 'text/event-stream'); self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive'); self.end_headers()
                try:
                    self.wfile.write(('event: status\ndata: %s\n\n' % json.dumps(hub.status())).encode()); self.wfile.flush()
                    while True:
                        try:
                            msg = q.get(timeout=15)
                        except queue.Empty:
                            msg = ': keep-alive\n\n'
                        self.wfile.write(msg.encode('utf-8')); self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError, OSError):
                    pass
                finally:
                    with hub.lock:
                        if q in hub.clients:
                            hub.clients.remove(q)
                return
            self._json(404, {'ok': False})

        def do_POST(self):
            o = self.headers.get('Origin', '')
            if o and not ORIGIN_OK.match(o):                # a web page elsewhere cannot start the microphone
                return self._json(403, {'ok': False, 'error': 'origin not allowed'})
            n = int(self.headers.get('Content-Length') or 0)
            try:
                body = json.loads(self.rfile.read(n) or b'{}')
            except ValueError:
                body = {}
            try:
                if self.path.startswith('/start'):
                    hub.start(body.get('device'))
                elif self.path.startswith('/stop'):
                    hub.stop()
                elif self.path.startswith('/config'):
                    if body.get('english') in ('web', 'kjv'):
                        hub.bible.set_english(body['english'])
                else:
                    return self._json(404, {'ok': False})
            except Exception as e:
                return self._json(500, {'ok': False, 'error': str(e)})
            self._json(200, hub.status())
    return H


def serve(args, engines=None):
    hub = Hub(args, engines)
    srv = ThreadingHTTPServer(('0.0.0.0' if args.lan else '127.0.0.1', args.port), make_handler(hub))
    srv.daemon_threads = True
    log('SDA Sabbath translator %s on http://%s:%d  (Ctrl+C to stop)' % (VERSION, '0.0.0.0' if args.lan else '127.0.0.1', args.port))
    if args.autostart:
        try:
            hub.start(args.device)
        except Exception as e:
            log(hub.error or e)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        hub.stop()
    return hub


# ---------------------------------------------------------------------------------------------- demo engines
class DemoASR:
    device, compute, path, beam, max_beam = 'cpu', 'demo', 'demo', 5, 5
    LINES = ['Broers en susters, ons lees vandag uit Johannes hoofstuk drie vers sestien.',
             'Want so lief het God die wêreld gehad, dat Hy sy eniggebore Seun gegee het, sodat elkeen wat in Hom glo, nie verlore mag gaan nie, maar die ewige lewe kan hê.',
             'Die Sabbat is \'n geskenk van God aan ons.',
             'Kom ons sing saam gesang nommer honderd.']
    def __init__(self):
        self.i = 0
    def __call__(self, audio, prompt):
        s = self.LINES[self.i % len(self.LINES)]; self.i += 1; return s


class DemoMT:
    path = 'demo'
    def __call__(self, sents):
        return ['[English] ' + s for s in sents]


def demo(args):
    import numpy as np
    hub = Hub(args, (DemoASR(), DemoMT(), Bible(args.english), Glossary()))
    class FakeMic:
        name = 'demo'
        def __init__(self, dev, cb):
            self.on = True
            def run():
                while self.on:
                    time.sleep(args.every)
                    if self.on and hub.pipe:
                        hub.pipe.push(np.zeros(SR, dtype=np.float32))
            threading.Thread(target=run, daemon=True).start()
        def close(self):
            self.on = False
    global Mic
    Mic = FakeMic
    srv = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(hub)); srv.daemon_threads = True
    log('Demo translator on http://127.0.0.1:%d (fake captions every %.0f s once started)' % (args.port, args.every))
    if args.autostart:
        hub.start(None)
    srv.serve_forever()


# ---------------------------------------------------------------------------------------------- bench
def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev, d[j] = d[j], cur
    return d[len(h)] / max(1, len(r))


def load_audio(path):
    import numpy as np, soundfile as sf
    x, rate = sf.read(path, dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if rate != SR:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(SR, rate); x = resample_poly(x, SR // g, rate // g).astype(np.float32)
    return x


def bench(args):
    audio = load_audio(args.file)
    bible, gloss = Bible(args.english), Glossary()
    asr = Recogniser(find_asr(args.asr), beam=args.beam); mt = Translator(find_mt(args.mt))
    asr(__import__('numpy').zeros(SR, dtype='float32'), '')
    lines, done = [], threading.Event()
    def emit(kind, data):
        if kind == 'line': lines.append(data); log('EN:', data['en'][:100])
        elif kind == 'done': done.set()
    pipe = Pipeline(asr, mt, bible, gloss, emit); pipe.asr.max_beam = args.beam
    cut = Cutter()
    for i in range(0, len(audio), SR // 10):
        for p in cut.feed(audio[i:i + SR // 10]):
            pipe.push(p)
            while pipe.audio_q.qsize() > 0:         # a recording is not live: recognise every piece at full quality
                time.sleep(0.01)
    for p in cut.flush():
        pipe.push(p)
    pipe.finish(); done.wait()
    st = pipe.stats
    af_all = ' '.join(l['af'] for l in lines)
    name = os.path.splitext(os.path.basename(args.file))[0]
    out = os.path.join(os.path.dirname(os.path.abspath(args.file)), name + '.translation.md')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('# %s — %s + %s\n\n' % (name, os.path.basename(asr.path), os.path.basename(mt.path)))
        f.write('| | |\n|---|---|\n')
        f.write('| Recording | %.1f min |\n| Speech recognised | %.1f min |\n' % (len(audio) / SR / 60, st['audio_s'] / 60))
        f.write('| Recognition time | %.0f s (%.2f × real time; under 0.8 keeps up live) |\n' % (st['asr_s'], st['asr_s'] / max(1, st['audio_s'])))
        f.write('| Translation time | %.1f s |\n| Sentences | %d (%d shown as the Bible verse) |\n' % (st['mt_s'], st['lines'], st['verses']))
        f.write('| Hardware | %s, %s |\n' % (asr.device, asr.compute))
        if args.ref:
            f.write('| Word error rate (Afrikaans) | %.1f %% |\n' % (100 * wer(open(args.ref, encoding='utf-8').read(), af_all)))
        f.write('\n| # | Afrikaans (heard) | English (shown) |\n|---|---|---|\n')
        for i, l in enumerate(lines, 1):
            en = l['en'] + (' **[%s]**' % l['verse']['ref'] if l.get('verse') else '')
            f.write('| %d | %s | %s |\n' % (i, l['af'].replace('|', '/'), en.replace('|', '/')))
    with open(os.path.splitext(out)[0] + '.af.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(l['af'] for l in lines) + '\n')
    print('\nRecognition %.2f × real time (%s). %d sentences, %d Bible verses. Report: %s' % (
        st['asr_s'] / max(1, st['audio_s']), 'keeps up live' if st['asr_s'] / max(1, st['audio_s']) < 0.8 else 'too slow for live: try --asr small',
        st['lines'], st['verses'], out))
    if args.ref:
        print('Word error rate: %.1f %%' % (100 * wer(open(args.ref, encoding='utf-8').read(), af_all)))


# ---------------------------------------------------------------------------------------------- downloads
def get_models(args):
    os.makedirs(MODELS, exist_ok=True)
    from huggingface_hub import snapshot_download
    for size in args.asr:
        dst = os.path.join(MODELS, 'fluister-' + size)
        log('Downloading Fluister %s (Afrikaans Whisper, MIT licence) …' % size)
        snapshot_download('digiphyte/fluister-' + size, local_dir=dst)
    dst = os.path.join(MODELS, 'opus-mt-af-en')
    if not os.path.isdir(dst):
        import tempfile, urllib.request, zipfile, shutil, ctranslate2
        tmp = tempfile.mkdtemp()
        try:
            log('Downloading OPUS-MT af-en (Apache 2.0) …')
            z = os.path.join(tmp, 'm.zip'); urllib.request.urlretrieve(OPUS_ZIP, z)
            zipfile.ZipFile(z).extractall(os.path.join(tmp, 'm'))
            ctranslate2.converters.OpusMTConverter(os.path.join(tmp, 'm')).convert(dst, quantization='int8')
            for f in ('source.spm', 'target.spm'):
                shutil.copy(os.path.join(tmp, 'm', f), dst)
        except Exception as e:
            log('Direct OPUS-MT download failed (%s); trying Hugging Face (needs: pip install transformers torch) …' % e)
            src = snapshot_download('Helsinki-NLP/opus-mt-af-en', local_dir=os.path.join(tmp, 'hf'))
            ctranslate2.converters.TransformersConverter(src, copy_files=['source.spm', 'target.spm']).convert(dst, quantization='int8')
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    log('Models ready in', MODELS)


def main(argv=None):
    ap = argparse.ArgumentParser(description='SDA Sabbath live translation (Afrikaans → English, offline)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    def common(p):
        p.add_argument('--asr', help='speech model: turbo, small, base, large-v3 or a folder (default: best downloaded)')
        p.add_argument('--mt', help='translation model folder')
        p.add_argument('--english', default='web', choices=['web', 'kjv'], help='English Bible for quotes (default WEB)')
        p.add_argument('--beam', type=int, default=5, help='search width: 5 most accurate, 2 faster')
    g = sub.add_parser('get-models'); g.add_argument('--asr', nargs='+', default=['turbo', 'small'], choices=ASR_SIZES)
    sub.add_parser('devices')
    s = sub.add_parser('serve'); common(s)
    s.add_argument('--device', type=int, default=None, help='sound input number (see: devices)')
    s.add_argument('--port', type=int, default=7790); s.add_argument('--lan', action='store_true', help='also reachable from other PCs')
    s.add_argument('--autostart', action='store_true', help='start listening immediately')
    b = sub.add_parser('bench'); common(b); b.add_argument('file'); b.add_argument('--ref', help='correct Afrikaans text, for the word error rate')
    d = sub.add_parser('demo'); d.add_argument('--port', type=int, default=7790); d.add_argument('--english', default='web')
    d.add_argument('--every', type=float, default=4.0); d.add_argument('--autostart', action='store_true')
    d.add_argument('--device', type=int, default=None); d.add_argument('--asr'); d.add_argument('--mt'); d.add_argument('--beam', type=int, default=5)
    d.add_argument('--lan', action='store_true')
    a = ap.parse_args(argv)
    if a.cmd == 'get-models':
        get_models(a)
    elif a.cmd == 'devices':
        for d in input_devices():
            print('%3d  %s%s' % (d['id'], d['name'], '   (default)' if d['default'] else ''))
    elif a.cmd == 'serve':
        serve(a)
    elif a.cmd == 'bench':
        bench(a)
    elif a.cmd == 'demo':
        demo(a)


if __name__ == '__main__':
    main()
