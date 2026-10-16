// SDA Sabbath control app boot: tabs, Present button, display menu, shortcuts, service worker.
import { $, h, isTyping } from './core/util.js';
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
import { clicker, actionFor, sigOfKey, sigOfMouse } from './core/clicker.js';
import { openClickerSetup, builtinAction } from './clickerui.js';

export const VERSION = '1.2.0';
export const BUILD = 'c0dfed5';

const TABS = [
  { id: 'bible', label: 'Bible', icon: 'bible', load: () => import('./tabs/bible.js') },
  { id: 'hymns', label: 'Hymns', icon: 'hymn', load: () => import('./tabs/hymns.js') },
  { id: 'ai', label: 'Banners', icon: 'banner', load: () => import('./tabs/ai.js') }, // id kept from the first version (plans and settings refer to it)
  { id: 'slides', label: 'Slides', icon: 'slides', load: () => import('./tabs/slides.js') },
  { id: 'video', label: 'Video', icon: 'video', load: () => import('./tabs/video.js') },
  { id: 'web', label: 'Web', icon: 'web', load: () => import('./tabs/web.js') },
  { id: 'screen', label: 'PC view', icon: 'pc', load: () => import('./tabs/screen.js') },
  { id: 'plan', label: 'Plan', icon: 'plan', load: () => import('./tabs/plan.js') },
  { id: 'tools', label: 'Tools', icon: 'grid', load: () => import('./tabs/tools.js') },
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
  live, link, settings, db, bgAudio, ui, toast: ui.toast, isMobile, VERSION, BUILD,
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
  let api;
  try { api = await getTab(id); }
  catch (e) { ui.toast('Could not open ' + id + ': ' + e.message, 'err', 6000); console.error(e); return null; }
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
// On phones only five buttons fit comfortably: Bible, Hymns, Banners, Slides, Plan and More (the rest).
const MORE_TABS = ['video', 'web', 'screen', 'tools', 'settings'];
const MORE_MENU = MORE_TABS; // Banners has its own button in the rail (never repeated in this menu)
TABS.forEach((t, i) => {
  if (!t) { rail.appendChild(h('div.rail-gap')); return; }
  const b = h('button' + (MORE_TABS.includes(t.id) ? '.more-tab' : ''), { type: 'button', role: 'tab', 'aria-selected': 'false', 'data-tab': t.id, title: t.label + (i < 9 ? '  (Alt+' + (i + 1) + ')' : ''), onclick: () => showTab(t.id) },
    icon(t.icon), h('span', t.label), h('span.tally'));
  railBtns.set(t.id, b);
  rail.appendChild(b);
});
const moreBtn = h('button.rail-more', { type: 'button', 'aria-label': 'More tabs', 'aria-haspopup': 'menu', onclick: () => ui.menu(moreBtn,
  MORE_MENU.map((id) => { const t = TABS.find((x) => x && x.id === id); return { label: t.label, icon: t.icon, hint: current === id ? 'Open' : '', onclick: () => showTab(id) }; })) },
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
// A one-tap stop button beside the display button whenever something is connected (cast, window, TV …).
const dispStop = h('button.disp-stop', { type: 'button', hidden: true, onclick: () => { const was = link.kind; link.close(); ui.toast(was === 'cast' ? 'Casting stopped.' : 'Display closed.', 'ok', 2000); } }, icon('x'));
dispBtn.after(dispStop);
function updateDispStop() {
  dispStop.hidden = !link.kind;
  const t = link.stopLabel();
  dispStop.title = t; dispStop.setAttribute('aria-label', t);
}
link.on('state', updateDispBtn);
link.on('state', updateDispStop);
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

const onWindows = () => /Windows/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.userAgent);
const onAndroid = () => /Android/i.test(navigator.userAgent);

/** Cast through the browser (Chromecast, Google TV, Android TV). Explains the other ways when it fails. */
function startCast() {
  return link.openCast().catch((e) => {
    // The person closed the browser's cast picker: nothing to report.
    if (e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return false;
    castHelp(e);
    return false;
  });
}

function castHelp(e) {
  const asked = !e; // opened from “TV not found? Help…”
  const noDevice = !e || e.name === 'NoCastDevice' || e.name === 'NotFoundError' || /no screens|not available|not found/i.test((e && e.message) || '');
  const steps = h('div.col', { style: { gap: '10px' } });
  steps.appendChild(h('p', asked
    ? 'Browser casting only works with Chromecast, Google TV and Android TV. Most other TVs (Samsung, LG, Hisense and projectors with “Screen mirroring”) use Miracast instead, which a web page cannot reach directly. These ways work with them:'
    : noDevice
    ? 'The browser found no cast device. Browser casting only works with Chromecast, Google TV and Android TV. Most other TVs (Samsung, LG, Hisense and projectors with “Screen mirroring”) use Miracast instead, which a web page cannot reach directly.'
    : 'Casting failed: ' + ((e && e.message) || e) + '.'));
  const opt = (ic, title, desc, fn) => h('button', { type: 'button', onclick: () => { ui.closeModal(); fn(); } },
    icon(ic), h('div.grow', h('div', { style: { fontWeight: 700 } }, title), h('div.note', desc)));
  const list = h('div.list');
  if (onWindows()) list.appendChild(opt('pc', 'Connect to a wireless display (Windows)', 'Windows connects to Miracast TVs and projectors itself. The TV then becomes a second screen for SDA Sabbath. Recommended.', wirelessDialog));
  list.appendChild(opt('link', 'SDA Sabbath companion', 'Best for a smart TV with a web browser: the TV opens the companion address and this device controls it over Wi-Fi.', companionDialog));
  if (onAndroid()) list.appendChild(opt('phone', 'Use this phone as the screen, then mirror it', 'Open your phone’s Smart View / Screen Cast / Screen mirroring from the quick settings and pick the TV. The TV shows the phone screen.', () => link.openSelf(createDisplay)));
  else list.appendChild(opt('phone', 'Use this device as the screen', 'Full screen here, for an HDMI cable or the device’s own screen mirroring.', () => link.openSelf(createDisplay)));
  list.appendChild(opt('cast', 'Try casting again', 'Make sure the TV and this device are on the same Wi-Fi and the TV is on.', () => startCast()));
  steps.appendChild(list);
  ui.modal({ title: asked ? 'TV not found? Other ways to connect' : noDevice ? 'No cast device found' : 'Casting failed', body: steps, actions: [{ label: 'Close' }], wide: true });
}

/**
 * Windows' own "Connect to a wireless display" (Miracast): Windows connects to the TV or projector and treats it
 * as a second screen; SDA Sabbath then opens its display window there like on any extended screen.
 */
function wirelessDialog() {
  const status = h('p.note.wd-status', 'Waiting for the wireless display…');
  let before = null, sd = null;
  const watch = async () => {
    if (sd || !('getScreenDetails' in window)) return;
    try {
      sd = await window.getScreenDetails();
      before = sd.screens.length;
      status.textContent = 'Screens now: ' + before + '. Connect the TV in the Windows panel; it shows up here when it is ready.';
      sd.addEventListener('screenschange', () => {
        const n = sd.screens.length;
        if (n > before) {
          const s2 = sd.screens.find((x) => x !== sd.currentScreen);
          status.textContent = 'Found: ' + ((s2 && s2.label) || 'a new screen') + '. Make sure Windows is set to Extend, then press Present on it.';
          status.classList.add('ok');
          goBtn.classList.add('primary');
        } else status.textContent = 'Screens now: ' + n + '.';
        before = n;
      });
    } catch (err) { /* permission refused: the steps still work */ }
  };
  const castLink = h('a.btn.primary', { href: 'ms-settings-connectabledevices:devicediscovery', onclick: () => { watch(); } }, icon('cast'), h('span', 'Open Windows “Connect”'));
  const dispLink = h('a.btn', { href: 'ms-settings:display', onclick: () => { watch(); } }, icon('pc'), h('span', 'Open Display settings'));
  const goBtn = h('button.btn', { type: 'button', onclick: async () => {
    ui.closeModal();
    if ('getScreenDetails' in window) await chooseScreen(); else await link.openWindow();
  } }, icon('present'), h('span', 'Present on the wireless display'));
  ui.modal({
    title: 'Connect to a wireless display (Windows)', wide: true,
    body: h('div.col.wd', { style: { gap: '10px' } },
      h('p.note', 'Use this when casting from the browser does not find your TV or projector. Windows connects to it (Miracast) and uses it as a second screen.'),
      h('ol.wd-steps',
        h('li', h('b', 'Open the Windows Connect panel'), ' and pick the TV or projector from the list (or press ', h('kbd', 'Windows'), ' + ', h('kbd', 'K'), '). The browser may ask “Open Settings?”: allow it.',
          h('div.row.wrap', { style: { marginTop: '6px' } }, castLink, dispLink),
          h('div.note', 'Not listed? Turn on “Screen mirroring” (or open the Screen Mirroring app) on the TV, keep it close, and make sure Wi-Fi is on. In Display settings this is “Connect to a wireless display”.')),
        h('li', h('b', 'Choose Extend'), ', not Duplicate: in the Connect panel press “Change projection mode” → Extend, or press ', h('kbd', 'Windows'), ' + ', h('kbd', 'P'), ' → Extend. Then the TV shows only the slides, and this screen keeps the controls.'),
        h('li', h('b', 'Present on it'), '. SDA Sabbath opens its display on the TV. To stop, press the × next to the display button, then Disconnect in the Windows panel.',
          h('div.row.wrap', { style: { marginTop: '6px' } }, goBtn))),
      status),
    actions: [{ label: 'Close' }],
  });
  watch();
}

function displayMenu(anchor) {
  const items = [];
  // Connected: stopping and switching come first, so they are easy to find.
  if (link.kind) {
    items.push({ label: link.stopLabel() + (link.info.label ? ' (' + link.info.label + ')' : ''), icon: 'x', onclick: () => { link.close(); ui.toast('Display closed.', 'ok', 2000); } });
    if (link.kind === 'cast') items.push({ label: 'Cast to another device…', icon: 'cast', onclick: () => { link.close(); startCast(); } });
    items.push('-');
  }
  if (!isMobile() || innerWidth > 900) {
    items.push({ label: 'Open display on second screen', icon: 'present', onclick: () => link.openWindow() });
    if ('getScreenDetails' in window) items.push({ label: 'Choose screen…', icon: 'pc', onclick: () => chooseScreen() });
  }
  items.push({ label: 'Use this device as the screen', icon: 'phone', onclick: () => link.openSelf(createDisplay) });
  if (link.canCast() && link.kind !== 'cast') items.push({ label: 'Cast (Chromecast, Google TV, Android TV)', icon: 'cast', onclick: () => startCast() });
  if (onWindows()) items.push({ label: 'Connect to a wireless display (Windows)…', icon: 'pc', onclick: wirelessDialog });
  items.push({ label: 'SDA Sabbath companion on the network…', icon: 'link', onclick: companionDialog });
  if (link.canCast() || onWindows()) items.push({ label: 'TV not found? Help…', icon: 'info', onclick: () => castHelp(null) });
  items.push({ label: 'Clicker setup and test…', icon: 'settings', onclick: () => clickerSetup() });
  if (pipSupported()) items.push('-', { label: 'Mini controller (stays on top)', icon: 'pip', onclick: () => openPip().catch((e) => ui.toast('The mini controller could not open: ' + e.message, 'err')) });
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
    link.canCast() ? opt('cast', 'Cast', 'Chromecast, Google TV or Android TV on the same Wi-Fi.', () => startCast()) : null,
    onAndroid() ? opt('info', 'My TV is not found', 'Smart View, Miracast and other ways to reach the TV.', () => { castHelp(null); return false; }) : null,
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

// Church logo in the top-right corner (replaces any browser cast icon visually).
const churchLogo = h('img.church-logo', { alt: 'Church logo', src: 'icons/favicon.svg' });
topIcons.appendChild(churchLogo);
// Only when the logo itself changes (colour changes must not make a new picture URL each time).
let logoShown = undefined, logoUrl = null;
async function refreshChurchLogo() {
  const id = settings.v.display.logo || null;
  if (id === logoShown) return;
  logoShown = id;
  let src = 'icons/favicon.svg', url = null;
  if (id) {
    try { const rec = await db.get('files', id); if (rec && rec.blob) src = url = URL.createObjectURL(rec.blob); } catch (e) { /* default icon */ }
  }
  if (logoShown !== id) { if (url) URL.revokeObjectURL(url); return; } // changed again meanwhile
  churchLogo.src = src;
  if (logoUrl) URL.revokeObjectURL(logoUrl);
  logoUrl = url;
}
refreshChurchLogo();
settings.on('change:display', (path) => { if (path === 'display.logo' || path === '*') refreshChurchLogo(); });
settings.on('change', (path) => { if (path === '*') refreshChurchLogo(); });
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
    ['B  or  .', 'Black screen (press again to return)'], ['L', 'Show logo'], ['Esc  or  C', 'Clear the screen'], ['M', 'Hymn music: play / pause'],
    ['/  or  Ctrl+K', 'Go to a Bible reference or hymn number'], ['Alt+1 … Alt+9', 'Switch tabs'],
    ['Space (video live)', 'Play / pause'], ['F (on the display)', 'Toggle full screen'],
    ['Clicker', 'Page Down / Page Up work even while typing in a box; with nothing on screen, next shows the Next item'],
  ];
  ui.modal({ title: 'Keyboard and clicker shortcuts', body: h('div.col', h('div.form', rows.map(([k, d]) => [h('label', h('kbd', k)), h('span', d)])),
    h('div.row', h('button.btn', { type: 'button', onclick: () => { ui.closeModal(); clickerSetup(); } }, icon('settings'), h('span', 'Clicker setup and test…')))) });
}
function clickerSetup() { openClickerSetup({ version: VERSION });
}

// Presentation clickers are keyboards that send Page Down / Page Up (some send arrows, "." or B for black, F5 /
// Shift+F5 to start and Esc to end). They must work whatever has the keyboard focus, like in PowerPoint:
//  - Page Down / Page Up mean nothing in a one-line box or a list, so they always move the slides, even when a
//    search box or a dropdown has the focus, or a dialog is open (only a multi-line text box keeps them).
//  - A box the app focused by itself (Bible reference, hymn search) that is still empty also lets the other
//    clicker keys through: arrows, "." (black screen), Esc and Space. Letters still type normally.
const CLICK_NEXT = new Set(['PageDown']), CLICK_PREV = new Set(['PageUp']);
const QUIET_KEYS = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', '.', 'Escape', ' ']);
let quietKey = false;
// Capture phase: see whether the box was focused by the app before the box's own handler clears that mark.
document.addEventListener('keydown', (e) => {
  const t = e.target;
  quietKey = !!(t && t.classList && t.classList.contains('quiet-focus') && t.tagName === 'INPUT' && !t.value);
}, true);
const inBigText = (t) => !!(t && (t.isContentEditable || t.tagName === 'TEXTAREA'));
let endPressAt = 0;

/** Clicker "next" with nothing more in the item on screen (or nothing on screen): show what is Next. */
function clickerNext() {
  if (!live.cue) {
    if (live.staged) { doPresent(); return; }
    ui.toast('Nothing is selected yet. Pick something in a tab; then the clicker’s next button shows it.', '', 4000);
    return;
  }
  const atEnd = live.cue.deck.kind !== 'video' && live.index >= live.count() - 1 && !live.cue.extend && !live.cue.autoLoop;
  if (atEnd && live.staged && !live.sameAsLive() && live.staged.id !== live.cue.id) {
    // Last slide: a second press within 4 seconds moves on to the item waiting on the Next screen.
    if (Date.now() - endPressAt < 4000) { endPressAt = 0; doPresent(); return; }
    endPressAt = Date.now();
    ui.toast('End of “' + live.cue.title + '”. Press next again to show: ' + live.staged.title, '', 4000);
    return;
  }
  live.next();
}

function doAction(act) {
  if (act === 'next') clickerNext();
  else if (act === 'prev') live.prev();
  else if (act === 'black') live.setBlank('black');
  else if (act === 'present') doPresent();
  else if (act === 'clear') live.clear();
}
// Keys a keyboard sends all the time: never worth a "clicker key not used" hint.
const PLAIN = /^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|NumLock|ScrollLock|Tab|Enter|Backspace|Delete|Insert|ContextMenu|Dead|Compose|F(?:[1-9]|1[0-2])|Home|End|Arrow\w+|Page\w+|Escape|AudioVolume\w+|Print|PrintScreen|Pause)$/;
let hinted = false;

