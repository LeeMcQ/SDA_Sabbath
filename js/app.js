// SDA Sabbath control app boot: tabs, Present button, display menu, shortcuts, service worker.
import { $, h, clear, isTyping } from './core/util.js';
import { icon } from './core/icons.js';
import { settings } from './core/settings.js';
import { db, persistStorage } from './core/db.js';
import { link, listScreens } from './core/link.js';
import { live } from './core/live.js';
import { bgAudio } from './core/audio.js';
import * as ui from './core/ui.js';
import { createMonitors } from './monitors.js';
import { createControlBar } from './controlbar.js';
import { createQuick } from './quick.js';
import { createDisplay } from './display/display.js';
import { openPip, pipSupported } from './pip.js';

export const VERSION = '1.1.0';

const TABS = [
  { id: 'bible', label: 'Bible', icon: 'bible', load: () => import('./tabs/bible.js') },
  { id: 'hymns', label: 'Hymns', icon: 'hymn', load: () => import('./tabs/hymns.js') },
  { id: 'slides', label: 'Slides', icon: 'slides', load: () => import('./tabs/slides.js') },
  { id: 'video', label: 'Video', icon: 'video', load: () => import('./tabs/video.js') },
  { id: 'web', label: 'Web', icon: 'web', load: () => import('./tabs/web.js') },
  { id: 'screen', label: 'PC view', icon: 'pc', load: () => import('./tabs/screen.js') },
  { id: 'plan', label: 'Plan', icon: 'plan', load: () => import('./tabs/plan.js') },
  null,
  { id: 'settings', label: 'Settings', icon: 'settings', load: () => import('./tabs/settings.js') },
];

const appEl = $('#app');
const work = $('#work');
const rail = $('#rail');
const presentBtn = $('#presentBtn');
const dispBtn = $('#dispBtn');
const tabs = new Map();      // id -> api (created lazily)
const loading = new Map();   // id -> promise
const stagedBy = new Map();  // id -> cue
const railBtns = new Map();
let current = null;

export const isMobile = () => matchMedia('(max-width: 760px)').matches;

// ------------------------------------------------------------ context passed to tabs
const ctx = {
  live, link, settings, db, bgAudio, ui, toast: ui.toast, isMobile, VERSION,
  setStaged(id, cue) {
    stagedBy.set(id, cue || null);
    if (id === current) live.stage(cue || null);
  },
  showTab: (id) => showTab(id),
  tab: (id) => getTab(id),
  stagedOf: (id) => stagedBy.get(id) || null,
  companion: null,
  installPrompt: null,
};
window.selah = ctx; // handy for debugging from the console (name kept for existing scripts)

async function getTab(id) {
  if (tabs.has(id)) return tabs.get(id);
  if (loading.has(id)) return loading.get(id);
  const def = TABS.find((t) => t && t.id === id);
  if (!def) throw new Error('No tab ' + id);
  const p = def.load().then((mod) => {
    const api = mod.default(ctx);
    api.el.classList.add('tabpanel');
    api.el.setAttribute('role', 'tabpanel');
    api.el.hidden = true;
    work.appendChild(api.el);
    tabs.set(id, api);
    return api;
  });
  loading.set(id, p);
  return p;
}

async function showTab(id) {
  // While the Plan tab opens an item in another tab, stay on the Plan.
  if (ctx.hold && id !== ctx.hold) return getTab(id);
  if (current === id && tabs.has(id)) return tabs.get(id);
  const api = await getTab(id);
  if (current && tabs.has(current)) { const prev = tabs.get(current); prev.el.hidden = true; if (prev.onHide) prev.onHide(); }
  const switching = !!current;
  current = id;
  api.el.hidden = false;
  if (switching) ui.enter(api.el); // gentle fade-in of the new tab (not on first load)
  railBtns.forEach((b, k) => b.setAttribute('aria-selected', String(k === id)));
  appEl.className = appEl.className.replace(/\btab-\S+/g, '').trim() + ' tab-' + id; // lets phones hide the monitors on Settings
  moreBtn.classList.toggle('on', MORE_TABS.includes(id));
  moreBtn.setAttribute('aria-label', MORE_TABS.includes(id) ? 'More tabs (' + TABS.find((t) => t && t.id === id).label + ' open)' : 'More tabs');
  if (api.onShow) api.onShow();
  live.stage(stagedBy.get(id) || null);
  if (id !== 'settings') settings.set('app.lastTab', id);
  return api;
}

