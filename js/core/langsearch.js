// Finding a Bible or hymnbook by language: "Xhosa", "isiXhosa", "xhose", "Sesotho" … all find the same one, and
// southern African languages come first, then the rest of Africa. Used by Add a Bible and Add a hymnbook.
// An item is { abbr, name, lang (ISO 639 code), langName }.

// African languages: southern ones first (ISO 639-3 / 639-1 codes, plus a name check for odd codes).
const SOUTH = new Set(['afr', 'xho', 'zul', 'sot', 'tsn', 'nso', 'tso', 'ven', 'ssw', 'nbl', 'nde', 'sna', 'nya', 'her', 'ndo', 'kua', 'loz', 'toi', 'bem', 'tum', 'kmb', 'umb', 'lue', 'kwn', 'af', 'xh', 'zu', 'st', 'tn', 'ts', 've', 'ss', 'nr', 'sn', 'ny', 'nd']);
const NORTH = new Set(['swa', 'swh', 'amh', 'yor', 'ibo', 'hau', 'som', 'orm', 'gaz', 'tir', 'lin', 'kin', 'run', 'mlg', 'plt', 'wol', 'aka', 'twi', 'ewe', 'gaa', 'ful', 'fuv', 'lug', 'kik', 'kam', 'luo', 'kon', 'lua', 'sw', 'am', 'yo', 'ig', 'ha', 'so', 'om', 'ti', 'ln', 'rw', 'rn', 'mg', 'wo', 'ak', 'tw', 'ee', 'ff', 'lg', 'ki', 'kg', 'cjk', 'tig', 'ara', 'arz', 'kab', 'ber', 'tzm', 'zgh', 'bam', 'ses', 'dag', 'efi', 'ibb', 'ijo', 'kpe', 'men', 'tem', 'vai', 'sag', 'ktu', 'mos', 'gur', 'dyu', 'bci', 'ctu', 'nym', 'mas', 'kln', 'luy', 'meru', 'mer', 'kdj', 'tuk', 'lgg', 'ach', 'alz', 'teo', 'rub', 'sna', 'guz']);
const SA_NAME = /afrikaans|xhosa|zulu|sotho|tswana|pedi|tsonga|venda|swati|swazi|ndebele|shona|chichewa|nyanja|herero|oshiwambo|ovambo|lozi|tonga|bemba|kwanyama|ndonga|\bhimba\b|nama|damara|mozambi|zimbab|malawi|namib/i;
const AF_NAME = /swahili|kiswahili|amharic|yoruba|igbo|hausa|somali|oromo|tigrinya|lingala|kinyarwanda|rwanda|kirundi|rundi|malagasy|wolof|akan|twi|ewe|fula|fulani|luganda|ganda|kikuyu|kamba|luo|kongo|chokwe|tumbuka|berber|kabyle|tamazight|bambara|dagbani|efik|ibibio|ijaw|kpelle|mende|temne|vai|sango|mossi|dyula|baoule|maasai|luhya|kalenjin|gusii|acholi|runyoro|nuer|dinka|african|ethiop|nigeria|ghana|kenya|uganda|tanzan|cameroon|congo|sudan|egypt|arabic \(?(egypt|morocc|alger|tunis|liby)/i;
export const isSA = (t) => SOUTH.has(String(t.lang).toLowerCase()) || SA_NAME.test(t.langName + ' ' + t.name);
export const isAfrica = (t) => !isSA(t) && (NORTH.has(String(t.lang).toLowerCase()) || AF_NAME.test(t.langName)) && !/^(eng|en)$/i.test(t.lang);
/** 0 southern Africa, 1 the rest of Africa, 2 everything else. */
export const rank = (t) => (isSA(t) ? 0 : isAfrica(t) ? 1 : 2);

const ALIAS = { xhose: 'xhosa', xosa: 'xhosa', khosa: 'xhosa', xh: 'xho', zulu: 'zulu', isizulu: 'zulu', sesotho: 'sotho', setswana: 'tswana', sepedi: 'pedi', 'northern sotho': 'pedi', tshivenda: 'venda', xitsonga: 'tsonga', siswati: 'swati', isindebele: 'ndebele', chishona: 'shona', chichewa: 'nyanja', afrikaans: 'afrikaans', afrikans: 'afrikaans', afrikaan: 'afrikaans' };
const strip = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const unprefix = (w) => w.replace(/^(isi|ses|se|si|tshi|xi|chi|oshi|ki|ci|ik|ichi|otji|oci)(?=[a-z]{3,})/, '');
const words = (x) => strip(x).split(/[^a-z0-9]+/).filter(Boolean).map(unprefix);
const canon = (qq) => { const k = strip(qq).trim(); return ALIAS[k] || ALIAS[unprefix(k)] || unprefix(k); };
const hay = (t) => strip([t.abbr, t.name, t.lang, t.langName].join(' '));

/** Does the item match what was typed? */
export function matches(t, qq) {
  const c = canon(qq), h2 = hay(t);
  return h2.includes(strip(qq).trim()) || h2.includes(c) || words(t.name + ' ' + t.langName).some((w) => w === c || w.startsWith(c));
}
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
/** A near miss ("Xhoza", "Shonna"): used when nothing matches exactly. */
export function fuzzyMatch(t, qq) {
  const c = canon(qq); if (c.length < 3) return false;
  const max = c.length >= 7 ? 2 : 1;
  return words(t.name + ' ' + t.langName + ' ' + t.abbr).some((w) => w.length >= 3 && lev(w.slice(0, c.length + 1), c, max) <= max || lev(w, c, max) <= max);
}
