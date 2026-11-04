// "Add a Bible" dialog — for licensed translations (NIV, Xhosa 1975, …) that cannot be
// shipped with the app. The file is converted once and stored offline on this device.
import { h, clear } from '../core/util.js';
import { modal, toast, closeModal } from '../core/ui.js';
import { parseBibleFile, saveImported, listTranslations } from '../core/bibledata.js';
import { BIBLE_SOURCES, corpusItems, getbibleItems, ebibleItems, loadAoList, loadGbList, addBible } from '../core/biblesources.js';
import { matches, fuzzyMatch, rank } from '../core/langsearch.js';

export function importBibleDialog(onDone) {
  const file = h('input', { type: 'file', accept: '.json,.xml,.csv,.tsv,.txt' });
  const abbr = h('input.field', { placeholder: 'NIV', maxlength: 8 });
  const name = h('input.field', { placeholder: 'New International Version' });
  const lang = h('select.field', h('option', { value: 'en' }, 'English'), h('option', { value: 'af' }, 'Afrikaans'), h('option', { value: 'xh' }, 'isiXhosa'), h('option', { value: 'zu' }, 'isiZulu / other'));
  const status = h('p.note', 'Supported: Zefania XML, OSIS XML, JSON (Joy in the Journey, bible-api, thiagobodruk, and book → chapter → verse files such as Bible-json) and CSV/TSV (book, chapter, verse, text).');
  let parsed = null;
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    status.textContent = 'Reading ' + f.name + '…';
    try {
      parsed = await parseBibleFile(f);
      const m = parsed.meta || {};
      if (m.abbr && !abbr.value) abbr.value = String(m.abbr).slice(0, 8);
      if ((m.name || m.shortname) && !name.value) name.value = m.name || m.shortname;
      if (m.lang && ['en', 'af', 'xh'].includes(m.lang)) lang.value = m.lang;
      if (/xho|xhosa/i.test(f.name + (m.name || ''))) lang.value = 'xh';
      if (/afr/i.test(f.name + (m.name || ''))) lang.value = 'af';
      status.textContent = 'Found ' + parsed.total.toLocaleString() + ' verses in ' + parsed.books.size + ' books. Check the name and press Add.';
    } catch (e) { parsed = null; status.textContent = e.message; status.classList.add('warn'); }
  });
  const PRESETS = [['NIV', 'New International Version'], ['ESV', 'English Standard Version'], ['NKJV', 'New King James Version']];
  const presets = h('div.row.wrap', { style: { gap: '6px' } }, h('span.note', 'Quick fill:'),
    PRESETS.map(([a, n]) => h('button.btn.sm', { type: 'button', onclick: () => { abbr.value = a; name.value = n; lang.value = 'en'; } }, a)));
  // Four sources, searched together. Each one's list loads on its own, so a slow or blocked source never hides the
  // others. getBible and the Bible corpus have built-in lists, so they always show; bible.helloao.org needs its live list.
  const SRC = {
    ao: Object.assign({ items: [], state: 'loading', note: '' }, BIBLE_SOURCES.ao),
    gb: Object.assign({ items: [], state: 'loading', note: '' }, BIBLE_SOURCES.gb),
    bc: Object.assign({ items: [], state: 'ok', note: '' }, BIBLE_SOURCES.bc),
    eb: Object.assign({ items: [], state: 'ok', note: '' }, BIBLE_SOURCES.eb),
  };
  let filter = 'all';
  const searchInp = h('input.field', { type: 'search', placeholder: 'Search: Zulu, Xhosa, Sesotho, Afrikaans, KJV…', 'aria-label': 'Search Bibles', oninput: () => renderAo() });
  const chips = h('div.row.wrap.src-chips', { style: { gap: '6px' }, role: 'group', 'aria-label': 'Bible sources' });
  const searchBox = h('div.col', { style: { gap: '4px', maxHeight: '320px', overflow: 'auto' } });
  const gets = h('div.col', { style: { gap: '6px' } },
    h('b', 'Find a Bible'), searchInp, chips, searchBox,
    h('p.note', 'Tap Add: it downloads once and then works offline.'));
  SRC.bc.items = corpusItems();
  SRC.gb.items = getbibleItems();
  SRC.eb.items = ebibleItems();

  async function loadSource(k) {
    const s = SRC[k];
    s.state = 'loading'; s.note = ''; renderAo();
    try {
      if (k === 'ao') s.items = await loadAoList();
      else if (k === 'gb') { const live = await loadGbList(); if (live.length) s.items = live; }
      s.state = 'ok';
    } catch (e) {
      s.state = k === 'gb' ? 'ok' : 'err';   // getBible falls back to its built-in list
      s.note = k === 'gb' ? 'built-in list (api.getbible.net did not answer; Add still needs it)' : (e.name === 'AbortError' ? 'it took too long' : e.name === 'TypeError' ? 'no connection, or the site blocked the request' : String(e.message || e));
    }
    renderAo();
  }


  const row = (t) => {
    const btn = h('button.btn.sm.primary', { type: 'button' }, 'Add');
    btn.onclick = () => addAo(t, btn);
    return h('div.row', { style: { gap: '6px', alignItems: 'center' } },
      h('span.grow', { title: t.license || '' }, h('b', t.name), h('span.note', (t.langName ? '  ' + t.langName : '') + ' · ' + SRC[t.src].label + (t.mb ? ', ' + t.mb + ' MB' : ''))), btn);
  };
  function paintChips() {
    clear(chips);
    const all = Object.keys(SRC).reduce((n, k) => n + SRC[k].items.length, 0);
    const chip = (key, text) => h('button.btn.sm' + (filter === key ? '.primary' : ''), { type: 'button', 'aria-pressed': String(filter === key), onclick: () => { filter = key; renderAo(); } }, text);
    chips.append(chip('all', 'All sources (' + all + ')'));
    Object.keys(SRC).forEach((k) => {
      const s = SRC[k];
      chips.append(chip(k, s.label + ' (' + (s.state === 'loading' ? '…' : s.state === 'err' ? '!' : s.items.length) + ')'));
    });
    Object.keys(SRC).forEach((k) => {
      const s = SRC[k];
      if (s.state === 'err') chips.append(h('span.note', { style: { width: '100%' } }, s.label + ' (' + s.site + ') could not be reached: ' + s.note + '. ',
        h('button.btn.ghost.sm', { type: 'button', onclick: () => loadSource(k) }, 'Try again')));
      else if (s.note) chips.append(h('span.note', { style: { width: '100%' } }, s.label + ': ' + s.note + '.'));
    });
  }
  function renderAo() {
    paintChips();
    clear(searchBox);
    const q = searchInp.value || '';
    const qq = q.toLowerCase().trim();
    const keys = filter === 'all' ? Object.keys(SRC) : [filter];
    const list = keys.flatMap((k) => SRC[k].items);
    let hits = list.filter((t) => !qq || matches(t, qq));
    let fuzzy = false;
    if (qq && !hits.length) { hits = list.filter((t) => fuzzyMatch(t, qq)); fuzzy = hits.length > 0; }
    hits = hits
      .sort((x, y) => rank(x) - rank(y) || (x.langName + x.name).localeCompare(y.langName + y.name) || x.src.localeCompare(y.src))
      .slice(0, qq ? 150 : 100);
    if (!hits.length) {
      const waiting = keys.some((k) => SRC[k].state === 'loading');
      searchBox.appendChild(h('p.note', waiting ? 'Loading the Bible lists…'
        : 'No Bible matches “' + q + '” in ' + (filter === 'all' ? 'the four sources' : SRC[filter].label) + '. If you have the Bible as a file (from the Bible Society or your church), choose it in the form below the list.'));
      return;
    }
    if (fuzzy) searchBox.appendChild(h('p.note', 'No exact match for “' + q + '”. Closest results:'));
    hits.forEach((t) => searchBox.appendChild(row(t)));
  }

  // One tap: download, convert and save for offline use.
  async function addAo(t, bt) {
    bt.disabled = true; const old = bt.textContent; bt.textContent = 'Adding…';
    const say = (x) => { bt.textContent = x; };
    try {
      const id = await addBible(t, say);
      const ab = String(t.abbr || t.id).trim().toUpperCase().slice(0, 8);
      closeModal();
      toast(ab + ' added and available offline.', 'ok');
      if (onDone) onDone(id);
      return;
    } catch (e) { bt.textContent = 'Failed: ' + (e.name === 'TypeError' ? 'no connection to ' + SRC[t.src].site : e.message); }
    setTimeout(() => { bt.disabled = false; bt.textContent = old; }, 4000);
  }
  renderAo();
  loadSource('ao');
  loadSource('gb');
  modal({
    title: 'Add a Bible translation',
    body: h('div.col',
      gets,
      h('p.note', { style: { marginTop: '10px' } }, 'Have a Bible file your church is licensed to use (NIV, ESV, NKJV, Xhosa 1975 …)? Choose it here:'),
      presets,
      file, h('div.form', h('label', 'Short name'), abbr, h('label', 'Full name'), name, h('label', 'Language (book names)'), lang), status),
    actions: [{ label: 'Cancel' }, {
      label: 'Add Bible', primary: true, onclick: async () => {
        if (!parsed) { toast('Choose a Bible file first.', 'err'); return false; }
        const ab = (abbr.value || 'BIB').trim().toUpperCase();
        const id = 'imp-' + ab.toLowerCase().replace(/[^a-z0-9]/g, '');
        const list = await listTranslations(true);
        if (list.some((t) => t.id === id && t.src !== 'imported')) { toast('That short name is already used by a built-in Bible.', 'err'); return false; }
        status.textContent = 'Saving for offline use…';
        await saveImported({ id, abbr: ab, name: name.value.trim() || ab, lang: lang.value, license: 'Imported on this device' }, parsed);
        closeModal();
        toast(ab + ' added and available offline.', 'ok');
        if (onDone) onDone(id);
        return false;
      },
    }],
  });
}