// ------------------------------------------------------------ rail
// On phones only five buttons fit comfortably: Bible, Hymns, Plan, Slides and More (the rest).
const MORE_TABS = ['video', 'web', 'screen', 'settings'];
TABS.forEach((t, i) => {
  if (!t) { rail.appendChild(h('div.rail-gap')); return; }
  const b = h('button' + (MORE_TABS.includes(t.id) ? '.more-tab' : ''), { type: 'button', role: 'tab', 'aria-selected': 'false', 'data-tab': t.id, title: t.label + (i < 7 ? '  (Alt+' + (i + 1) + ')' : ''), onclick: () => showTab(t.id) },
    icon(t.icon), h('span', t.label), h('span.tally'));
  railBtns.set(t.id, b);
  rail.appendChild(b);
});
const moreBtn = h('button.rail-more', { type: 'button', 'aria-label': 'More tabs', 'aria-haspopup': 'menu', onclick: () => ui.menu(moreBtn,
  MORE_TABS.map((id) => { const t = TABS.find((x) => x && x.id === id); return { label: t.label, icon: t.icon, hint: current === id ? 'Open' : '', onclick: () => showTab(id) }; })) },
icon('grid'), h('span', 'More'));
rail.parentNode.appendChild(moreBtn);
live.on('live', (cue) => {
  railBtns.forEach((b, k) => b.classList.toggle('is-live', !!cue && cue.tab === k));
  moreBtn.classList.toggle('is-live', !!cue && MORE_TABS.includes(cue.tab));
});

// ------------------------------------------------------------ layout settings
function applyLayout() {
  const a = settings.v.app;
  document.documentElement.setAttribute('data-theme', a.theme || 'dark');
  appEl.classList.toggle('rail-right', a.railSide === 'right');
  appEl.classList.toggle('no-monitors', a.monitors === false);
  document.documentElement.classList.toggle('no-mon', a.monitors === false);
  document.documentElement.classList.toggle('lp', settings.lowPower()); // low-power mode: no UI motion
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--sunk').trim() || '#161c28';
}
settings.on('change:app', applyLayout);
applyLayout();

// ------------------------------------------------------------ Present button
// When the staged item is the one already on screen, the button says "On screen" instead of
// inviting a second press (the Next monitor gets a "Same as Live" badge to match).
const presentKey = presentBtn.querySelector('.pk');
function updatePresent() {
  const c = live.staged;
  const same = live.sameAsLive();
  presentBtn.classList.toggle('empty', !c);
  presentBtn.classList.toggle('is-live', same);
  presentKey.textContent = same ? 'On screen' : 'Present';
  $('#presentNext').textContent = c ? (same ? '' : 'Next: ') + c.title + (c.sub ? '  ' + c.sub : '') : 'Nothing selected';
  presentBtn.title = same ? 'This is already on screen. Press again (F5) to show it from the start.' : 'Present the selected item (F5 or Ctrl+Enter)';
}
live.on('staged', updatePresent);
live.on('live', updatePresent);
live.on('go', updatePresent);
// Phones: with nothing staged or live, the two empty monitors fold into one slim strip.
const syncIdle = () => document.documentElement.classList.toggle('mon-idle', !live.staged && !live.cue);
live.on('staged', syncIdle);
live.on('live', syncIdle);
presentBtn.addEventListener('click', () => doPresent());
async function doPresent() {
  persistStorage();
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'SELECT') && a !== document.body) a.blur();
  const ok = await live.take();
  if (ok) { presentBtn.classList.add('flash'); setTimeout(() => presentBtn.classList.remove('flash'), 260); }
}

live.on('notice', (n) => ui.toast(n.text, n.code === 'nothing' || n.code === 'nologo' ? '' : 'err', n.code === 'autoplay' || n.code === 'nologo' ? 6000 : 3600));

