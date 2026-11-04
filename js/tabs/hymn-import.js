// "Add a hymnbook" dialog — the hymn counterpart of Add a Bible (bible-import.js). Pick a hymnbook from the list
// (SDA hymnals in 26 languages, the SID Hymnal, early Adventist hymnals): it downloads once from GitHub and is
// kept offline on this device. Or choose a hymnbook file (VideoPsalm .vpc / .json, SDA Sabbath .json, text).
// Opened from Hymns → More and from Settings → Bibles & hymns; both refresh through the 'selah-hymnbooks' event.
import { h, clear } from '../core/util.js';
import { modal, toast, closeModal } from '../core/ui.js';
import { db } from '../core/db.js';
import { parseHymnFile } from '../core/hymnparse.js';
import { HYMNALS, SOURCES, NOTES, downloadHymnal, sameTitle } from '../core/hymnsources.js';
import { matches, fuzzyMatch, rank } from '../core/langsearch.js';

/** Fired on window when hymnbooks were added or removed: detail.select is the hymnbook to open, if any. */
export const HYMNBOOKS_CHANGED = 'selah-hymnbooks';
const announce = (select) => window.dispatchEvent(new CustomEvent(HYMNBOOKS_CHANGED, { detail: { select: select || null } }));

const SDAH_BUILTIN = 'sda-online';
const LANGS = [['en', 'English'], ['af', 'Afrikaans'], ['xh', 'isiXhosa'], ['zu', 'isiZulu'], ['st', 'Sesotho'], ['tn', 'Setswana'], ['nso', 'Sepedi'],
  ['sn', 'Shona'], ['ny', 'Chichewa'], ['sw', 'Swahili'], ['fr', 'French'], ['pt', 'Portuguese'], ['es', 'Spanish'], ['', 'Other']];
