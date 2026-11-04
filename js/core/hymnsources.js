// Hymnbooks that can be added from the internet (Hymns → More → Add a hymnbook, or Settings → Bibles & hymns),
// the way Add a Bible works: pick one from the list, it downloads once from GitHub and then works offline.
//   rejnac  github.com/rejnac/compiled-hymnal: SDA hymnals in 26 languages (VideoPsalm songbooks, MIT licence)
//   sid     github.com/sidadventist/sid_hymnal: SID Hymnal in English, isiXhosa and Setswana, one hymn per file,
//           the same numbers in all three languages
//   gs      github.com/GospelSounders/hymnals-data: early Adventist hymnals (Hymnals Data)
// The lists are built in (like getBible and the Bible corpus), so they show even when GitHub is slow; the
// hymns themselves come from raw.githubusercontent.com. Each hymnbook keeps its own copyright.
import { normaliseBook, relaxedJson, fromMarkdownHymn } from './hymnparse.js';

const RAW = 'https://raw.githubusercontent.com/';
export const SOURCES = {
  rejnac: { label: 'SDA hymnals (Rejnac)', site: 'github.com/rejnac/compiled-hymnal', licence: 'Rejnac Foundation (VideoPsalm songbook, MIT licence); the hymns keep their own copyright' },
  sid: { label: 'SID Hymnal', site: 'github.com/sidadventist/sid_hymnal', licence: 'SID Hymnal (Southern Africa-Indian Ocean Division app); the hymns keep their own copyright' },
  gs: { label: 'Hymnals Data', site: 'github.com/GospelSounders/hymnals-data', licence: 'Hymnals Data by Gospel Sounders; the hymns keep their own copyright' },
};

