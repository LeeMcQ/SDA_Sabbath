// Hymnbook formats: SDA Sabbath's own JSON, the Afrikaans Liedboek site, plain text ("# 73 Title"),
// VideoPsalm songbooks (.vpc or their .json, as in the rejnac SDA hymnals), SID Hymnal markdown (one file per
// hymn) and GospelSounders Hymnals Data. Every format becomes { name, short, lang, hymns: [{ n, t, a, v, c }] }:
// v is the list of stanzas (each a list of lines), c the chorus (sung after each stanza) or null.
// No other app modules are imported, so the parsers also run in tests and tools.

/** A line that only names the chorus, in the languages of the hymnals SDA Sabbath can add. */
export const CHORUS_RE = /^(chorus|refrain|ref|koor|refrein|ikhorasi|khorasi|korasi|koras|chorasi|kiitikio|coro|estribillo|refr[aã]o|ch[oœ]eur|припев|c)\s*[:.]?\s*$/i;
const CHORUS_HEAD = /^(chorus|refrain|koor|refrein|ikhorasi|khorasi|korasi|koras|chorasi|kiitikio|coro|estribillo|refr[aã]o|ch[oœ]eur|припев)\s*[:.]\s*(.*)$/i;

/** Parse lyrics text: stanzas separated by blank lines; a stanza that starts with
 *  "Chorus:" / "Refrain:" / "Koor:" is the chorus. */
