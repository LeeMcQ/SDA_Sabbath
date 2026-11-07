// Hymns tab: find a hymn by number or words, choose which stanzas to sing,
// present stanza by stanza (chorus repeated automatically).
import { h, clear, esc, debounce, normalize, readText, download } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, modal, seg, toggle, menu, toast, confirmBox, closeModal, enter, emptyState, keepInView } from '../core/ui.js';
import { db } from '../core/db.js';
import { fitsText } from '../core/render.js';
import { lookPanel } from './look-panel.js';
import { music, INSTRUMENTS, packFor, PACKS, hqStored, hqRemove, hqPrefetch, EQ_BANDS, EQ_PRESETS, SOUND_PRESETS } from '../core/hymnmusic.js';
import { fmtTime } from '../core/util.js';
import * as ai from '../core/ai.js';
import { findSongs, lyricsOf, songFromPlain, songText, sourceLinks, matchLabel, splitQuery, findMidi, fetchMidi } from '../core/lyrics.js';
import { communitySongs, syncCommunity, shareUrl, songText as sharedText, COMMUNITY_BOOK, FIRST_NUMBER, sharedBookId, isSharedBookId, sharedLangOf } from '../core/community.js';
import { languageChoices, langName } from '../core/langs.js';
import { church } from '../core/church.js';
import { zipBlobs } from '../lib/blobzip.js';
import { parseLyrics, lyricsText, decodeEntities, normaliseBook, parseTxtBook, relaxedJson, parseHymnFile } from '../core/hymnparse.js';
import { HYMNBOOKS_CHANGED, removeHymnbook, addHymnbookDialog, sharedLangs, setSharedLangs } from './hymn-import.js';

// Parsers live in core/hymnparse.js (shared with Add a hymnbook); these stay exported from here for other code.
export { parseLyrics, lyricsText, decodeEntities };

/** A hymn saved on this device, checked before use (older versions or a damaged database). */
const strList = (a) => (Array.isArray(a) ? a.filter((l) => typeof l === 'string') : []);
function cleanHymn(x) {
  if (!x || typeof x !== 'object') return null;
  const n = +x.n;
  if (!(n > 0)) return null;
  const v = (Array.isArray(x.v) ? x.v : []).map(strList).filter((st) => st.length);
  if (!v.length) return null;
  const c = strList(x.c);
  return Object.assign({}, x, { n, t: typeof x.t === 'string' ? x.t : String(x.t == null ? '' : x.t), a: typeof x.a === 'string' ? x.a : '', v, c: c.length ? c : null });
}
const cleanHymns = (list) => (Array.isArray(list) ? list.map(cleanHymn).filter(Boolean) : []);

/** The second line in hymn lists: the first line of the words, or why there are none. */
const firstLine = (x) => (x.v && x.v[0] && x.v[0][0]) || (x.locked ? (x.ccli ? 'CCLI song ' + x.ccli + ' · ' : '') + 'Words not included (copyrighted)' : '');

/** SongSelect / FreeShow-style files: one song each. ".usr" (SongSelect USR) or SongSelect plain text.
 *  Returns {t, a, ccli, v, c} or null. */