// ------------------------------------------------------------ display menu
const SHORT_KIND = { window: 'Window', self: 'Here', cast: 'Cast', socket: 'TV' };
function updateDispBtn() {
  const isLive = !!live.cue && link.ready;
  dispBtn.classList.toggle('on', link.ready);
  dispBtn.classList.toggle('is-live', isLive);
  const full = link.kind ? (link.ready ? link.info.label || 'Display' : 'Connecting…') : 'No display';
  dispBtn.querySelector('.lbl').textContent = full;
  // Phones show a one-glance status: "No display", "Ready · TV" or "Live · TV".
  dispBtn.querySelector('.lbl-s').textContent = !link.kind ? 'No display' : !link.ready ? 'Connecting' : (isLive ? 'Live · ' : 'Ready · ') + (SHORT_KIND[link.kind] || 'Screen');
  dispBtn.setAttribute('aria-label', 'Display: ' + full + (isLive ? ', something is live' : '') + '. Choose where to present');
}
link.on('state', updateDispBtn);
link.on('hello', updateDispBtn);
live.on('live', updateDispBtn);
link.on('blocked', () => ui.toast('The browser blocked the display window. Allow pop-ups for this site, then press Present again.', 'err', 7000));
link.on('pin-wrong', () => ui.toast('Wrong PIN for the SDA Sabbath companion.', 'err'));
link.on('found', () => { if (!link.kind) ui.toast('A display window is already open. Press Present to reconnect to it.'); });

async function chooseScreen() {
  const r = await listScreens();
  if (!r) { ui.toast('This browser cannot list screens. Drag the display window onto the projector screen and press F there.', '', 6000); return link.openWindow(); }
  return new Promise((resolve) => {
    const list = h('div.list');
    r.screens.forEach((s, i) => {
      list.appendChild(h('button', { type: 'button', onclick: async () => {
        settings.set('display.screenLabel', s.label || ''); ui.closeModal(); resolve(await link.openWindow({ prompt: true }));
      } }, icon('pc'), h('span.grow', (s.label || 'Screen ' + (i + 1)) + (s === r.current ? '  (this screen)' : '')), h('span.faint', s.width + ' × ' + s.height)));
    });
    ui.modal({ title: 'Present on which screen?', body: list, onclose: () => resolve(false) });
  });
}

function companionDialog() {
  return new Promise((resolve) => {
    const url = h('input.field', { value: settings.v.companion.url || (ctx.companion ? location.origin : 'http://192.168.1.10:7777'), style: { width: '100%' } });
    const pin = h('input.field', { value: settings.v.companion.pin || '', inputmode: 'numeric', style: { width: '120px' } });
    ui.modal({
      title: 'Present through the SDA Sabbath companion',
      body: h('div.col',
        h('p.note', 'Run the SDA Sabbath companion on the church PC. Open the address it shows on the TV or projector PC with “/display” at the end, then connect here.'),
        h('label.muted', 'Companion address'), url, h('label.muted', 'PIN shown by the companion'), pin),
      onclose: () => resolve(false),
      actions: [{ label: 'Cancel' }, { label: 'Connect', primary: true, onclick: () => {
        settings.set('companion.url', url.value.trim()); settings.set('companion.pin', pin.value.trim());
        link.connectSocket(url.value.trim(), pin.value.trim()); resolve(true);
      } }],
    });
  });
}

function displayMenu(anchor) {
  const items = [];
  if (!isMobile() || innerWidth > 900) {
    items.push({ label: 'Open display on second screen', icon: 'present', onclick: () => link.openWindow() });
    if ('getScreenDetails' in window) items.push({ label: 'Choose screen…', icon: 'pc', onclick: () => chooseScreen() });
  }
  items.push({ label: 'Use this device as the screen', icon: 'phone', onclick: () => link.openSelf(createDisplay) });
  if (link.canCast()) items.push({ label: 'Cast to a TV or wireless display', icon: 'cast', onclick: () => link.openCast().catch((e) => ui.toast('Cast was cancelled or is not available: ' + e.message, 'err')) });
  items.push({ label: 'SDA Sabbath companion on the network…', icon: 'link', onclick: companionDialog });
  if (pipSupported()) items.push('-', { label: 'Mini controller (stays on top)', icon: 'pip', onclick: () => openPip().catch((e) => ui.toast('The mini controller could not open: ' + e.message, 'err')) });
  if (link.kind) items.push('-', { label: 'Close display', icon: 'x', onclick: () => { link.close(); } });
  ui.menu(anchor, items);
}
dispBtn.addEventListener('click', () => displayMenu(dispBtn));