export function parseLyrics(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
  const v = []; let c = null;
  blocks.forEach((b) => {
    const first = b[0];
    const m = CHORUS_HEAD.exec(first);
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

/** Safeguard: hymn text is plain text, so turn any HTML entities left in data (&#8217; &amp; …) into characters. */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
export function decodeEntities(s) {
  if (typeof s !== 'string' || s.indexOf('&') < 0) return s;
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m; }
    return Object.prototype.hasOwnProperty.call(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : m;
  });
}
const decodeDeep = (x) => (typeof x === 'string' ? decodeEntities(x) : Array.isArray(x) ? x.map(decodeDeep) : x);

// Text from the internet or another program: no control characters, sensible lengths.
const clip = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** An all-capitals title ("HOLY SABBATH.") in ordinary title case; other titles stay as written. */
export function tidyTitle(t) {
  const s = clip(t, 200).replace(/[.\s]+$/, '');
  if (!/\p{Lu}/u.test(s) || /\p{Ll}/u.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s("“‘-])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());
}

const MAX_LINE = 64, MIN_PART = 16, SHORT = 15;
/** One stanza as display lines. Many exports keep a stanza on one line ("Holy, holy, holy! Lord God Almighty!
 *  Early in the morning …"): it is broken where a new line of the hymn starts (punctuation, then a capital),
 *  very short pieces are joined, and lines still too long to read are halved at the best place near the middle. */
export function splitLines(text) {
  const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/ /g, ' ');
  if (src.trim().includes('\n')) return src.split('\n').map((l) => clip(l, 400)).filter(Boolean);
  let s = clip(src, 4000).replace(/^\d+[.)]\s+/, '');
  if (!s) return [];
  s = s.replace(/([,;:!?])(?=["“‘«(]?\p{Lu})/gu, '$1 ')              // "reigneth,Shieldeth" → "reigneth, Shieldeth"
    .replace(/(\p{Ll}\p{Ll})\.(?=["“‘«(]?\p{Lu}\p{Ll})/gu, '$1. ');   // "thee.Ponder"
  const parts = s.replace(/([,;:.!?…)\]"”»]) (?=["“‘«(¡¿]?\p{Lu})/gu, '$1\n').split('\n').map((p) => p.trim()).filter(Boolean);
  const joined = [];
  parts.forEach((p) => {
    const last = joined[joined.length - 1];
    if (last != null && (p.length < SHORT || last.length < SHORT) && last.length + p.length < MAX_LINE) joined[joined.length - 1] = last + ' ' + p;
    else joined.push(p);
  });
  return joined.flatMap(halve);
}
function halve(line) {
  if (line.length <= MAX_LINE) return [line];
  const mid = line.length / 2;
  let best = -1, score = Infinity;
  // After a comma, semicolon … (best), or before a capital (a hymn line usually starts with one).
  for (const m of line.matchAll(/([,;:.!?…]) |\s(?=["“‘«(]?\p{Lu})/gu)) {
    const at = m.index + m[0].length;
    if (at < MIN_PART || line.length - at < MIN_PART) continue;
    // Not inside a name ("the King of Creation", "Lord God"): a capital after a capitalised word is a poor place.
    const prev = m[1] ? '' : (/(\S+)\s*$/.exec(line.slice(0, m.index)) || ['', ''])[1];
    const sc = Math.abs(at - mid) * (m[1] ? 1 : /^["“‘«(]?\p{Lu}/u.test(prev) ? 4 : 1.6);
    if (sc < score) { score = sc; best = at; }
  }
  if (best < 0 && line.length > 90) {           // no good place: the space nearest the middle
    for (let d = 0; d < mid; d++) {
      if (line[Math.floor(mid) + d] === ' ') { best = Math.floor(mid) + d + 1; break; }
      if (line[Math.floor(mid) - d] === ' ') { best = Math.floor(mid) - d + 1; break; }
    }
  }
  if (best < 0) return [line];
  return [...halve(line.slice(0, best).trim()), ...halve(line.slice(best).trim())];
}

const textKey = (lines) => lines.join(' ').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Stanzas and chorus blocks in the order they are sung → { v, c }. The usual case (the same chorus after the
 *  stanzas) becomes stanzas + one chorus; a chorus that changes, or comes first, keeps the order as written. */
export function arrangeBlocks(blocks) {
  const cho = blocks.filter((b) => b.cho), ver = blocks.filter((b) => !b.cho);
  if (!cho.length) return { v: ver.map((b) => b.lines), c: null };
  if (ver.length && !blocks[0].cho && new Set(cho.map((b) => textKey(b.lines))).size === 1) return { v: ver.map((b) => b.lines), c: cho[0].lines };
  return { v: blocks.map((b) => b.lines), c: null };
}

const LIMIT = { hymns: 3000, stanzas: 60 };
function finishHymn(n, t, a, blocks) {
  const kept = blocks.map((b) => ({ cho: !!b.cho, lines: b.lines.slice(0, 40) })).filter((b) => b.lines.length).slice(0, LIMIT.stanzas);
  if (!kept.length || !(n > 0)) return null;
  const { v, c } = arrangeBlocks(kept);
  return { n, t: tidyTitle(t) || kept[0].lines[0], a: clip(a, 200), v, c };
}

/** VideoPsalm songbook (.vpc unpacked, or its .json export): Songs[{ ID, Text: title, Verses[{ Text, Tag }] }],
 *  where Tag marks a chorus. */
export function fromVideoPsalm(j) {
  const hymns = [], seen = new Set();
  let skipped = 0;
  (Array.isArray(j.Songs) ? j.Songs : []).slice(0, LIMIT.hymns).forEach((s, i) => {
    if (!s || typeof s !== 'object') return;
    const n = Math.floor(+(s.ID != null ? s.ID : s.Number)) || i + 1;
    if (seen.has(n)) return;
    const blocks = (Array.isArray(s.Verses) ? s.Verses : []).map((x) => ({ cho: !!(x && x.Tag), lines: splitLines(x && x.Text) }));
    const hy = finishHymn(n, s.Text || s.Title, s.Author || '', blocks);
    if (!hy) { skipped++; return; }
    seen.add(n); hymns.push(hy);
  });
  return { name: clip(j.Text || j.Description || '', 120), short: clip(j.Abbreviation || '', 8), copyright: clip(j.Copyright || '', 200), hymns, skipped };
}

/** GospelSounders Hymnals Data: { songs: { "0": { id, title, author, stanzas: { "1": text }, choruses: { "1": text } } } } */
export function fromHymnalsData(j) {
  const list = Array.isArray(j.songs) ? j.songs : Object.values(j.songs || {});
  const hymns = [], seen = new Set();
  let skipped = 0;
  const byKey = (o) => Object.keys(o || {}).sort((a, b) => +a - +b).map((k) => o[k]).filter((x) => typeof x === 'string');
  list.slice(0, LIMIT.hymns).forEach((s) => {
    if (!s || typeof s !== 'object') return;
    const n = Math.floor(+s.id);
    if (!(n > 0) || seen.has(n)) return;
    const stanzas = byKey(s.stanzas).map(splitLines).filter((l) => l.length);
    const cho = byKey(s.choruses).map(splitLines).find((l) => l.join(' ').split(/\s+/).length >= 3);
    const blocks = [];
    stanzas.forEach((lines, i) => { blocks.push({ cho: false, lines }); if (cho) blocks.push({ cho: true, lines: cho }); });
    const hy = finishHymn(n, s.title, s.author, blocks);
    if (!hy) { skipped++; return; }
    seen.add(n); hymns.push(hy);
  });
  return { name: '', short: '', hymns, skipped };
}

/** One hymn written in Markdown (SID Hymnal): "## Title", stanzas separated by empty lines, a "Chorus" line
 *  before the chorus. */
export function fromMarkdownHymn(text, n) {
  let t = '', cur = null, pendingCho = false;
  const blocks = [];
  const flush = () => { if (cur && cur.lines.length) blocks.push(cur); cur = null; };
  String(text || '').replace(/\r/g, '').split('\n').forEach((raw) => {
    const l = clip(raw, 400).replace(/^>\s*/, '').replace(/(\*\*|__)/g, '');
    const head = /^#{1,6}\s*(.*)$/.exec(l);
    if (head) { if (!t) t = head[1]; flush(); return; }
    if (!l || /^[-*_]{3,}$/.test(l)) { flush(); return; }
    if (CHORUS_RE.test(l)) { flush(); pendingCho = true; return; }
    if (!cur) { cur = { cho: pendingCho, lines: [] }; pendingCho = false; }
    cur.lines.push(l.replace(/^\d+[.)]\s+/, ''));
  });
  flush();
  return finishHymn(n, t, '', blocks);
}

/** JSON as written by VideoPsalm (keys without quotes: {Songs:[{ID:1,…}]}), or ordinary JSON. */
export function relaxedJson(text) {
  const s = String(text || '').replace(/^﻿/, '');
  try { return JSON.parse(s); } catch (e) { /* VideoPsalm writes its keys without quotes */ }
  const out = [];
  const isStart = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 36;
  const isPart = (c) => isStart(c) || (c >= 48 && c <= 57);
  let i = 0, from = 0;
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c === 34) {                                      // a string: copied as it is
      i++;
      while (i < s.length && s.charCodeAt(i) !== 34) i += s.charCodeAt(i) === 92 ? 2 : 1;
      i++;
      continue;
    }
    if (isStart(c)) {
      let j = i + 1;
      while (j < s.length && isPart(s.charCodeAt(j))) j++;
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === ':') { out.push(s.slice(from, i), '"', s.slice(i, j), '"'); from = j; }
      i = j;
      continue;
    }
    i++;
  }
  out.push(s.slice(from));
  return JSON.parse(out.join(''));
}

/** Accepts our format, the Liedboek format [{number,title,lyrics}] or {songs:[...]}, a VideoPsalm songbook and
 *  GospelSounders Hymnals Data. */
export function normaliseBook(j, fallbackName) {
  let meta = {};
  if (j && !Array.isArray(j) && Array.isArray(j.Songs)) { meta = fromVideoPsalm(j); j = Object.assign({}, meta, { name: meta.name || fallbackName }); }
  else if (j && !Array.isArray(j) && j.songs && typeof j.songs === 'object' && !Array.isArray(j.songs)) { meta = fromHymnalsData(j); j = Object.assign({}, meta, { name: fallbackName }); }
  let hymns = [];
  const list = Array.isArray(j) ? j : j.hymns || j.songs || [];
  list.forEach((x) => {
    if (!x || typeof x !== 'object') return;
    // Copyrighted songs are listed by number and title only ("words": false): the church adds the words under
    // its own licence (More → Import licensed words, or Add the words), and they stay on its own devices.
    if (x.words === false && !(x.v && x.v.length)) hymns.push({ n: +x.n, t: x.t || '', a: x.a || '', ccli: x.ccli ? String(x.ccli) : '', v: [], c: null, locked: true });
    else if (x.v) hymns.push(Object.assign({ n: +x.n, t: x.t, a: x.a || '', v: x.v, c: x.c || null }, x.ccli ? { ccli: String(x.ccli) } : {}));
    else if (x.lyrics || x.words || x.text) {
      const p = parseLyrics(x.lyrics || x.words || x.text);
      hymns.push({ n: +(x.number || x.n || x.no), t: x.title || x.t || '', a: x.author || '', v: p.v, c: p.c });
    }
  });
  hymns = hymns.filter((x) => x.n && x.v && (x.v.length || x.locked)).sort((a, b) => a.n - b.n)
    .map((x) => Object.assign(x, { t: decodeEntities(x.t || ''), a: decodeEntities(x.a || ''), v: decodeDeep(x.v), c: x.c ? decodeDeep(x.c) : null }));
  const out = { id: j.id || 'book-' + Date.now().toString(36), name: j.name || fallbackName || 'Imported hymns', short: j.short || '', lang: j.lang || 'en', hymns };
  if (meta.skipped) out.skipped = meta.skipped;
  if (meta.copyright) out.copyright = meta.copyright;
  return out;
}

/** Plain-text hymnbook: each hymn starts with "# 73 Holy, Holy, Holy" */
export function parseTxtBook(text, name) {
  const hymns = [];
  String(text).replace(/\r/g, '').split(/^#\s*/m).forEach((chunk) => {
    const m = /^(\d+)\s*[.\-–:]?\s*(.*)\n([\s\S]*)$/.exec(chunk.trim());
    if (!m) return;
    const p = parseLyrics(m[3]);
    if (p.v.length) hymns.push({ n: +m[1], t: m[2].trim(), a: '', v: p.v, c: p.c });
  });
  return { id: 'book-' + Date.now().toString(36), name, lang: 'en', hymns };
}

/** A hymnbook file chosen on this device: VideoPsalm .vpc (a zip), JSON in any of the formats above, or text. */
export async function parseHymnFile(file) {
  const name = String(file.name || 'Hymnbook').replace(/\.[^.]+$/, '');
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  let text;
  if (head[0] === 0x50 && head[1] === 0x4b) {           // "PK": a VideoPsalm .vpc songbook is a zip with one .json
    const { unzipSync, strFromU8 } = await import('../../vendor/fflate-unzip.min.js');
    const all = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const key = Object.keys(all).find((k) => /\.json$/i.test(k)) || Object.keys(all).find((k) => !k.endsWith('/'));
    if (!key) throw new Error(file.name + ' is empty.');
    text = strFromU8(all[key]);
  } else text = file.text ? await file.text() : await new Response(file).text();
  if (/^\s*[[{]/.test(text.replace(/^﻿/, ''))) return normaliseBook(relaxedJson(text), name);
  return parseTxtBook(text, name);
}
