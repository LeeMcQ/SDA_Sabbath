// Hymns tab: find a hymn by number or words, choose which stanzas to sing,
// present stanza by stanza (chorus repeated automatically).
import { h, clear, esc, debounce, normalize, readText, download } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, modal, seg, toggle, menu, toast, confirmBox, closeModal, enter, emptyState } from '../core/ui.js';
import { db } from '../core/db.js';
import { fitsText, createStage } from '../core/render.js';
import { music, INSTRUMENTS } from '../core/hymnmusic.js';
import { fmtTime } from '../core/util.js';

const CHORUS_RE = /^(chorus|refrain|koor|refrein|ikhorasi|c)\s*[:.]?\s*$/i;

/** Parse lyrics text: stanzas separated by blank lines; a stanza that starts with
 *  "Chorus:" / "Refrain:" / "Koor:" is the chorus. */
export function parseLyrics(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  const v = []; let c = null;
  blocks.forEach((b) => {
    const first = b[0];
    const m = /^(chorus|refrain|koor|refrein|ikhorasi)\s*[:.]\s*(.*)$/i.exec(first);
    if (CHORUS_RE.test(first)) c = b.slice(1);
    else if (m) c = (m[2] ? [m[2]] : []).concat(b.slice(1));
    else v.push(b.map((l) => l.replace(/^\d+[.)]\s+/, '')));
  });
  return { v, c: c && c.length ? c : null };
}
export function lyricsText(hy) {
  const parts = [];
  hy.v.forEach((s, i) => { parts.push(s.join('\n')); if (i === 0 && hy.c) parts.push('Chorus:\n' + hy.c.join('\n')); });
  return parts.join('\n\n');
}

/** Accepts our format, the Liedboek format [{number,title,lyrics}] or {songs:[...]}. */
/** Safeguard: hymn text is plain text, so turn any HTML entities left in data (&#8217; &amp; …) into characters. */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026' };
export function decodeEntities(s) {
  if (typeof s !== 'string' || s.indexOf('&') < 0) return s;
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m; }
    return Object.prototype.hasOwnProperty.call(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : m;
  });
}
const decodeDeep = (x) => (typeof x === 'string' ? decodeEntities(x) : Array.isArray(x) ? x.map(decodeDeep) : x);

function normaliseBook(j, fallbackName) {
  let hymns = [];
  const list = Array.isArray(j) ? j : j.hymns || j.songs || [];
  list.forEach((x) => {
    if (x.v) hymns.push({ n: +x.n, t: x.t, a: x.a || '', v: x.v, c: x.c || null });
    else if (x.lyrics || x.words || x.text) {
      const p = parseLyrics(x.lyrics || x.words || x.text);
      hymns.push({ n: +(x.number || x.n || x.no), t: x.title || x.t || '', a: x.author || '', v: p.v, c: p.c });
    }
  });
  hymns = hymns.filter((x) => x.n && x.v && x.v.length).sort((a, b) => a.n - b.n)
    .map((x) => Object.assign(x, { t: decodeEntities(x.t || ''), a: decodeEntities(x.a || ''), v: decodeDeep(x.v), c: x.c ? decodeDeep(x.c) : null }));
  return { id: j.id || 'book-' + Date.now().toString(36), name: j.name || fallbackName || 'Imported hymns', short: j.short || '', lang: j.lang || 'en', hymns };
}

/** Plain-text hymnbook: each hymn starts with "# 73 Holy, Holy, Holy" */
function parseTxtBook(text, name) {
  const hymns = [];
  String(text).replace(/\r/g, '').split(/^#\s*/m).forEach((chunk) => {
    const m = /^(\d+)\s*[.\-–:]?\s*(.*)\n([\s\S]*)$/.exec(chunk.trim());
    if (!m) return;
    const p = parseLyrics(m[3]);
    if (p.v.length) hymns.push({ n: +m[1], t: m[2].trim(), a: '', v: p.v, c: p.c });
  });
  return { id: 'book-' + Date.now().toString(36), name, lang: 'en', hymns };
}

