// Verse and hymn suggestions while the service runs (Advanced mode).
// The browser's speech recogniser turns what is said into text. Bible verses and hymns (by number or by name:
// "let us sing Great Is Thy Faithfulness") are offered to the operator as cards ("John 3:16 — Put on Next /
// Present"). While a hymn is on screen it also follows the singing and offers the stanza being sung.
// Nothing ever goes on screen by itself.
// Two ways to hear (Tools → Listen → Hear with):
//   Offline translator – the SDA Sabbath translator on this PC (Tools → Listen & Translate) already turns the Afrikaans
//                        sermon into sentences offline; its sentences, the Bible quotes it recognises (the verse
//                        itself, even when no reference is said) and the references and hymn numbers it finds
//                        become cards here.
//   Browser (online)   – Chrome and Edge send the audio to their own speech service, so this needs the internet.
// Automatic uses the translator when it is running on this PC, otherwise the browser. Off by default.
import { h, clear } from './core/util.js';
import { icon } from './core/icons.js';
import { settings } from './core/settings.js';
import { findRefs, findHymnTitle, stanzaScores } from './core/spokenref.js';
import { live } from './core/live.js';
import { parseRef, refText, EN, AF } from './core/books.js';
import { versesFor, verseText } from './core/bibledata.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const KEEP_MS = 3 * 60 * 1000;   // a suggestion disappears after three minutes
const REPEAT_MS = 90 * 1000;     // the same reference is not offered again within 90 seconds
const MAX_CARDS = 3;

