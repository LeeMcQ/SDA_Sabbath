// "Add a Bible" dialog — for licensed translations (NIV, Xhosa 1975, …) that cannot be
// shipped with the app. The file is converted once and stored offline on this device.
import { h } from '../core/util.js';
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
  const gets = h('div.col', { style: { gap: '6px' } },
    h('b', 'Download a Bible file'),
    h('div.row.wrap', { style: { gap: '6px' } }, GET.map(([a, f]) => {
      const bt = h('button.btn.sm', { type: 'button' }, a + ' (download)');
      bt.onclick = async () => {
        bt.disabled = true; bt.textContent = 'Downloading ' + a + '…';
        try {
          const r = await fetch(RAW + encodeURIComponent(f));
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const blob = await r.blob();
          const u = URL.createObjectURL(blob);
          const aEl = h('a', { href: u, download: a + '.json' });
          document.body.appendChild(aEl); aEl.click(); aEl.remove();
          setTimeout(() => URL.revokeObjectURL(u), 10000);
          bt.textContent = a + ' saved — now choose ' + a + '.json below';
          abbr.value = a; name.value = PRESETS.find((x) => x[0] === a)[1]; lang.value = 'en';
        } catch (e) {
          bt.textContent = a + ' failed (' + e.message + ')';
          window.open(RAW + encodeURIComponent(f), '_blank', 'noopener');
        }
        bt.disabled = false;
      };
      return bt;
    })),
    h('p.note', 'Needs internet. The file goes to your Downloads folder; then press “Choose file” below and pick it. ',
      h('a', { href: PAGE, target: '_blank', rel: 'noopener' }, 'See all files on GitHub'), '.'));
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