// [source, key, hymnbook, short name, language code (ISO 639), language, hymns with words, size in KB, path]
// rejnac path: repository/branch/file. sid path: language folder. gs path: hymnal folder.
export const HYMNALS = [
  ['rejnac', 'chichewa', 'Khristu Mu Nyimbo', 'KMN', 'ny', 'Chichewa (Nyanja)', 350, 387, 'chichewa-hymnal/main/Khristu Mu Nyimbo Lyrics.json'],
  ['rejnac', 'dholuo', 'Wende Nyasaye', 'WN', 'luo', 'Dholuo', 332, 388, 'dholuo-hymnal/main/Wende Nyasaye Lyrics.json'],
  ['rejnac', 'ekegusii', 'Ogotera Kwa Nyasae', 'OKN', 'guz', 'Ekegusii', 365, 417, 'ekegusii-hymnal/Master/Ogotera Kwa Nyasae Lyrics.json'],
  ['rejnac', 'english', 'SDA Hymnal with words (695 hymns and 257 more songs)', 'SDAH+', 'en', 'English', 952, 1127, 'sdah-hymnal/main/SDAH Hymnal Lyrics.json'],
  ['rejnac', 'french', 'Hymnes et Louanges', 'HEL', 'fr', 'French (Français)', 520, 518, 'french-hymnal/main/Hymnes et Louanges Lyrics.json'],
  ['rejnac', 'icibemba', 'Klistu Mu Nyimbo', 'KLMN', 'bem', 'Icibemba (Bemba)', 311, 344, 'icibemba-hymnal/main/Klistu Mu Nyimbo Lyrics.json'],
  ['rejnac', 'zulu', 'UKrestu Esihlabelelweni', 'UES', 'zu', 'isiZulu / isiNdebele', 300, 348, 'isiZulu-ndebele-hymnal/main/UKrestu Esihlabelelweni Lyrics.json'],
  ['rejnac', 'kalenjin', 'Tienwogik che Kilosune Jehovah', 'TCKJ', 'kln', 'Kalenjin', 245, 257, 'kalenjin-hymnal/main/Tienwogik che Kilosune Jehovah Lyrics.json'],
  ['rejnac', 'kamba', 'Mbathi sya Kumutaia Ngai', 'MSKN', 'kam', 'Kamba (Kikamba)', 469, 610, 'kamba-hymnal/main/Mbathi sya Kumutaia Ngai Lyrics.json'],
  ['rejnac', 'kikuyu', 'Nyimbo Cia Agendi', 'NCA', 'ki', 'Kikuyu (Gĩkũyũ)', 299, 321, 'kikuyu-hymnal/main/Nyimbo Cia Agendi Lyrics.json'],
  ['rejnac', 'kinyarwanda', 'Indirimbo Zo Guhimbaza Imana', 'IZGI', 'rw', 'Kinyarwanda', 500, 568, 'kinyarwanda-hymnal/main/Indirimbo Zo Guhimbaza Imana Lyrics.json'],
  ['rejnac', 'maasai', 'Isinkolioitin', 'ISI', 'mas', 'Maasai', 243, 270, 'maasai-hymnal/main/Isinkolioitin Lyrics.json'],
  ['rejnac', 'portuguese', 'Novo Hinário Adventista', 'NHA', 'pt', 'Portuguese (Português)', 574, 665, 'portuguese-hymnal/main/Novo Hinário Adventista Lyrics.json'],
  ['rejnac', 'russian', 'Psalmi Siona', 'PS', 'ru', 'Russian (Русский)', 384, 508, 'russian-hymnal/main/Psalmi Siona Lyrics.json'],
  ['rejnac', 'sepedi', 'Kreste Ka Kopelo', 'KKK', 'nso', 'Sepedi (Northern Sotho)', 303, 276, 'sepedi-hymnal/main/Kreste Ka Kopelo Lyrics.json'],
  ['rejnac', 'shona', 'Kristu MuNzwiyo', 'KMZ', 'sn', 'Shona (chiShona)', 300, 323, 'shona-hymnal/main/Kristu MuNzwiyo Lyrics.json'],
  ['rejnac', 'sotho', 'Keresete Pineng', 'KP', 'st', 'Sesotho', 268, 315, 'sotho-hymnal/main/Keresete Pineng Lyrics.json'],
  ['rejnac', 'spanish', 'Himnario Adventista', 'HA', 'es', 'Spanish (Español)', 614, 640, 'spanish-hymnal/main/Himnario Adventista Lyrics.json'],
  ['rejnac', 'swahili', 'Nyimbo za Kristo', 'NZK', 'sw', 'Swahili (Kiswahili)', 220, 219, 'swahili-hymnal/main/Nyimbo za Kristo Lyrics.json'],
  ['rejnac', 'tonga', 'Kristu Mu Nyimbo', 'KMNT', 'toi', 'Tonga (Zambia)', 341, 367, 'tonga-hymnal/main/Kristu Mu Nyimbo Lyrics.json'],
  ['rejnac', 'tswana', 'Keresete mo Kopelong', 'KMK', 'tn', 'Setswana', 300, 365, 'tswana-hymnal/main/Keresete mo Kopelong Lyrics.json'],
  ['rejnac', 'tumbuka', 'Nyimbo za Mpingo wa SDA', 'NZM', 'tum', 'Tumbuka', 352, 392, 'tumbuka-hymnal/main/Nyimbo za Mpingo wa SDA Lyrics.json'],
  ['rejnac', 'twi', 'Memeneda Akwanhwefo Nnwom', 'MAN', 'tw', 'Twi', 754, 748, 'twi-hymnal/main/Memeneda Akwanhwefo Nnwom Lyrics.json'],
  ['rejnac', 'venda', 'Ngosha YaDzingosha', 'NY', 've', 'Tshivenda', 306, 364, 'venda-hymnal/main/Ngosha YaDzingosha Lyrics.json'],
  ['rejnac', 'xhosa', 'UKristu Engomeni', 'UE', 'xh', 'isiXhosa', 352, 403, 'xhosa-hymnal/main/uKrestu Engomeni Lyrics.json'],
  ['rejnac', 'xitsonga', 'Tinsimu ta Mhalamhala', 'TTM', 'ts', 'Xitsonga', 311, 376, 'xitsonga-hymnal/main/Tinsimu ta Mhalamhala Lyrics.json'],
  ['sid', 'en', 'SID Hymnal (English)', 'SID', 'en', 'English', 300, 217, 'en'],
  ['sid', 'xh', 'U-Kristu Engomeni (SID Hymnal)', 'SID-XH', 'xh', 'isiXhosa', 352, 178, 'xh'],
  ['sid', 'tn', 'Keresete Mo Kopelong (SID Hymnal)', 'SID-TN', 'tn', 'Setswana', 300, 162, 'tn'],
  ['gs', 'hgpp1849', 'Hymns for God’s Peculiar People (1849)', 'HGPP', 'en', 'English', 53, 55, 'HGPP1849'],
  ['gs', 'nzk', 'Nyimbo za Kristo (Hymnals Data)', 'NZK-G', 'sw', 'Swahili (Kiswahili)', 219, 121, 'NZK'],
].map(([src, key, name, short, lang, langName, hymns, kb, path]) => ({ src, key, id: 'web-' + src + '-' + key, name, short, abbr: short, lang, langName, hymns, kb, path }));