const kbText = (kb) => (kb >= 1000 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB');

/** Hymnbooks saved on this device (not the words added to a built-in book). */
export async function addedHymnbooks() {
  const all = (await db.all('hymnbooks').catch(() => [])) || [];
  return all.filter((b) => b && typeof b === 'object' && b.id && !b.overlayOf);
}

/** Words that a downloaded hymnbook filled into a built-in book (the SDA Hymnal) are kept per hymn with "from". */
export async function overlayCounts() {
  const all = (await db.all('hymnbooks').catch(() => [])) || [];
  const out = {};
  all.filter((b) => b && b.overlayOf && Array.isArray(b.hymns)).forEach((b) => { out[b.overlayOf] = b.hymns.filter((x) => x && x.v && x.v.length).length; });
  return out;
}

/** Remove a hymnbook from this device, with any words it filled into a built-in book. */
export async function removeHymnbook(id) {
  await db.del('hymnbooks', id);
  const all = (await db.all('hymnbooks').catch(() => [])) || [];
  for (const ov of all) {
    if (!ov || !ov.overlayOf || !Array.isArray(ov.hymns) || !ov.hymns.some((x) => x && x.from === id)) continue;
    ov.hymns = ov.hymns.filter((x) => !(x && x.from === id));
    await db.put('hymnbooks', ov.id, ov);
  }
  announce(null);
}

/** The English SDA Hymnal words (rejnac) also go into the built-in SDA Hymnal 1985, which has numbers and titles
 *  only, so those hymns keep their offline music, plans and "hymn 73". Only hymns whose title matches, and never
 *  over words the church added itself. Returns how many hymns were filled. */
async function fillBuiltIn(book) { return fillBuiltInWords(SDAH_BUILTIN, book.hymns, { from: book.id, titles: true }); }

/** Put words into a built-in book that has numbers and titles only (SDA Hymnal 1985, Advent Lofliedere), by number.
 *  titles: only where the title matches (a downloaded hymnbook); a church's own licensed file goes in by number,
 *  as Import licensed words does. Built-in words stay; words the church typed itself stay unless they come from
 *  its own file. from: the downloaded hymnbook, so removing it takes its words out again. Returns how many. */
export async function fillBuiltInWords(baseId, hymns, { from = null, titles = false } = {}) {
  let base;
  try { base = await (await fetch('data/hymns/' + (baseId === 'afrikaans-sda' ? 'afrikaans' : baseId) + '.json')).json(); } catch (e) { return 0; }
  const key = 'overlay:' + baseId;
  const ov = (await db.get('hymnbooks', key).catch(() => null)) || { id: key, overlayOf: baseId, hymns: [] };
  const have = new Map((Array.isArray(ov.hymns) ? ov.hymns : []).filter((x) => x && x.n).map((x) => [x.n, x]));
  let filled = 0;
  for (const b of (base && base.hymns) || []) {
    if (b.v && b.v.length) continue;                          // words built in
    const mine = have.get(b.n);
    if (from && mine && !mine.from && mine.v && mine.v.length) continue; // words this church added itself
    const hy = hymns.find((x) => x.n === b.n);
    if (!hy || !hy.v || !hy.v.length || (titles && !sameTitle(b.t, hy.t))) continue;
    have.set(b.n, Object.assign({ n: b.n, t: b.t, a: hy.a || '', v: hy.v, c: hy.c || null }, from ? { from } : {}));
    filled++;
  }
  ov.hymns = [...have.values()].sort((x, y) => x.n - y.n);
  await db.put('hymnbooks', key, ov);
  return filled;
}

/** Download one hymnbook from the list and keep it offline (with the SDA Hymnal words, for the English one).
 *  Returns { book, filled }. The caller announces the change. */
export async function installHymnal(e, say = () => {}) {
  if (navigator.onLine === false) throw new Error('no internet connection');
  const book = await downloadHymnal(e, say);
  say('Saving…');
  await db.put('hymnbooks', book.id, book);
  const filled = e.id === 'web-rejnac-english' ? await fillBuiltIn(book) : 0;
  return { book, filled };
}
export const announceHymnbooks = announce;

export function addHymnbookDialog(onDone) {
  let filter = 'all';
  let installed = new Map();
  let builtinIds = new Set();
  const counts = {};
  HYMNALS.forEach((e) => { counts[e.src] = (counts[e.src] || 0) + 1; });

  const searchInp = h('input.field', { type: 'search', placeholder: 'Search: Xhosa, Zulu, Sesotho, French, Swahili…', 'aria-label': 'Search hymnbooks', oninput: () => render() });
  const chips = h('div.row.wrap.src-chips', { style: { gap: '6px' }, role: 'group', 'aria-label': 'Hymnbook sources' });
  const box = h('div.col', { style: { gap: '4px', maxHeight: '320px', overflow: 'auto' } });

  function paintChips() {
    clear(chips);
    const chip = (key, text) => h('button.btn.sm' + (filter === key ? '.primary' : ''), { type: 'button', 'aria-pressed': String(filter === key), onclick: () => { filter = key; render(); } }, text);
    chips.append(chip('all', 'All sources (' + HYMNALS.length + ')'));
    Object.keys(SOURCES).forEach((k) => chips.append(chip(k, SOURCES[k].label + ' (' + (counts[k] || 0) + ')')));
  }
  function row(e) {
    const have = installed.get(e.id);
    const bt = h('button.btn.sm' + (have ? '' : '.primary'), { type: 'button', title: have ? 'Download it again (changes you made to its hymns are replaced)' : 'Download and keep offline' }, have ? 'Update' : 'Add');
    bt.onclick = () => add(e, bt, !!have);
    return h('div.row', { style: { gap: '6px', alignItems: 'center' } },
      h('span.grow', { title: SOURCES[e.src].licence, lang: e.lang || undefined },
        h('b', e.name),
        h('span.note', '  ' + e.langName + ' · ' + SOURCES[e.src].label + ' · ' + e.hymns + ' hymns, ' + kbText(e.kb) + (have ? ' · added ✓' : '')),
        NOTES[e.id] ? h('div.note', NOTES[e.id]) : null),
      bt);
  }
  function render() {
    paintChips();
    clear(box);
    const q = searchInp.value || '';
    const qq = q.toLowerCase().trim();
    const list = HYMNALS.filter((e) => filter === 'all' || e.src === filter);
    let hits = list.filter((e) => !qq || matches(e, qq));
    let fuzzy = false;
    if (qq && !hits.length) { hits = list.filter((e) => fuzzyMatch(e, qq)); fuzzy = hits.length > 0; }
    hits = hits.slice().sort((x, y) => rank(x) - rank(y) || x.langName.localeCompare(y.langName) || x.name.localeCompare(y.name));
    if (!hits.length) {
      box.appendChild(h('p.note', 'No hymnbook matches “' + q + '”' + (filter === 'all' ? '' : ' in ' + SOURCES[filter].label) +
        '. If your church has the hymnbook as a file (VideoPsalm, or another presentation program), choose it in the form below the list.'));
      return;
    }
    if (fuzzy) box.appendChild(h('p.note', 'No exact match for “' + q + '”. Closest results:'));
    hits.forEach((e) => box.appendChild(row(e)));
  }

  // One tap: download, convert and keep offline. "Update" asks for a second tap, since edits are replaced.
  async function add(e, bt, have) {
    if (have && bt.dataset.armed !== '1') {
      bt.dataset.armed = '1'; const old = bt.textContent; bt.textContent = 'Replace? Tap again';
      setTimeout(() => { if (bt.dataset.armed === '1') { bt.dataset.armed = ''; bt.textContent = old; } }, 4000);
      return;
    }
    bt.dataset.armed = '';
    bt.disabled = true; const old = have ? 'Update' : 'Add';
    const say = (x) => { bt.textContent = x; };
    try {
      const { book, filled } = await installHymnal(e, say);
      closeModal();
      toast(e.name + ' added (' + book.hymns.length + ' hymns) and available offline.' +
        (filled ? ' The words were also filled in for ' + filled + (filled === 1 ? ' hymn' : ' hymns') + ' of the SDA Hymnal 1985, so they play with their music.' : ''), 'ok', filled ? 7000 : 4000);
      announce(book.id);
      if (onDone) onDone(book.id);
      return;
    } catch (err) {
      say('Failed: ' + (err.name === 'AbortError' ? 'it took too long' : err.name === 'TypeError' ? 'no connection to GitHub' : err.message));
    }
    setTimeout(() => { bt.disabled = false; bt.textContent = old; }, 4000);
  }

  // A hymnbook file this church already has.
  const file = h('input', { type: 'file', accept: '.vpc,.json,.txt' });
  const short = h('input.field', { placeholder: 'UE', maxlength: 8 });
  const name = h('input.field', { placeholder: 'UKristu Engomeni' });
  const lang = h('select.field', LANGS.map(([k, l]) => h('option', { value: k }, l)));
  const status = h('p.note', 'Supported: VideoPsalm songbooks (.vpc, or their .json), SDA Sabbath hymnbooks (.json), the Liedboek JSON format, and text with “# 73 Title” before each hymn.');
  let parsed = null;
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    status.classList.remove('warn');
    status.textContent = 'Reading ' + f.name + '…';
    try {
      parsed = await parseHymnFile(f);
      if (!parsed.hymns.length) throw new Error('No hymns found in ' + f.name + '.');
      if (parsed.name && !name.value) name.value = parsed.name;
      if (parsed.short && !short.value) short.value = String(parsed.short).slice(0, 8);
      if (parsed.lang && LANGS.some(([k]) => k === parsed.lang)) lang.value = parsed.lang;
      status.textContent = 'Found ' + parsed.hymns.length + ' hymns' + (parsed.skipped ? ' (' + parsed.skipped + ' without words left out)' : '') + '. Check the name and press Add hymnbook.';
    } catch (e) { parsed = null; status.textContent = e.message; status.classList.add('warn'); }
  });

  async function refresh() {
    installed = new Map((await addedHymnbooks()).map((b) => [String(b.id), b]));
    try { builtinIds = new Set(((await (await fetch('data/hymns/index.json')).json()) || []).map((b) => b.id)); } catch (e) { /* offline first start */ }
    render();
  }
  render();
  refresh();
  modal({
    title: 'Add a hymnbook',
    body: h('div.col',
      h('div.col', { style: { gap: '6px' } },
        h('b', 'Find a hymnbook'), searchInp, chips, box,
        h('p.note', 'Tap Add: it downloads once and then works offline. Hymn words belong to their owners: the compilers share these hymnbooks for worship, but check that your church may use the words (many SDA Hymnal texts are under copyright; a licence such as CCLI covers many of them). A live stream also needs a CCLI Streaming Licence.')),
      h('p.note', { style: { marginTop: '10px' } }, 'Have a hymnbook file your church uses (from VideoPsalm, another presentation program, or SDA Sabbath on another device)? Choose it here:'),
      file, h('div.form', h('label', 'Short name'), short, h('label', 'Full name'), name, h('label', 'Language'), lang), status),
    actions: [{ label: 'Cancel' }, {
      label: 'Add hymnbook', primary: true, onclick: async () => {
        if (!parsed) { toast('Choose a hymnbook file first.', 'err'); return false; }
        let id = parsed.id && !/^book-/.test(parsed.id) ? String(parsed.id).slice(0, 60) : 'book-' + Date.now().toString(36);
        if (builtinIds.has(id) || installed.has(id)) id += '-' + Date.now().toString(36);
        const book = { id, name: name.value.trim() || parsed.name || 'Hymnbook', short: short.value.trim().slice(0, 8), lang: lang.value,
          hymns: parsed.hymns, licence: 'Imported on this device', added: Date.now() };
        status.textContent = 'Saving for offline use…';
        await db.put('hymnbooks', id, book);
        closeModal();
        toast(book.name + ' added (' + book.hymns.length + ' hymns) and available offline.', 'ok');
        announce(id);
        if (onDone) onDone(id);
        return false;
      },
    }],
  });
}