live.ensureDisplay = () => new Promise((resolve) => {
  if (!isMobile() && !matchMedia('(pointer: coarse)').matches) { link.openWindow().then(resolve); return; }
  let done = false;
  const opt = (ic, title, desc, fn) => h('button', { type: 'button', onclick: async () => { done = true; ui.closeModal(); try { resolve(await fn()); } catch (e) { ui.toast(e.message, 'err'); resolve(false); } } },
    icon(ic), h('div.grow', h('div', { style: { fontWeight: 700 } }, title), h('div.note', desc)));
  const list = h('div.list',
    opt('phone', 'This device', 'Full screen here. Use with an HDMI adapter or screen mirroring.', () => link.openSelf(createDisplay)),
    link.canCast() ? opt('cast', 'Cast', 'Chromecast or a wireless display.', () => link.openCast()) : null,
    opt('link', 'SDA Sabbath companion', 'Control a PC or TV on the church network from this phone.', companionDialog),
    innerWidth > 700 ? opt('present', 'Display window', 'A separate window you can move to a projector.', () => link.openWindow()) : null);
  ui.modal({ title: 'Where should SDA Sabbath present?', body: list, onclose: () => { if (!done) resolve(false); } });
});

// ------------------------------------------------------------ top icons
const topIcons = $('#topIcons');
const searchBtn = ui.btn('search', 'Go to (/)', () => quick.focus(), { cls: 'sm' });
searchBtn.classList.add('show-sm');
async function promptInstall() {
  const p = ctx.installPrompt;
  if (!p) return;
  ctx.installPrompt = null; installBtn.hidden = true; // a prompt can only be shown once
  try { p.prompt(); await p.userChoice; } catch (e) { /* dismissed */ }
}
ctx.promptInstall = promptInstall;
const installBtn = ui.btn('download', 'Install SDA Sabbath on this device', promptInstall, { cls: 'sm' });
installBtn.hidden = true;
const helpBtn = ui.btn('kbd', 'Keyboard shortcuts (?)', () => showHelp(), { cls: 'sm' });
topIcons.append(searchBtn, installBtn, helpBtn);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ctx.installPrompt = e; installBtn.hidden = false; ui.enter(installBtn, 'pop'); });
window.addEventListener('appinstalled', () => { ctx.installPrompt = null; installBtn.hidden = true; ui.toast('SDA Sabbath is installed.', 'ok'); });
const mq = matchMedia('(max-width: 760px)');
const syncSearch = () => { searchBtn.hidden = !mq.matches; helpBtn.hidden = mq.matches; };
mq.addEventListener ? mq.addEventListener('change', syncSearch) : mq.addListener(syncSearch);
syncSearch();

// ------------------------------------------------------------ quick go-to
const quick = createQuick({ input: $('#quickInput'), pop: $('#quickPop'), wrap: $('#quick'), getTab, showTab });

// ------------------------------------------------------------ keyboard (also clickers & keys pressed on the display window)
function showHelp() {
  const rows = [
    ['F5  or  Ctrl+Enter', 'Present what is selected (Next → Live)'],
    ['→  ↓  Page Down  Space', 'Next verse / slide / stanza'],
    ['←  ↑  Page Up', 'Previous'], ['Home  End', 'First / last'],
    ['B  or  .', 'Black screen (press again to return)'], ['L', 'Show logo'], ['Esc  or  C', 'Clear the screen'],
    ['/  or  Ctrl+K', 'Go to a Bible reference or hymn number'], ['Alt+1 … Alt+7', 'Switch tabs'],
    ['Space (video live)', 'Play / pause'], ['F (on the display)', 'Toggle full screen'],
  ];
  ui.modal({ title: 'Keyboard and clicker shortcuts', body: h('div.form', rows.map(([k, d]) => [h('label', h('kbd', k)), h('span', d)])) });
}