/** Notes shown in the list next to some hymnbooks. */
export const NOTES = {
  'web-rejnac-english': 'Numbers 1–695 are the SDA Hymnal (1985). The words also fill in the built-in SDA Hymnal, so the hymns keep their offline music.',
  'web-sid-en': 'Same numbers as the SID Hymnal in isiXhosa and Setswana.',
  'web-gs-hgpp1849': 'The first Sabbath-keeping Adventist hymnal, compiled by James White (public domain).',
};

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
export function urlOf(e) {
  if (e.src === 'rejnac') return RAW + 'rejnac/' + encPath(e.path);
  if (e.src === 'sid') return RAW + 'sidadventist/sid_hymnal/master/assets/hymns/' + encPath(e.path) + '/';
  return RAW + 'GospelSounders/hymnals-data/master/' + encPath(e.path) + '/index.json';
}

async function get(url, ms, as) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return as === 'json' ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

/** Download one hymnbook from the list and convert it: { id, name, short, lang, hymns, licence, origin }.
 *  say(text) reports progress. */
export async function downloadHymnal(e, say = () => {}) {
  let book;
  if (e.src === 'sid') {
    const base = urlOf(e);
    const meta = await get(base + 'meta.json', 30000, 'json');
    const nums = Object.keys((meta && meta.songs) || {}).map((k) => parseInt(k, 10)).filter((n) => n > 0 && n < 10000).sort((a, b) => a - b);
    if (!nums.length) throw new Error('the hymn list is empty');
    const hymns = new Map();
    let i = 0, done = 0;
    async function worker() {
      while (i < nums.length) {
        const n = nums[i++];
        for (let tries = 0; tries < 3; tries++) {
          try { const hy = fromMarkdownHymn(await get(base + String(n).padStart(3, '0') + '.md', 30000), n); if (hy) hymns.set(n, hy); break; } catch (err) { /* try again */ }
        }
        say('Adding… ' + Math.round((++done / nums.length) * 100) + '%');
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));
    if (hymns.size < nums.length * 0.9) throw new Error('only ' + hymns.size + ' of ' + nums.length + ' hymns arrived; try again');
    book = normaliseBook({ hymns: [...hymns.values()] }, e.name);
  } else {
    say('Downloading… ' + (e.kb >= 1000 ? (e.kb / 1024).toFixed(1) + ' MB' : e.kb + ' KB'));
    const text = await get(urlOf(e), 120000);
    say('Converting…');
    book = normaliseBook(relaxedJson(text), e.name);
  }
  if (!book.hymns || !book.hymns.length) throw new Error('no hymns found');
  return { id: e.id, name: e.name, short: e.short, lang: e.lang, hymns: book.hymns, licence: SOURCES[e.src].licence, origin: urlOf(e), added: Date.now() };
}

const titleKey = (t) => String(t || '').toLowerCase().replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** Do two titles name the same hymn? ("Praise to the Lord" / "Praise To The Lord, the Almighty") */
export function sameTitle(a, b) {
  const x = titleKey(a), y = titleKey(b);
  if (!x || !y) return false;
  if (x === y || x.startsWith(y) || y.startsWith(x)) return true;
  const wx = x.split(' '), wy = y.split(' ');
  if (wx.length > 1 && wx[0] === wy[0] && wx[1] === wy[1]) return true;
  const sx = new Set(wx); const common = wy.filter((w) => sx.has(w)).length;
  if (common / Math.max(wx.length, wy.length) >= 0.6) return true;
  // Spelling slips ("The Savoir Is Waitning"): most letter pairs the same.
  const pairs = (t) => { const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const k = t.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const px = pairs(x), py = pairs(y);
  let both = 0; px.forEach((c, k) => { both += Math.min(c, py.get(k) || 0); });
  return (2 * both) / (x.length + y.length - 2) >= 0.75;
}