export function parseSongSelect(text) {
  const src = String(text || '').replace(/\r/g, '');
  if (/^\s*\[S\b/m.test(src) || /^Words=/m.test(src)) {
    const get = (k) => { const m = new RegExp('^' + k + '=(.*)$', 'm').exec(src); return m ? m[1].trim() : ''; };
    const head = /^\s*\[S\s+A?(\d+)\]/m.exec(src);
    const fields = get('Fields').split('/t');
    const parts = get('Words').split('/t').map((b) => b.split('/n').map((l) => l.trim()).filter(Boolean));
    const v = []; let c = null;
    parts.forEach((b, i) => { if (!b.length) return; if (/chorus|refrain/i.test(fields[i] || '')) { if (!c) c = b; } else v.push(b); });
    if (!v.length && !c) return null;
    return { t: get('Title'), a: get('Author').replace(/\|/g, ', '), ccli: head ? head[1] : '', v: v.length ? v : [c], c: v.length ? c : null };
  }
  const lines = src.split('\n');
  const t = (lines.find((l) => l.trim()) || '').trim();
  const HEADS = /^(verse|chorus|refrain|bridge|pre-?chorus|tag|ending|intro|misc)\b[\s\d]*$/i;
  const v = []; let c = null; let cur = null; let kind = ''; let ccli = '';
  const flush = () => { if (cur && cur.length) { if (/chorus|refrain/i.test(kind) && !/pre/i.test(kind)) { if (!c) c = cur; } else v.push(cur); } cur = null; };
  for (const raw of lines.slice(lines.indexOf(lines.find((l) => l.trim())) + 1)) {
    const l = raw.trim();
    const m = /^CCLI Song\s*#\s*(\d+)/i.exec(l);
    if (m) { ccli = m[1]; break; }
    if (HEADS.test(l)) { flush(); kind = l; cur = []; continue; }
    if (!l) { if (cur && cur.length) { flush(); kind = ''; } continue; }
    if (!cur) cur = [];
    cur.push(l);
  }
  flush();
  if (!t || (!v.length && !c)) return null;
  return { t, a: '', ccli, v: v.length ? v : [c], c: v.length ? c : null };
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
  ['keydown', 'pointerdown', 'blur'].forEach((ev) => q.addEventListener(ev, () => q.classList.remove('quiet-focus')));
  const padBtn = btn('', 'Number pad', () => { keypad.hidden = !keypad.hidden; }, { cls: 'sm', label: '123' });
  const keypad = h('div.keypad', { hidden: true });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Go'].forEach((k) => keypad.appendChild(h('button', { type: 'button', onclick: () => {
    if (k === '⌫') q.value = q.value.slice(0, -1);
    else if (k === 'Go') { const first = listEl.querySelector('button'); if (first) first.click(); keypad.hidden = true; return; }
    else q.value = (/^\d*$/.test(q.value) ? q.value : '') + k;
    renderList();
  } }, k)));
  const listEl = h('div.list');
  const titleEl = h('h2.grow.trunc', 'Hymns');
  const metaEl = h('span.note', '');
  const verseChips = h('div.row.wrap');
  const grid = h('div.stanza-grid');
  const empty = emptyState('hymn', 'Pick a hymn', 'Type a hymn number (for example 73) or words from the hymn, then pick it from the list.');
  const optsBtn = btn('settings', 'Hymn display options', () => optionsDialog(), { cls: 'sm' });
  const musicBar = h('div.music-bar', { hidden: true });
  let musicSet = null;     // hymn numbers with music in the current book
  let musicEntry = null;   // music index entry of the selected hymn
  const editBtn = btn('edit', 'Edit this hymn', () => hymn && editHymn(hymn), { cls: 'sm' });
  // A song this church added itself to a Shared Hymns book can be shared with every church (in that language).
  const shareBtn = h('button.btn.sm', { type: 'button', hidden: true, title: 'Share this hymn with all churches that use SDA Sabbath', onclick: () => hymn && shareChorus(hymn) }, icon('send'), h('span', 'Share with all churches'));
  const isOwnChorus = (hy) => !!(hy && book && book.shared && !hy.shared && !(book.builtinNs && book.builtinNs.has(hy.n)));
  const moreBtn = btn('more', 'More', () => menu(moreBtn, [
    { label: 'Find lyrics online', icon: 'search', onclick: () => findLyrics() },
    { label: 'New song (choose its language)', icon: 'plus', onclick: () => editHymn(null) },
    { label: 'Import licensed words…', icon: 'upload', onclick: importLicensed },
    hymn && hymn.locked ? { label: 'Add the words for this hymn (licensed)…', icon: 'edit', onclick: () => editHymn(hymn) } : null,
    { label: 'Add a hymnbook (isiXhosa, isiZulu, French, …)', icon: 'plus', onclick: () => addHymnbookDialog() },
    { label: 'Export this hymnbook', icon: 'download', onclick: exportBook },
    { label: 'Add this hymn to the service plan', icon: 'plan', onclick: addToPlan, disabled: !hymn },
    { label: 'Check for new shared hymns', icon: 'reload', onclick: () => checkShared(true) },
    { label: 'Shared Hymns in another language…', icon: 'plus', onclick: () => addSharedLanguage() },
    isOwnChorus(hymn) ? { label: 'Share this hymn with all churches…', icon: 'send', onclick: () => shareChorus(hymn) } : null,
    book && (!book.builtin || book.shared) ? { label: book.shared ? 'Remove Shared Hymns – ' + book.name + ' from this device' : 'Delete this hymnbook', icon: 'trash', onclick: deleteBook } : null,
  ]), { cls: 'sm' });

  const el = h('section',
    h('div.toolbar', h('h2', 'Hymns'), bookSel, h('div.grow'), optsBtn, moreBtn),
    h('div.split.hymn-split',
      h('div.pane', h('div.pane-h', q, padBtn), keypad, h('div.scroll', { style: { flex: '1' } }, listEl)),
      h('div.pane', h('div.pane-h', titleEl, shareBtn, editBtn), musicBar, h('div', { style: { padding: '8px 12px 0' } }, metaEl, verseChips), h('div.scroll', { style: { flex: '1' } }, grid, empty))));

  // ------------------------------------------------------------ data
  /** Malmesbury Praise became part of Shared Hymns – English (5 Nov 2026), numbered 101–148 (MP 1 = 101).
   *  Words and MIDI files this device added for it move along once. */
  const MP_OFFSET = 100;
  async function moveMalmesbury() {
    if (await db.get('kv', 'moved-malmesbury').catch(() => null)) return;
    try {
      const old = await db.get('hymnbooks', 'overlay:malmesbury');
      if (old && Array.isArray(old.hymns) && old.hymns.length) {
        const key = 'overlay:' + COMMUNITY_BOOK;
        const ov = (await db.get('hymnbooks', key)) || { id: key, overlayOf: COMMUNITY_BOOK, hymns: [] };
        old.hymns.forEach((x) => { if (x && x.n > 0 && x.n <= 99) { const n = x.n + MP_OFFSET; if (!ov.hymns.some((y) => y.n === n)) ov.hymns.push(Object.assign({}, x, { n })); } });
        await db.put('hymnbooks', key, ov);
        await db.del('hymnbooks', 'overlay:malmesbury');
      }
      for (const f of ((await db.all('files')) || []).filter((x) => x && typeof x.id === 'string' && x.id.startsWith('midi:malmesbury:'))) {
        const n = +f.id.split(':')[2] + MP_OFFSET;
        await db.put('files', 'midi:' + COMMUNITY_BOOK + ':' + n, Object.assign({}, f, { id: 'midi:' + COMMUNITY_BOOK + ':' + n }));
        await db.del('files', f.id);
      }
      if (S().book === 'malmesbury') settings.set('hymns.book', COMMUNITY_BOOK);
      await db.put('kv', 'moved-malmesbury', Date.now());
    } catch (e) { console.warn('moving Malmesbury Praise', e); }
  }
  async function loadBooks() {
    await moveMalmesbury();
    books = [];
    try {
      const idx = await (await fetch('data/hymns/index.json')).json();
      for (const b of idx) {
        try {
          const j = await (await fetch('data/hymns/' + b.file)).json();
          const nb = normaliseBook(j, b.name); nb.id = b.id; nb.name = b.name || nb.name; nb.short = b.short || nb.short; nb.builtin = true; nb.builtinNs = new Set(nb.hymns.map((x) => x.n));
          if (b.shared) { nb.shared = true; nb.lang = b.lang || 'en'; nb.name = langName(nb.lang); }
          if (b.shared && !sharedLangs(settings).includes(nb.lang)) continue;   // the church removed this language
          books.push(nb);
        } catch (e) { console.warn('hymnbook', b.file, e); }
      }
    } catch (e) { console.warn('hymn index', e); }
    // Shared Hymns for the church's languages: a book per language (English is built in with its choruses).
    sharedLangs(settings).forEach((lg) => {
      const id = sharedBookId(lg);
      if (!books.some((b) => b.id === id)) books.push({ id, name: langName(lg), short: 'SH-' + lg.toUpperCase(), lang: lg, hymns: [], builtin: true, shared: true, builtinNs: new Set() });
    });
    try {
      const saved = (await db.all('hymnbooks')) || [];
      saved.forEach((sb) => {
        if (!sb || typeof sb !== 'object' || !sb.id) return;
        if (sb.overlayOf) {
          const base = books.find((b) => b.id === sb.overlayOf);
          if (base) cleanHymns(sb.hymns).forEach((hy) => { const i = base.hymns.findIndex((x) => x.n === hy.n); if (i >= 0) base.hymns[i] = hy; else base.hymns.push(hy); });
          if (base) base.hymns.sort((a, b) => a.n - b.n);
        } else books.push({ id: String(sb.id), name: typeof sb.name === 'string' && sb.name ? sb.name : 'Hymnbook', short: typeof sb.short === 'string' ? sb.short : '',
          lang: typeof sb.lang === 'string' ? sb.lang : 'en', hymns: cleanHymns(sb.hymns).sort((a, b) => a.n - b.n) });
      });
    } catch (e) { console.warn(e); }
    // Hymns shared by other churches (approved by the maintainer) join the Shared Hymns book of their language.
    try {
      const cs = await communitySongs();
      const key = (x) => normalize(x.t) + '|' + normalize(((x.v && x.v[0]) || [])[0] || '');
      books.filter((b) => b.shared).forEach((cb) => {
        const mine = cs.songs.filter((sg) => sg.lang === cb.lang);
        const sharedKeys = new Set(mine.map(key));
        // A song this church added and later shared now arrives as the shared copy: show it once.
        cb.hymns = cb.hymns.filter((x) => cb.builtinNs.has(x.n) || !sharedKeys.has(key(x)) || mine.some((y) => y.n === x.n));
        mine.forEach((sg) => {
          const hy = Object.assign({}, sg, { shared: true });
          const i = cb.hymns.findIndex((x) => x.n === sg.n);
          if (i >= 0) cb.hymns[i] = hy; else cb.hymns.push(hy);
        });
        cb.hymns.sort((a, b) => a.n - b.n);
        cb.sharedCount = mine.length;
      });
    } catch (e) { console.warn('shared hymns', e); }
    // Hymnals first, then "Shared Hymns" with a line per language.
    clear(bookSel);
    const opt = (b) => h('option', { value: b.id }, b.name + ' (' + b.hymns.length + ')');
    const hymnals = books.filter((b) => !b.shared), shared = books.filter((b) => b.shared);
    if (hymnals.length) bookSel.appendChild(h('optgroup', { label: 'Hymnals' }, hymnals.map(opt)));
    if (shared.length) bookSel.appendChild(h('optgroup', { label: 'Shared Hymns' }, shared.map(opt)));
    setBook(books.some((b) => b.id === S().book) ? S().book : books[0] && books[0].id);
  }

  function setBook(id) {
    book = books.find((b) => b.id === id) || null;
    if (book) { bookSel.value = book.id; settings.set('hymns.book', book.id); }
    shareBtn.hidden = !isOwnChorus(hymn);
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

  // The hymn list is one Tab stop (the chosen hymn, or the first); the arrow keys, Home and End move inside it,
  // so Tab reaches the stanzas and music controls without walking through every hymn.
  function rovingStop() {
    const bs = listEl.querySelectorAll(':scope > button');
    if (!bs.length) return;
    const cur = listEl.querySelector(':scope > button[aria-pressed="true"]') || bs[0];
    bs.forEach((b) => b.setAttribute('tabindex', b === cur ? '0' : '-1'));
  }
  listEl.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key) || e.ctrlKey || e.altKey || e.metaKey) return;
    const bs = Array.from(listEl.querySelectorAll(':scope > button'));
    const i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : e.key === 'PageDown' ? Math.min(bs.length - 1, i + 10) : e.key === 'PageUp' ? Math.max(0, i - 10)
      : Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    e.preventDefault(); e.stopPropagation();
    bs.forEach((b, k) => b.setAttribute('tabindex', k === j ? '0' : '-1'));
    bs[j].focus();
  });
  function renderList() {
    const hadFocus = listEl.contains(document.activeElement);
    clear(listEl);
    if (!book) { listEl.appendChild(emptyState('hymn', 'No hymnbook installed', 'Use More (…) → Add a hymnbook.')); return; }
    // Screen readers read an Afrikaans (or other) hymnbook in its own language. The text itself is unchanged.
    const L = book.lang && book.lang !== 'en' ? book.lang : null;
    [listEl, grid, titleEl].forEach((el) => { if (L) el.setAttribute('lang', L); else el.removeAttribute('lang'); });
    const qq = q.value.trim();
    let list = book.hymns.filter((x) => matches(x, qq));
    if (/^\d+$/.test(qq)) list.sort((a, b) => (a.n === +qq ? -1 : b.n === +qq ? 1 : a.n - b.n));
    const frag = document.createDocumentFragment();
    list.slice(0, 400).forEach((x) => {
      frag.appendChild(h('button', { type: 'button', tabindex: '-1', 'aria-pressed': String(hymn === x), onclick: () => selectHymn(x), ondblclick: () => { selectHymn(x); live.take(); } },
        h('span.num', String(x.n)), h('span.grow', h('div.trunc', x.t), h('div.note.trunc', firstLine(x))),
        x.shared ? h('span.hy-shared', { title: 'Shared by a church that uses SDA Sabbath' }, 'Shared') : null,
        musicSet && musicSet.has(x.n) ? h('span.has-music', { title: 'Music available offline' }, icon('music')) : null));
    });
    listEl.appendChild(frag);
    rovingStop();
    if (hadFocus) { const t = listEl.querySelector(':scope > button[tabindex="0"]'); if (t) t.focus({ preventScroll: true }); }
    if (!book.hymns.length && book.shared) listEl.appendChild(emptyState('hymn', 'No shared hymns in ' + book.name + ' yet',
      'Churches add songs here and share them with every church that has ' + book.name + '. New ones arrive by themselves when this device is online.',
      { label: 'Add the first song', icon: 'plus', onclick: () => editHymn(null, book.id) }));
    else if (!list.length) listEl.appendChild(emptyState('search', 'No hymn matches “' + qq + '”', 'Try a number like 73 or a few words from the hymn.',
      { label: 'Clear search', icon: 'x', onclick: () => { q.value = ''; renderList(); q.focus(); } }));
  }

  // ------------------------------------------------------------ slides
  function partsOf(hy) {
    const parts = [];
    const s = S();
    if (s.titleSlide || !hy.v.length) parts.push({ kind: 'title', label: 'T' });
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
    const style = settings.kindStyle(live.style || settings.displayStyle(), 'hymn');
    const aspect = ctx.link.aspect();
    const roomy = Object.assign({}, style, { minFont: Math.max(style.minFont || 58, Math.round((style.maxFont || 150) * 0.5)) });
    const nVerses = hy.v.length;
    const footL = s.showNumber ? hy.n + '  ' + hy.t : hy.t;
    const cls = s.caps ? 'caps' : '';
    const frames = [], labels = [], cards = [];
    const textFrame = (lines, p, sub) => ({
      kind: 'text', variant: 'hymn', lines: true, cls: cls + (p.kind === 'chorus' ? ' is-chorus' : ''), refPos: s.refPos, lang: (book && book.lang) || undefined,
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
    shareBtn.hidden = !isOwnChorus(hy);
    restage();
    renderList();
  }

  function restage() {
    if (!hymn) { titleEl.textContent = 'Hymns'; metaEl.textContent = ''; clear(grid); clear(verseChips); empty.hidden = false; musicBar.hidden = true; return; }
    empty.hidden = true;
    cue = buildCue(hymn);
    titleEl.textContent = hymn.n + '  ' + hymn.t;
    metaEl.textContent = (hymn.a ? hymn.a + '. ' : '') + (hymn.locked ? (hymn.ccli ? 'CCLI song ' + hymn.ccli + '. ' : '') : 'Sing stanzas:');
    renderChips();
    renderCards();
    if (hymn.locked) grid.appendChild(licencePanel(hymn));
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
      // Like verses: a click or tap only selects the stanza as Next (also while the hymn is live);
      // double-click, Enter, Present or F5 puts it on screen.
      const card = h('button.stanza' + (c.p.kind === 'chorus' ? '.chorus' : ''), {
        type: 'button', 'aria-pressed': String(i === cue.index),
        onclick: () => stageStanza(i),
        ondblclick: () => { stageStanza(i); live.take(cue); },
        onkeydown: (e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); stageStanza(i); live.take(cue); } },
      }, h('span.lab', lab), c.lines.map((l) => h('span.ln', l)));
      if (isLive && live.index === i) card.classList.add('live');
      if (i < 10) card.style.setProperty('--i', i);
      grid.appendChild(card);
    });
    if (fresh) enter(grid, 'stagger', 700); // a newly opened hymn: stanzas settle in one after another
  }
  const isLiveHymn = () => live.cue && live.cue.tab === 'hymns' && cue && live.cue.hymnKey === cue.hymnKey;
  /** Select stanza card i as Next (pick: the "Next follows Live" logic leaves this choice alone). */
  function stageStanza(i) {
    if (!cue) return;
    stagedIndex = i; cue.index = i; markCards();
    ctx.setStaged('hymns', cue, { pick: true });
  }
  // The live stanza card stays in view while the hymn moves on (arrows, F5, clicker, music).
  const followCard = () => { if (!isLiveHymn() || el.hidden) return; keepInView(grid.children[live.index]); };
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
  live.on('go', followCard);
  live.on('live', followCard);
  // Next follows the live hymn (Verse 2 live → Next is the chorus after it): keep the picked stanza in step.
  live.on('staged', (s) => { if (s && s === cue && s.index != null) { stagedIndex = s.index; markCards(); } });

  // ------------------------------------------------------------ options / editing / import
  function slider(min, max, step, value, fmt, onchange) {
    const out = h('span.note', { style: { minWidth: '44px', textAlign: 'right' } }, fmt(value));
    const r = h('input', { type: 'range', min, max, step, style: { flex: '1', maxWidth: '240px' }, oninput: () => { out.textContent = fmt(+r.value); }, onchange: () => onchange(+r.value) });
    r.value = value;
    return h('div.row', r, out);
  }

  /** Sound presets, equaliser and quality (Hymn options → Music). Any single change makes the preset "Custom". */
  function soundControls(reopen) {
    const s = S();
    const custom = () => { if (S().musicPreset !== 'custom') { settings.set('hymns.musicPreset', 'custom'); presetSel.value = 'custom'; } };
    const apply = () => music.applyEffects();
    const presetSel = h('select.field', { 'aria-label': 'Sound preset', onchange: () => {
      const p = SOUND_PRESETS[presetSel.value];
      settings.set('hymns.musicPreset', presetSel.value);
      if (p) {
        Object.entries(p[1]).forEach(([k, v]) => settings.set('hymns.' + k, v));
        const eqp = EQ_PRESETS[p[1].musicEqPreset];
        if (eqp) settings.set('hymns.musicEq', eqp[1].slice());
        apply(); if (packFor(S().musicHQ)) hqPrefetch(packFor(S().musicHQ));
        if (music.isPlaying()) music.rearrange({ natural: S().musicNatural !== false });
        reopen();
      }
    } }, ...Object.entries(SOUND_PRESETS).map(([k, [label]]) => h('option', { value: k }, label)), h('option', { value: 'custom' }, 'Custom'));
    presetSel.value = SOUND_PRESETS[s.musicPreset] ? s.musicPreset : 'custom';

    const eqVals = (Array.isArray(s.musicEq) ? s.musicEq : [0, 0, 0, 0, 0]).slice(0, 5);
    const bands = EQ_BANDS.map(([, freq, name], i) => {
      const out = h('span.meq-v', fmtDb(eqVals[i]));
      const r = h('input', { type: 'range', min: -12, max: 12, step: 1, 'aria-label': name + ' (' + freq + ' Hz)',
        oninput: () => { out.textContent = fmtDb(+r.value); },
        onchange: () => { eqVals[i] = +r.value; settings.set('hymns.musicEq', eqVals.slice()); settings.set('hymns.musicEqPreset', 'custom'); eqSel.value = 'custom'; custom(); apply(); } });
      r.value = eqVals[i] || 0;
      return h('div.meq-band', h('span.meq-n', name), r, out);
    });
    const eqSel = h('select.field', { 'aria-label': 'Equaliser preset', onchange: () => {
      const p = EQ_PRESETS[eqSel.value];
      settings.set('hymns.musicEqPreset', eqSel.value);
      if (!p) return;
      p[1].forEach((v, i) => { eqVals[i] = v; bands[i].querySelector('input').value = v; bands[i].querySelector('.meq-v').textContent = fmtDb(v); });
      settings.set('hymns.musicEq', eqVals.slice()); custom(); apply();
    } }, ...Object.entries(EQ_PRESETS).map(([k, [label]]) => h('option', { value: k }, label)), h('option', { value: 'custom' }, 'Custom'));
    eqSel.value = EQ_PRESETS[s.musicEqPreset] ? s.musicEqPreset : 'custom';

    return [
      h('label', 'Sound preset'), h('div.col', { style: { alignItems: 'stretch', gap: '4px' } }, presetSel,
        h('p.note', 'Sets the instruments, church echo, quality and equaliser together. Fine-tune anything below.')),
      h('label', 'Equaliser'), h('div.col', { style: { alignItems: 'stretch', gap: '6px' } }, eqSel, h('div.meq', ...bands)),
      h('label', 'Sound quality'), seg([['hermite', 'Best'], ['linear', 'Lighter']], s.musicInterp === 'linear' ? 'linear' : 'hermite', (v) => { settings.set('hymns.musicInterp', v); custom(); apply(); }),
      h('label', 'Notes at once'), h('div.col', { style: { alignItems: 'flex-start', gap: '4px' } },
        seg([['96', '96'], ['192', '192'], ['256', '256'], ['350', '350']], String(+s.musicVoices || 256), (v) => { settings.set('hymns.musicVoices', +v); custom(); apply(); }),
        h('p.note', 'Lighter and fewer notes help old PCs and phones that crackle; Best and 256 or more for the church PC.')),
    ];
  }
  const fmtDb = (v) => (v > 0 ? '+' : '') + (v || 0) + ' dB';

  function optionsDialog() {
    const s = S();
    // What the chosen sounds are on this device, and whether their download is already here.
    const hqNote = h('p.note');
    const paintHQ = async () => {
      const v = S().musicHQ || 'auto';
      const pack = packFor(v);
      const haveHQ = await hqStored('hq'), haveStudio = await hqStored('studio');
      clear(hqNote);
      if (!pack) hqNote.append(v === 'auto' ? 'Automatic: high quality on PCs and laptops; standard sounds on phones (smaller and lighter). ' : 'Standard sounds (GeneralUser GS). ');
      else {
        const P = PACKS[pack], have = pack === 'studio' ? haveStudio : haveHQ;
        hqNote.append(pack === 'studio'
          ? 'Studio: every one of the piano’s 16 recorded loudness layers, its full natural ring, finer audio and a fuller pipe organ. Best on the church PC. '
          : 'Recorded concert grand piano and church pipe organ. ');
        if (v === 'studio' && pack !== 'studio') hqNote.append('This device has too little memory for Studio, so it uses High quality. ');
        hqNote.append(have ? 'Downloaded on this device.' : 'Downloading in the background (' + P.mb + ' MB, once); hymns play with ' + (pack === 'studio' && haveHQ ? 'High quality' : 'the standard sounds') + ' until it is done, then offline too.');
        if (!have) {
          const prog = h('b', { style: { marginLeft: '6px' } });
          hqNote.append(prog);
          hqPrefetch(pack, (t, pct) => { prog.textContent = pct + '%'; }).then(() => { if (hqNote.isConnected) paintHQ(); });
        }
      }
      const rm = (pk, label) => h('button.btn.ghost.sm', { type: 'button', onclick: async () => { await hqRemove(pk); paintHQ(); toast(label + ' sounds removed from this device.'); } }, 'Remove ' + label);
      if (haveHQ) hqNote.append(' ', rm('hq', 'High quality'));
      if (haveStudio) hqNote.append(' ', rm('studio', 'Studio'));
      if (music.where === 'display') hqNote.append(' The church PC plays the music and uses its own setting for Automatic.');
    };
    paintHQ();
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
        lookPanel('hymn', ctx, () => { if (hymn) { restage(); syncLive(); } }),
        h('h3', { style: { gridColumn: '1 / -1', marginTop: '10px' } }, 'Music'),
        ...soundControls(() => { closeModal(); setTimeout(optionsDialog, 60); }),
        h('label', 'Volume'), slider(0, 2, 0.05, s.musicVolume == null ? 1.3 : s.musicVolume, (v) => Math.round(v / 1.3 * 100) + '%', (v) => music.setVolume(v)),
        h('label', 'Instruments'), seg([['auto', 'Automatic'], ['off', 'Standard'], ['on', 'High quality'], ['studio', 'Studio']], s.musicHQ || 'auto', (v) => { settings.set('hymns.musicPreset', 'custom'); settings.set('hymns.musicHQ', v); music.applyEffects(); paintHQ(); }),
        h('label', ''), hqNote,
        h('label', 'Church echo'), seg([['off', 'Off'], ['small', 'Small room'], ['church', 'Church'], ['large', 'Large church']], s.musicRoom || 'church', (v) => { settings.set('hymns.musicPreset', 'custom'); settings.set('hymns.musicRoom', v); music.applyEffects(); }),
        h('label', 'Natural playing'), toggle('Melody sings out, inner parts softer, every note a little different', s.musicNatural !== false, (v) => { settings.set('hymns.musicPreset', 'custom'); settings.set('hymns.musicNatural', v); if (music.isPlaying()) music.rearrange({ natural: v }); }, 'Hymn files often strike every note equally hard. A playing hymn changes straight away.'),
        h('label', 'Reverb'), slider(0, 127, 1, s.musicReverb == null ? 59 : s.musicReverb, (v) => String(v), (v) => { settings.set('hymns.musicPreset', 'custom'); settings.set('hymns.musicReverb', v); music.applyEffects(); }),
        h('label', 'Chorus effect'), slider(0, 127, 1, s.musicChorus == null ? 43 : s.musicChorus, (v) => String(v), (v) => { settings.set('hymns.musicPreset', 'custom'); settings.set('hymns.musicChorus', v); music.applyEffects(); }),
        h('label', ''), h('p.note', 'Reverb is used when Church echo is off (59 and chorus 43 are the levels GeneralUser GS’s author recommends). ',
          h('button.btn.sm', { type: 'button', onclick: () => { settings.set('hymns.musicReverb', 59); settings.set('hymns.musicChorus', 43); settings.set('hymns.musicRoom', 'church'); settings.set('hymns.musicHQ', 'auto'); settings.set('hymns.musicNatural', true); settings.set('hymns.musicInterp', 'hermite'); settings.set('hymns.musicVoices', 256); settings.set('hymns.musicEq', [0, 0, 0, 0, 0]); settings.set('hymns.musicEqPreset', 'flat'); settings.set('hymns.musicPreset', 'balanced'); music.applyEffects(); closeModal(); optionsDialog(); } }, 'Use recommended')),
        h('label', 'Music plays on'), seg([['auto', 'Automatic'], ['here', 'This device'], ['display', 'The display']], s.musicOutput || 'auto', (v) => settings.set('hymns.musicOutput', v)),
        h('label', ''), h('p.note', 'Automatic: on this device, except when this phone controls the church PC through the companion — then the PC plays it.')),
      actions: [{ label: 'Done', primary: true }],
    });
  }

  async function saveBookEdit(hy, isNew, bk = book, quiet = false) {
    if (bk.builtin) {
      const key = 'overlay:' + bk.id;
      const ov = (await db.get('hymnbooks', key)) || { id: key, overlayOf: bk.id, hymns: [] };
      const i = ov.hymns.findIndex((x) => x.n === hy.n);
      if (i >= 0) ov.hymns[i] = hy; else ov.hymns.push(hy);
      await db.put('hymnbooks', key, ov);
    } else await db.put('hymnbooks', bk.id, { id: bk.id, name: bk.name, short: bk.short, lang: bk.lang, hymns: bk.hymns });
    const o = Array.from(bookSel.options).find((x) => x.value === bk.id);   // the count in the book list
    if (o) o.textContent = bk.name + ' (' + bk.hymns.length + ')';
    if (quiet) return;
    if (isNew) toast('Hymn ' + hy.n + ' added.', 'ok'); else toast('Hymn ' + hy.n + ' saved.', 'ok');
  }

  /** The next free number for a song a church adds itself. In Shared Hymns, 501 and up belong to the songs shared
   *  by all churches, so a church's own songs take the next number below 501. */
  function nextNumber(bk) {
    const below = bk.shared ? bk.hymns.filter((x) => x.n < FIRST_NUMBER) : bk.hymns;
    let num = below.reduce((m, x) => Math.max(m, +x.n || 0), 0) + 1;
    if (bk.shared && num >= FIRST_NUMBER) num = bk.hymns.reduce((m, x) => Math.max(m, +x.n || 0), 0) + 1;
    return num;
  }

  /** hy: the hymn to edit, or null for a new song (the language is asked first, then a number is given). */
  function editHymn(hy, intoId) {
    const n = h('input.field', { type: 'number', min: 1, value: hy ? hy.n : '', style: { width: '110px' }, oninput: () => { n.dataset.touched = '1'; } });
    const t = h('input.field', { value: hy ? hy.t : '', placeholder: 'Title' });
    const a = h('input.field', { value: hy ? hy.a || '' : '', placeholder: 'Author (optional)' });
    const ta = h('textarea.field', { rows: 14, value: hy ? lyricsText(hy) : '', placeholder: 'Stanza 1 line 1\nStanza 1 line 2\n\nChorus:\nChorus line 1\n\nStanza 2 line 1…' });
    ta.value = hy ? lyricsText(hy) : '';
    // New song: which language (Shared Hymns book) it goes in. A downloaded or own hymnbook that is open can take it too.
    let into = book;
    let langRow = null;
    if (!hy) {
      const shared = books.filter((b) => b.shared);
      const ownOpen = book && !book.builtin && !book.shared ? book : null;
      const first = ((settings.v.church && settings.v.church.languages) || []).find((x) => x && shared.some((b) => b.lang === x));
      into = books.find((b) => b.id === intoId) || (book && book.shared ? book : ownOpen) || shared.find((b) => b.lang === first) || shared[0] || book;
      const sel = h('select.field', { 'aria-label': 'Language of the new song' },
        shared.length ? h('optgroup', { label: 'Shared Hymns' }, shared.map((b) => h('option', { value: b.id }, b.name))) : null,
        ownOpen ? h('optgroup', { label: 'This hymnbook' }, h('option', { value: ownOpen.id }, ownOpen.name)) : null,
        h('option', { value: '+' }, 'Another language…'));
      sel.value = into ? into.id : '+';
      const numFor = () => { if (!n.dataset.touched && into) n.value = nextNumber(into); };
      sel.addEventListener('change', () => {
        if (sel.value === '+') { addSharedLanguage((code) => loadBooks().then(() => editHymn(null, sharedBookId(code)))); return; }
        into = books.find((b) => b.id === sel.value); numFor();
      });
      numFor();
      langRow = [h('label', 'Language'), sel];
    }
    modal({
      title: hy ? 'Edit hymn ' + hy.n : 'New song', wide: true,
      body: h('div.col', h('div.form', ...(langRow || []), h('label', 'Number'), n, h('label', 'Title'), t, h('label', 'Author'), a),
        h('p.note', 'Leave an empty line between stanzas. Start the chorus with a line “Chorus:”.' + (hy && hy.locked ? ' Only add words your church is licensed to use; they stay on this device.' : '')
          + (!hy ? ' After saving, “Share with all churches” offers it to every church that has this language.' : '')), ta),
      actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onclick: async () => {
        const bk = hy ? book : into;
        if (!bk) { toast('Choose a language first.', 'err'); return false; }
        const num = parseInt(n.value, 10);
        const p = parseLyrics(ta.value);
        if (!num || !t.value.trim() || !p.v.length) { toast('A number, a title and at least one stanza are needed.', 'err'); return false; }
        if (!hy && bk.hymns.some((x) => x.n === num) && !(await confirmBox('Number ' + num + ' is taken', 'Number ' + num + ' is already “' + bk.hymns.find((x) => x.n === num).t + '” in ' + bk.name + '. Replace it?', 'Replace', true))) return false;
        const nh = { n: num, t: t.value.trim(), a: a.value.trim(), v: p.v, c: p.c };
        if (hy && hy.ccli) nh.ccli = hy.ccli;
        const i = bk.hymns.findIndex((x) => x.n === num);
        if (i >= 0) bk.hymns[i] = nh; else { bk.hymns.push(nh); bk.hymns.sort((x, y) => x.n - y.n); }
        await saveBookEdit(nh, i < 0, bk);
        if (book !== bk) setBook(bk.id);
        selectHymn(nh);
        syncLive();
      } }],
    });
  }

  /** A copyrighted hymn without words: the title slide still works; the church adds the words under its licence. */
  function licencePanel(hy) {
    const norm = (t) => normalize(t || '').replace(/[^a-z0-9 ]+/g, '').trim();
    const pd = book && book.id === 'sda-online' ? books.find((b) => b.id === 'church-1941') : null;
    const twin = pd ? pd.hymns.find((x) => x.v.length && norm(x.t) === norm(hy.t)) : null;
    const ss = 'https://songselect.ccli.com/search/results?search=' + encodeURIComponent(hy.ccli || hy.t);
    return h('div.licence-panel', { role: 'note' },
      h('b', 'Words not included'),
      h('p.note', 'This song is under copyright, so SDA Sabbath shows only its number and title (the title slide works). ' +
        'If your church is licensed (for example CCLI, or the publisher’s permission), add the words: they stay on your own devices and are never shared.'),
      h('div.row.wrap',
        h('button.btn.sm.primary', { type: 'button', onclick: () => editHymn(hy) }, icon('edit'), h('span', 'Add the words')),
        h('button.btn.sm', { type: 'button', onclick: importLicensed }, icon('upload'), h('span', 'Import licensed words…')),
        twin ? h('button.btn.sm', { type: 'button', title: 'Older public-domain words of this hymn', onclick: () => { setBook(pd.id); selectHymn(twin); } }, icon('hymn'), h('span', 'Church Hymnal 1941 #' + twin.n)) : null,
        h('a.btn.sm', { href: ss, target: '_blank', rel: 'noopener' }, icon('search'), h('span', hy.ccli ? 'SongSelect (CCLI ' + hy.ccli + ')' : 'Look up on SongSelect'))),
      h('p.note', 'Showing song words on a live stream needs your church’s CCLI Streaming Licence as well.'));
  }

  /** Words a licensed church imports for a built-in book: our .json / .txt hymnbook (by number), or one song
   *  from SongSelect (.usr or .txt, matched by title or put on the chosen hymn), like OpenLP and FreeShow. */
  async function importLicensed() {
    if (!book) return;
    const ok = await confirmBox('Import licensed words',
      'Only import words your church is licensed to use (CCLI, or the publisher’s permission). They are saved on this device for “' + book.name + '” and are never shared. Accepted: a SongSelect file (.usr or .txt), or a hymnbook file (VideoPsalm .vpc or .json, SDA Sabbath .json, or .txt with “# 73 Title” before each hymn) whose numbers match this book.',
      'Choose file…');
    if (!ok) return;
    const inp = h('input', { type: 'file', accept: '.json,.txt,.usr,.vpc', multiple: true });
    inp.onchange = async () => {
      const files = Array.from(inp.files || []);
      let added = 0, last = null;
      const norm = (t) => normalize(t || '').replace(/[^a-z0-9 ]+/g, '').trim();
      for (const f of files) {
        try {
          const vpc = /\.vpc$/i.test(f.name);            // VideoPsalm songbook (a zip)
          const text = vpc ? '' : await readText(f);
          let list = [];
          if (vpc) list = (await parseHymnFile(f)).hymns;
          else if (/^\s*[[{]/.test(text)) list = normaliseBook(relaxedJson(text), f.name).hymns;
          else if (/^\s*#\s*\d+/m.test(text) && !/^\s*\[S\b/m.test(text)) list = parseTxtBook(text, f.name).hymns;
          else {
            const sg = parseSongSelect(text);
            if (sg) {
              const hit = book.hymns.find((x) => norm(x.t) === norm(sg.t)) || (files.length === 1 && hymn && hymn.locked ? hymn : null);
              const n = hit ? hit.n : Math.max(0, ...book.hymns.map((x) => x.n)) + 1;
              list = [{ n, t: hit ? hit.t : sg.t, a: sg.a || (hit && hit.a) || '', v: sg.v, c: sg.c, ccli: sg.ccli || (hit && hit.ccli) || '' }];
            }
          }
          for (const x of list) {
            if (!x.v || !x.v.length) continue;
            const nh = { n: x.n, t: x.t, a: x.a || '', v: x.v, c: x.c || null };
            if (x.ccli) nh.ccli = String(x.ccli);
            const i = book.hymns.findIndex((y) => y.n === nh.n);
            if (i >= 0) { if (!nh.t) nh.t = book.hymns[i].t; book.hymns[i] = nh; } else { book.hymns.push(nh); book.hymns.sort((a, b) => a.n - b.n); }
            await saveBookEdit(nh, i < 0, book, true);
            added++; last = nh;
          }
        } catch (e) { toast('Could not read ' + f.name + ': ' + e.message, 'err', 6000); }
      }
      if (!added) { toast('No song words found in the file.', 'err'); return; }
      toast(added + (added === 1 ? ' song' : ' songs') + ' with words saved on this device.', 'ok');
      renderList();
      if (last) selectHymn(book.hymns.find((x) => x.n === last.n));
    };
    inp.click();
  }

  function exportBook() {
    if (!book) return;
    const out = { id: book.id, name: book.name, short: book.short, lang: book.lang, hymns: book.hymns.map(({ n, t, a, v, c }) => ({ n, t, a, v, c })) };
    download(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }), (book.short || book.id) + '-hymns.json');
    toast('Exported. Before you share this file: song words belong to their owners — songs from CCLI or other publishers may not be passed on, even if your church may sing them.', '', 8000);
  }

  /** Add the Shared Hymns book of another language (any language with a Bible or hymnbook in the download lists). */
  function addSharedLanguage(then) {
    const have = sharedLangs(settings);
    const sel = h('select.field', { 'aria-label': 'Language' }, languageChoices().filter((l) => !have.includes(l.key)).map((l) => h('option', { value: l.key }, l.name)));
    modal({ title: 'Shared Hymns in another language', body: h('div.col', { style: { gap: '10px' } },
      h('p.note', 'Every language has its own Shared Hymns. Churches add songs to it and share them; when they are approved every church that has the language gets them.'),
      h('div.form', h('label', 'Language'), sel)),
    actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onclick: () => {
      setSharedLangs(settings, have.concat(sel.value));
      settings.set('hymns.book', sharedBookId(sel.value));
      toast('Shared Hymns – ' + langName(sel.value) + ' added.', 'ok');
      if (then) then(sel.value);
    } }] });
  }
  async function deleteBook() {
    if (book && book.shared) {
      if (!(await confirmBox('Remove Shared Hymns – ' + book.name + '?', 'Take this language’s Shared Hymns off this device? Songs your church added to it stay saved and come back if you add the language again (Hymns → More → Shared Hymns in another language).', 'Remove', true))) return;
      setSharedLangs(settings, sharedLangs(settings).filter((x) => x !== book.lang));   // the 'selah-hymnbooks' event reloads the list
      return;
    }
    if (!book || book.builtin) return;
    if (!(await confirmBox('Delete hymnbook?', 'Remove “' + book.name + '” from this device?', 'Delete', true))) return;
    await removeHymnbook(book.id);   // the 'selah-hymnbooks' event reloads the list
  }

  // ------------------------------------------------------------ shared choruses
  /** New choruses from other churches: quietly when the tab opens, or when asked from More. */
  let checking = false;
  async function checkShared(asked) {
    if (checking) return;
    checking = true;
    try {
      const r = await syncCommunity({ force: !!asked });
      if (r.changed) {
        const keep = book && book.id, keepN = hymn && hymn.n;
        await loadBooks();
        if (keep) setBook(keep);
        if (keepN && book) { const x = book.hymns.find((y) => y.n === keepN); if (x) selectHymn(x); }
        // Only the languages this church has: "2 new shared hymns: Afrikaans 1, English 1".
        const mine = Object.entries(r.byLang || {}).filter(([lg]) => sharedLangs(settings).includes(lg));
        const cnt = mine.reduce((m, [, c]) => m + c, 0);
        toast(cnt ? cnt + ' new shared hymn' + (cnt === 1 ? '' : 's') + ': ' + mine.map(([lg, c]) => langName(lg) + ' ' + c).join(', ') + '. Find them in Shared Hymns.' : 'Shared Hymns updated.', 'ok', 6000);
      } else if (asked) toast(r.offline ? 'No internet connection. Shared Hymns are checked when this device is online.' : r.error ? 'Could not check for shared hymns: ' + r.error : 'You have all the shared hymns.', r.error ? 'err' : '', 4000);
    } finally { checking = false; }
  }
  window.addEventListener('online', () => setTimeout(() => checkShared(false), 3000));

  /** Send a chorus to the shared list: a GitHub issue with the words filled in; the chorus robot checks it
   *  and the maintainer approves it, then every church gets it. */
  async function shareChorus(hy) {
    const myMidi = await db.get('files', 'midi:' + book.id + ':' + hy.n).catch(() => null);
    const lg = book.lang || 'en', lgName = langName(lg);
    const name = h('input.field', { value: church().name, placeholder: 'Your church (optional, shown publicly)' });
    const RIGHTS = [
      ['public-domain', 'Public domain (an old song, or the writer died more than 70 years ago)'],
      ['own', 'We wrote it (our church or a member)'],
      ['permission', 'The writer allows it to be shared'],
      ['unsure', 'I am not sure'],
    ];
    let rights = '';
    const rightsList = h('div.col', { role: 'radiogroup', 'aria-label': 'May these words be shared?', style: { gap: '4px' } },
      ...RIGHTS.map(([k, lab]) => h('label.switch', h('input', { type: 'radio', name: 'chorus-rights', value: k, onchange: () => { rights = k; } }), h('span', lab))));
    const preview = h('pre.note', { style: { whiteSpace: 'pre-wrap', maxHeight: '180px', overflow: 'auto', margin: '0', padding: '8px', border: '1px solid var(--line)', borderRadius: '8px' } }, sharedText(hy));
    const midiRow = myMidi && myMidi.blob ? h('div.row.wrap', h('span.note', 'Your MIDI file for this song can go with it: save it, then drag the .zip into the GitHub page.'),
      h('button.btn.sm', { type: 'button', onclick: async () => {
        const z = await zipBlobs([{ name: (hy.t.replace(/[^\w\- ]+/g, '').trim() || 'chorus') + '.mid', blob: myMidi.blob }]);
        download(z, (hy.t.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'chorus') + '_midi.zip');
      } }, icon('download'), h('span', 'Save MIDI as .zip'))) : h('p.note', 'No MIDI? The robot looks for one and attaches it if it finds a good match.');
    const body = h('div.col', { style: { gap: '10px' } },
      h('p', 'Every church that has Shared Hymns – ' + lgName + ' gets this song there (with the music, if there is a MIDI), with the next shared number (501 and up). The SDA Sabbath maintainer checks each song first.'),
      h('b', hy.t + (hy.a ? ' — ' + hy.a : '')), preview,
      h('label.muted', 'May these words be shared with every church?'), rightsList,
      h('p.note', 'Songs from CCLI or other song publishers (most modern worship songs) may not be shared, even if your church has a licence to sing them.'),
      h('label.muted', 'Shared by'), name,
      midiRow,
      h('p.note', 'Sending uses GitHub (a free account is needed). The words are filled in for you: press “Create” / “Submit new issue” on the page that opens.'));
    const go = () => {
      if (!rights) { toast('Choose whether the words may be shared.', 'err'); return false; }
      if (rights === 'unsure') { toast('Please find out who wrote it first. Only songs that may be shared can go to every church.', 'err', 6000); return false; }
      const url = shareUrl(hy, { church: name.value.trim(), rights, language: lgName + ' (' + lg + ')' });
      if (url.length > 7800) {
        navigator.clipboard && navigator.clipboard.writeText(sharedText(hy)).catch(() => {});
        window.open(shareUrl(Object.assign({}, hy, { v: [['(paste the words here)']], c: null }), { church: name.value.trim(), rights, language: lgName + ' (' + lg + ')' }), '_blank', 'noopener');
        toast('The words are long, so they were copied: paste them into the Lyrics box on GitHub.', '', 8000);
      } else window.open(url, '_blank', 'noopener');
      toast('Thank you! When the song is approved, every church with ' + lgName + ' gets it with its next update check.', 'ok', 7000);
      return true;
    };
    modal({ title: 'Share “' + hy.t + '” with all churches', body, wide: true, actions: [
      { label: 'Cancel' },
      { label: 'No GitHub account? Copy the song', onclick: () => {
        const txt = 'Song for SDA Sabbath (Shared Hymns – ' + lgName + ')\nTitle: ' + hy.t + '\nWriter: ' + (hy.a || '') + '\nShared by: ' + name.value.trim() + '\nMay be shared: ' + (RIGHTS.find((r) => r[0] === rights) || ['', 'not said'])[1] + '\n\n' + sharedText(hy);
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Copied. Send it to the person who looks after SDA Sabbath, or to the maintainer on GitHub.', 'ok', 7000), () => toast('Could not copy.', 'err'));
        return false;
      } },
      { label: 'Share on GitHub', primary: true, onclick: go }] });
  }

  async function addToPlan() { if (cue) (await ctx.tab('plan')).addItem(cue.plan); }

  // ------------------------------------------------------------ online lyrics
  // Search public lyric sources, show the likeliest songs, let the person pick one, check the words as slides
  // and keep it offline in a book (Shared Hymns – English by default) so it can be found again like any other song.
  function findLyrics() {
    let aiOn = ai.hasKey();
    let seq = 0, picked = null;
    const qIn = h('input.field.grow', { type: 'search', 'aria-label': 'Song to find', placeholder: 'Title, first line or some of the words. Add “by singer” if you know it.', value: q.value.trim(),
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); search(); } } });
    const status = h('p.note.lyr-status', 'Type a song and press Search. Songs already on this device are shown first.');
    const offBox = h('div.col.lyr-off');
    const resBox = h('div.col.lyr-res');
    const detail = h('div.lyr-detail', { hidden: true });
    const linkBox = h('div.row.wrap.lyr-links', { hidden: true });
    const aiChip = ai.hasKey()
      ? h('button.chip', { type: 'button', 'aria-pressed': String(aiOn), title: 'Let AI suggest which songs your words belong to. The lyrics still come from the lyric sites, never from AI.',
        onclick: () => { aiOn = !aiOn; aiChip.setAttribute('aria-pressed', String(aiOn)); } }, icon('sparkle'), 'Ask AI to help identify')
      : null;

    function offlineMatches(query) {
      clear(offBox);
      const { text } = splitQuery(query);
      const hits = [];
      books.forEach((bk) => bk.hymns.forEach((hy) => { if (hits.length < 6 && matches(hy, text)) hits.push({ bk, hy }); }));
      if (!hits.length) return;
      offBox.appendChild(h('h4', 'Already on this device'));
      hits.forEach(async ({ bk, hy }) => {
        const hasMusic = await music.entry(bk.id, hy.n).catch(() => null);
        offBox.appendChild(h('button.lyr-item', { type: 'button', onclick: () => { closeModal(); if (book !== bk) setBook(bk.id); selectHymn(hy); } },
          h('div.grow', h('div.row', h('b.grow', hy.n + '  ' + hy.t), hasMusic ? h('span.lyr-badge.midi', 'MIDI') : null),
            h('div.note.trunc', bk.name + ' · ' + firstLine(hy))), h('span.lyr-go', 'Open')));
      });
    }

    let rankedLast = [];
    function paint(list) {
      rankedLast = list;
      clear(resBox);
      if (!list.length) return;
      resBox.appendChild(h('h4', 'Found online'));
      list.forEach(async (c) => {
        const lab = matchLabel(c.score);
        // Check MIDI availability for this title.
        if (c._midi == null) { const m = await findMidi(c.title).catch(() => []); c._midi = m.length > 0; }
        const badge = lab + ' · ' + Math.round(c.score * 100) + '%' + (c._midi ? ' · MIDI' : '');
        resBox.appendChild(h('button.lyr-item', { type: 'button', 'aria-pressed': String(picked === c), onclick: () => choose(c) },
          h('div.grow', h('div.row', h('b.grow.trunc', c.title), h('span.lyr-badge.' + lab.split(' ')[0].toLowerCase(), badge)),
            h('div.note.trunc', [c.artist, c.album, c.source + (c.aiPick ? ' · AI suggested' : '')].filter(Boolean).join(' · ')),
            c.preview ? h('div.lyr-prev', c.preview) : null)));
      });
    }

    async function search() {
      const query = qIn.value.trim();
      if (!query) { status.textContent = 'Type a title, a first line or some words first.'; qIn.focus(); return; }
      const my = ++seq;
      picked = null; detail.hidden = true; clear(detail); clear(resBox);
      offlineMatches(query);
      renderLinks(query);
      if (navigator.onLine === false) { status.textContent = 'No internet connection, so online search is not possible. You can still paste the words below.'; openPaste(query); return; }
      status.textContent = 'Searching the lyric sites' + (aiOn ? ' and asking AI to help identify the song' : '') + '…';
      let out;
      try { out = await findSongs(query, { useAi: aiOn, onUpdate: (r) => { if (my === seq) paint(r); } }); }
      catch (e) { if (my === seq) status.textContent = 'Search failed: ' + ((e && e.message) || e); return; }
      if (my !== seq) return;
      paint(out.results);
      if (out.results.length) status.textContent = out.results.length + ' possible song' + (out.results.length === 1 ? '' : 's') + '. Pick the right one to check the words.';
      else if (out.errors.length >= 2) status.textContent = 'The lyric sites could not be reached (' + out.errors.join('; ') + '). Check the internet connection, or use the links below and paste the words.';
      else status.textContent = 'Nothing found for “' + query + '”. Try fewer words, the first line, or use the links below and paste the words.';
      if (!out.results.length) openPaste(query);
    }

    function renderLinks(query) {
      clear(linkBox);
      linkBox.hidden = false;
      linkBox.appendChild(h('span.note', 'Not the right song? Look on:'));
      sourceLinks(query).forEach(([name, url]) => linkBox.appendChild(h('a.btn.sm', { href: url, target: '_blank', rel: 'noopener noreferrer' }, name + ' ↗')));
      linkBox.appendChild(h('button.btn.sm', { type: 'button', onclick: () => openPaste(query) }, icon('edit'), h('span', 'Paste words')));
    }

    async function choose(c) {
      picked = c;
      paint(rankedLast);
      openDetail({ title: c.title, author: c.artist, text: '', loading: true, source: c });
      try {
        const raw = await lyricsOf(c);
        if (picked !== c) return;
        const song = songFromPlain(raw);
        // Also look for a MIDI file.
        const midis = await findMidi(c.title).catch(() => []);
        openDetail({ title: c.title, author: c.artist, text: songText(song), source: c, midis });
      } catch (e) {
        if (picked !== c) return;
        const msg = (e && e.message) || String(e);
        const is404 = /404|not found|no words/i.test(msg);
        openDetail({ title: c.title, author: c.artist, text: '', error: is404 ? 'This source returned 404 — no lyrics available. Try another result, or check “Already on this device” above.' : msg, source: c });
      }
    }
    function openPaste(query) {
      picked = null;
      openDetail({ title: splitQuery(query || '').text, author: splitQuery(query || '').artist, text: '', paste: true });
    }

    function openDetail(o) {
      clear(detail);
      detail.hidden = false;
      if (o.loading) { detail.appendChild(h('p.note', 'Getting the words for “' + o.title + '”…')); return; }
      const titleIn = h('input.field', { value: o.title || '', 'aria-label': 'Song title', placeholder: 'Title' });
      const authorIn = h('input.field', { value: o.author || '', 'aria-label': 'Singer or author', placeholder: 'Singer or author (optional)' });
      const ta = h('textarea.field.lyr-ta', { rows: 12, 'aria-label': 'Lyrics', placeholder: 'Stanza 1 line 1\nStanza 1 line 2\n\nChorus:\nChorus line 1\n\nStanza 2 line 1…' });
      ta.value = o.text || '';
      const sum = h('p.note.lyr-sum', '');
      const cards = h('div.lyr-cards');
      const refresh = () => {
        const p = parseLyrics(ta.value);
        sum.textContent = p.v.length || p.c ? p.v.length + ' stanza' + (p.v.length === 1 ? '' : 's') + (p.c ? ' + chorus' : '') + '. Each becomes its own slide; long stanzas are split to fit the screen.' : 'No words yet.';
        clear(cards);
        p.v.forEach((s, i) => cards.appendChild(h('div.lyr-card', h('b', 'Stanza ' + (i + 1)), h('div', s.join('\n')))));
        if (p.c) cards.appendChild(h('div.lyr-card.chorus', h('b', 'Chorus'), h('div', p.c.join('\n'))));
      };
      ta.addEventListener('input', debounce(refresh, 150));
      const bookSel2 = h('select.field', { 'aria-label': 'Add to book' });
      books.forEach((bk) => bookSel2.appendChild(h('option', { value: bk.id }, (bk.shared ? 'Shared Hymns – ' : '') + bk.name)));
      bookSel2.value = book && (book.shared || !book.builtin) ? book.id : books.some((b) => b.id === COMMUNITY_BOOK) ? COMMUNITY_BOOK : book ? book.id : (books[0] && books[0].id) || '';
      // MIDI picker
      let chosenMidi = (o.midis && o.midis[0]) || null;
      const midiBox = h('div.col', { style: { gap: '4px' } });
      if (o.midis && o.midis.length) {
        midiBox.appendChild(h('span.note', 'MIDI found — pick one to play with this song:'));
        o.midis.forEach((m) => {
          const btn = h('button.chip', { type: 'button', 'aria-pressed': String(chosenMidi === m), onclick: () => { chosenMidi = m; midiBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn))); } },
            m.name + ' (' + Math.round(m.score * 100) + '%)');
          midiBox.appendChild(btn);
        });
        midiBox.appendChild(h('button.chip', { type: 'button', onclick: () => { chosenMidi = null; midiBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false')); } }, 'No MIDI'));
      } else {
        midiBox.appendChild(h('span.note', 'No MIDI found for this title. You can still add the words.'));
      }
      const doAdd = async (andNext) => {
        const bk = books.find((b) => b.id === bookSel2.value);
        if (!bk) { toast('Choose a book to keep it in.', 'err'); return; }
        const p = parseLyrics(ta.value);
        if (!p.v.length && !p.c) { toast('There are no words to add yet.', 'err'); return; }
        const title = titleIn.value.trim() || 'Untitled song';
        if (bk.hymns.some((x) => normalize(x.t) === normalize(title)) &&
          !(await confirmBox('Already in this book', '“' + title + '” is already in ' + bk.name + '. Add another copy?', 'Add anyway'))) return;
        const num = nextNumber(bk);   // in Shared Hymns, 501 and up are the songs shared by all churches
        const nh = { n: num, t: title, a: authorIn.value.trim(), v: p.v.length ? p.v : [p.c], c: p.v.length ? p.c : null };
        bk.hymns.push(nh); bk.hymns.sort((a, b) => a.n - b.n);
        try { await saveBookEdit(nh, true, bk, true); }
        catch (e) { bk.hymns = bk.hymns.filter((x) => x !== nh); toast('Could not save the song: ' + ((e && e.message) || e), 'err', 7000); return; }
        // Download and store the MIDI if one was chosen.
        if (chosenMidi && chosenMidi.url) {
          try {
            const blob = await fetchMidi(chosenMidi.url);
            await db.put('files', 'midi:' + bk.id + ':' + num, { id: 'midi:' + bk.id + ':' + num, kind: 'midi', name: chosenMidi.name, blob, added: Date.now() });
            toast('MIDI “' + chosenMidi.name + '” assigned.', 'ok', 2500);
          } catch (e) { toast('Words saved, but MIDI could not be downloaded: ' + ((e && e.message) || e), '', 4000); }
        }
        closeModal();
        if (book !== bk) setBook(bk.id);
        selectHymn(nh);
        toast('“' + title + '” is saved in ' + bk.name + ' (# ' + num + ') and works offline.' + (andNext ? ' It is on the Next screen.' : '') + (chosenMidi ? ' MIDI assigned.' : ''), 'ok', 4500);
      };
      detail.append(
        o.error ? h('p.note.warn', o.error + ' You can paste the words below instead.') : null,
        h('h4', o.paste ? 'Paste the words' : 'Check the words'),
        h('p.note', 'Words from ' + (o.source ? o.source.source : 'you') + '. Fix any mistakes, keep one empty line between stanzas, and start the chorus with a line “Chorus:”.'),
        h('div.form', h('label', 'Title'), titleIn, h('label', 'Singer / author'), authorIn),
        ta, sum, cards,
        midiBox,
        h('div.form', h('label', 'Keep in'), bookSel2),
        h('p.note', 'Song words belong to their owners. Check that your church’s CCLI (or other) licence covers showing them.'),
        h('div.row.wrap',
          h('button.btn.primary', { type: 'button', onclick: () => doAdd(true) }, icon('next'), h('span', 'Add and put on Next')),
          h('button.btn', { type: 'button', onclick: () => doAdd(false) }, icon('plus'), h('span', 'Add to book'))));
      refresh();
      detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    modal({
      title: 'Find lyrics online', wide: true,
      body: h('div.col.lyr-wrap',
        h('p.note', 'Finds the words to hymns and choruses on public lyric sites, suggests the likeliest songs, and saves your choice on this device so it works offline.'),
        h('div.row.wrap', qIn, h('button.btn.primary', { type: 'button', onclick: search }, icon('search'), h('span', 'Search')), aiChip),
        status, offBox, resBox, linkBox, detail),
      actions: [{ label: 'Close' }],
    });
    qIn.focus();
    if (qIn.value) search();
  }

  // ------------------------------------------------------------ music (offline MIDI accompaniment)
  const sungStanzas = () => (chosen ? Array.from(chosen).sort((a, b) => a - b)
    : !hymn.v.length && musicEntry && Array.isArray(musicEntry.v) && musicEntry.v.length ? musicEntry.v.map((_, i) => i) : hymn.v.map((_, i) => i));
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

  /** Attach (or remove) the user's own MIDI file for the open hymn. */
  function addMidiBtn(has) {
    const num = hymn.n, bid = book.id;
    if (has) {
      return h('button.btn.sm', { type: 'button', title: 'Stop using your MIDI file for this hymn', onclick: async () => {
        music.stop();
        try { await db.del('files', 'midi:' + bid + ':' + num); toast('MIDI file removed.', 'ok', 2000); }
        catch (e) { toast('Could not remove the MIDI file: ' + (e.message || e), 'err', 6000); }
        renderMusic();
      } }, icon('trash'), h('span', 'Remove my MIDI'));
    }
    const inp = h('input', { type: 'file', accept: '.mid,.midi,audio/midi,audio/x-midi', hidden: true, onchange: async () => {
      const f = inp.files && inp.files[0]; inp.value = '';
      if (!f) return;
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 4)) !== 'MThd') { toast('That is not a MIDI file.', 'err', 3000); return; }
      await db.put('files', 'midi:' + bid + ':' + num, { id: 'midi:' + bid + ':' + num, kind: 'midi', name: f.name.replace(/\.midi?$/i, ''), blob: new Blob([bytes], { type: 'audio/midi' }), added: Date.now() });
      toast('MIDI added to hymn ' + num + '.', 'ok', 2500); renderMusic();
    } });
    return h('span', inp, h('button.btn.sm.primary', { type: 'button', title: 'Choose a .mid file from this device', onclick: () => inp.click() }, icon('plus'), h('span', 'Add MIDI file…')));
  }

  async function renderMusic() {
    if (!hymn || !book) { musicBar.hidden = true; return; }
    const key = cue && cue.hymnKey;
    const entry = await music.entry(book.id, hymn.n);
    if (!cue || cue.hymnKey !== key) return; // another hymn was picked meanwhile
    musicEntry = entry;
    clear(musicBar);
    if (!entry) {
      // No music for this hymn: let the user attach a MIDI file (kept on this device).
      musicBar.hidden = false;
      musicBar.append(h('div.row.wrap', h('span.note', 'No music for this hymn yet.'), addMidiBtn(false),
        h('a.btn.sm', { href: 'https://www.google.com/search?q=' + encodeURIComponent('"' + hymn.t + '" hymn midi'), target: '_blank', rel: 'noopener' }, 'Find a MIDI online')));
      return;
    }
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
    if (entry.custom && !entry.bundled) row1.append(addMidiBtn(true));
    musicBar.append(row1);
    // Jump to a part while it plays: Intro 1 2 3 …
    if (mine && st.sections && st.sections.length > 1) {
      const jumps = h('div.row.wrap.music-jumps');
      st.sections.forEach((sec, i) => jumps.appendChild(h('button.frame-chip' + (st.section === i ? '.cur' : ''), { type: 'button', title: 'Go to ' + sec.label, onclick: () => music.seek(i) }, sec.label === 'Intro' ? 'Intro' : sec.label.replace('Verse ', ''))));
      musicBar.append(jumps);
    }
    const instSel = h('select.field.sm', { 'aria-label': 'Instrument', title: 'Instrument', onchange: () => { setM('musicInstrument', instSel.value); if (mine) music.rearrange({ instrument: instSel.value }); } },
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
  music.on('notice', (msg) => toast(msg, '', 6000));
  // Words follow the music: the arrangement carries markers where each slide begins.
  music.on('slide', ({ key, slide }) => {
    if (S().musicFollow === false) return;
    if (live.cue && live.cue.tab === 'hymns' && live.cue.hymnKey === key && slide < live.count()) live.go(slide);
  });

  // ------------------------------------------------------------ public API
  const api = {
    addSharedLanguage: () => addSharedLanguage(),
    el,
    lookup(n) {
      const out = [];
      const order = [book].concat(books.filter((b) => b !== book)).filter(Boolean);
      order.forEach((b) => b.hymns.forEach((x) => { if (x.n === n) out.push({ n: x.n, t: x.t, book: b.short || b.name, bookId: b.id }); }));
      return out;
    },
    /** Hymns and choruses in every book (the open book first) whose number, title or words match. */
    searchAll(qq, k = 20) {
      const out = [];
      const order = [book].concat(books.filter((b) => b !== book)).filter(Boolean);
      for (const b of order) for (const x of b.hymns) { if (matches(x, qq)) { out.push({ n: x.n, t: x.t, book: b.short || b.name, bookId: b.id }); if (out.length >= k) return out; } }
      return out;
    },
    whenReady() { return ready; },
    /** Number, title and first line of every hymn in the open book, plus its id (for hymns announced by name). */
    catalog() {
      if (!book) return { id: '', list: [] };
      if (!book._cat || book._cat.length !== book.hymns.length) book._cat = book.hymns.map((x) => ({ n: x.n, t: x.t, first: (x.v && x.v[0] && x.v[0][0]) || '' }));
      return { id: book.id, name: book.short || book.name, list: book._cat };
    },
    search(qq, k = 5) {
      const out = [];
      if (!book) return out;
      for (const x of book.hymns) { if (matches(x, qq)) { out.push({ n: x.n, t: x.t, book: book.short || book.name, bookId: book.id }); if (out.length >= k) break; } }
      return out;
    },
    async open({ n, book: bid, index = 0 }) {
      await ready;
      if (bid === 'malmesbury') { bid = COMMUNITY_BOOK; n = +n + MP_OFFSET; }   // plans made before the merge
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
    onShow() { if (!hymn && !opening && !ctx.isMobile()) setTimeout(() => { q.classList.add('quiet-focus'); q.focus(); }, 50); opening = false; if (hymn) renderMusic(); },
    /** Number keys: stage stanza n (of the hymn shown here; the title and chorus are reached with the arrows). */
    numberKey(n, multi) {
      if (!cue || !cue.labels) return false;
      if (multi) { n %= 10; if (!n) return true; } // stanzas go up to 9: two quick presses mean the last one
      const i = cue.labels.findIndex((lab) => lab === String(n) || lab === n + 'a');
      if (i < 0) { ctx.toast('This hymn has no stanza ' + n + (chosen ? ' selected' : '') + '.', '', 2200); return true; }
      stageStanza(i);
      keepInView(grid.children[i]);
      return true;
    },
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
    /** Present the hymn and start the music together (used by Plan). */
    async presentAndPlay(item) {
      const c = await api.open(item);
      if (!c) return null;
      // Give the music bar a moment to resolve the entry, then present and play.
      await new Promise((r) => setTimeout(r, 80));
      await startMusic(true);
      return c;
    },
    controls(c) {
      // Jump straight to a stanza: T 1 C 2 C 3 …
      const box = h('div.row.cb-chips', { style: { flexWrap: 'nowrap', overflowX: 'auto', minWidth: 0, flex: '1 1 auto' } });
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
        return h('div.row', { style: { flexWrap: 'nowrap', minWidth: 0, flex: '1 1 auto' } }, box,
          h('button.btn.sm.cb-music', { type: 'button', title: 'Play the music for this hymn (M)', 'aria-label': 'Play the music for this hymn', style: { flex: 'none' }, onclick: () => api.musicKey() }, icon('music'), h('span.hide-sm', 'Music')));
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

  const ready = loadBooks().then(() => renderList()).then(() => setTimeout(() => checkShared(false), 4000));
  // A hymnbook was added or removed (Hymns → More, or Settings → Bibles & hymns): reload, keep the hymn, open a new one.
  window.addEventListener(HYMNBOOKS_CHANGED, async (e) => {
    const select = e.detail && e.detail.select;
    if (select) settings.set('hymns.book', select);
    const keepBook = book && book.id, keepN = hymn ? hymn.n : null;
    await ready;
    await loadBooks();
    if (book && book.id === keepBook && keepN) { const x = book.hymns.find((y) => y.n === keepN); if (x) selectHymn(x); }
    else { hymn = null; chosen = null; restage(); }
  });
  return api;
}