export function createListener({ ctx, getTab, present, ui }) {
  let on = false, rec = null, restartT = null, problem = '', testing = false;
  let source = '';        // 'offline' (the translator on this PC) or 'browser' while listening
  let cap = null;         // the translator client (js/core/livecaptions.js), loaded when first needed
  let startedTranslator = false, capOff = null;
  // Live translation → Suggestions: the translator's finds become cards here even while Listen itself is off.
  const fromLive = () => !!(settings.v.captions && settings.v.captions.on && settings.v.captions.suggest !== false);
  const active = () => on || testing || fromLive();
  const seen = new Map(); // key -> time offered
  const cards = [];       // { key, el, t }
  let hyApi = null;       // the Hymns tab, once loaded (its hymn list is used to find hymns announced by name)
  let music = null;       // hymn music: while it plays, the slides already follow the music
  let sung = '';          // what was heard while the hymn on screen was sung (for following the singing)
  let follow = null;      // { el, i } the "being sung now" card
  const loadHelpers = () => {
    if (!hyApi) getTab('hymns').then(async (t) => { await t.whenReady(); hyApi = t; }).catch(() => {});
    if (!music) import('./core/hymnmusic.js').then((m) => { music = m.music; }).catch(() => {});
  };

  const head = h('div.ls-head');
  const list = h('div.ls-list', { 'aria-live': 'polite' });
  const box = h('div.listen-box', { 'aria-label': 'Verse and hymn suggestions' }, head, list);

  const lang = () => (settings.v.bible.primary === 'afr53' ? 'af-ZA' : 'en-ZA');
  const afr = () => lang() === 'af-ZA';

  const watchers = new Set(); // Tools → Listen repaints when listening starts or stops
  function paintHead() {
    clear(head);
    box.classList.toggle('on', on);
    box.hidden = !on && !list.children.length; // switched on and off in Tools → Listen
    box.classList.toggle('has-cards', !!list.children.length);
    watchers.forEach((fn) => { try { fn(); } catch (e) { /* */ } });
    if (!on) {
      // Cards from Live translation → Suggestions while Listen itself is off.
      if (list.children.length) head.append(h('span.ls-dot.live-tr', { 'aria-hidden': 'true' }), h('span.ls-state', 'From the live translation'),
        h('button.btn.sm.ls-stop', { type: 'button', title: 'Dismiss all suggestions', onclick: () => clearAll() }, icon('x'), h('span', 'Clear')));
      return;
    }
    head.append(
      h('span.ls-dot', { 'aria-hidden': 'true' }),
      h('span.ls-state', problem || ((cards.length ? 'Listening' : 'Listening for verses and hymns…') + (source === 'offline' ? ' (offline)' : ''))),
      h('button.btn.sm.ls-stop', { type: 'button', title: 'Stop listening', onclick: () => stop() }, icon('x'), h('span', 'Stop')));
  }

  // ------------------------------------------------------------ speech
  const pref = () => settings.v.app.listenSource || 'auto';
  async function translator() {
    if (!cap) { const m = await import('./core/livecaptions.js'); m.initCaptions(ctx); cap = m.captions; }
    return cap;
  }
  /** Which ears to use now: 'offline', 'browser', or null (with the reason shown). */
  async function pickSource() {
    if (pref() !== 'browser') {
      let up = false;
      try { await (await translator()).status(); up = true; } catch (e) { up = false; }
      if (up) return 'offline';
      if (pref() === 'offline') {
        ui.toast('The offline translator is not running on this PC. Start it with the “SDA Sabbath translator” shortcut on the desktop (set it up once in Tools → Listen & Translate).', 'err', 8000);
        return null;
      }
    }
    if (!SR) {
      ui.toast('This browser cannot listen, and the offline translator is not running on this PC. Use Chrome or Edge, or start the translator (Tools → Listen & Translate).', 'err', 8000);
      return null;
    }
    return 'browser';
  }
  let starting = false;
  async function start() {
    if (on || starting) return;
    starting = true;
    try {
      const src = await pickSource();
      if (!src) return;
      if (src === 'browser' && !settings.v.app.listenOk) { explain(); return; }
      on = true; problem = ''; source = src;
      loadHelpers();
      if (src === 'browser') begin(); else await beginOffline();
      paintHead();
    } finally { starting = false; }
  }
  function explain() {
    ui.modal({
      title: 'Listen for verses and hymns',
      body: h('div.col', { style: { gap: '10px' } },
        h('p', 'Church Service listens through the microphone. When a Bible verse or a hymn is mentioned (by number, “hymn 100”, or by name, “let us sing Great Is Thy Faithfulness”), it is offered here. While a hymn is on the screen it also follows the singing and offers the stanza being sung.'),
        h('p', 'You choose whether to put it on Next or show it. Nothing goes on the screen by itself.'),
        h('p.note', 'The offline translator is not running on this PC, so the browser listens instead: it turns speech into text with its own online speech service (Google for Chrome, Microsoft for Edge), so it needs the internet while it listens. It only listens while “Listening” shows, and you can stop it at any time.'),
        h('p.note', 'Language: ' + (afr() ? 'Afrikaans' : 'English') + ' (follows your main Bible in Settings).')),
      actions: [{ label: 'Cancel' }, { label: 'Start listening', primary: true, onclick: () => { settings.set('app.listenOk', true); start(); } }],
    });
  }
  function begin() {
    try {
      rec = new SR();
      rec.lang = lang();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          heard(r[0].transcript, r.isFinal);
        }
        if (problem) { problem = ''; paintHead(); }
      };
      rec.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          stop();
          ui.toast('The microphone is blocked for Church Service. Allow it with the lock icon in the address bar, then try again.', 'err', 8000);
        } else if (e.error === 'network') { problem = 'No internet: listening paused'; paintHead(); }
        else if (e.error === 'audio-capture') { problem = 'No microphone found'; paintHead(); }
      };
      // Chrome stops after a pause in speech: start again while listening is on.
      rec.onend = () => { rec = null; if (on) { clearTimeout(restartT); restartT = setTimeout(() => { if (on && !rec) begin(); }, problem ? 4000 : 300); } };
      rec.start();
    } catch (err) {
      rec = null;
      if (on) { clearTimeout(restartT); restartT = setTimeout(() => { if (on && !rec) begin(); }, 2000); }
    }
  }
  // ------------------------------------------------------------ the offline translator as the ears
  async function beginOffline() {
    const c = await translator();
    c.onEvent = fromTranslator;
    c.listen(true);
    if (capOff) capOff();
    capOff = c.on((st) => {
      const p = !st.connected ? 'Offline translator not reachable' : st.status && st.status.error ? st.status.error : '';
      if (p !== problem) { problem = p; paintHead(); }
    });
    // The translator only hears once it listens to the sound input; Live translation may already have started it.
    const st = c.state.status;
    if (!(st && st.running)) {
      const C = settings.v.captions || {};
      try { await c.start(C.device == null ? '' : C.device); startedTranslator = true; }
      catch (e) { problem = 'Translator: ' + (e.message || e); }
    }
  }
  function fromTranslator(type, d) {
    if (!on || source !== 'offline' || !d) return;
    translatorEvent(type, d);
  }
  /** One event from the translator: verses and hymns named or quoted become cards (and the singing is followed). */
  function translatorEvent(type, d) {
    if (type === 'line') {
      // A sentence that quotes the Bible arrives with the verse itself: offer it, even when no reference was said.
      if (d.verse && d.verse.ref) offerRef(d.verse.ref, d.af || d.en || '');
      if (d.af) heard(d.af, true);   // Afrikaans: "Johannes drie vers sestien", "gesang nommer 100", hymns by name, singing
      if (d.en) {
        const found = findRefs(d.en);
        found.forEach((r) => offer(r, d.en, true));
        // The English sentence may name a hymn of the (English) hymnal: "let us sing Great Is Thy Faithfulness".
        if (hyApi && !found.some((r) => r.kind === 'hymn')) {
          const c = hyApi.catalog();
          const m = findHymnTitle(d.en, c.list);
          if (m) offer({ kind: 'hymn', n: m.n, book: c.id }, d.en, true);
        }
      }
    } else if (type === 'ref' && d.q) offerRef(d.q, d.af || d.q);
    else if (type === 'hymn' && d.n) offer({ kind: 'hymn', n: +d.n }, d.af || '', true);
  }
  /** A reference as text ("John 3:16", "Johannes 3:16-18") offered like one that was heard. */
  function offerRef(q, text) {
    const pr = parseRef(q);
    if (!pr || !pr.segs.length) return;
    const g = pr.segs[0];
    offer({ kind: 'bible', book: pr.book, c: g.c1, v: g.v1, v2: g.v2 != null && g.v2 !== g.v1 ? g.v2 : null, ref: refText(EN, pr.book, pr.segs.slice(0, 1)) }, text, true);
  }

  function stop() {
    on = false; problem = '';
    sung = ''; clearFollow();
    clearTimeout(restartT);
    if (rec) { try { rec.onend = null; rec.abort(); } catch (e) { /* already stopped */ } rec = null; }
    if (source === 'offline' && cap) {
      cap.onEvent = null;
      if (capOff) { capOff(); capOff = null; }
      // Stop the translator only if Listen started it and Live translation is not using it.
      if (startedTranslator && !(settings.v.captions && settings.v.captions.on)) cap.stop().catch(() => {});
      cap.listen(false);
    }
    startedTranslator = false; source = '';
    paintHead();
  }

  // ------------------------------------------------------------ suggestions
  function heard(text, final) {
    const found = findRefs(text);
    found.forEach((r) => offer(r, text, final));
    // A hymn announced by name ("our closing hymn is Blessed Assurance"): only on the finished sentence.
    if (final && hyApi && !found.some((r) => r.kind === 'hymn')) {
      const c = hyApi.catalog();
      const m = findHymnTitle(text, c.list);
      if (m) offer({ kind: 'hymn', n: m.n, book: c.id }, text, final);
    }
    followSinging(text, final);
  }

  // ------------------------------------------------------------ following the singing
  const slideLabel = (lab) => (lab === 'T' ? 'Title' : /^C/.test(lab) ? 'Chorus' : 'Verse ' + String(lab || '').replace(/a$/, ''));
  function clearFollow() { if (follow) { follow.el.remove(); follow = null; paintHead(); } }
  live.on('live', () => { sung = ''; clearFollow(); }); // another item on screen: start listening afresh
  live.on('go', () => { if (follow && follow.i === live.index) clearFollow(); });

  function followSinging(text, final) {
    const cue = live.cue;
    if (!cue || cue.tab !== 'hymns' || !cue.cards || !active()) return;
    if (music && music.isPlaying() && music.hymnKey === cue.hymnKey) return; // the music already moves the slides
    const recent = (sung + ' ' + text).slice(-400);
    if (final) sung = recent;
    const slides = cue.cards.map((c) => (c.p && c.p.kind === 'title' ? null : c.lines));
    const { scores, best } = stanzaScores(recent, slides);
    if (best < 2) return;
    const tops = scores.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    if (tops.includes(live.index)) { clearFollow(); return; } // already showing what is sung
    const i = tops.find((x) => x > live.index) ?? tops[0]; // a chorus sung again: the next one
    if (follow && follow.i === i) return;
    clearFollow();
    const name = slideLabel(cue.labels && cue.labels[i]);
    const first = (cue.cards[i].lines || [])[0] || '';
    const el = h('article.ls-card.ls-follow',
      h('div.ls-k', icon('music'), h('span', 'Being sung now')),
      h('div.ls-ref', name),
      first ? h('div.ls-peek', first) : null,
      h('div.ls-act',
        h('button.btn.primary', { type: 'button', onclick: () => { if (live.cue === cue) live.go(i); clearFollow(); } }, icon('next'), h('span', 'Show ' + name.toLowerCase())),
        h('button.btn.icon', { type: 'button', title: 'Dismiss', 'aria-label': 'Dismiss', onclick: () => clearFollow() }, icon('x'))));
    follow = { el, i };
    list.prepend(el);
    paintHead();
  }

  async function offer(r, text, final) {
    const key = r.kind === 'hymn' ? 'h' + r.n : 'b' + String(r.ref).replace(/[–—]/g, '-'); // the translator and the browser write ranges alike
    const now = Date.now();
    if (seen.has(key) && now - seen.get(key) < REPEAT_MS) return;
    // Wait for the finished sentence before offering a whole chapter: "John 3" usually becomes "John 3:16".
    if (r.kind === 'bible' && r.v == null && !final) return;
    seen.set(key, now);
    let card = null;
    if (r.kind === 'bible') card = await bibleCard(r, text);
    else card = await hymnCard(r, text);
    if (!card || !active()) return;
    // A verse replaces the bare chapter offered a moment ago ("John 3" -> "John 3:16").
    if (r.kind === 'bible' && r.v != null) {
      const ch = 'b' + EN[r.book - 1] + ' ' + r.c;
      const old = cards.find((c) => c.key === ch && now - c.t < 20000);
      if (old) drop(old);
    }
    const entry = { key, el: card, t: now };
    entry.timer = setTimeout(() => drop(entry), KEEP_MS);
    cards.unshift(entry);
    list.prepend(card);
    while (cards.length > MAX_CARDS) drop(cards[cards.length - 1]);
    paintHead();
  }
  function clearAll() { cards.slice().forEach(drop); clearFollow(); paintHead(); }
  function drop(entry) {
    const i = cards.indexOf(entry);
    if (i >= 0) cards.splice(i, 1);
    clearTimeout(entry.timer);
    entry.el.remove();
    paintHead();
  }
  const quote = (text) => {
    const t = String(text || '').trim().replace(/\s+/g, ' ');
    return '“…' + (t.length > 70 ? t.slice(t.length - 70).replace(/^\S*\s/, '') : t) + '”';
  };

  function cardEl(kind, label, peek, text, stageIt) {
    const entry = () => cards.find((c) => c.el === el);
    const run = async (andShow) => {
      try {
        const c = await stageIt();
        if (!c) return;
        if (andShow) await present(); else ui.toast(label + ' is on Next. Press Present (F5) to show it.', 'ok', 2600);
        const e = entry(); if (e) drop(e);
      } catch (err) { ui.toast('Could not open ' + label + ': ' + err.message, 'err'); }
    };
    const el = h('article.ls-card',
      h('div.ls-k', icon(kind === 'hymn' ? 'hymn' : 'bible'), h('span', kind === 'hymn' ? 'Hymn' : 'Bible'), h('span.ls-heard', quote(text))),
      h('div.ls-ref', label),
      peek ? h('div.ls-peek', peek) : null,
      h('div.ls-act',
        h('button.btn.primary', { type: 'button', onclick: () => run(false) }, h('span', 'Put on Next')),
        h('button.btn', { type: 'button', onclick: () => run(true) }, icon('present'), h('span', 'Present')),
        h('button.btn.icon', { type: 'button', title: 'Dismiss', 'aria-label': 'Dismiss ' + label, onclick: () => { const e = entry(); if (e) drop(e); } }, icon('x'))));
    return el;
  }

  async function bibleCard(r, text) {
    const pr = parseRef(r.ref);
    if (!pr) return null;
    const tr = settings.v.bible.primary;
    let vs = [];
    try { vs = await versesFor(tr, pr.book, pr.segs); } catch (e) { vs = []; }
    if (!vs.length) return null; // no such chapter or verse: probably misheard
    const label = refText(afr() ? AF : EN, pr.book, pr.segs);
    const t = verseText(vs[0].text);
    const peek = r.v == null ? 'Whole chapter' : t.length > 120 ? t.slice(0, t.lastIndexOf(' ', 120)) + '…' : t;
    return cardEl('bible', label, peek, text, async () => (await getTab('bible')).open({ ref: r.ref }));
  }

  async function hymnCard(r, text) {
    let hy;
    try { hy = await getTab('hymns'); await hy.whenReady(); } catch (e) { return null; }
    const all = hy.lookup(r.n);
    const m = (r.book && all.find((x) => x.bookId === r.book)) || all[0];
    if (!m) return null;
    return cardEl('hymn', 'Hymn ' + m.n + ' · ' + m.t, m.book, text, async () => hy.open({ n: m.n, book: m.bookId }));
  }

  paintHead();
  return {
    el: box,
    get on() { return on; },
    get problem() { return problem; },
    get source() { return source; },
    /** Live translation → Suggestions: an event from the translator while Listen itself is not using it. */
    suggest(type, d) { if (!d || (on && source === 'offline')) return; loadHelpers(); translatorEvent(type, d); },
    /** For tests: an event as the offline translator sends it. */
    fromTranslator(type, d) { const was = [on, source]; on = true; source = 'offline'; testing = true; fromTranslator(type, d); [on, source] = was; },
    onChange(fn) { watchers.add(fn); },
    supported: !!SR,
    start, stop,
    toggle() { if (on) stop(); else start(); },
    /** For tests: offer what a sentence mentions, as if it had been heard. */
    hear(text) { testing = true; loadHelpers(); heard(text, true); },
    /** For tests: load what hymns by name and following the singing need. */
    ready: async () => { loadHelpers(); const t = await getTab('hymns'); await t.whenReady(); hyApi = t; },
  };
}
