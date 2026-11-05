// The languages a church can choose in the first-start setup: every language that has a hymnbook (Add a hymnbook)
// or a Bible (Add a Bible) in the download lists, with what is available for it. One key per language (ISO 639-1
// where there is one), so "xho" (Bible corpus), "xh" (hymnals) and "isiXhosa" meet.
import { HYMNALS } from './hymnsources.js';
import { corpusItems, getbibleItems, ebibleItems } from './biblesources.js';
import { rank } from './langsearch.js';

const TO_1 = {
  eng: 'en', enm: 'en', afr: 'af', xho: 'xh', zul: 'zu', nbl: 'nr', nde: 'nd', sot: 'st', tsn: 'tn', tso: 'ts', ven: 've', ssw: 'ss', sna: 'sn',
  nya: 'ny', swa: 'sw', swh: 'sw', kin: 'rw', kik: 'ki', aka: 'tw', twi: 'tw', fra: 'fr', fre: 'fr', por: 'pt', spa: 'es', rus: 'ru',
  alb: 'sq', amh: 'am', ara: 'ar', bul: 'bg', ces: 'cs', cha: 'ch', dan: 'da', deu: 'de', ell: 'el', epo: 'eo', est: 'et', eus: 'eu', ewe: 'ee',
  fin: 'fi', gla: 'gd', glv: 'gv', guj: 'gu', hat: 'ht', heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu', hye: 'hy', ind: 'id', isl: 'is', ita: 'it',
  jpn: 'ja', kan: 'kn', kor: 'ko', lat: 'la', lav: 'lv', lit: 'lt', mal: 'ml', mar: 'mr', mri: 'mi', mya: 'my', nep: 'ne', nld: 'nl', nor: 'no',
  nb: 'no', nn: 'no', oji: 'oj', pes: 'fa', plt: 'mg', pol: 'pl', que: 'qu', ron: 'ro', slk: 'sk', slv: 'sl', som: 'so', srp: 'sr', swe: 'sv',
  tel: 'te', tgl: 'tl', tha: 'th', tur: 'tr', ukr: 'uk', vie: 'vi', wol: 'wo', cmn: 'zh', 'zh-hans': 'zh', 'zh-hant': 'zh',
};
/** Names shown in the setup (the church's own name for the language first, where it differs). */
const NAMES = {
  en: 'English', af: 'Afrikaans', xh: 'isiXhosa', zu: 'isiZulu', nd: 'isiNdebele', nr: 'isiNdebele (South Africa)', st: 'Sesotho', tn: 'Setswana',
  nso: 'Sepedi', ts: 'Xitsonga', ve: 'Tshivenda', ss: 'siSwati', sn: 'Shona', ny: 'Chichewa', bem: 'Icibemba', toi: 'Tonga (Zambia)',
  tum: 'Tumbuka', sw: 'Kiswahili', rw: 'Kinyarwanda', ki: 'Gĩkũyũ (Kikuyu)', kam: 'Kikamba', kln: 'Kalenjin', luo: 'Dholuo', guz: 'Ekegusii',
  mas: 'Maasai', tw: 'Twi', fr: 'Français (French)', pt: 'Português (Portuguese)', es: 'Español (Spanish)', ru: 'Русский (Russian)',
  de: 'Deutsch (German)', nl: 'Nederlands (Dutch)', zh: 'Chinese', no: 'Norwegian', el: 'Greek', he: 'Hebrew', mg: 'Malagasy', am: 'Amharic',
  grc: 'Greek (ancient)', hbo: 'Hebrew (ancient)', my: 'Burmese (Myanmar)', tpi: 'Tok Pisin',
};

export function langKey(code, name) {
  const c = String(code || '').toLowerCase();
  if (c) return TO_1[c] || c;
  return String(name || '').toLowerCase().split(/[^a-z]+/)[0] || 'und';
}
export const langName = (key) => NAMES[key] || key;

let cache = null;
/** [{ key, name, hymns: [hymnal entries], bibles: [Bible items], builtinBible, builtinHymns }], southern African first. */
export function languageChoices() {
  if (cache) return cache;
  const by = new Map();
  const get = (key, name) => {
    if (!by.has(key)) by.set(key, { key, name: NAMES[key] || name || key, hymns: [], bibles: [] });
    return by.get(key);
  };
  HYMNALS.forEach((e) => get(langKey(e.lang), e.langName).hymns.push(e));
  [...getbibleItems(), ...ebibleItems(), ...corpusItems()].forEach((t) => { if (t.langName || t.lang) get(langKey(t.lang, t.langName), t.langName).bibles.push(t); });
  get('en').builtinBible = 'KJV and WEB are built in';
  get('en').builtinHymns = 'SDA Hymnal 1985 (numbers, titles and music) and Church Hymnal 1941 (words) are built in';
  get('af').builtinHymns = 'Advent Lofliedere (numbers and titles) is built in';
  cache = [...by.values()].map((l) => Object.assign(l, { lang: l.key, langName: l.name }))
    .sort((a, b) => (a.key === 'en' ? -1 : b.key === 'en' ? 1 : 0) || (a.key === 'af' ? -1 : b.key === 'af' ? 1 : 0)
      || rank(a) - rank(b) || (b.hymns.length ? 1 : 0) - (a.hymns.length ? 1 : 0) || a.name.localeCompare(b.name));
  return cache;
}

const SRC_ORDER = { gb: 0, eb: 1, bc: 2, ao: 3 };
/** Bibles for one language, the likeliest choice first: whole Bibles before New Testaments. */
export const sortBibles = (list) => list.slice().sort((a, b) => (b.full ? 1 : 0) - (a.full ? 1 : 0) || SRC_ORDER[a.src] - SRC_ORDER[b.src] || a.name.localeCompare(b.name));
/** Hymnbooks for one language, the likeliest choice first: the ones with real line breaks (SID, Hymnals Data). */
const HYM_ORDER = { sid: 0, gs: 1, rejnac: 2 };
export const sortHymnals = (list) => list.slice().sort((a, b) => (a.key === 'hgpp1849' ? 1 : 0) - (b.key === 'hgpp1849' ? 1 : 0)
  || (a.id === 'web-rejnac-english' ? -1 : b.id === 'web-rejnac-english' ? 1 : 0) || HYM_ORDER[a.src] - HYM_ORDER[b.src]);