function handleKey(e, remote) {
  const k = e.key;
  const t = remote ? null : e.target;
  const sig = (remote && e.sig) || sigOfKey(e);
  if (clicker.testing) { if (remote) clicker.emit('event', { sig, from: 'projector window' }); return remote; }
  // A taught button, or one of the odd keys some clickers send (Browser Forward/Back, media keys, mouse on the projector).
  const taughtAct = actionFor(sig) || (remote && /^(mouse|wheel):/.test(sig) ? builtinAction(sig, true) : null);
  if (taughtAct && !inBigText(t)) { if (t && t.tagName === 'SELECT') t.blur(); doAction(taughtAct); return true; }
  const pager = (CLICK_NEXT.has(k) || CLICK_PREV.has(k)) && !inBigText(t) && !e.ctrlKey && !e.metaKey && !e.altKey;
  if (pager) {
    if (t && t.tagName === 'SELECT') t.blur(); // otherwise the dropdown would also change
    if (CLICK_NEXT.has(k)) clickerNext(); else live.prev();
    return true;
  }
  if (!remote && ui.modalOpen() && k !== 'F5') { if (k === 'Escape') { ui.closeModal(); return true; } return false; }
  const quiet = !remote && quietKey && QUIET_KEYS.has(k);
  const typing = !remote && !quiet && isTyping(e);
  const ctrl = e.ctrlKey || e.metaKey;
  if (k === 'F5' || (ctrl && k === 'Enter')) { doPresent(); return true; }
  if (typing) return false;
  if (quiet && t && t.blur) t.blur();
  if (!remote && ((ctrl && (k === 'k' || k === 'K')) || k === '/')) { quick.focus(); return true; }
  if (e.altKey && /^[1-9]$/.test(k)) { const tb = TABS.filter(Boolean)[+k - 1]; if (tb) showTab(tb.id); return true; }
  if (ctrl || e.altKey) return false;
  const kind = live.cue && live.cue.deck.kind;
  switch (k) {
    case 'ArrowRight': case 'ArrowDown': live.next(); return true;
    case 'ArrowLeft': case 'ArrowUp': live.prev(); return true;
    case ' ': if (kind === 'video') live.mediaCmd('toggle'); else live.next(); return true;
    case 'Home': live.go(0); return true;
    case 'End': live.go(live.count() - 1); return true;
    case 'b': case 'B': case '.': live.setBlank('black'); return true;
    case 'w': case 'W': live.setBlank('black'); return true; // some clickers send W for a "white/blank" screen
    case 'l': case 'L': live.setBlank('logo'); return true;
    case 'Escape': case 'c': case 'C': live.clear(); return true;
    case 'm': case 'M': getTab('hymns').then((tb) => tb.musicKey && tb.musicKey()); return true;
    case '?': showHelp(); return true;
  }
  if (!hinted && k && k.length > 1 && !PLAIN.test(k) && !isTyping(e)) {
    hinted = true;
    ui.toast(h('span', 'A button sent “' + k + '”, which SDA Sabbath does not use yet. ', h('button.btn.sm', { type: 'button', onclick: () => clickerSetup() }, 'Clicker setup')), '', 9000);
  }
  return false;
}
// Mouse “back / forward” side buttons (some clickers send these): change slides instead of leaving the app.
const onSideButton = (e) => {
  if (e.button !== 3 && e.button !== 4) return;
  e.preventDefault();
  if (clicker.testing) return;
  const act = actionFor(sigOfMouse(e.button));
  if (act) doAction(act);
};
document.addEventListener('mouseup', onSideButton);
document.addEventListener('auxclick', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
// The keyboard follows the mouse back out of an embedded web page, so the clicker works again.
document.addEventListener('pointermove', () => {
  const a = document.activeElement;
  if (a && a.tagName === 'IFRAME') { a.blur(); window.focus(); }
}, { passive: true });
document.addEventListener('keydown', (e) => { if (handleKey(e, false)) e.preventDefault(); });
live.on('remote-key', (m) => handleKey({ key: m.key, code: m.code, sig: m.sig, ctrlKey: m.ctrl, metaKey: false, altKey: m.alt, shiftKey: m.shift, target: null }, true));

// ------------------------------------------------------------ monitors & control bar
createMonitors($('#monitors'));
createControlBar($('#ctrlbar'), getTab);

// ------------------------------------------------------------ keep the control screen awake during a service (phones)
let wake = null;
async function keepAwake() {
  if (wake && !wake.released) return; // one lock is enough
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible' && (live.cue || link.kind)) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
}
document.addEventListener('visibilitychange', keepAwake);
live.on('live', keepAwake);

// ------------------------------------------------------------ storage problems
// Saving not possible at all (private window, storage blocked): say so once; the app still works.
window.addEventListener('selah-storage', () => ui.toast('This browser is not letting SDA Sabbath save (private window or storage turned off). Everything works, but changes are lost when it closes.', 'err', 10000));
// A full disk, or any other failure nobody waited for: tell the operator plainly instead of failing silently.
let fullShown = 0;
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  const name = r && r.name, msg = (r && r.message) || String(r || '');
  if (name === 'QuotaExceededError' || /quota|disk|space/i.test(msg)) {
    e.preventDefault();
    if (Date.now() - fullShown > 15000) { fullShown = Date.now(); ui.toast('This device is out of storage space, so the last change was not saved. Delete unused slides or videos (or free space on the device).', 'err', 10000); }
  }
});

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
