// Banners: welcome, Bible-verse, announcement, offering, countdown and sunset banners, drawn live on the
// display (sharp at any size, any projector shape); a pre-service loop that runs on the display by itself;
// and Topics: key Bible verses for the 28 Fundamental Beliefs and common sermon topics, from the installed
// Bibles. Nothing here reaches the screen until Present. Online AI (optional) makes background pictures
// and short summaries that are always shown for checking first.
// (The tab id stays 'ai' so existing settings and service plans keep working.)
import { h, clear, uid, debounce, esc, normalize } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, seg, toast, modal, closeModal, confirmBox, promptBox, menu, emptyState } from '../core/ui.js';
import { db } from '../core/db.js';
import { createStage } from '../core/render.js';
import { PALETTES, DECOS } from '../core/bannerframe.js';
import { church, hasLocation, sabbathSunsetLine, sabbathDateLine, nextTime, safeGivingUrl } from '../core/church.js';
import { listTranslations, getInfo, versesFor, verseText, search as bibleSearch } from '../core/bibledata.js';
import { parseRef, refText, SHORT } from '../core/books.js';
import * as ai from '../core/ai.js';
import { churchForm } from './church-form.js';
import { openFullBanner } from './ai-full.js';

// ------------------------------------------------------------ templates
const TPL = {
  welcome: { name: 'Welcome', fields: ['kicker', 'title', 'text', 'foot'], x: { logo: true, date: true }, s: { pal: 'navy', deco: 'glow' },
    d: (c) => ({ kicker: c.name, title: 'Happy Sabbath', text: 'Welcome to our worship service. We are glad you are here!' }),
    mood: 'Warm early-morning light over a peaceful green valley' },
  verse: { name: 'Bible verse', fields: ['ref', 'title', 'kicker'], x: {}, s: { pal: 'black', deco: 'none', font: 'serif' },
    d: () => ({ ref: 'Exodus 20:8' }), mood: 'A quiet, softly lit nature scene' },
  announce: { name: 'Announcement', fields: ['kicker', 'title', 'text', 'foot'], x: {}, s: { pal: 'slate', deco: 'waves' },
    d: () => ({ kicker: 'Announcement', title: 'Family Week of Prayer', text: 'Every evening at 19:00', foot: 'Main sanctuary · Everyone welcome' }),
    mood: 'Bright, friendly, softly blurred light' },
  offering: { name: 'Tithe & offering', fields: ['kicker', 'title', 'text', 'foot'], x: { qr: true }, s: { pal: 'earth', deco: 'glow' },
    d: (c) => ({ kicker: c.name, title: 'Tithes & Offerings', text: '“God loveth a cheerful giver.”\n2 Corinthians 9:7' }),
    presets: ['2 Cor 9:7', 'Mal 3:10', 'Prov 3:9', 'Luke 6:38', '1 Chr 29:14'], mood: 'A golden wheat field in late afternoon sun' },
  countdown: { name: 'Countdown', fields: ['kicker', 'at', 'done', 'text', 'foot'], x: {}, s: { pal: 'navy', deco: 'rays' },
    d: (c) => ({ kicker: 'Our service starts in', at: c.service, done: 'Welcome', text: 'Please take your seats and silence your phones.', foot: c.name }),
    mood: 'A calm sky at dawn with soft clouds' },
  sunset: { name: 'Sabbath sunset', fields: ['kicker', 'title', 'text', 'foot'], x: { sunset: true }, s: { pal: 'sunset', deco: 'rays' },
    d: (c) => ({ kicker: c.name, title: 'Welcome the Sabbath', text: 'Come, let us worship together as the sun sets.' }),
    mood: 'A peaceful sunset over gentle hills' },
  closing: { name: 'Closing blessing', fields: ['title', 'text', 'foot'], x: {}, s: { pal: 'plum', deco: 'glow' },
    d: (c) => ({ title: 'The Lord bless thee, and keep thee', text: 'Numbers 6:24', foot: (c.name ? c.name + ' · ' : '') + 'Go in peace' }),
    mood: 'An evening sky with soft golden clouds' },
  blank: { name: 'Blank', fields: ['kicker', 'title', 'text', 'foot'], x: {}, s: { pal: 'navy', deco: 'none' }, d: () => ({}), mood: 'A peaceful nature scene' },
  picture: { name: 'Picture', fields: ['title', 'text'], x: {}, s: { pal: 'navy', deco: 'none' }, d: () => ({}), mood: 'A peaceful nature scene' },
};
const FIELD = {
  kicker: { label: 'Top line', ph: 'Church name or a short heading' },
  title: { label: 'Heading', ph: 'The main words', multi: 2 },
  text: { label: 'Message', ph: 'Optional', multi: 3 },
  foot: { label: 'Bottom line', ph: 'Optional: place, time or contact' },
  ref: { label: 'Bible reference' },
  at: { label: 'Service starts at' },
  done: { label: 'At zero show', ph: 'Welcome' },
};
const EXTRAS = [
  ['logo', 'Logo', 'Your church logo from Settings → Screen'],
  ['date', 'Date', 'The coming Sabbath’s date'],
  ['sunset', 'Sunset time', 'When Sabbath begins or ends, worked out offline'],
  ['qr', 'Giving QR code', 'The giving link from Church details'],
  ['mark', '“SDA Sabbath” mark', 'A small app name in the corner'],
];
const POS = [['center', 'Centre'], ['left', 'Left'], ['low', 'Low']];

