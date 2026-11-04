// Bibles that can be added from the internet: bible.helloao.org (Free Use Bible API, live list), getBible (built-in
// list) and the multilingual Bible corpus (built-in list). Used by Add a Bible and by the first-start setup.
// An item is { src: 'ao' | 'gb' | 'bc', id, abbr, name, lang, langName, license, full, mb?, … }.
import { parseBibleFile, saveImported, listTranslations, USFM } from './bibledata.js';
import { CORPUS, CORPUS_BASE } from './biblecorpus.js';
import { GETBIBLE } from './biblegetbible.js';

export const AO = 'https://bible.helloao.org';
export const GB = 'https://api.getbible.net';
export const BIBLE_SOURCES = {
  ao: { label: 'Free Use Bible API', site: 'bible.helloao.org' },
  gb: { label: 'getBible', site: 'api.getbible.net' },
  bc: { label: 'Bible corpus', site: 'github.com/christos-c/bible-corpus' },
  eb: { label: 'eBible corpus', site: 'github.com/BibleNLP/ebible' },
};

// The eBible corpus (BibleNLP, from eBible.org): openly licensed Bibles, one verse per line in the order of
// metadata/vref.txt. Only African translations not offered by the other sources are listed.
// Fields: [file, abbreviation, language, title, ISO 639-3, whole Bible, MB, licence].
const EB_BASE = 'https://raw.githubusercontent.com/BibleNLP/ebible/main/';
const BIBLICA = 'CC BY-SA 4.0, Biblica, Inc.';
export const EBIBLE = [
  ['tsn-tsn', 'TSN', 'Setswana', 'Lefoko: La Botshelo, Kgolagano e Ntsha (New Testament)', 'tsn', false, 1.2, BIBLICA],
  ['nde-nde', 'NDE', 'isiNdebele', 'IBhayibhili Elingcwele LesiNdebele Elifinyelelekayo', 'nde', true, 3.8, BIBLICA],
  ['nya-nya', 'NYA', 'Chichewa', 'Tsekulani Mawu a Mulungu mu Chichewa Chalero', 'nya', true, 4.0, BIBLICA],
  ['sna-sna', 'SNA17', 'Shona', 'Bhaibheri Dzvene Rakasununguka MuChiShona Chanhasi (2017)', 'sna', true, 3.8, BIBLICA],
  ['kik-kik', 'KIK', 'Kikuyu', 'Kiugo Gĩtheru Kĩa Ngai Kĩhingũre', 'kik', true, 4.7, BIBLICA],
  ['luo-luo', 'LUO', 'Dholuo', 'Ochiw Thuolo Motingʼo Loko Manyien', 'luo', true, 3.6, BIBLICA],
  ['swh-swhonen', 'SWHNEN', 'Kiswahili', 'Toleo Wazi Neno: Bibilia Takatifu', 'swh', true, 3.8, BIBLICA],
  ['swh-swhulb', 'SWHULB', 'Kiswahili', 'Biblia Takatifu (unfoldingWord)', 'swh', true, 3.8, 'CC BY-SA 4.0, Door43 World Missions Community'],
  ['swh-swh1850', 'SWH1850', 'Kiswahili', 'Biblia Takatifu, Agano Jipya (Krapf, 1850)', 'swh', false, 0.9, 'Public domain'],
  ['twi-twi', 'TWI', 'Akuapem Twi', 'Nkwa Asɛm (Akuapem)', 'twi', true, 3.6, BIBLICA],
  ['twi-twiasante', 'TWIAS', 'Asante Twi', 'Nkwa Asɛm (Asante)', 'twi', true, 3.7, BIBLICA],
];
export const ebibleItems = () => EBIBLE.map(([file, abbr, langName, name, lang, full, mb, lic]) => ({ src: 'eb', id: abbr, abbr, name, lang, langName, full, mb,
  license: 'eBible corpus (github.com/BibleNLP/ebible); ' + lic, link: EB_BASE + 'corpus/' + file + '.txt' }));
let vref = null;
async function ebibleParsed(t, say) {
  say('Downloading… ' + t.mb + ' MB');
  if (!vref) {
    const r = await fetch(EB_BASE + 'metadata/vref.txt');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    vref = (await r.text()).split('\n');
  }
  const r = await fetch(t.link);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const lines = (await r.text()).split('\n');
  say('Converting…');
  const books = new Map();
  let total = 0;
  lines.forEach((line, i) => {
    const text = line.trim();
    if (!text || text === '<range>') return;
    const m = /^(\w{3}) (\d+):(\d+)$/.exec(vref[i] || '');
    if (!m) return;
    const b = USFM.indexOf(m[1]) + 1, c = +m[2], v = +m[3];
    if (b < 1 || c < 1 || v < 1) return;
    let bk = books.get(b); if (!bk) books.set(b, bk = []);
    const ch = bk[c - 1] || (bk[c - 1] = []);
    ch[v - 1] = text; total++;
  });
  if (total < 100) throw new Error('no verses found');
  return { meta: { abbr: t.abbr, name: t.name }, books, total };
}

export const withTimeout = (url, ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t)); };