export default function create(ctx) {
  const { settings, live } = ctx;
  const S = () => settings.v.hymns;
  let books = [];      // [{id,name,short,lang,hymns,builtin}]
  let book = null;     // current
  let hymn = null;     // selected
  let chosen = null;   // Set of stanza indexes to sing
  let stagedIndex = 0;
  let cue = null;
  let opening = false;

  // ------------------------------------------------------------ layout
  const bookSel = h('select.field', { 'aria-label': 'Hymnbook', onchange: () => setBook(bookSel.value) });
  const q = h('input.field.grow', { type: 'search', placeholder: 'Number or words…', 'aria-label': 'Find a hymn', inputmode: 'search',
    oninput: debounce(() => renderList(), 80),
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); e.stopPropagation();
      renderList();
      const first = listEl.querySelector('button');
      if (first) first.click();
      if (e.ctrlKey || e.metaKey) setTimeout(() => live.take(), 50);
    } });
  const padBtn = btn('', 'Number pad', () => { keypad.hidden = !keypad.hidden; }, { cls: 'sm', label: '123' });
  const keypad = h('div.keypad', { hidden: true });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Go'].forEach((k) => keypad.appendChild(h('button', { type: 'button', onclick: () => {
    if (k === '⌫') q.value = q.value.slice(0, -1);
    else if (k === 'Go') { const first = listEl.querySelector('button'); if (first) first.click(); keypad.hidden = true; return; }
    else q.value = (/^\d*$/.test(q.value) ? q.value : '') + k;
    renderList();
  } }, k)));
  const listEl = h('div.list');
  const titleEl = h('h2.grow.trunc', '');
  const metaEl = h('span.note', '');
  const verseChips = h('div.row.wrap');
  const grid = h('div.stanza-grid');
  const empty = emptyState('hymn', 'Pick a hymn', 'Type a hymn number (for example 73) or words from the hymn, then pick it from the list.');
  const optsBtn = btn('settings', 'Hymn display options', () => optionsDialog(), { cls: 'sm' });
  const musicBar = h('div.music-bar', { hidden: true });
  let musicSet = null;     // hymn numbers with music in the current book
  let musicEntry = null;   // music index entry of the selected hymn
  const editBtn = btn('edit', 'Edit this hymn', () => hymn && editHymn(hymn), { cls: 'sm' });
  const moreBtn = btn('more', 'More', () => menu(moreBtn, [
    { label: 'New hymn', icon: 'plus', onclick: () => editHymn(null) },
    { label: 'Import a hymnbook…', icon: 'upload', onclick: importBook },
    { label: 'Export this hymnbook', icon: 'download', onclick: exportBook },
    { label: 'Add this hymn to the service plan', icon: 'plan', onclick: addToPlan, disabled: !hymn },
    book && !book.builtin ? { label: 'Delete this hymnbook', icon: 'trash', onclick: deleteBook } : null,
  ]), { cls: 'sm' });

  const el = h('section',
    h('div.toolbar', h('h2', 'Hymns'), bookSel, h('div.grow'), optsBtn, moreBtn),
    h('div.split.hymn-split',
      h('div.pane', h('div.pane-h', q, padBtn), keypad, h('div.scroll', { style: { flex: '1' } }, listEl)),
      h('div.pane', h('div.pane-h', titleEl, editBtn), musicBar, h('div', { style: { padding: '8px 12px 0' } }, metaEl, verseChips), h('div.scroll', { style: { flex: '1' } }, grid, empty))));

  // ------------------------------------------------------------ data
  async function loadBooks() {
    books = [];
    try {
      const idx = await (await fetch('data/hymns/index.json')).json();
      for (const b of idx) {
        try {
          const j = await (await fetch('data/hymns/' + b.file)).json();
          const nb = normaliseBook(j, b.name); nb.id = b.id; nb.short = b.short || nb.short; nb.builtin = true;
          books.push(nb);
        } catch (e) { console.warn('hymnbook', b.file, e); }
      }
    } catch (e) { console.warn('hymn index', e); }
    try {
      const saved = await db.all('hymnbooks');
      saved.forEach((sb) => {
        if (sb.overlayOf) {
          const base = books.find((b) => b.id === sb.overlayOf);
          if (base) sb.hymns.forEach((hy) => { const i = base.hymns.findIndex((x) => x.n === hy.n); if (i >= 0) base.hymns[i] = hy; else base.hymns.push(hy); });
          if (base) base.hymns.sort((a, b) => a.n - b.n);
        } else books.push(sb);
      });
    } catch (e) { console.warn(e); }
    clear(bookSel);
    books.forEach((b) => bookSel.appendChild(h('option', { value: b.id }, b.name + ' (' + b.hymns.length + ')')));
    setBook(books.some((b) => b.id === S().book) ? S().book : books[0] && books[0].id);
  }

  function setBook(id) {
    book = books.find((b) => b.id === id) || null;
    if (book) { bookSel.value = book.id; settings.set('hymns.book', book.id); }
    musicSet = null;
    renderList();
    const bid = book && book.id;
    music.hasBook(bid).then(async (has) => {
      if (!has || !book || book.id !== bid) return;
      const set = new Set();
      for (const x of book.hymns) if (await music.entry(bid, x.n)) set.add(x.n);
      if (book && book.id === bid) { musicSet = set; renderList(); }
    });
  }

  function matches(hy, qq) {
    if (!qq) return true;
    if (/^\d+$/.test(qq)) return String(hy.n).startsWith(qq);
    const nq = normalize(qq);
    if (normalize(hy.t).includes(nq)) return true;
    if (!hy._txt) hy._txt = normalize(hy.v.map((s) => s.join(' ')).join(' ') + ' ' + (hy.c || []).join(' '));
    return nq.split(/\s+/).every((w) => hy._txt.includes(w));
  }

  function renderList() {
    clear(listEl);
    if (!book) { listEl.appendChild(emptyState('hymn', 'No hymnbook installed', 'Use More (…) → Import a hymnbook.')); return; }
    const qq = q.value.trim();
    let list = book.hymns.filter((x) => matches(x, qq));
    if (/^\d+$/.test(qq)) list.sort((a, b) => (a.n === +qq ? -1 : b.n === +qq ? 1 : a.n - b.n));
    const frag = document.createDocumentFragment();
    list.slice(0, 400).forEach((x) => {
      frag.appendChild(h('button', { type: 'button', 'aria-pressed': String(hymn === x), onclick: () => selectHymn(x), ondblclick: () => { selectHymn(x); live.take(); } },
        h('span.num', String(x.n)), h('span.grow', h('div.trunc', x.t), h('div.note.trunc', x.v[0][0])),
        musicSet && musicSet.has(x.n) ? h('span.has-music', { title: 'Music available offline' }, icon('music')) : null));
    });
    listEl.appendChild(frag);
    if (!list.length) listEl.appendChild(emptyState('search', 'No hymn matches “' + qq + '”', 'Try a number like 73 or a few words from the hymn.',
      { label: 'Clear search', icon: 'x', onclick: () => { q.value = ''; renderList(); q.focus(); } }));
  }

  // ------------------------------------------------------------ slides
  function partsOf(hy) {
    const parts = [];
    const s = S();
    if (s.titleSlide) parts.push({ kind: 'title', label: 'T' });
    const sel = chosen || new Set(hy.v.map((_, i) => i));
    let choDone = false;
    hy.v.forEach((lines, i) => {
      if (!sel.has(i)) return;
      parts.push({ kind: 'verse', n: i + 1, lines, label: String(i + 1) });
      if (hy.c && (s.chorusRepeat || !choDone)) { parts.push({ kind: 'chorus', lines: hy.c, label: 'C' }); choDone = true; }
    });
    return parts;
  }

  function buildCue(hy) {
    const s = S();
    const style = live.style || settings.displayStyle();
    const aspect = ctx.link.aspect();
    const roomy = Object.assign({}, style, { minFont: Math.max(style.minFont || 58, Math.round((style.maxFont || 150) * 0.5)) });
    const nVerses = hy.v.length;
    const footL = s.showNumber ? hy.n + '  ' + hy.t : hy.t;
    const cls = s.caps ? 'caps' : '';
    const frames = [], labels = [], cards = [];
    const textFrame = (lines, p, sub) => ({
      kind: 'text', variant: 'hymn', lines: true, cls: cls + (p.kind === 'chorus' ? ' is-chorus' : ''), refPos: s.refPos,
      html: lines.map((l) => '<span class="ln">' + esc(l) + '</span>').join(''), foot: footL,
      footR: p.kind === 'chorus' ? 'Chorus' : 'Verse ' + p.n + (sub ? sub : '') + ' of ' + nVerses,
    });
    partsOf(hy).forEach((p) => {
      if (p.kind === 'title') {
        frames.push({ kind: 'text', variant: 'title', cls, refPos: 'none',
          html: (s.showNumber ? '<span class="hn">' + esc(hy.n) + '</span>' : '') + esc(hy.t) + (hy.a ? '<span class="ha">' + esc(hy.a) + '</span>' : '') });
        labels.push('T'); cards.push({ p, lines: [hy.t] });
        return;
      }
      // Split long stanzas: fixed lines per slide, or automatically when they don't fit comfortably.
      let chunks = [p.lines];
      const max = +s.maxLines || 0;
      if (max > 0 && p.lines.length > max) {
        chunks = [];
        for (let i = 0; i < p.lines.length; i += max) chunks.push(p.lines.slice(i, i + max));
      } else if (!fitsText(textFrame(p.lines, p), roomy, aspect) && p.lines.length >= 4) {
        const half = Math.ceil(p.lines.length / 2);
        chunks = [p.lines.slice(0, half), p.lines.slice(half)];
      }
      chunks.forEach((ch, ci) => {
        const sub = chunks.length > 1 ? 'abcdef'[ci] : '';
        frames.push(textFrame(ch, p, sub));
        labels.push(p.label + sub);
        cards.push({ p, lines: ch, sub });
      });
    });
    return {
      id: 'hymn:' + book.id + ':' + hy.n + ':' + Array.from(chosen || []).join(','), tab: 'hymns',
      title: (s.showNumber ? hy.n + ' ' : '') + hy.t, sub: book.short || '',
      deck: { kind: 'text', frames }, index: Math.min(stagedIndex, frames.length - 1), labels, cards,
      hymnKey: book.id + ':' + hy.n,
      plan: { tab: 'hymns', n: hy.n, book: book.id, label: 'Hymn ' + hy.n + ' — ' + hy.t },
    };
  }

  function selectHymn(hy, { index = 0 } = {}) {
    if (hymn !== hy) chosen = null;
    hymn = hy; stagedIndex = index;
    restage();
    renderList();
  }

  function restage() {
    if (!hymn) { titleEl.textContent = ''; metaEl.textContent = ''; clear(grid); clear(verseChips); empty.hidden = false; musicBar.hidden = true; return; }
    empty.hidden = true;
    cue = buildCue(hymn);
    titleEl.textContent = hymn.n + '  ' + hymn.t;
    metaEl.textContent = (hymn.a ? hymn.a + '. ' : '') + 'Sing stanzas:';
    renderChips();
    renderCards();
    ctx.setStaged('hymns', cue);
    renderMusic();
  }

  function renderChips() {
    clear(verseChips);
    const sel = chosen || new Set(hymn.v.map((_, i) => i));
    // Same chip as the stanza jump buttons; a check when the stanza is sung, struck out when skipped.
    hymn.v.forEach((_, i) => verseChips.appendChild(h('button.frame-chip.pick', { type: 'button', 'aria-pressed': String(sel.has(i)), title: 'Sing stanza ' + (i + 1), 'aria-label': 'Sing stanza ' + (i + 1),
      onclick: () => {
        const s2 = new Set(sel);
        if (s2.has(i)) { if (s2.size > 1) s2.delete(i); } else s2.add(i);
        chosen = s2.size === hymn.v.length ? null : s2;
        stagedIndex = 0; restage(); syncLive();
      } }, sel.has(i) ? icon('check') : null, String(i + 1))));
    if (hymn.c) verseChips.appendChild(h('span.note', { style: { marginLeft: '6px' } }, S().chorusRepeat ? 'Chorus after each stanza' : 'Chorus once'));
  }

  let shownKey = null;
  function renderCards() {
    clear(grid);
    const fresh = cue.hymnKey !== shownKey; shownKey = cue.hymnKey;
    const isLive = live.cue && live.cue.tab === 'hymns' && live.cue.hymnKey === cue.hymnKey;
    cue.cards.forEach((c, i) => {
      const lab = c.p.kind === 'title' ? 'Title' : c.p.kind === 'chorus' ? 'Chorus' : 'Verse ' + c.p.n + (c.sub || '');
      const card = h('button.stanza' + (c.p.kind === 'chorus' ? '.chorus' : ''), {
        type: 'button', 'aria-pressed': String(i === cue.index),
        onclick: () => { stagedIndex = i; cue.index = i; markCards(); ctx.setStaged('hymns', cue); if (isLiveHymn()) live.go(i); },
        ondblclick: () => { stagedIndex = i; cue.index = i; live.take(cue); },
      }, h('span.lab', lab), c.lines.map((l) => h('span.ln', l)));
      if (isLive && live.index === i) card.classList.add('live');
      if (i < 10) card.style.setProperty('--i', i);
      grid.appendChild(card);
    });
    if (fresh) enter(grid, 'stagger', 700); // a newly opened hymn: stanzas settle in one after another
  }
  const isLiveHymn = () => live.cue && live.cue.tab === 'hymns' && cue && live.cue.hymnKey === cue.hymnKey;
  function markCards() {
    Array.prototype.forEach.call(grid.children, (c, i) => {
      const on = !!cue && i === cue.index;
      if (on && c.getAttribute('aria-pressed') !== 'true') enter(c, 'pick'); // soft pulse on the newly picked stanza
      c.setAttribute('aria-pressed', String(on));
      c.classList.toggle('live', isLiveHymn() && live.index === i);
    });
  }
  // When options change while the same hymn is live, update it in place.
  function syncLive() {
    if (isLiveHymn()) { const n = buildCue(hymn); live.replace(n, Math.min(live.index, n.deck.frames.length - 1)); }
  }
  live.on('go', markCards);
  live.on('live', markCards);

  // ------------------------------------------------------------ options / editing / import
  function slider(min, max, step, value, fmt, onchange) {
    const out = h('span.note', { style: { minWidth: '44px', textAlign: 'right' } }, fmt(value));
    const r = h('input', { type: 'range', min, max, step, style: { flex: '1', maxWidth: '240px' }, oninput: () => { out.textContent = fmt(+r.value); }, onchange: () => onchange(+r.value) });
    r.value = value;
    return h('div.row', r, out);
  }

  function optionsDialog() {
    const s = S();
    const set = (k) => (v) => { settings.set('hymns.' + k, v); if (hymn) { restage(); syncLive(); } };
    modal({
      title: 'Hymn options',
      body: h('div.form',
        h('label', 'Title slide'), toggle('Start with the number and title', s.titleSlide, set('titleSlide')),
        h('label', 'Chorus'), toggle('Repeat the chorus after every stanza', s.chorusRepeat, set('chorusRepeat')),
        h('label', 'Hymn number'), toggle('Show the number on screen', s.showNumber, set('showNumber')),
        h('label', 'Capitals'), toggle('Show words in capitals', s.caps, set('caps')),
        h('label', 'Lines per slide'), seg([['0', 'Auto'], ['2', '2'], ['3', '3'], ['4', '4'], ['6', '6']], String(s.maxLines || 0), (v) => set('maxLines')(+v)),
        h('label', 'Hymn title line'), seg([['bottom', 'Bottom'], ['top', 'Top'], ['none', 'Hidden']], s.refPos, set('refPos')),
        h('h3', { style: { gridColumn: '1 / -1', marginTop: '10px' } }, 'Music'),
        h('label', 'Volume'), slider(0, 2, 0.05, s.musicVolume == null ? 1.3 : s.musicVolume, (v) => Math.round(v / 1.3 * 100) + '%', (v) => music.setVolume(v)),
        h('label', 'Reverb'), slider(0, 127, 1, s.musicReverb == null ? 59 : s.musicReverb, (v) => String(v), (v) => { settings.set('hymns.musicReverb', v); music.applyEffects(); }),
        h('label', 'Chorus effect'), slider(0, 127, 1, s.musicChorus == null ? 43 : s.musicChorus, (v) => String(v), (v) => { settings.set('hymns.musicChorus', v); music.applyEffects(); }),
        h('label', ''), h('p.note', 'Reverb 59 and chorus 43 are the levels GeneralUser GS’s author recommends for Falcosoft MIDI Player. ',
          h('button.btn.sm', { type: 'button', onclick: () => { settings.set('hymns.musicReverb', 59); settings.set('hymns.musicChorus', 43); music.applyEffects(); closeModal(); optionsDialog(); } }, 'Use recommended')),
        h('label', 'Music plays on'), seg([['auto', 'Automatic'], ['here', 'This device'], ['display', 'The display']], s.musicOutput || 'auto', (v) => settings.set('hymns.musicOutput', v)),
        h('label', ''), h('p.note', 'Automatic: on this device, except when this phone controls the church PC through the companion — then the PC plays it.')),
      actions: [{ label: 'Done', primary: true }],
    });
  }

  async function saveBookEdit(hy, isNew) {
    if (book.builtin) {
      const key = 'overlay:' + book.id;
      const ov = (await db.get('hymnbooks', key)) || { id: key, overlayOf: book.id, hymns: [] };
      const i = ov.hymns.findIndex((x) => x.n === hy.n);
      if (i >= 0) ov.hymns[i] = hy; else ov.hymns.push(hy);
      await db.put('hymnbooks', key, ov);
    } else await db.put('hymnbooks', book.id, { id: book.id, name: book.name, short: book.short, lang: book.lang, hymns: book.hymns });
    if (isNew) toast('Hymn ' + hy.n + ' added.', 'ok'); else toast('Hymn ' + hy.n + ' saved.', 'ok');
  }

  function editHymn(hy) {
    const n = h('input.field', { type: 'number', min: 1, value: hy ? hy.n : '', style: { width: '110px' } });
    const t = h('input.field', { value: hy ? hy.t : '', placeholder: 'Title' });
    const a = h('input.field', { value: hy ? hy.a || '' : '', placeholder: 'Author (optional)' });
    const ta = h('textarea.field', { rows: 14, value: hy ? lyricsText(hy) : '', placeholder: 'Stanza 1 line 1\nStanza 1 line 2\n\nChorus:\nChorus line 1\n\nStanza 2 line 1…' });
    ta.value = hy ? lyricsText(hy) : '';
    modal({
      title: hy ? 'Edit hymn ' + hy.n : 'New hymn', wide: true,
      body: h('div.col', h('div.form', h('label', 'Number'), n, h('label', 'Title'), t, h('label', 'Author'), a),
        h('p.note', 'Leave an empty line between stanzas. Start the chorus with a line “Chorus:”.'), ta),
      actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onclick: async () => {
        const num = parseInt(n.value, 10);
        const p = parseLyrics(ta.value);
        if (!num || !t.value.trim() || !p.v.length) { toast('A number, a title and at least one stanza are needed.', 'err'); return false; }
        const nh = { n: num, t: t.value.trim(), a: a.value.trim(), v: p.v, c: p.c };
        const i = book.hymns.findIndex((x) => x.n === num);
        if (i >= 0) book.hymns[i] = nh; else { book.hymns.push(nh); book.hymns.sort((x, y) => x.n - y.n); }
        await saveBookEdit(nh, i < 0);
        selectHymn(nh);
        syncLive();
      } }],
    });
  }

  async function importBook() {
    const inp = h('input', { type: 'file', accept: '.json,.txt' });
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const text = await readText(f);
        const name = f.name.replace(/\.[^.]+$/, '');
        const nb = /^\s*[[{]/.test(text) ? normaliseBook(JSON.parse(text), name) : parseTxtBook(text, name);
        if (!nb.hymns.length) throw new Error('No hymns found in ' + f.name + '.');
        if (books.some((b) => b.id === nb.id)) nb.id = nb.id + '-' + Date.now().toString(36);
        await db.put('hymnbooks', nb.id, nb);
        toast(nb.hymns.length + ' hymns imported from ' + f.name + '.', 'ok');
        settings.set('hymns.book', nb.id);
        await loadBooks();
      } catch (e) { toast('Import failed: ' + e.message, 'err', 6000); }
    };
    inp.click();
  }

  function exportBook() {
    if (!book) return;
    const out = { id: book.id, name: book.name, short: book.short, lang: book.lang, hymns: book.hymns.map(({ n, t, a, v, c }) => ({ n, t, a, v, c })) };
    download(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), (book.short || book.id) + '-hymns.json');
  }

  async function deleteBook() {
    if (!book || book.builtin) return;
    if (!(await confirmBox('Delete hymnbook?', 'Remove “' + book.name + '” from this device?', 'Delete', true))) return;
    await db.del('hymnbooks', book.id);
    await loadBooks();
  }

  async function addToPlan() { if (cue) (await ctx.tab('plan')).addItem(cue.plan); }

  // ------------------------------------------------------------ music (offline MIDI accompaniment)
  const sungStanzas = () => (chosen ? Array.from(chosen).sort((a, b) => a - b) : hymn.v.map((_, i) => i));
  const playingThis = () => music.isPlaying() && cue && music.hymnKey === cue.hymnKey;
  let musicStatus = '';

  async function startMusic(present) {
    if (!hymn || !cue) return;
    music.unlock(); // must happen inside the click
    if (present) await live.take(cue);
    musicStatus = 'Starting…'; renderMusic();
    try {
      await music.play({ book: book.id, hy: hymn, sung: sungStanzas(), cards: cue.cards, hymnKey: cue.hymnKey, title: hymn.n + '  ' + hymn.t });
      musicStatus = '';
    } catch (e) { musicStatus = ''; toast('Could not play the music: ' + e.message, 'err', 6000); }
    renderMusic();
  }

  const setM = (k, v) => settings.set('hymns.' + k, v);
  function stepper(label, value, fmt, onMinus, onPlus, title) {
    return h('div.stepper', { title },
      h('span.note', label),
      h('button.btn.sm.icon', { type: 'button', 'aria-label': label + ' down', onclick: onMinus }, icon('minus')),
      h('span.val', fmt(value)),
      h('button.btn.sm.icon', { type: 'button', 'aria-label': label + ' up', onclick: onPlus }, icon('plus')));
  }

  async function renderMusic() {
    if (!hymn || !book) { musicBar.hidden = true; return; }
    const key = cue && cue.hymnKey;
    const entry = await music.entry(book.id, hymn.n);
    if (!cue || cue.hymnKey !== key) return; // another hymn was picked meanwhile
    musicEntry = entry;
    clear(musicBar);
    if (!entry) { musicBar.hidden = true; return; }
    musicBar.hidden = false;
    const m = S();
    const st = music.state || {};
    const mine = playingThis();
    const playBtn = mine
      ? h('button.btn.sm.primary', { type: 'button', title: 'Pause / continue the music (M)', onclick: () => { music.unlock(); music.toggle(); } }, icon(st.paused ? 'play' : 'pause'), h('span', st.paused ? 'Continue' : 'Pause'))
      : h('button.btn.sm.primary', { type: 'button', title: 'Play the music for the stanzas being sung (M)', onclick: () => startMusic(false) }, icon('play'), h('span', 'Play music'));
    const row1 = h('div.row.wrap', playBtn);
    if (mine) {
      row1.append(btn('fade', 'Fade out', () => music.fade(3000), { cls: 'sm fade-btn', label: 'Fade' }), btn('stop', 'Stop the music', () => music.stop(), { cls: 'sm' }));
    } else {
      row1.append(h('button.btn.sm', { type: 'button', title: 'Show the words and start the music together', onclick: () => startMusic(true) }, icon('present'), h('span', 'Present & play')));
    }
    const sung = sungStanzas().length;
    const info = musicStatus || (mine
      ? (st.loading ? 'Preparing instruments…' : (st.section != null && st.sections[st.section] ? st.sections[st.section].label + '   ' : '') + fmtTime(st.time) + ' / ' + fmtTime(st.dur))
      : '♪ ' + (entry.tune || 'Tune') + (entry.ok ? ' · ' + (m.musicIntro !== false ? 'intro + ' : '') + sung + (sung === 1 ? ' stanza' : ' stanzas') : ' · plays as recorded') + (entry.ok && entry.v.length < sung ? ' (verse music repeated)' : ''));
    musicInfo = h('span.note.music-info.trunc', info);
    row1.append(musicInfo);
    musicSig = sigOf();
    musicBar.append(row1);
    // Jump to a part while it plays: Intro 1 2 3 …
    if (mine && st.sections && st.sections.length > 1) {
      const jumps = h('div.row.wrap.music-jumps');
      st.sections.forEach((sec, i) => jumps.appendChild(h('button.frame-chip' + (st.section === i ? '.cur' : ''), { type: 'button', title: 'Go to ' + sec.label, onclick: () => music.seek(i) }, sec.label === 'Intro' ? 'Intro' : sec.label.replace('Verse ', ''))));
      musicBar.append(jumps);
    }
    const instSel = h('select.field.sm', { 'aria-label': 'Instrument', title: 'Instrument', onchange: () => { setM('musicInstrument', instSel.value); if (mine) startMusic(false); } },
      Object.keys(INSTRUMENTS).map((k) => h('option', { value: k, selected: k === (m.musicInstrument || 'arranged') }, INSTRUMENTS[k].label)));
    const tempo = m.musicTempo || 100, keyS = m.musicKey || 0;
    musicBar.append(h('div.row.wrap.music-opts',
      h('button.chip', { type: 'button', 'aria-pressed': String(m.musicIntro !== false), title: 'Play the introduction before the first stanza', disabled: !entry.ok,
        onclick: () => { setM('musicIntro', m.musicIntro === false); renderMusic(); } }, 'Play intro'),
      h('button.chip', { type: 'button', 'aria-pressed': String(m.musicFollow !== false), title: 'When the hymn is live, the words change with the music', disabled: !entry.ok,
        onclick: () => { setM('musicFollow', m.musicFollow === false); renderMusic(); } }, 'Words follow music'),
      stepper('Tempo', tempo, (v) => v + '%', () => { const v = Math.max(60, tempo - 5); setM('musicTempo', v); music.setRate(v / 100); renderMusic(); },
        () => { const v = Math.min(140, tempo + 5); setM('musicTempo', v); music.setRate(v / 100); renderMusic(); }, 'Speed of the music'),
      stepper('Key', keyS, (v) => (v > 0 ? '+' : '') + v, () => { const v = Math.max(-6, keyS - 1); setM('musicKey', v); music.setKey(v); renderMusic(); },
        () => { const v = Math.min(6, keyS + 1); setM('musicKey', v); music.setKey(v); renderMusic(); }, 'Raise or lower the key in semitones'),
      instSel));
  }
  let musicInfo = null, musicSig = '';
  const sigOf = () => { const st = music.state || {}; return [playingThis(), !!st.paused, !!st.loading, (st.sections || []).length, st.section].join('|'); };
  music.on('state', (st) => {
    if (el.hidden || !hymn) return;
    if (sigOf() !== musicSig || !musicInfo) { renderMusic(); return; }
    // Just the clock: rebuilding the bar four times a second would close open menus.
    if (playingThis() && !musicStatus) musicInfo.textContent = (st.section != null && st.sections[st.section] ? st.sections[st.section].label + '   ' : '') + fmtTime(st.time) + ' / ' + fmtTime(st.dur);
  });
  music.on('progress', (msg) => { musicStatus = msg; if (!el.hidden) renderMusic(); });
  // Words follow the music: the arrangement carries markers where each slide begins.
  music.on('slide', ({ key, slide }) => {
    if (S().musicFollow === false) return;
    if (live.cue && live.cue.tab === 'hymns' && live.cue.hymnKey === key && slide < live.count()) live.go(slide);
  });

  // ------------------------------------------------------------ public API
  const api = {
    el,
    lookup(n) {
      const out = [];
      const order = [book].concat(books.filter((b) => b !== book)).filter(Boolean);
      order.forEach((b) => b.hymns.forEach((x) => { if (x.n === n) out.push({ n: x.n, t: x.t, book: b.short || b.name, bookId: b.id }); }));
      return out;
    },
    search(qq, k = 5) {
      const out = [];
      if (!book) return out;
      for (const x of book.hymns) { if (matches(x, qq)) { out.push({ n: x.n, t: x.t, book: book.short || book.name, bookId: book.id }); if (out.length >= k) break; } }
      return out;
    },
    async open({ n, book: bid, index = 0 }) {
      await ready;
      if (bid && bid !== (book && book.id) && books.some((b) => b.id === bid)) setBook(bid);
      let x = book && book.hymns.find((y) => y.n === +n);
      // Plan items made before a hymnbook was chosen (or after it was switched): use any book that has it.
      if (!x && (!bid || !books.some((b) => b.id === bid))) {
        const other = books.find((b) => b.hymns.some((y) => y.n === +n));
        if (other) { setBook(other.id); x = book.hymns.find((y) => y.n === +n); }
      }
      opening = true;
      await ctx.showTab('hymns');
      if (!x) { toast('Hymn ' + n + ' is not in ' + (book ? book.name : 'the hymnbook') + '.', 'err'); return null; }
      q.value = '';
      selectHymn(x, { index });
      return cue;
    },
    onShow() { if (!hymn && !opening && !ctx.isMobile()) setTimeout(() => q.focus(), 50); opening = false; if (hymn) renderMusic(); },
    /** M key: pause/continue the music, or start it for the live (or selected) hymn. */
    async musicKey() {
      music.unlock();
      if (music.isPlaying()) { music.toggle(); return; }
      if (live.cue && live.cue.tab === 'hymns' && (!cue || live.cue.hymnKey !== cue.hymnKey)) {
        const [bid, n] = live.cue.hymnKey.split(':');
        await api.open({ n: +n, book: bid });
      }
      if (hymn && musicEntry) startMusic(false);
    },
    musicFor(c) { return c && c.tab === 'hymns' && !!(musicSet && book && c.hymnKey && c.hymnKey.startsWith(book.id + ':') && musicSet.has(+c.hymnKey.split(':')[1])); },
    startMusicFor(c) { if (cue && c && cue.hymnKey === c.hymnKey) startMusic(false); },
    controls(c) {
      // Jump straight to a stanza: T 1 C 2 C 3 …
      const box = h('div.row', { style: { flexWrap: 'nowrap', overflowX: 'auto' } });
      const labels = c.labels || [];
      const isCho = (lab) => /^C[a-f]?$/.test(lab);
      const firstCho = labels.findIndex(isCho);
      labels.forEach((lab, i) => {
        if (isCho(lab) && i !== firstCho) return; // one chorus button is enough (also when the chorus is split in two)
        if (/^\d+[b-f]$/.test(lab)) return; // second half of a long stanza: its first half's button is enough
        const name = lab === 'T' ? 'Title' : isCho(lab) ? 'Chorus' : 'Stanza ' + lab.replace(/a$/, '');
        box.appendChild(h('button.frame-chip', { type: 'button', title: name, 'aria-label': name, 'data-lab': lab, onclick: () => {
          if (isCho(lab)) {
            // the chorus that follows the current stanza (or the first one)
            let after = -1;
            for (let k = live.index; k < labels.length; k++) if (labels[k] === lab) { after = k; break; }
            live.go(after >= 0 ? after : i);
          } else live.go(i);
        } }, isCho(lab) ? 'C' : lab.replace(/a$/, '')));
      });
      ctlBox = box; markCtl();
      // Live hymn with offline music: start it from the control bar too.
      if (api.musicFor(c) && !(music.isPlaying() && music.hymnKey === c.hymnKey)) {
        return h('div.row', { style: { flexWrap: 'nowrap', minWidth: 0 } }, box,
          h('button.btn.sm', { type: 'button', title: 'Play the music for this hymn (M)', onclick: () => api.musicKey() }, icon('music'), h('span.hide-sm', 'Music')));
      }
      return box;
    },
  };
  // The live stanza's jump button is filled red (same chip style as under the Live monitor).
  let ctlBox = null;
  function markCtl() {
    if (!ctlBox || !ctlBox.isConnected || !live.cue || !live.cue.labels) return;
    const cur = live.cue.labels[live.index] || '';
    const base = (x) => (/^C[a-f]?$/.test(x) ? 'C' : x.replace(/[a-f]$/, ''));
    ctlBox.querySelectorAll('.frame-chip').forEach((b) => b.classList.toggle('cur', base(b.dataset.lab) === base(cur)));
  }
  live.on('go', markCtl);

  const ready = loadBooks().then(() => renderList());
  return api;
}