function handleKey(e, remote) {
  const k = e.key;
  if (!remote && ui.modalOpen() && k !== 'F5') { if (k === 'Escape') { ui.closeModal(); return true; } return false; }
  const typing = !remote && isTyping(e);
  const ctrl = e.ctrlKey || e.metaKey;
  if (k === 'F5' || (ctrl && k === 'Enter')) { doPresent(); return true; }
  if (typing) return false;
  if (!remote && ((ctrl && (k === 'k' || k === 'K')) || k === '/')) { quick.focus(); return true; }
  if (e.altKey && /^[1-7]$/.test(k)) { const t = TABS.filter(Boolean)[+k - 1]; if (t) showTab(t.id); return true; }
  if (ctrl || e.altKey) return false;
  const kind = live.cue && live.cue.deck.kind;
  switch (k) {
    case 'ArrowRight': case 'ArrowDown': case 'PageDown': live.next(); return true;
    case 'ArrowLeft': case 'ArrowUp': case 'PageUp': live.prev(); return true;
    case ' ': if (kind === 'video') live.mediaCmd('toggle'); else live.next(); return true;
    case 'Home': live.go(0); return true;
    case 'End': live.go(live.count() - 1); return true;
    case 'b': case 'B': case '.': live.setBlank('black'); return true;
    case 'l': case 'L': live.setBlank('logo'); return true;
    case 'Escape': case 'c': case 'C': live.clear(); return true;
    case '?': showHelp(); return true;
  }
  return false;
}
document.addEventListener('keydown', (e) => { if (handleKey(e, false)) e.preventDefault(); });
live.on('remote-key', (m) => handleKey({ key: m.key, ctrlKey: m.ctrl, metaKey: false, altKey: m.alt, shiftKey: m.shift, target: null }, true));

// ------------------------------------------------------------ monitors & control bar
createMonitors($('#monitors'));
createControlBar($('#ctrlbar'), getTab);

// ------------------------------------------------------------ keep the control screen awake during a service (phones)
let wake = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && (live.cue || link.kind)) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
}
document.addEventListener('visibilitychange', keepAwake);
live.on('live', keepAwake);

// Warn before closing while something is live.
window.addEventListener('beforeunload', (e) => { if (live.cue && link.kind === 'window') { e.preventDefault(); e.returnValue = ''; } });

// ------------------------------------------------------------ companion (LAN) detection
async function detectCompanion() {
  // The companion only serves plain http on the church network, so an https site (GitHub Pages)
  // or a file:// copy can never be it. Skipping the probe avoids a 404 in the console on every load.
  if (location.protocol !== 'http:') return;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1200);
    const r = await fetch('api/info', { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return;
    const info = await r.json();
    if (info.app !== 'selah-companion') return;
    ctx.companion = info;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    const params = new URLSearchParams(location.search);
    if (!local || params.get('remote') === '1') {
      // Opened from a phone on the church network: become a remote for the display there.
      const pin = params.get('pin') || settings.v.companion.pin || (await ui.promptBox('Connect to the church display', 'PIN shown by the SDA Sabbath companion'));
      if (pin != null) { settings.set('companion.pin', pin); link.connectSocket(location.origin, pin); }
    }
  } catch (e) { /* not served by the companion */ }
}

// ------------------------------------------------------------ service worker (offline + updates)
function registerSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const ask = (w) => {
      const t = ui.toast(h('span', 'An SDA Sabbath update is ready. ', h('button.btn.sm', { type: 'button', onclick: () => { w.postMessage({ t: 'skip' }); } }, 'Update now')), 'ok', 15000);
      return t;
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          if (live.cue) { const off = live.on('live', (c) => { if (!c) { off(); ask(w); } }); } // never interrupt a live item
          else ask(w);
        }
      });
    });
    // Reload only when an *update* takes over (not on the very first install).
    let reloading = false;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading && !live.cue) { reloading = true; location.reload(); } });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.t === 'progress') ctx.cacheProgress = e.data;
      if (e.data && e.data.t === 'progress') window.dispatchEvent(new CustomEvent('selah-cache', { detail: e.data }));
    });
  }).catch((e) => console.warn('SW', e));
}

// ------------------------------------------------------------ boot
const qTab = new URLSearchParams(location.search).get('tab');
const firstTab = [qTab, settings.v.app.lastTab].find((id) => TABS.some((t) => t && t.id === id)) || 'bible';
showTab(firstTab);
// UI motion starts only after the first load has settled, so nothing animates during start-up.
const markBooted = () => setTimeout(() => document.documentElement.classList.add('booted'), 300);
if (document.readyState === 'complete') markBooted(); else window.addEventListener('load', markBooted, { once: true });
// Opening a PDF / PowerPoint file with SDA Sabbath (installed app on Chrome / Edge).
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => {
    if (!params.files || !params.files.length) return;
    const files = await Promise.all(params.files.map((f) => f.getFile()));
    const slides = await showTab('slides');
    slides.importFiles(files);
  });
}
registerSW();
detectCompanion();
// Warm the Hymns tab in the background so "Go to 73" is instant.
setTimeout(() => getTab('hymns').catch(() => {}), 1500);