export function fromAo(t) {
  return { src: 'ao', id: t.id, abbr: t.shortName || t.id, name: t.englishName || t.name || t.id, lang: t.language || '',
    langName: t.languageEnglishName || t.languageName || '', license: t.licenseUrl ? 'licence: ' + String(t.licenseUrl).replace(/^https?:\/\//, '').slice(0, 40) : '',
    full: !(t.numberOfBooks > 0 && t.numberOfBooks < 60),
    complete: t.completeTranslationApiLink || '', simple: t.simpleCompleteTranslationApiLink || '', books: t.listOfBooksApiLink || ('/api/' + t.id + '/books.json') };
}
export const fromGb = (abbr, name, lang, language, lic) => ({ src: 'gb', id: abbr, abbr, name, lang, langName: language, license: lic ? 'licence: ' + lic : '',
  full: !/\bNT\b|New Testament/i.test(name), link: '/v2/' + encodeURIComponent(abbr) + '.json' });
export const corpusItems = () => CORPUS.map(([file, iso, lang, kind, abbr, mb]) => ({ src: 'bc', id: abbr, abbr, name: lang + (kind === 'nt' ? ' New Testament' : kind === 'part' ? ' (parts of the Bible)' : ' Bible'),
  lang: iso, langName: lang, mb, full: !kind, license: 'Bible corpus (github.com/christos-c/bible-corpus); the translation keeps its own copyright', link: CORPUS_BASE + encodeURIComponent(file) }));
export const getbibleItems = () => GETBIBLE.map((r) => fromGb(...r));

/** bible.helloao.org's list (live only). */
export async function loadAoList(ms = 20000) {
  const r = await withTimeout(AO + '/api/available_translations.json', ms);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  const items = (d.translations || []).map(fromAo);
  if (!items.length) throw new Error('empty list');
  return items;
}
/** getBible's live list (the built-in one is used when it does not answer). */
export async function loadGbList(ms = 20000) {
  const r = await withTimeout(GB + '/v2/translations.json', ms);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const d = await r.json();
  return Object.keys(d || {}).map((key) => { const t = d[key] || {}; return fromGb(t.abbreviation || key, t.translation || key, t.lang || '', t.language || '', String(t.distribution_license || '').slice(0, 40)); });
}

/** Book names: the app knows English, Afrikaans, isiXhosa and isiZulu ones. */
export const langOf = (t) => { const c = String(t.lang).toLowerCase(); return c === 'afr' || c === 'af' ? 'af' : c === 'xho' || c === 'xh' ? 'xh' : c === 'zul' || c === 'zu' ? 'zu' : /afrikaans/i.test(t.langName) ? 'af' : /xhosa/i.test(t.langName) ? 'xh' : /zulu/i.test(t.langName) ? 'zu' : 'en'; };

/** The id a Bible from the internet gets. The source goes into it, so the same short name from two sources (XHO,
 *  SHONA …) never overwrites the other. */
export const bibleIdOf = (t) => 'imp-' + String(t.abbr || t.id).trim().toUpperCase().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '') + (t.src === 'ao' ? '' : '-' + t.src);

// helloao: the whole Bible in one file when the site offers it, otherwise chapter by chapter.
async function aoDownload(t, say) {
  for (const link of [t.simple, t.complete, '/api/' + t.id + '/complete.json']) {
    if (!link) continue;
    try { const r = await fetch(AO + link); if (r.ok) return await r.blob(); } catch (e) { /* try the next */ }
  }
  const r = await fetch(AO + t.books);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const bl = await r.json();
  const jobs = [];
  (bl.books || []).forEach((b) => { for (let c = b.firstChapterNumber || 1; c <= (b.lastChapterNumber || b.numberOfChapters || 0); c++) jobs.push([b, c]); });
  const books = new Map();
  let done = 0, i = 0;
  async function worker() {
    while (i < jobs.length) {
      const [b, c] = jobs[i++];
      let ok = false;
      for (let tries = 0; tries < 3 && !ok; tries++) {
        try {
          const rr = await fetch(AO + '/api/' + encodeURIComponent(t.id) + '/' + encodeURIComponent(b.id) + '/' + c + '.json');
          if (rr.ok) { const d = await rr.json(); if (!books.has(b.id)) books.set(b.id, { id: b.id, name: b.name, order: b.order, chapters: [] }); books.get(b.id).chapters.push({ chapter: d.chapter }); ok = true; }
        } catch (e) { /* retry */ }
      }
      say('Adding… ' + Math.round((++done / jobs.length) * 100) + '%');
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  const out = { translation: { shortName: t.abbr, englishName: t.name, language: t.lang }, books: [...books.values()].sort((a, b) => a.order - b.order) };
  out.books.forEach((b) => b.chapters.sort((x, y) => x.chapter.number - y.chapter.number));
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

/** Download, convert and save one Bible for offline use. Returns its id. say(text) reports progress. */
export async function addBible(t, say = () => {}) {
  const ab = String(t.abbr || t.id).trim().toUpperCase().slice(0, 8);
  const id = bibleIdOf(t);
  const existing = await listTranslations(true);
  if (existing.some((x) => x.id === id && x.src !== 'imported')) throw new Error('already built in');
  if (t.src === 'eb') {
    const parsed = await ebibleParsed(t, say);
    say('Saving…');
    await saveImported({ id, abbr: ab, name: t.name, lang: langOf(t), license: t.license }, parsed);
    return id;
  }
  let blob;
  if (t.src === 'ao') blob = await aoDownload(t, say);
  else {
    say('Downloading…' + (t.mb ? ' ' + t.mb + ' MB' : ''));
    const r = await fetch(t.src === 'gb' ? GB + t.link : t.link);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    blob = await r.blob();
  }
  say('Saving…');
  const parsed = await parseBibleFile(new File([blob], ab + (t.src === 'bc' ? '.xml' : '.json'), { type: t.src === 'bc' ? 'application/xml' : 'application/json' }));
  await saveImported({ id, abbr: ab, name: t.name, lang: langOf(t), license: t.src === 'bc' ? t.license : BIBLE_SOURCES[t.src].site + (t.license ? ', ' + t.license : '') }, parsed);
  return id;
}