function newBanner(tpl = 'welcome', extra) {
  const t = TPL[tpl] || TPL.welcome;
  const c = church();
  return Object.assign({ id: null, name: '', tpl, f: Object.assign({}, t.d(c)), x: Object.assign({}, t.x),
    s: Object.assign({ pal: 'navy', deco: 'none', pos: 'center', font: 'sans', img: null, dim: null }, t.s) }, extra || {});
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const sig = (b) => JSON.stringify([b.name, b.tpl, b.f, b.x, b.s]);
const short = (s, n = 48) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const nameOf = (b) => b.name || short((TPL[b.tpl] || TPL.blank).name + (b.f.title || b.f.kicker ? ': ' + (b.f.title || b.f.kicker) : ''), 60);

export default function create(ctx) {
  const { live, settings, link } = ctx;
  let lib = [];             // saved banners
  let loop = { items: [], secs: 8, count: true, at: '', end: '' };
  let cur = newBanner();    // banner in the editor
  let savedSig = null;      // sig(cur) when it was last saved (null = never)
  let view = 'make';
  let topics = null;

  // ------------------------------------------------------------ storage
  const saveLib = () => db.put('kv', 'banners', lib);
  const saveLoop = () => db.put('kv', 'banner-loop', loop);
  const saveDraft = debounce(() => db.put('kv', 'banner-draft', { cur, savedSig }).catch(() => {}), 500);

  // Saved data from older versions or a damaged database: repair what can be used, drop the rest.
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  function repair(b) {
    if (!isObj(b) || !TPL[b.tpl]) return null;
    const base = newBanner(b.tpl);
    const out = Object.assign(base, { id: typeof b.id === 'string' ? b.id : null, name: typeof b.name === 'string' ? b.name : '', created: b.created, updated: b.updated });
    if (isObj(b.f)) Object.keys(b.f).forEach((k) => { if (typeof b.f[k] === 'string') out.f[k] = b.f[k]; });
    if (isObj(b.x)) Object.keys(b.x).forEach((k) => { out.x[k] = !!b.x[k]; });
    if (isObj(b.s)) {
      if (PALETTES[b.s.pal]) out.s.pal = b.s.pal;
      if (DECOS[b.s.deco]) out.s.deco = b.s.deco;
      if (['center', 'left', 'low'].includes(b.s.pos)) out.s.pos = b.s.pos;
      if (['sans', 'serif'].includes(b.s.font)) out.s.font = b.s.font;
      out.s.img = typeof b.s.img === 'string' ? b.s.img : null;
      out.s.dim = typeof b.s.dim === 'number' && isFinite(b.s.dim) ? b.s.dim : null;
    }
    return out;
  }
  async function load() {
    const raw = await db.get('kv', 'banners').catch(() => null);
    lib = (Array.isArray(raw) ? raw : []).map(repair).filter((b) => b && b.id);
    const lp = await db.get('kv', 'banner-loop').catch(() => null);
    if (isObj(lp)) {
      loop.items = (Array.isArray(lp.items) ? lp.items : []).filter((it) => isObj(it) && (it.t === 'banner' || it.t === 'deck') && typeof it.id === 'string');
      loop.secs = [5, 8, 10, 15, 20, 30].includes(+lp.secs) ? +lp.secs : 8;
      loop.count = lp.count !== false;
      loop.at = /^\d{1,2}:\d{2}$/.test(lp.at || '') ? lp.at : '';
      loop.end = typeof lp.end === 'string' ? lp.end : '';
    }
    const d = await db.get('kv', 'banner-draft').catch(() => null);
    const dc = d && repair(d.cur);
    if (dc) { cur = dc; savedSig = typeof d.savedSig === 'string' ? d.savedSig : null; }
    await migrateOldHistory().catch((e) => console.warn('old banners', e));
  }
  // Banners saved by the old Banner tab were pictures in browser storage (about 5 MB, easily full).
  // Move them into the app's database once, as Picture banners.
  async function migrateOldHistory() {
    let old;
    try { old = JSON.parse(localStorage.getItem('selah-ai-history') || 'null'); } catch (e) { old = null; }
    if (!Array.isArray(old) || !old.length) return;
    for (const it of old.slice().reverse()) {
      if (!it || typeof it.data !== 'string' || !/^data:image\//.test(it.data)) continue;
      try {
        const blob = await (await fetch(it.data)).blob();
        const id = await storePicture(blob, (it.title || 'Banner') + '.jpg', { dim: 0 });
        lib.unshift(Object.assign(newBanner('picture'), { id: 'b-' + uid(), name: (it.title || 'Banner') + ' (earlier)', s: { pal: 'navy', deco: 'none', pos: 'center', font: 'sans', img: id, dim: 0 }, created: it.ts || Date.now(), updated: it.ts || Date.now() }));
      } catch (e) { /* skip a broken entry */ }
    }
    await saveLib();
    try { localStorage.removeItem('selah-ai-history'); } catch (e) { /* */ }
  }

  // ------------------------------------------------------------ pictures
  const blobCache = new Map();
  async function fileBlob(id) {
    if (!id) return null;
    if (blobCache.has(id)) return blobCache.get(id);
    const r = await db.get('files', id).catch(() => null);
    const b = (r && r.blob) || null;
    blobCache.set(id, b);
    return b;
  }
  /** Store a background picture (scaled to at most 2560 px, JPEG) with a thumbnail and its brightness. */
  async function storePicture(blob, name, opts = {}) {
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, 2560 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const full = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
    const t = document.createElement('canvas');
    t.width = 192; t.height = 108;
    const tg = t.getContext('2d');
    const k = Math.max(192 / bmp.width, 108 / bmp.height);
    tg.drawImage(bmp, (192 - bmp.width * k) / 2, (108 - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
    const thumb = await new Promise((r) => t.toBlob(r, 'image/jpeg', 0.8));
    // Average brightness decides how much the picture is darkened under white text.
    const px = tg.getImageData(0, 0, 192, 108).data;
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    const lum = sum / (px.length / 4) / 255;
    if (bmp.close) bmp.close();
    c.width = c.height = 0;
    const id = 'bbg-' + uid();
    await db.put('files', id, { id, kind: 'banner-bg', name: name || 'Picture', type: 'image/jpeg', size: full.size, blob: full, thumb, added: Date.now(), meta: { lum } });
    blobCache.set(id, full);
    return id;
  }
  const autoDim = (lum) => Math.round(Math.max(0.25, Math.min(0.7, 0.2 + 0.55 * (lum == null ? 0.5 : lum))) * 100) / 100;

  // ------------------------------------------------------------ frames and cues
  let qrCache = { url: '', data: '' };
  async function qrData(url) {
    if (qrCache.url === url) return qrCache.data;
    const m = await import('../../vendor/qrcode.min.js');
    const q = m.default(0, 'M'); q.addData(url); q.make();
    qrCache = { url, data: q.createDataURL(8, 0) };
    return qrCache.data;
  }
  async function logoBlob() {
    const st = live.style || (await live.buildStyle());
    return (st && st.logoBlob) || null;
  }
  /** The display frame for a banner (pictures, logo and QR code resolved). */
  async function frameOf(b, now = new Date()) {
    const c = church(), f = b.f || {}, x = b.x || {}, s = b.s || {};
    const fr = { kind: 'banner', tpl: b.tpl, pal: s.pal || 'navy', deco: s.deco || 'none', pos: s.pos || 'center', font: s.font || 'sans',
      kicker: f.kicker || '', title: f.title || '', text: f.text || '', mark: !!x.mark };
    const foot = [b.tpl === 'verse' ? f.refLabel || f.ref : f.foot, x.date ? sabbathDateLine(now) : '', x.sunset ? sabbathSunsetLine(now) : '']
      .map((t) => (t || '').trim()).filter(Boolean);
    fr.foot = foot.join('  ·  ');
    if (b.tpl === 'countdown') {
      const at = nextTime(f.at || c.service, now);
      fr.title = ''; fr.countdown = { at: at ? at.getTime() : Date.now(), done: f.done || 'Welcome' };
    }
    if (s.img) { const im = await fileBlob(s.img); if (im) { fr.img = im; fr.dim = s.dim == null ? 0.45 : s.dim; } }
    if (x.logo) { const lg = await logoBlob(); if (lg) fr.logo = lg; }
    const gu = x.qr ? safeGivingUrl(c.givingUrl) : '';
    if (gu) { try { fr.qr = await qrData(gu); fr.qrLabel = c.givingLabel; } catch (e) { /* no QR */ } }
    return fr;
  }
  const cueId = (b) => 'banner:' + (b.id || 'draft');
  function bannerCue(b, frame) {
    return { id: cueId(b), tab: 'ai', title: nameOf(b), sub: 'Banner', deck: { kind: 'banner', frames: [frame] }, index: 0, labels: [TPL[b.tpl].name],
      plan: b.id ? { tab: 'ai', banner: b.id, label: 'Banner: ' + nameOf(b) } : null };
  }

  // ------------------------------------------------------------ layout
  const viewSeg = h('div.seg.bn-views', { role: 'tablist' });
  const VIEWS = [['make', 'Make'], ['library', 'Saved'], ['loop', 'Loop', 'Pre-service '], ['topics', 'Topics']];
  function renderViewSeg() {
    clear(viewSeg);
    VIEWS.forEach(([v, label, pre]) => viewSeg.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': String(v === view), 'aria-pressed': String(v === view),
      onclick: () => setView(v) }, pre ? [h('span.hide-sm', pre + label.toLowerCase()), h('span.bn-sm', label)] : label, v === 'library' && lib.length ? ' (' + lib.length + ')' : '')));
  }
  const churchBtn = h('button.btn.sm', { type: 'button', title: 'Church name, town, location, service time and giving link', onclick: () => churchDialog() }, icon('pin'), h('span.hide-sm', 'Church details'));
  const views = { make: h('div.bn-view'), library: h('div.bn-view.scroll.pad'), loop: h('div.bn-view.scroll.pad'), topics: h('div.bn-view') };
  const el = h('section.banners',
    h('div.toolbar', h('h2', 'Banners'), viewSeg, h('div.grow'), churchBtn),
    views.make, views.library, views.loop, views.topics);

  function setView(v) {
    view = v;
    renderViewSeg();
    Object.keys(views).forEach((k) => { views[k].hidden = k !== v; });
    if (v === 'make') { refreshPreview(); }
    if (v === 'library') renderLibrary();
    if (v === 'loop') renderLoop();
    if (v === 'topics') renderTopics();
  }

  function churchDialog() {
    modal({ title: 'Your church', body: h('div', h('p.note', { style: { marginBottom: '10px' } }, 'Banners use these details. They are also in Settings → Church. Nothing here leaves this device.'),
      churchForm(settings, () => { schedule(); })), actions: [{ label: 'Done', primary: true }], wide: true });
  }

  // ============================================================ MAKE
  const host = h('div.stage-host');
  const screen = h('div.screen.bn-screen', host);
  const stage = createStage(host, { placeholderOnly: true });
  const nameInp = h('input.field', { placeholder: 'Name (for the Saved list)', 'aria-label': 'Banner name', style: { flex: '1 1 160px', minWidth: '0' },
    oninput: () => { cur.name = nameInp.value; changed(false); } });
  const saveBtn = h('button.btn', { type: 'button', onclick: () => saveCurrent(true) }, icon('save'), h('span', 'Save'));
  const nextBtn = h('button.btn.primary', { type: 'button', title: 'Put this banner on the green Next screen. Press Present (F5) to show it.', onclick: () => setNext() }, icon('next'), h('span', 'Set as Next'));
  const editorScroll = h('div.scroll.pad.bn-editor');
  const previewPane = h('div.pane.bn-preview-pane',
    h('div.bn-preview-in',
      screen,
      h('div.row.wrap.bn-actions', nextBtn, saveBtn,
        h('button.btn', { type: 'button', title: 'Add to the current service plan', onclick: () => addCurToPlan() }, icon('plan'), h('span', 'Add to plan')),
        h('button.btn', { type: 'button', title: 'Add to the pre-service loop', onclick: () => addCurToLoop() }, icon('loop'), h('span', 'Add to loop'))),
      h('div.row', nameInp,
        h('button.btn.sm', { type: 'button', title: 'Start a new banner', onclick: () => startNew() }, icon('plus'), h('span', 'New'))),
      h('p.note', 'Set as Next puts the banner on the green Next screen; Present (F5) shows it. Text is fitted to the projector, like Bible verses.')));
  views.make.append(h('div.split.banner-split', h('div.pane.bn-edit-pane', editorScroll), previewPane));

  function setPreviewAspect() {
    const a = link.aspect ? link.aspect() : 16 / 9;
    stage.setAspect(a);
    screen.style.aspectRatio = String(a);
  }
  live.on('style', (s) => { stage.applyStyle(s); setPreviewAspect(); refreshPreview(); });
  if (link.on) link.on('hello', () => { setPreviewAspect(); refreshPreview(); });

  let previewSeq = 0;
  async function refreshPreview() {
    if (view !== 'make') return;
    const my = ++previewSeq;
    const fr = await frameOf(cur);
    if (my !== previewSeq) return;
    stage.show(fr);
    // Keep the Next screen truthful while editing the banner that is staged.
    if (live.staged && live.staged.id === cueId(cur) && live.staged.tab === 'ai') ctx.setStaged('ai', bannerCue(cur, fr));
  }
  const schedule = debounce(refreshPreview, 120);
  function changed(rerender) {
    updateSaveBtn();
    saveDraft();
    if (rerender) renderEditor();
    schedule();
  }
  function updateSaveBtn() {
    const clean = savedSig && savedSig === sig(cur) && cur.id && lib.some((b) => b.id === cur.id);
    saveBtn.disabled = !!clean;
    saveBtn.lastChild.textContent = clean ? 'Saved' : 'Save';
  }

  async function setNext() {
    const fr = await frameOf(cur);
    ctx.setStaged('ai', bannerCue(cur, fr));
    toast('Banner is Next. Press Present (F5) to show it.', 'ok', 2500);
  }
  function saveCurrent(announce) {
    const now = Date.now();
    if (!cur.id) { cur.id = 'b-' + uid(); cur.created = now; }
    cur.updated = now;
    if (!cur.name) cur.name = nameOf(cur);
    nameInp.value = cur.name;
    const copy = clone(cur);
    const i = lib.findIndex((b) => b.id === cur.id);
    if (i >= 0) lib[i] = copy; else lib.unshift(copy);
    savedSig = sig(cur);
    saveLib(); saveDraft(); updateSaveBtn(); renderViewSeg();
    if (announce) toast('Saved to Saved banners.', 'ok', 2000);
    return copy;
  }
  async function addCurToPlan() {
    const b = saveCurrent(false);
    (await ctx.tab('plan')).addItem({ tab: 'ai', banner: b.id, label: 'Banner: ' + nameOf(b) });
  }
  function addCurToLoop() {
    const b = saveCurrent(false);
    if (!loop.items.some((it) => it.t === 'banner' && it.id === b.id)) { loop.items.push({ t: 'banner', id: b.id }); saveLoop(); }
    toast('Added to the pre-service loop (' + loop.items.length + ' item' + (loop.items.length === 1 ? '' : 's') + ').', 'ok');
  }
  function startNew(tpl) {
    cur = newBanner(tpl || cur.tpl);
    savedSig = null;
    nameInp.value = '';
    changed(true);
    if (cur.tpl === 'verse') fetchVerse();
  }
  function edit(b) {
    cur = clone(b); savedSig = sig(cur);
    nameInp.value = cur.name || '';
    setView('make');
    changed(true);
  }

  // ------------------------------------------------------------ editor
  let trList = [];
  function renderEditor() {
    clear(editorScroll);
    const c = church();
    if (!c.name) {
      editorScroll.appendChild(h('div.card.bn-church', h('div.row.wrap',
        icon('pin'), h('div.grow', h('b', 'Add your church’s name once'), h('div.note', 'Banners fill it in, with the date, sunset time and giving QR code.')),
        h('button.btn.sm.primary', { type: 'button', onclick: () => churchDialog() }, 'Church details'))));
    }
    // Template chips
    const tplRow = h('div.row.wrap.bn-tpls');
    Object.keys(TPL).forEach((k) => tplRow.appendChild(h('button.chip', { type: 'button', 'aria-pressed': String(cur.tpl === k), onclick: () => switchTemplate(k) }, TPL[k].name)));
    editorScroll.append(h('h3.bn-h', 'Kind of banner'), tplRow);

    // Fields
    const form = h('div.form.bn-form');
    const t = TPL[cur.tpl];
    t.fields.forEach((k) => {
      const F = FIELD[k];
      let label = F.label;
      if (cur.tpl === 'verse' && k === 'title') label = 'Verse text';
      if (cur.tpl === 'verse' && k === 'kicker') label = 'Top line';
      if (cur.tpl === 'countdown' && k === 'kicker') label = 'Above the clock';
      if (k === 'ref') {
        const refInp = h('input.field', { value: cur.f.ref || '', placeholder: 'e.g. Psalm 23:1 or John 3:16', 'aria-label': 'Bible reference', style: { flex: '1 1 160px', minWidth: '0' },
          oninput: () => { cur.f.ref = refInp.value; fetchVerseSoon(); } });
        const trSel = h('select.field', { 'aria-label': 'Translation', onchange: () => { cur.f.tr = trSel.value; fetchVerse(); } });
        trList.forEach((x) => trSel.appendChild(h('option', { value: x.id, selected: x.id === (cur.f.tr || settings.v.bible.primary) }, x.abbr)));
        form.append(h('label', label), h('div.row', refInp, trSel));
        return;
      }
      if (k === 'at') {
        const tm = h('input.field', { type: 'time', value: cur.f.at || c.service, 'aria-label': 'Service starts at', style: { width: '130px' },
          onchange: () => { cur.f.at = tm.value; changed(false); } });
        form.append(h('label', label), h('div.row', tm, h('span.note', 'Counts down on the screen; shows “' + (cur.f.done || 'Welcome') + '” at zero.')));
        return;
      }
      const inp = F.multi
        ? h('textarea.field.bn-ta', { rows: F.multi, placeholder: F.ph || '', 'aria-label': label })
        : h('input.field', { placeholder: F.ph || '', 'aria-label': label, style: { width: '100%' } });
      inp.value = cur.f[k] || '';
      inp.oninput = () => { cur.f[k] = inp.value; changed(false); };
      if (cur.tpl === 'verse' && k === 'title') inp.dataset.verse = '1';
      form.append(h('label', label), inp);
    });
    if (t.presets) {
      const pr = h('div.row.wrap');
      t.presets.forEach((r) => pr.appendChild(h('button.chip', { type: 'button', title: 'Use this verse as the message', onclick: () => presetVerse(r) }, r)));
      form.append(h('label', 'Verse'), pr);
    }
    editorScroll.appendChild(form);

    // Extras
    const ex = h('div.row.wrap.bn-extras');
    const hasLogo = !!(settings.v.display.logo);
    EXTRAS.forEach(([k, label, title]) => {
      let why = '';
      if (k === 'logo' && !hasLogo) why = 'Add a logo picture in Settings → Screen first.';
      if (k === 'sunset' && !hasLocation()) why = 'Add your church’s location in Church details first.';
      if (k === 'qr' && !safeGivingUrl(c.givingUrl)) why = 'Add a giving link in Church details first.';
      const on = !!cur.x[k] && !why;
      ex.appendChild(h('button.chip', { type: 'button', 'aria-pressed': String(on), title: why || title, 'aria-disabled': why ? 'true' : null,
        onclick: () => { if (why) { toast(why, '', 4000); if (k !== 'logo') churchDialog(); return; } cur.x[k] = !cur.x[k]; changed(true); } },
      on ? icon('check') : null, label));
    });
    editorScroll.append(h('h3.bn-h', 'Also show'), ex);

    // Look
    const sw = h('div.row.wrap.bn-swatches');
    Object.keys(PALETTES).forEach((k) => {
      const p = PALETTES[k];
      sw.appendChild(h('button.swatch', { type: 'button', title: p.name, 'aria-label': 'Colours: ' + p.name, 'aria-pressed': String((cur.s.pal || 'navy') === k),
        style: { background: 'linear-gradient(135deg,' + p.bg[0] + ',' + p.bg[1] + ')', color: p.accent }, onclick: () => { cur.s.pal = k; changed(true); } }, 'Aa'));
    });
    const decoSeg = seg(Object.keys(DECOS).map((k) => [k, DECOS[k]]), cur.s.deco || 'none', (v) => { cur.s.deco = v; changed(false); });
    const posSeg = seg(POS, cur.s.pos || 'center', (v) => { cur.s.pos = v; changed(false); });
    const fontSeg = seg([['sans', 'Clear sans'], ['serif', 'Serif']], cur.s.font || 'sans', (v) => { cur.s.font = v; changed(false); });
    const look = h('div.form.bn-form',
      h('label', 'Colours'), sw,
      h('label', 'Pattern'), decoSeg,
      h('label', 'Picture'), pictureRow(),
      cur.s.img ? h('label', 'Darken picture') : null, cur.s.img ? dimRow() : null,
      h('label', 'Text position'), posSeg,
      h('label', 'Font'), fontSeg);
    editorScroll.append(h('h3.bn-h', 'Look'), look);
    if (cur.s.img) decoSeg.querySelectorAll('button').forEach((b) => { b.disabled = true; b.title = 'Patterns are for plain colours (a picture is chosen)'; });
  }

  function switchTemplate(k) {
    if (k === cur.tpl) return;
    const keep = { id: null, name: '', s: Object.assign({}, cur.s) };
    const nb = newBanner(k);
    // Keep a chosen picture; take the new kind's colours only when no picture is used.
    if (keep.s.img) { nb.s.img = keep.s.img; nb.s.dim = keep.s.dim; }
    cur = nb; savedSig = null; nameInp.value = '';
    changed(true);
    if (k === 'verse') fetchVerse();
  }

  // Verse text from the installed Bible (any translation, Afrikaans and Xhosa too).
  let verseSeq = 0;
  async function versesText(ref, tr) {
    const r = parseRef(ref);
    if (!r || !/\d/.test(ref)) return null;
    const info = await getInfo(tr || settings.v.bible.primary);
    if (!info.books[r.book - 1] || !info.books[r.book - 1][1]) return null;
    const vs = await versesFor(info.id, r.book, r.segs);
    if (!vs.length) return null;
    return { text: vs.slice(0, 12).map((v) => verseText(v.text)).join(' ').replace(/^(A Psalm[^.]*\.|To the chief Musician[^.]*\.|[A-Z]{2,}\.)\s*/, ''),
      label: refText(info.names, r.book, r.segs) + ' (' + info.abbr + ')', many: vs.length > 12 };
  }
  async function fetchVerse() {
    const my = ++verseSeq;
    const v = await versesText(cur.f.ref || '', cur.f.tr).catch(() => null);
    if (my !== verseSeq) return;
    if (!v) { changed(false); return; }
    cur.f.title = v.text; cur.f.refLabel = v.label;
    const ta = editorScroll.querySelector('textarea[data-verse]');
    if (ta) ta.value = v.text;
    if (v.many) toast('Long passage: only the first 12 verses fit on one banner.', '', 3500);
    changed(false);
  }
  const fetchVerseSoon = debounce(fetchVerse, 350);
  async function presetVerse(ref) {
    const v = await versesText(ref, settings.v.bible.primary).catch(() => null);
    if (!v) { toast('That verse is not in the installed Bible.', 'err'); return; }
    cur.f.text = '“' + v.text + '”\n' + v.label.replace(/ \([^)]*\)$/, '');
    changed(true);
  }

  // Pictures: the church's own photos (kept offline), or one made by online AI.
  function pictureRow() {
    const row = h('div.col.bn-pics');
    const inp = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
      const f = inp.files[0]; inp.value = '';
      if (!f) return;
      try { await usePicture(await storePicture(f, f.name)); } catch (e) { toast('Could not use that picture: ' + e.message, 'err'); }
    } });
    const aiDesc = h('input.field', { placeholder: 'Describe a picture (optional), e.g. mountains at sunrise', 'aria-label': 'Describe the AI picture', style: { flex: '1 1 200px', minWidth: '0' } });
    // Maker 1: a background only. The banner words stay sharp (drawn live by the app) on top of it.
    const aiBtn = h('button.btn.sm', { type: 'button', title: 'Make a background picture with online AI (no text in it, the banner words stay sharp on top)', onclick: async () => {
      aiBtn.disabled = true; const lbl = aiBtn.lastChild.textContent; aiBtn.lastChild.textContent = 'Making picture…';
      try {
        const desc = aiDesc.value.trim();
        const prompt = (desc || TPL[cur.tpl].mood) + '. A wide 16:9 background photograph for a church projector screen. Calm, reverent and uplifting, soft natural light, ' +
          'simple composition with plenty of open space for text. Absolutely no text, letters, words, numbers, logos, signs or watermarks.';
        const flags = ai.flaggedWords(desc);
        if (flags.length) { toast('Please describe a picture suitable for church.', 'err'); return; }
        const blob = await ai.aiImage(prompt);
        await usePicture(await storePicture(blob, 'AI picture ' + new Date().toLocaleDateString()));
        toast('AI picture added. It is saved on this device and works offline from now on.', 'ok', 4000);
      } catch (e) { toast(ai.friendlyAiError(e), 'err', 8000); }
      finally { aiBtn.disabled = false; aiBtn.lastChild.textContent = lbl; }
    } }, icon('sparkle'), h('span', 'Make background'));
    // Maker 2: a full finished banner picture with all the words in it, built around the church's own pictures.
    const fullBtn = h('button.btn.sm', { type: 'button', title: 'Make one finished banner picture with all your words and your own pictures built in', onclick: () => fullBannerDialog() },
      icon('sparkle'), h('span', 'Make full banner…'));
    const gallery = h('div.bn-gallery');
    row.append(h('div.row.wrap',
      h('button.btn.sm', { type: 'button', onclick: () => inp.click() }, icon('upload'), h('span', 'Choose picture…')),
      cur.s.img ? h('button.btn.sm', { type: 'button', onclick: () => { cur.s.img = null; changed(true); } }, icon('x'), h('span', 'No picture')) : null,
      inp), gallery);
    if (ai.hasKey() && ai.canImage()) {
      row.append(h('div.card.bn-aimakers',
        h('h4', icon('sparkle'), ' Two online AI picture makers'),
        h('div.bn-maker', h('b', '1. Background'), h('p.note', 'A picture with no words. Your banner words are drawn sharp on top by the app.'), h('div.row.wrap', aiDesc, aiBtn)),
        h('div.bn-maker', h('b', '2. Full banner'), h('p.note', 'One finished picture with all your words in it, built around pictures you attach. Check the spelling.'), h('div.row.wrap', fullBtn))));
    } else row.append(h('p.note', 'Two online AI picture makers (background, and full banner with your words and pictures): add a key in Settings → AI (OpenAI, Gemini, Grok, Together or OpenRouter).'));
    fillGallery(gallery);
    return row;
  }
  /** The full-banner maker: opens a dialog pre-filled from the banner being edited. */
  async function fullBannerDialog() {
    const c = church();
    const fr = await frameOf(cur).catch(() => null) || {};
    const f = cur.f || {};
    let heading = (fr.title || '').trim();
    if (cur.tpl === 'countdown') heading = ((f.kicker || 'Our service starts at') + ' ' + (f.at || c.service || '')).trim();
    const kicker = (fr.kicker || '').trim();
    openFullBanner({
      fields: { church: c.name || '', heading, message: fr.text || '', foot: fr.foot || '', extra: kicker && kicker !== c.name && cur.tpl !== 'countdown' ? 'Small top line: "' + kicker + '"' : '', style: TPL[cur.tpl].mood },
      files: async () => (await db.all('files').catch(() => [])).filter((x) => x.kind === 'banner-bg').sort((a, b) => (b.added || 0) - (a.added || 0)),
      logo: () => logoBlob(),
      storePicture: (blob, name) => storePicture(blob, name, {}),
      onUse: (id) => {
        const keepQr = !!(cur.x && cur.x.qr);
        cur = newBanner('picture');
        cur.s.img = id; cur.s.dim = 0; cur.x = { qr: keepQr }; cur.name = 'AI banner';
        savedSig = null; nameInp.value = cur.name;
        changed(true);
        toast('Full AI banner is ready. Set as Next, or Save it.', 'ok', 4000);
      },
    });
  }
  async function fillGallery(gallery) {
    const files = (await db.all('files').catch(() => [])).filter((f) => f.kind === 'banner-bg').sort((a, b) => (b.added || 0) - (a.added || 0));
    clear(gallery);
    files.forEach((f) => {
      const u = URL.createObjectURL(f.thumb || f.blob);
      const pick = h('button.bn-pic', { type: 'button', title: 'Use ' + (f.name || 'this picture'), 'aria-pressed': String(cur.s.img === f.id),
        onclick: () => usePicture(f.id) }, h('img', { src: u, alt: f.name || 'Picture', onload: () => setTimeout(() => URL.revokeObjectURL(u), 1000) }));
      const del = h('button.bn-pic-x', { type: 'button', title: 'Delete this picture from this device', 'aria-label': 'Delete picture ' + (f.name || ''),
        onclick: async () => {
          const used = lib.filter((b) => b.s && b.s.img === f.id).length;
          if (!(await confirmBox('Delete picture?', used ? 'It is used by ' + used + ' saved banner' + (used === 1 ? '' : 's') + '; they will show plain colours instead.' : 'Delete this picture from this device?', 'Delete', true))) return;
          await db.del('files', f.id); blobCache.delete(f.id);
          if (cur.s.img === f.id) cur.s.img = null;
          changed(true);
        } }, icon('x'));
      gallery.appendChild(h('div.bn-pic-wrap', pick, del));
    });
  }
  async function usePicture(id) {
    const rec = await db.get('files', id).catch(() => null);
    cur.s.img = id;
    cur.s.dim = autoDim(rec && rec.meta && rec.meta.lum);
    changed(true);
  }
  function dimRow() {
    const out = h('span.note', Math.round((cur.s.dim == null ? 0.45 : cur.s.dim) * 100) + '%');
    const r = h('input', { type: 'range', min: 0, max: 0.85, step: 0.05, 'aria-label': 'Darken picture', style: { flex: '1', maxWidth: '240px' },
      oninput: () => { cur.s.dim = +r.value; out.textContent = Math.round(cur.s.dim * 100) + '%'; changed(false); } });
    r.value = cur.s.dim == null ? 0.45 : cur.s.dim;
    return h('div.row', r, out);
  }

  // ============================================================ SAVED (library)
  let minis = [];
  const destroyMinis = () => { minis.forEach((s) => s.destroy()); minis = []; };
  function mini(frameP) {
    const hostM = h('div.stage-host');
    const box = h('div.bn-thumb', hostM);
    box.style.aspectRatio = String(link.aspect ? link.aspect() : 16 / 9);
    requestAnimationFrame(async () => {
      const st = createStage(hostM, { placeholderOnly: true, aspect: link.aspect ? link.aspect() : 16 / 9 });
      minis.push(st);
      if (live.style) st.applyStyle(live.style);
      try { st.show(await frameP); } catch (e) { /* */ }
    });
    return box;
  }
  function renderLibrary() {
    destroyMinis();
    const box = views.library;
    clear(box);
    if (!lib.length) {
      box.appendChild(emptyState('banner', 'No saved banners yet', 'Make a banner and press Save, or Add to loop / Add to plan.', { label: 'Make a banner', icon: 'plus', primary: true, onclick: () => setView('make') }));
      return;
    }
    const grid = h('div.bn-lib');
    lib.forEach((b) => {
      const more = btn('more', 'More', () => menu(more, [
        { label: 'Add to the pre-service loop', icon: 'loop', onclick: () => { if (!loop.items.some((it) => it.t === 'banner' && it.id === b.id)) { loop.items.push({ t: 'banner', id: b.id }); saveLoop(); } toast('Added to the loop.', 'ok'); } },
        { label: 'Add to the service plan', icon: 'plan', onclick: async () => (await ctx.tab('plan')).addItem({ tab: 'ai', banner: b.id, label: 'Banner: ' + nameOf(b) }) },
        { label: 'Rename…', icon: 'edit', onclick: async () => { const n = await promptBox('Rename banner', 'Name', b.name || nameOf(b)); if (n && n.trim()) { b.name = n.trim(); b.updated = Date.now(); if (cur.id === b.id) { cur.name = b.name; nameInp.value = b.name; savedSig = sig(cur); } await saveLib(); renderLibrary(); } } },
        { label: 'Duplicate', icon: 'copy', onclick: async () => { const c = clone(b); c.id = 'b-' + uid(); c.name = nameOf(b) + ' (copy)'; c.created = c.updated = Date.now(); lib.unshift(c); await saveLib(); renderLibrary(); renderViewSeg(); } },
        '-',
        { label: 'Delete', icon: 'trash', onclick: async () => {
          if (!(await confirmBox('Delete banner?', 'Delete “' + nameOf(b) + '”?' + (loop.items.some((it) => it.id === b.id) ? ' It is also removed from the pre-service loop.' : ''), 'Delete', true))) return;
          lib = lib.filter((x) => x.id !== b.id);
          loop.items = loop.items.filter((it) => !(it.t === 'banner' && it.id === b.id));
          if (loop.end === b.id) loop.end = '';
          if (cur.id === b.id) { cur.id = null; savedSig = null; }
          await saveLib(); await saveLoop(); renderLibrary(); renderViewSeg(); updateSaveBtn();
        } },
      ]), { cls: 'sm' });
      const card = h('div.bn-card',
        mini(frameOf(b)),
        h('div.bn-card-b',
          h('div.bn-card-t.trunc', nameOf(b)),
          h('div.note', TPL[b.tpl] ? TPL[b.tpl].name : 'Banner', b.updated ? ' · ' + new Date(b.updated).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''),
          h('div.row.bn-card-a',
            h('button.btn.sm.primary', { type: 'button', onclick: async () => { ctx.setStaged('ai', bannerCue(b, await frameOf(b))); toast('“' + nameOf(b) + '” is Next. Press Present (F5).', 'ok', 2500); } }, icon('next'), h('span', 'Set as Next')),
            h('button.btn.sm', { type: 'button', onclick: () => edit(b) }, icon('edit'), h('span', 'Edit')),
            more)));
      grid.appendChild(card);
    });
    box.appendChild(grid);
  }

  // ============================================================ PRE-SERVICE LOOP
  async function decks() { return (await db.all('files').catch(() => [])).filter((f) => f.kind === 'deck' && f.type !== 'web'); }
  async function deckFrames(d) {
    if (d.type === 'pptx') { const rec = await db.get('renders', d.id + '/frames').catch(() => null); return rec ? rec.frames.map((f) => Object.assign({}, f)) : []; }
    const out = [];
    for (let i = 0; i < (d.count || 0); i++) {
      const r = await db.get('renders', d.id + '/' + i).catch(() => null);
      if (r && r.full) out.push({ kind: 'image', src: r.full, fit: settings.v.slides.fit || 'contain' });
    }
    return out;
  }
  async function loopCue() {
    const frames = [], labels = [];
    const dl = await decks();
    for (const it of loop.items) {
      if (it.t === 'banner') {
        const b = lib.find((x) => x.id === it.id); if (!b) continue;
        frames.push(await frameOf(b)); labels.push(short(nameOf(b), 18));
      } else if (it.t === 'deck') {
        const d = dl.find((x) => x.id === it.id); if (!d) continue;
        const fs = await deckFrames(d);
        fs.forEach((f, i) => { frames.push(f); labels.push(short(d.name, 12) + ' ' + (i + 1)); });
      }
    }
    if (!frames.length) return null;
    const len = frames.length;
    const secs = +loop.secs || 8;
    let at = null, end = null;
    if (loop.count) { const t = nextTime(loop.at || church().service); at = t ? t.getTime() : null; }
    if (at) frames.forEach((f) => { if (!(f.kind === 'banner' && f.countdown)) f.clock = { at, label: 'Service starts in' }; });
    if (at && loop.end) {
      const b = lib.find((x) => x.id === loop.end);
      if (b) { frames.push(await frameOf(b)); labels.push('At start: ' + short(nameOf(b), 14)); end = len; }
    }
    return { id: 'loop:' + Date.now(), tab: 'ai', title: 'Pre-service loop', sub: len + ' slide' + (len === 1 ? '' : 's') + ' · every ' + secs + ' s',
      deck: { kind: 'loop', frames, auto: { secs, len, at, end } }, index: 0, labels, autoLoop: true, isLoop: true,
      plan: { tab: 'ai', loop: true, label: 'Pre-service loop' } };
  }
  async function renderLoop() {
    destroyMinis();
    const box = views.loop;
    clear(box);
    const dl = await decks();
    const c = church();
    box.appendChild(h('p.note.bn-intro', 'Plays before the service: your banners and announcement slides take turns on the screen. It runs on the display itself, so it keeps going if this phone or PC sleeps. Use Next / Previous at any time to move by hand.'));
    const list = h('div.list.bn-loop-list');
    if (!loop.items.length) list.appendChild(h('p.note.pad', 'The loop is empty. Add saved banners or slide decks below.'));
    loop.items.forEach((it, i) => {
      let name = '', kind = '', thumb;
      if (it.t === 'banner') { const b = lib.find((x) => x.id === it.id); name = b ? nameOf(b) : '(deleted banner)'; kind = 'Banner'; thumb = b ? mini(frameOf(b)) : h('div.bn-thumb'); }
      else { const d = dl.find((x) => x.id === it.id); name = d ? d.name : '(deleted slides)'; kind = d ? d.count + ' slide' + (d.count === 1 ? '' : 's') : 'Slides'; thumb = h('div.bn-thumb', h('div.bn-thumb-ic', icon('slides'))); }
      list.appendChild(h('div.li.bn-loop-row', thumb,
        h('div.grow', h('div.trunc', name), h('div.note', kind)),
        btn('up', 'Move up', () => { if (i > 0) { const t = loop.items[i - 1]; loop.items[i - 1] = it; loop.items[i] = t; saveLoop(); renderLoop(); } }, { cls: 'sm' }),
        btn('down', 'Move down', () => { if (i < loop.items.length - 1) { const t = loop.items[i + 1]; loop.items[i + 1] = it; loop.items[i] = t; saveLoop(); renderLoop(); } }, { cls: 'sm' }),
        btn('trash', 'Remove from the loop', () => { loop.items.splice(i, 1); saveLoop(); renderLoop(); }, { cls: 'sm' })));
    });
    box.appendChild(list);
    box.appendChild(h('div.row.wrap.bn-add',
      h('button.btn', { type: 'button', onclick: () => pickBanners() }, icon('banner'), h('span', 'Add banners…')),
      h('button.btn', { type: 'button', onclick: () => pickDecks(dl) }, icon('slides'), h('span', 'Add slides…'))));

    const secsSeg = seg([5, 8, 10, 15, 20, 30].map((s) => [String(s), s + ' s']), String(loop.secs || 8), (v) => { loop.secs = +v; saveLoop(); });
    const atInp = h('input.field', { type: 'time', value: loop.at || c.service, 'aria-label': 'Service starts at', style: { width: '130px' },
      onchange: () => { loop.at = atInp.value; saveLoop(); } });
    const countChip = h('button.chip', { type: 'button', 'aria-pressed': String(!!loop.count), onclick: () => { loop.count = !loop.count; saveLoop(); renderLoop(); } },
      loop.count ? icon('check') : null, 'Show “Service starts in” clock');
    const endSel = h('select.field', { 'aria-label': 'When it is time', onchange: () => { loop.end = endSel.value; saveLoop(); } },
      h('option', { value: '' }, 'Keep looping'),
      lib.map((b) => h('option', { value: b.id, selected: loop.end === b.id }, 'Show: ' + nameOf(b))));
    box.appendChild(h('div.form.bn-form',
      h('label', 'Each slide shows for'), secsSeg,
      h('label', 'Countdown'), h('div.row.wrap', countChip),
      loop.count ? h('label', 'Service starts at') : null, loop.count ? h('div.row', atInp) : null,
      loop.count ? h('label', 'When it is time') : null, loop.count ? h('div.col', { style: { alignItems: 'flex-start' } }, endSel, h('p.note', 'For example your Welcome banner. The loop stops there.')) : null));
    box.appendChild(h('div.row.wrap.bn-actions',
      h('button.btn.primary', { type: 'button', disabled: !loop.items.length, onclick: async () => {
        const cue = await loopCue();
        if (!cue) { toast('The loop has nothing to show yet.', 'err'); return; }
        ctx.setStaged('ai', cue); toast('Loop is Next. Press Present (F5) to start it.', 'ok', 2500);
      } }, icon('next'), h('span', 'Set loop as Next')),
      h('button.btn', { type: 'button', disabled: !loop.items.length, onclick: async () => (await ctx.tab('plan')).addItem({ tab: 'ai', loop: true, label: 'Pre-service loop' }) }, icon('plan'), h('span', 'Add to plan'))));
  }
  function pickBanners() {
    if (!lib.length) { toast('No saved banners yet. Make one and press Save.'); setView('make'); return; }
    const chosen = new Set();
    const list = h('div.list', { style: { maxHeight: '50vh', overflow: 'auto' } });
    lib.forEach((b) => {
      const inLoop = loop.items.some((it) => it.t === 'banner' && it.id === b.id);
      const row = h('button', { type: 'button', 'aria-pressed': 'false', disabled: inLoop, onclick: () => { if (chosen.has(b.id)) chosen.delete(b.id); else chosen.add(b.id); row.setAttribute('aria-pressed', String(chosen.has(b.id))); } },
        icon('banner'), h('span.grow', nameOf(b)), inLoop ? h('span.note', 'in the loop') : null);
      list.appendChild(row);
    });
    modal({ title: 'Add banners to the loop', body: list, actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onclick: () => {
      lib.forEach((b) => { if (chosen.has(b.id)) loop.items.push({ t: 'banner', id: b.id }); });
      saveLoop(); renderLoop();
    } }] });
  }
  function pickDecks(dl) {
    if (!dl.length) { toast('No slide decks yet. Add announcement slides in the Slides tab first.'); return; }
    const list = h('div.list', { style: { maxHeight: '50vh', overflow: 'auto' } });
    dl.forEach((d) => list.appendChild(h('button', { type: 'button', onclick: () => { loop.items.push({ t: 'deck', id: d.id }); saveLoop(); closeModal(); renderLoop(); } },
      icon('slides'), h('span.grow', d.name), h('span.note', d.count + ' slides'))));
    modal({ title: 'Add slides to the loop', body: list, actions: [{ label: 'Cancel' }] });
  }

  // ============================================================ TOPICS
  const tpSearch = h('input.field.grow', { type: 'search', placeholder: 'Topic, belief or words — e.g. hope, Sabbath, baptism, Psalm 23', 'aria-label': 'Find a topic',
    oninput: () => filterTopics(), onkeydown: (e) => { if (e.key === 'Enter') runTopicSearch(); } });
  const tpTr = h('select.field', { 'aria-label': 'Translation', onchange: () => { if (curTopic) showTopic(curTopic); else if (lastQuery) runTopicSearch(); } });
  const tpList = h('div.tp-list');
  const tpOut = h('div.tp-out.scroll.pad');
  const askIn = h('input.field.grow', { type: 'search', placeholder: 'Ask a question, e.g. What does the Bible say about the Sabbath?', 'aria-label': 'Ask a question',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); askAi(); } } });
  const askBtn = h('button.btn.primary', { type: 'button', title: 'Online AI answers your question in three ways that fit a slide. You choose one.', onclick: () => askAi() }, icon('sparkle'), h('span', 'Ask AI'));
  views.topics.append(
    h('div.toolbar.tp-bar', tpSearch, tpTr, h('button.btn', { type: 'button', onclick: () => runTopicSearch() }, icon('search'), h('span', 'Find'))),
    h('div.toolbar.tp-bar.tp-ask', icon('sparkle'), askIn, askBtn),
    h('div.split.topics-split', h('div.pane', h('div.scroll', tpList)), h('div.pane', tpOut)));
  let curTopic = null, lastQuery = '';

  async function loadTopics() {
    if (topics) return topics;
    const r = await fetch('data/topics/topics.json');
    topics = (await r.json()).topics || [];
    topics.forEach((t) => { t._k = normalize([t.t, t.d, (t.a || []).join(' ')].join(' ')); });
    return topics;
  }
  async function renderTopics() {
    if (!trList.length) trList = await listTranslations().catch(() => []);
    if (!tpTr.options.length) trList.forEach((x) => tpTr.appendChild(h('option', { value: x.id, selected: x.id === settings.v.bible.primary }, x.abbr)));
    await loadTopics().catch(() => { clear(tpList); tpList.appendChild(h('p.note.pad', 'The topic list could not be loaded.')); });
    filterTopics();
    if (!curTopic && !lastQuery && !tpOut.childNodes.length) {
      tpOut.appendChild(emptyState('bible', 'Key verses for any topic', 'Pick a belief or topic, or type words. Verses come from the Bible you choose above, so they work offline and in Afrikaans or Xhosa too.'));
    }
  }
  function filterTopics() {
    if (!topics) return;
    const q = normalize(tpSearch.value.trim());
    clear(tpList);
    const groups = [['belief', '28 Fundamental Beliefs'], ['topic', 'Topics']];
    groups.forEach(([g, label]) => {
      const items = topics.filter((t) => t.group === g && (!q || t._k.includes(q) || (g === 'belief' && String(t.n) === q)));
      if (!items.length) return;
      tpList.appendChild(h('div.tp-h', label));
      items.forEach((t) => {
        const b = h('button.tp-item', { type: 'button', 'aria-pressed': String(curTopic === t), onclick: () => showTopic(t) },
          t.n ? h('span.tp-n', String(t.n)) : null, h('span.grow', h('span.tp-t', t.t), h('span.note.tp-d', t.d)));
        tpList.appendChild(b);
      });
    });
    if (!tpList.childNodes.length) tpList.appendChild(h('p.note.pad', 'No topic matches. Press Find to search the Bible for these words.'));
  }
  function bestTopic(q) {
    const n = normalize(q);
    if (!n || !topics) return null;
    const num = /^(?:fb|belief|fundamental belief)?\s*#?(\d{1,2})$/.exec(n);
    if (num) return topics.find((t) => t.group === 'belief' && t.n === +num[1]) || null;
    return topics.find((t) => normalize(t.t) === n) || topics.find((t) => (t.a || []).some((a) => normalize(a) === n)) ||
      topics.find((t) => normalize(t.t).includes(n)) || topics.find((t) => (t.a || []).some((a) => normalize(a).includes(n) || (n.length > 4 && n.includes(normalize(a))))) || null;
  }
  async function runTopicSearch() {
    await loadTopics();
    const q = tpSearch.value.trim();
    if (!q) return;
    lastQuery = q;
    if (/\d/.test(q) && parseRef(q) && !/^(?:fb|belief)?\s*#?\d{1,2}$/i.test(q)) { showPassages(q, [q]); return; }
    const t = bestTopic(q);
    if (t) { showTopic(t); return; }
    // No topic: search the chosen Bible for the words.
    curTopic = null; filterTopics();
    dropAskStage();
    clear(tpOut);
    tpOut.appendChild(h('p.note', 'Searching ' + (tpTr.selectedOptions[0] ? tpTr.selectedOptions[0].textContent : 'the Bible') + ' for “' + q + '”…'));
    const info = await getInfo(tpTr.value || settings.v.bible.primary);
    const res = await bibleSearch(info.id, q, { limit: 40 });
    clear(tpOut);
    if (!res.length) { tpOut.appendChild(emptyState('search', 'Nothing found for “' + q + '”', 'Try fewer words, another translation, or one of the topics on the left.')); return; }
    tpOut.appendChild(h('div.tp-head', h('h3', 'Verses with “' + q + '”'), h('p.note', res.length >= 40 ? 'The first 40 verses in ' + info.abbr + '.' : res.length + ' verses in ' + info.abbr + '.')));
    res.forEach((r) => tpOut.appendChild(verseRow(info.names[r.b - 1] + ' ' + r.c + ':' + r.v, verseText(r.text))));
  }
  async function showTopic(t) {
    curTopic = t; lastQuery = '';
    filterTopics();
    await showPassages(t.t, t.r, t);
    if (ctx.isMobile()) tpOut.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function showPassages(title, refs, topic) {
    dropAskStage();
    clear(tpOut);
    const tr = tpTr.value || settings.v.bible.primary;
    const info = await getInfo(tr);
    const head = h('div.tp-head',
      h('h3', topic && topic.n ? topic.n + '. ' + title : title),
      topic ? h('p.note', topic.d) : null,
      h('div.row.wrap.bn-actions',
        h('button.btn.primary', { type: 'button', onclick: () => stageTopic(topic, refs, title, tr) }, icon('next'), h('span', refs.length > 1 ? 'Set all as Next' : 'Set as Next')),
        topic ? h('button.btn', { type: 'button', onclick: async () => (await ctx.tab('plan')).addItem({ tab: 'ai', topic: topic.id, tr, label: 'Verses: ' + topic.t }) }, icon('plan'), h('span', 'Add to plan')) : null,
        h('button.btn', { type: 'button', title: 'A short summary with Bible references, made online and shown here for checking first', onclick: () => aiSummary(title, refs) }, icon('sparkle'), h('span', 'AI summary (online)'))));
    tpOut.appendChild(head);
    const aiBox = h('div.tp-ai');
    tpOut.appendChild(aiBox);
    for (const ref of refs) {
      const r = parseRef(ref);
      if (!r) continue;
      let text = '', label = ref;
      try {
        if (info.books[r.book - 1] && info.books[r.book - 1][1]) {
          const vs = await versesFor(info.id, r.book, r.segs);
          text = vs.map((v) => verseText(v.text)).join(' ');
          label = refText(info.names, r.book, r.segs);
        }
      } catch (e) { /* missing book in this translation */ }
      tpOut.appendChild(verseRow(label, text || '(not in ' + info.abbr + ')', ref));
    }
  }
  function verseRow(label, text, ref) {
    const tr = tpTr.value || settings.v.bible.primary;
    const r = ref || label;
    return h('div.tp-verse',
      h('div.tp-verse-t', h('b', label), ' ', text.length > 420 ? text.slice(0, 419) + '…' : text),
      h('div.row.tp-verse-a',
        h('button.btn.sm', { type: 'button', title: 'Put this passage on the Next screen', onclick: async () => {
          const cue = await (await ctx.tab('bible')).cueFor(r, tr);
          if (!cue) { toast('That passage is not in this translation.', 'err'); return; }
          ctx.setStaged('ai', cue); toast(cue.title + ' is Next. Press Present (F5).', 'ok', 2500);
        } }, icon('next'), h('span', 'Next')),
        h('button.btn.sm', { type: 'button', title: 'Make a banner with this verse', onclick: () => {
          cur = newBanner('verse'); cur.f.ref = r; cur.f.tr = tr; savedSig = null; nameInp.value = '';
          setView('make'); changed(true); fetchVerse();
        } }, icon('banner'), h('span', 'Banner'))));
  }
  async function topicCue(topic, refs, title, tr) {
    const bible = await ctx.tab('bible');
    const frames = [], labels = [];
    for (const ref of refs) {
      const c = await bible.cueFor(ref, tr);
      if (!c) continue;
      const sh = refText(SHORT, c.book, c.segs);
      c.deck.frames.forEach((f, i) => { frames.push(f); labels.push(c.deck.frames.length > 1 ? sh + ' (' + (i + 1) + ')' : sh); });
    }
    if (!frames.length) return null;
    const info = await getInfo(tr);
    return { id: 'topic:' + (topic ? topic.id : title) + ':' + tr, tab: 'ai', title: topic ? topic.t : title, sub: info.abbr + ' · ' + refs.length + ' passage' + (refs.length === 1 ? '' : 's'),
      deck: { kind: 'text', frames }, index: 0, labels, plan: topic ? { tab: 'ai', topic: topic.id, tr, label: 'Verses: ' + topic.t } : null };
  }
  async function stageTopic(topic, refs, title, tr) {
    const cue = await topicCue(topic, refs, title, tr);
    if (!cue) { toast('None of these passages are in this translation.', 'err'); return; }
    ctx.setStaged('ai', cue);
    toast(cue.title + ': ' + cue.deck.frames.length + ' slides are Next. Press Present (F5).', 'ok', 3000);
  }

  // AI summary: editable slides, Bible references checked against the offline Bible before anything is shown.
  async function aiSummary(title, refs) {
    const box = tpOut.querySelector('.tp-ai');
    if (!box) return;
    if (!ai.hasKey()) { toast('Add an API key in Settings → AI to use online summaries. Everything else here works offline.', '', 6000); return; }
    clear(box);
    box.appendChild(h('p.note', 'Asking ' + ai.providerName() + '…'));
    let reply;
    try {
      reply = await ai.aiText({
        system: 'You write short, accurate, Bible-based slide text for a Seventh-day Adventist church service. Warm, simple language suitable for all ages, faithful to Scripture and to Seventh-day Adventist beliefs. No controversy. Reply with JSON only.',
        prompt: 'Topic: ' + title + (refs && refs.length ? '\nKey texts: ' + refs.slice(0, 8).join('; ') : '') +
          '\nWrite 2 or 3 slides. Each slide has a short title (at most 6 words) and text (at most 45 words). Give 2 to 4 Bible references that support it.' +
          '\nReply exactly in this JSON form: {"slides":[{"title":"…","text":"…"}],"verses":["John 3:16"]}',
      });
    } catch (e) { clear(box); box.appendChild(h('p.note.warn', ai.friendlyAiError(e))); return; }
    const slides = parseSlides(reply);
    const j = ai.parseJsonReply(reply);
    const verses = (j && Array.isArray(j.verses) ? j.verses : []).map(String);
    renderAiSlides(box, slides, verses);
  }
  function parseSlides(reply) {
    const j = ai.parseJsonReply(reply);
    if (j && Array.isArray(j.slides)) {
      const out = j.slides.map((s) => ({ title: String((s && s.title) || '').trim(), text: String((s && s.text) || '').trim() })).filter((s) => s.title || s.text);
      if (out.length) return out.slice(0, 5);
    }
    // Older "Slide 1 title: … / Slide 1 text: …" replies.
    const out = [];
    const re = /slide\s*\d+\s*title\s*:\s*(.+)\s*\n\s*slide\s*\d+\s*text\s*:\s*([\s\S]*?)(?=\n\s*slide\s*\d+\s*title\s*:|$)/gi;
    let m;
    while ((m = re.exec(reply))) out.push({ title: m[1].trim(), text: m[2].trim() });
    if (out.length) return out.slice(0, 5);
    const plain = String(reply || '').trim();
    return plain ? [{ title: '', text: plain.slice(0, 600) }] : [];
  }
  function refsIn(text) {
    const found = [];
    const re = /\b((?:[1-3]\s?)?[A-Z][a-z]+\.?\s\d{1,3}(?::\d{1,3}(?:\s?[-–]\s?\d{1,3})?)?)/g;
    let m;
    while ((m = re.exec(text))) { const p = parseRef(m[1]); if (p) found.push(m[1].trim()); }
    return found;
  }
  async function renderAiSlides(box, slides, verses) {
    clear(box);
    const tr = tpTr.value || settings.v.bible.primary;
    const info = await getInfo(tr);
    const list = h('div.col');
    const draw = () => {
      clear(list);
      slides.forEach((s, i) => {
        const ti = h('input.field', { value: s.title, placeholder: 'Slide title', 'aria-label': 'Slide ' + (i + 1) + ' title', style: { width: '100%' }, oninput: () => { s.title = ti.value; } });
        const tx = h('textarea.field.bn-ta', { rows: 3, placeholder: 'Slide text', 'aria-label': 'Slide ' + (i + 1) + ' text', oninput: () => { s.text = tx.value; } });
        tx.value = s.text;
        list.appendChild(h('div.card.tp-ai-slide', h('div.row', h('b.grow', 'Slide ' + (i + 1)), btn('trash', 'Remove this slide', () => { slides.splice(i, 1); draw(); }, { cls: 'sm' })), ti, tx));
      });
    };
    draw();
    const all = slides.map((s) => s.title + ' ' + s.text).join(' ');
    const flags = ai.flaggedWords(all);
    const refs = Array.from(new Set(verses.concat(refsIn(all))));
    const checks = h('div.col.tp-checks');
    for (const ref of refs) {
      const r = parseRef(ref);
      let vs = [];
      try { if (r && info.books[r.book - 1] && info.books[r.book - 1][1]) vs = await versesFor(info.id, r.book, r.segs); } catch (e) { vs = []; }
      const ok = vs.length && vs.every((v) => v.text);
      if (ok) {
        const label = refText(info.names, r.book, r.segs);
        const txt = vs.map((v) => verseText(v.text)).join(' ');
        checks.appendChild(h('div.tp-check.ok', icon('check'), h('div.grow', h('b', label), ' ', short(txt, 160)),
          h('button.btn.sm', { type: 'button', title: 'Add this verse as a slide', onclick: () => { slides.push({ title: label, text: txt }); draw(); } }, icon('plus'), h('span', 'Slide'))));
      } else {
        checks.appendChild(h('div.tp-check.bad', icon('info'), h('div.grow', h('b', ref), ' — not found in ' + info.abbr + '. Check this reference before showing it.')));
      }
    }
    box.append(...[
      h('div.row.wrap', h('h3.grow', 'AI summary — check before showing'), h('span.note', ai.providerName())),
      flags.length ? h('p.note.warn', 'Please read carefully: the reply contains “' + flags.join('”, “') + '”.') : null,
      list,
      h('div.row.wrap', h('button.btn.sm', { type: 'button', onclick: () => { slides.push({ title: '', text: '' }); draw(); } }, icon('plus'), h('span', 'Add slide'))),
      refs.length ? h('h4', 'Bible references') : null, checks,
      h('div.row.wrap.bn-actions',
        h('button.btn.primary', { type: 'button', onclick: () => {
          const fr = slides.filter((s) => (s.title || s.text).trim()).map((s) => ({ kind: 'text', variant: 'plain', head: s.title.trim() || undefined, html: esc(s.text.trim()).replace(/\n/g, '<br>') }));
          if (!fr.length) { toast('Nothing to show yet.', 'err'); return; }
          ctx.setStaged('ai', { id: 'aisum:' + Date.now(), tab: 'ai', title: (slides[0] && slides[0].title) || 'Summary', sub: 'Checked summary', deck: { kind: 'text', frames: fr }, index: 0, labels: fr.map((f, i) => String(i + 1)) });
          toast('Summary slides are Next. Press Present (F5).', 'ok', 2500);
        } }, icon('next'), h('span', 'Set as Next')),
        h('button.btn', { type: 'button', title: 'Start a banner from the first slide', onclick: () => {
          const s = slides[0]; if (!s) return;
          cur = newBanner('blank'); cur.f.title = s.title; cur.f.text = s.text; savedSig = null; nameInp.value = '';
          setView('make'); changed(true);
        } }, icon('banner'), h('span', 'Make a banner')))].filter(Boolean));
  }


  // ------------------------------------------------------------ Ask AI: one question, three slide-sized answers
  // The person picks the answer they prefer (and may edit it), optionally adds a picture, and sets it as a
  // slide. Bible references in the answers are checked against the installed Bible; a verse shown on a slide
  // is always the Bible's own words, never AI's wording of it.
  let askStage = null;
  const dropAskStage = () => { if (askStage) { try { askStage.destroy(); } catch (e) { /* */ } askStage = null; } };
  const clampStr = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n);
  const ASK_LABELS = ['Short answer', 'With the Bible’s own words', 'Key points'];

  async function askAi() {
    const question = askIn.value.trim();
    if (!question) { askIn.focus(); return; }
    await loadTopics().catch(() => {});
    if (!ai.hasKey() || navigator.onLine === false) {
      toast(!ai.hasKey() ? 'No AI key yet (Settings → AI), so the Bible and topics were searched instead.' : 'No internet, so the Bible and topics were searched instead.', '', 5000);
      tpSearch.value = question; runTopicSearch();
      return;
    }
    dropAskStage(); curTopic = null; lastQuery = ''; filterTopics();
    clear(tpOut);
    tpOut.appendChild(h('p.note', 'Asking ' + ai.providerName() + '…'));
    askBtn.disabled = true;
    let reply;
    try {
      reply = await ai.aiText({
        system: 'You help a Seventh-day Adventist church media team answer questions on a projector slide. Be accurate, warm, simple and faithful to the Bible and to Seventh-day Adventist beliefs. No controversy. Never invent Bible references. Reply with JSON only.',
        prompt: 'Question: ' + question +
          '\nGive exactly 3 different ways to answer on one slide:' +
          '\n1 "Short answer": title (at most 6 words), text (at most 30 words), 0 to 2 Bible references.' +
          '\n2 "With the Bible’s own words": title (at most 6 words), text = one short lead-in sentence (at most 16 words), and exactly one best Bible reference (one verse or at most 3 verses) in "verses".' +
          '\n3 "Key points": title (at most 6 words), text = exactly 3 short points of at most 8 words, one per line, each starting with "• ", 0 to 2 Bible references.' +
          '\nAlso "picture": at most 12 words describing a calm, reverent background scene with no people and no text.' +
          '\nIf the question is not suitable for church or cannot be answered, reply {"options":[]}.' +
          '\nReply exactly in this JSON form: {"options":[{"label":"Short answer","title":"…","text":"…","verses":["John 3:16"]},{"label":"…","title":"…","text":"…","verses":["…"]},{"label":"Key points","title":"…","text":"• …\\n• …\\n• …","verses":[]}],"picture":"…"}',
        maxTokens: 900,
      });
    } catch (e) { clear(tpOut); tpOut.appendChild(h('p.note.warn', ai.friendlyAiError(e))); askBtn.disabled = false; return; }
    askBtn.disabled = false;
    const j = ai.parseJsonReply(reply);
    const raw = j && Array.isArray(j.options) ? j.options.filter((o) => o && typeof o === 'object').slice(0, 3) : [];
    clear(tpOut);
    if (!raw.length) {
      tpOut.appendChild(emptyState('search', 'No answer to show', 'The AI could not answer that for a slide. Try asking in other words, or search the topics on the left.'));
      return;
    }
    const tr = tpTr.value || settings.v.bible.primary;
    const options = [];
    for (let i = 0; i < raw.length; i++) {
      const o = raw[i];
      const refs = (Array.isArray(o.verses) ? o.verses : []).map((x) => String(x).trim()).filter(Boolean).slice(0, i === 1 ? 1 : 2);
      const ok = [], bad = [];
      for (const ref of refs) {
        const v = await versesText(ref, tr).catch(() => null);
        if (v) ok.push({ ref, label: v.label.replace(/ \([^)]*\)$/, ''), text: v.text }); else bad.push(ref);
      }
      let title = clampStr(o.title, 70), text = clampStr(o.text, 420), foot = ok.map((v) => v.label).join('  ·  ');
      if (i === 1 && ok[0]) {
        const vt = ok[0].text.length > 260 ? ok[0].text.slice(0, 259).replace(/\s+\S*$/, '') + '…' : ok[0].text;
        text = (text ? text + '\n\n' : '') + '“' + vt + '”';
      }
      options.push({ label: clampStr(o.label, 40) || ASK_LABELS[i] || 'Answer ' + (i + 1), title, text, foot, bad });
    }
    const mood = ai.flaggedWords(j.picture).length ? '' : clampStr(j.picture, 160);
    renderAsk(question, options, mood, tr);
  }

  function renderAsk(question, options, mood, tr) {
    dropAskStage();
    clear(tpOut);
    let sel = 0;
    const ab = newBanner('blank');           // the banner for the chosen answer
    ab.s.pal = 'navy'; ab.s.deco = 'glow';
    const cards = h('div.col.tp-ask-cards');
    const stHost = h('div.stage-host');
    const stScreen = h('div.screen.bn-screen', stHost);
    askStage = createStage(stHost, { placeholderOnly: true, aspect: link.aspect ? link.aspect() : 16 / 9 });
    if (live.style) askStage.applyStyle(live.style);
    stScreen.style.aspectRatio = String(link.aspect ? link.aspect() : 16 / 9);
    const pre = (o) => { ab.f.title = o.title; ab.f.text = o.text; ab.f.foot = o.foot; };
    const sync = () => { pre(options[sel]); refresh(); };
    let seq = 0;
    async function refresh() {
      const my = ++seq;
      const fr = await frameOf(ab).catch(() => null);
      if (my !== seq || !fr || !askStage) return;
      askStage.show(fr);
    }
    const refreshSoon = debounce(refresh, 150);
    function drawCards() {
      clear(cards);
      options.forEach((o, i) => {
        const on = i === sel;
        const ti = h('input.field', { value: o.title, 'aria-label': 'Slide heading', placeholder: 'Heading', style: { width: '100%' }, oninput: () => { o.title = ti.value; if (on) { sync(); } } });
        const tx = h('textarea.field.bn-ta', { rows: 3, 'aria-label': 'Slide text', oninput: () => { o.text = tx.value; if (on) { sync(); } } });
        tx.value = o.text;
        const ft = h('input.field', { value: o.foot, 'aria-label': 'Bible reference line', placeholder: 'Bible reference (bottom line)', style: { width: '100%' }, oninput: () => { o.foot = ft.value; if (on) sync(); } });
        const flags = ai.flaggedWords(o.title + ' ' + o.text);
        cards.appendChild(h('div.card.tp-ask-card' + (on ? '.on' : ''), { 'aria-current': on ? 'true' : null },
          h('div.row', h('span.chip', o.label), h('div.grow'),
            h('button.btn.sm' + (on ? '.primary' : ''), { type: 'button', 'aria-pressed': String(on), onclick: () => { sel = i; sync(); drawCards(); } }, on ? icon('check') : null, h('span', on ? 'Chosen' : 'Use this one'))),
          ti, tx, ft,
          o.bad.length ? h('p.note.warn', 'Not found in the Bible: ' + o.bad.join(', ') + '. Left out of the slide; check it before using.') : null,
          flags.length ? h('p.note.warn', 'Please read carefully: contains “' + flags.join('”, “') + '”.') : null));
      });
    }
    const dimInfo = h('span.note', '');
    const picRow = h('div.row.wrap');
    function drawPic() {
      clear(picRow);
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
        const f0 = file.files[0]; file.value = '';
        if (!f0) return;
        try { await setPic(await storePicture(f0, f0.name)); } catch (e) { toast('Could not use that picture: ' + e.message, 'err'); }
      } });
      const aiPic = h('button.btn', { type: 'button', title: 'Make a calm background picture for this answer with online AI (no words in it)', onclick: async () => {
        aiPic.disabled = true; const lbl = aiPic.lastChild.textContent; aiPic.lastChild.textContent = 'Making picture…';
        try {
          const blob = await ai.aiImage((mood || 'A peaceful nature scene, soft light') + '. A wide 16:9 background photograph for a church projector screen. Calm, reverent and uplifting, soft natural light, ' +
            'simple composition with plenty of open space for text. Absolutely no text, letters, words, numbers, logos, signs or watermarks.');
          await setPic(await storePicture(blob, 'AI picture ' + new Date().toLocaleDateString()));
        } catch (e) { toast(ai.friendlyAiError(e), 'err', 8000); }
        finally { aiPic.disabled = false; aiPic.lastChild.textContent = lbl; }
      } }, icon('sparkle'), h('span', ai.canImage() ? 'Add AI picture (online)' : 'AI picture (not with this provider)'));
      aiPic.disabled = !ai.canImage();
      picRow.append(aiPic, h('button.btn', { type: 'button', onclick: () => file.click() }, icon('upload'), h('span', 'Choose picture…')), file,
        ab.s.img ? h('button.btn', { type: 'button', onclick: () => { ab.s.img = null; ab.s.dim = null; drawPic(); refresh(); } }, icon('x'), h('span', 'No picture')) : null);
    }
    async function setPic(id) {
      const rec = await db.get('files', id).catch(() => null);
      ab.s.img = id; ab.s.dim = Math.max(0.35, autoDim(rec && rec.meta && rec.meta.lum));
      drawPic(); refresh();
    }
    async function cue() {
      const fr = await frameOf(ab);
      const title = (ab.f.title || ab.f.text || 'Answer').split('\n')[0];
      return Object.assign(bannerCue(ab, fr), { id: 'banner:ask:' + Date.now(), title: short(title, 50), sub: 'Answer: ' + short(question, 40), plan: null });
    }
    function saveAsBanner() {
      const b = clone(ab);
      b.id = 'b-' + uid(); b.created = b.updated = Date.now(); b.name = short(question, 50);
      lib.unshift(b); saveLib(); renderViewSeg();
      return b;
    }
    tpOut.append(
      h('div.tp-head', h('h3', 'Your question'), h('p', question), h('p.note', 'Three ways to answer on a slide. Pick the one you like, edit it if needed, and add a picture if you wish. Check it before it goes on screen.')),
      cards,
      h('h4', 'Picture (optional)'), picRow,
      h('h4', 'Slide preview'), stScreen,
      h('div.row.wrap.bn-actions',
        h('button.btn.primary', { type: 'button', onclick: async () => {
          const o = options[sel];
          if (!(o.title || o.text).trim()) { toast('The slide is empty. Choose or write an answer first.', 'err'); return; }
          ctx.setStaged('ai', await cue()); toast('Answer is Next. Press Present (F5) to show it.', 'ok', 3000);
        } }, icon('next'), h('span', 'Set as Next')),
        h('button.btn', { type: 'button', onclick: async () => { const b = saveAsBanner(); (await ctx.tab('plan')).addItem({ tab: 'ai', banner: b.id, label: 'Answer: ' + short(question, 40) }); } }, icon('plan'), h('span', 'Add to plan')),
        h('button.btn', { type: 'button', onclick: () => { saveAsBanner(); toast('Saved in Banners → Saved.', 'ok', 2500); } }, icon('save'), h('span', 'Save')),
        h('button.btn', { type: 'button', title: 'Open it in the banner editor to change colours and text position', onclick: () => {
          cur = clone(ab); cur.id = null; savedSig = null; nameInp.value = ''; setView('make'); changed(true);
        } }, icon('banner'), h('span', 'Edit as banner')),
        h('button.btn', { type: 'button', onclick: () => askAi() }, icon('sparkle'), h('span', 'Ask again'))),
      dimInfo);
    drawCards(); drawPic(); sync();
    if (ctx.isMobile()) tpOut.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ============================================================ control bar + plan
  const api = {
    el,
    onShow() { setPreviewAspect(); if (view === 'make') refreshPreview(); },
    /** Open a plan item: {banner} | {loop} | {topic, tr}. Returns the staged cue. */
    async open(item) {
      await ready;
      let cue = null;
      if (item.banner) {
        const b = lib.find((x) => x.id === item.banner);
        if (!b) { toast('That banner is no longer on this device.', 'err'); return null; }
        cue = bannerCue(b, await frameOf(b));
      } else if (item.loop) {
        cue = await loopCue();
        if (!cue) { toast('The pre-service loop is empty. Add banners in Banners → Pre-service loop.', 'err'); return null; }
      } else if (item.topic) {
        await loadTopics();
        const t = topics.find((x) => x.id === item.topic);
        if (!t) return null;
        cue = await topicCue(t, t.r, t.t, item.tr || settings.v.bible.primary);
      }
      if (cue) ctx.setStaged('ai', cue);
      return cue;
    },
    controls(cue) {
      if (!cue.isLoop) return null;
      const b = h('button.btn.sm', { type: 'button', title: 'Pause or resume the loop',
        onclick: () => { live.autoRun(!!live.autoPaused); paint(); } });
      const paint = () => { clear(b); b.append(icon(live.autoPaused ? 'play' : 'pause'), h('span', live.autoPaused ? 'Resume loop' : 'Pause loop')); };
      paint();
      const a = cue.deck.auto || {};
      return h('div.row', b, h('span.note.hide-sm', 'every ' + a.secs + ' s' + (a.at ? ' · until ' + new Date(a.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }) : '')));
    },
    /** Saved banners, for the Plan tab's Link dialog. */
    banners() { return lib.map((b) => ({ id: b.id, name: nameOf(b) })); },
  };

  const ready = (async () => {
    await load().catch((e) => console.warn('banners', e));
    trList = await listTranslations().catch(() => []);
    if (!live.style) await live.buildStyle().catch(() => {});
    if (live.style) stage.applyStyle(live.style);
    setPreviewAspect();
    nameInp.value = cur.name || '';
    renderEditor();
    updateSaveBtn();
    setView(view);
  })();
  settings.on('change:church', (path) => {
    // A church name added after starting a banner fills the empty lines that would have shown it.
    if (path === 'church.name') {
      const c = church(), d = TPL[cur.tpl].d(c);
      Object.keys(d).forEach((k) => { if (!cur.f[k] && d[k] && c.name && d[k].includes(c.name)) cur.f[k] = d[k]; });
      saveDraft();
    }
    if (view === 'make') { renderEditor(); schedule(); }
  });
  settings.on('change:display', (p) => { if (p === 'display.logo' && view === 'make') renderEditor(); });
  renderViewSeg();
  return api;
}
