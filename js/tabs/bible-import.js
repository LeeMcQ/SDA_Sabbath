// "Add a Bible" dialog — for licensed translations (NIV, Xhosa 1975, …) that cannot be
// shipped with the app. The file is converted once and stored offline on this device.
import { h, clear } from '../core/util.js';
import { modal, toast, closeModal } from '../core/ui.js';
import { parseBibleFile, saveImported, listTranslations } from '../core/bibledata.js';

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
  // Where the Bible files can be downloaded. The button saves the file to the Downloads folder;
  // then choose it below. (Check that your church may use the translation.)
  const RAW = 'https://raw.githubusercontent.com/Amosamevor/bible-json/main/versions/en/';
  const PAGE = 'https://github.com/Amosamevor/Bible-json/tree/main/versions/en';
  const GET = [['NIV', 'NEW INTERNATIONAL VERSION.json'], ['ESV', 'ENGLISH STANDARD VERSION.json'], ['NKJV', 'NEW KING JAMES VERSION.json']];
  // Full index of downloadable Bibles (English + Afrikaans). Search filters this list.
  const INDEX = [
    ['ASV', 'American Standard Version', 'AMERICAN STANDARD VERSION.json', 'en'],
    ['AMP', 'Amplified Bible', 'AMPLIFIED BIBLE.json', 'en'],
    ['BSB', 'Berean Standard Bible', 'BEREAN STANDARD BIBLE.json', 'en'],
    ['CSB', 'Christian Standard Bible', 'CHRISTIAN STANDARD BIBLE.json', 'en'],
    ['CEV', 'Contemporary English Version', 'CONTEMPORARY ENGLISH VERSION.json', 'en'],
    ['ESV', 'English Standard Version', 'ENGLISH STANDARD VERSION.json', 'en'],
    ['GNT', 'Good News Translation', 'GOOD NEWS TRANSLATION.json', 'en'],
    ['KJV', 'King James Bible', 'KING JAMES BIBLE.json', 'en'],
    ['LSB', 'Legacy Standard Bible', 'LEGACY STANDARD BIBLE.json', 'en'],
    ['NASB', 'New American Standard Bible', 'NEW AMERICAN STANDARD BIBLE.json', 'en'],
    ['NET', 'NET Bible', 'NET BIBLE.json', 'en'],
    ['NIV', 'New International Version', 'NEW INTERNATIONAL VERSION.json', 'en'],
    ['NKJV', 'New King James Version', 'NEW KING JAMES VERSION.json', 'en'],
    ['NLT', 'New Living Translation', 'NEW LIVING TRANSLATION.json', 'en'],
    ['NRSV', 'New Revised Standard Version', 'NEW REVISED STANDARD VERSION.json', 'en'],
    ['WEB', 'World English Bible', 'WORLD ENGLISH BIBLE.json', 'en'],
    ['YLT', 'Young\'s Literal Translation', 'YOUNG\'S LITERAL TRANSLATION.json', 'en'],
    ['AF', 'Afrikaans PWL', 'AFRIKAANS PWL.json', 'af'],
  ];
  const gets = h('div.col', { style: { gap: '6px' } },
    h('b', 'Download a Bible file'),
    h('div.row.wrap', { style: { gap: '6px' } }, GET.map(([a, f]) => {
      const bt = h('button.btn.sm', { type: 'button' }, a + ' (download)');
      bt.onclick = () => downloadOne(a, f, bt);
      return bt;
    })),
    h('label', 'Search all Bibles'),
    h('input.field', { type: 'search', placeholder: 'Type a name, e.g. NASB, Afrikaans, King James…', 'aria-label': 'Search Bibles', oninput: (e) => renderSearch(e.target.value) }),
    h('div.col', { id: 'bible-search-results', style: { gap: '4px', maxHeight: '180px', overflow: 'auto' } }));
  const searchBox = gets.querySelector('#bible-search-results');
  function renderSearch(q) {
    clear(searchBox);
    const qq = (q || '').toLowerCase().trim();
    const hits = INDEX.filter(([a, n]) => !qq || a.toLowerCase().includes(qq) || n.toLowerCase().includes(qq)).slice(0, 12);
    if (!hits.length) { searchBox.appendChild(h('p.note', 'No Bible matches “' + q + '”.')); return; }
    hits.forEach(([a, n, f, lang]) => {
      const row = h('div.row', { style: { gap: '6px', alignItems: 'center' } },
        h('span.grow', h('b', a), h('span.note', '  ' + n)),
        h('button.btn.sm', { type: 'button', onclick: (e) => downloadOne(a, f, e.target, lang) }, 'Download'));
      searchBox.appendChild(row);
    });
  }
  renderSearch('');
  async function downloadOne(a, f, bt, langCode) {
    const raw = langCode === 'af' ? RAW.replace('/en/', '/af/') : RAW;
    bt.disabled = true; const old = bt.textContent; bt.textContent = 'Downloading…';
    try {
      const r = await fetch(raw + encodeURIComponent(f));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const aEl = h('a', { href: u, download: a + '.json' });
      document.body.appendChild(aEl); aEl.click(); aEl.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
      bt.textContent = a + ' saved';
      abbr.value = a; name.value = INDEX.find((x) => x[0] === a)?.[1] || a; lang.value = langCode || 'en';
    } catch (e) {
      bt.textContent = 'Failed';
      window.open(raw + encodeURIComponent(f), '_blank', 'noopener');
    }
    setTimeout(() => { bt.disabled = false; bt.textContent = old; }, 2500);
  }
  modal({
    title: 'Add a Bible translation',
    body: h('div.col',
      h('p.note.warn', 'Only add translations your church is licensed to use. NIV is © Biblica, ESV is © Crossway, NKJV is © Thomas Nelson, and the 1975 Xhosa Bible is © Bible Society of South Africa. The app cannot include them; choose a file you are licensed to use (see Supported below).'),
      gets, presets,
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
