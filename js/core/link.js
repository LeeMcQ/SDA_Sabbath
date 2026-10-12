// Connection from the control screen to the output display.
//   window  – a pop-up on the extended screen (PC). Fastest: direct object hand-over, no copies.
//   self    – this device becomes the screen (phone/tablet on HDMI or screen mirroring)
//   cast    – Presentation API (Chromecast / wireless display from Chrome)
//   socket  – SDA Sabbath companion on the LAN (TV browser or second PC shows display.html?via=ws)
import { emitter, h } from './util.js';
import { createEncoder, createDecoder } from './wire.js';
import { settings } from './settings.js';

const WIN_NAME = 'selah-display';
export const link = emitter({ kind: null, ready: false, info: { w: 1920, h: 1080, label: '' }, win: null, self: null });

let sendImpl = null;
let lastStream = null;
let pollT = null;
let ws = null, wsEnc = null, wsTimer = null;
let castConn = null, castEnc = null;
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('selah-display') : null;
let displayAlive = false;
if (bc) {
  bc.onmessage = (e) => { if (e.data && e.data.t === 'here') { displayAlive = true; link.emit('found'); } };
  bc.postMessage({ t: 'who' });
}

function setState(kind, ready, label) {
  link.kind = kind; link.ready = ready;
  if (label != null) link.info.label = label;
  link.emit('state');
}

function onDisplayMsg(m) {
  if (!m || !m.t) return;
  if (m.t === 'hello') {
    link.info.w = m.w; link.info.h = m.h;
    if (!link.ready) setState(link.kind, true);
    link.emit('hello', m);
  }
  link.emit('msg', m);
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !link.win || e.source !== link.win) return;
  onDisplayMsg(e.data);
});

link.send = (msg) => { if (sendImpl) sendImpl(msg); };
link.aspect = () => {
  const a = settings.v.display.aspect;
  if (a && a !== 'auto') { const [x, y] = a.split(':').map(Number); if (x && y) return x / y; }
  return link.info.w && link.info.h ? link.info.w / link.info.h : 16 / 9;
};

/** Direct (same-memory) access to the display, available for window and self links. */
link.direct = () => {
  if (link.kind === 'self' && link.self) return link.self.display;
  if (link.kind === 'window' && link.win && !link.win.closed) { try { return link.win.SelahDisplay || null; } catch (e) { return null; } }
  return null;
};

link.setStream = (stream) => {
  lastStream = stream || null;
  const d = link.direct();
  if (d) { d.setStream(lastStream); return true; }
  return false;
};
link.canStream = () => link.kind === 'window' || link.kind === 'self';

// ------------------------------------------------------------ window on an extended screen
async function pickScreen(allowPrompt) {
  if (!('getScreenDetails' in window)) return null;
  try {
    let state = 'prompt';
    try { state = (await navigator.permissions.query({ name: 'window-management' })).state; } catch (e) { /* older name */ }
    if (state === 'denied' || (state !== 'granted' && !allowPrompt)) return null;
    const sd = await window.getScreenDetails();
    const want = settings.v.display.screenLabel;
    const others = sd.screens.filter((s) => s !== sd.currentScreen);
    return (want && sd.screens.find((s) => s.label === want)) || others[0] || null;
  } catch (e) { return null; }
}

export async function listScreens() {
  if (!('getScreenDetails' in window)) return null;
  try { const sd = await window.getScreenDetails(); return { screens: sd.screens, current: sd.currentScreen }; }
  catch (e) { return null; }
}

link.openWindow = async ({ prompt = false } = {}) => {
  link.close(true);
  const url = new URL('display.html', location.href).href;
  // Reuse an already-open display window (e.g. after this control page was reloaded).
  let w = null;
  const scr = await pickScreen(prompt);
  let features = 'popup=yes';
  if (scr) features += ',left=' + scr.availLeft + ',top=' + scr.availTop + ',width=' + scr.availWidth + ',height=' + scr.availHeight + ',fullscreen=yes';
  else features += ',width=960,height=540';
  if (displayAlive) {
    try { w = window.open('', WIN_NAME, features); } catch (e) { w = null; }
    if (w && !(() => { try { return w.SelahDisplay; } catch (e) { return null; } })()) { try { w.location.href = url; } catch (e) { /* */ } }
  }
  if (!w) w = window.open(url, WIN_NAME, features);
  if (!w) { link.emit('blocked'); return false; }
  link.win = w;
  sendImpl = (m) => { if (!w.closed) w.postMessage(m, location.origin); };
  setState('window', false, scr ? scr.label || 'Second screen' : 'Display window');
  clearInterval(pollT);
  pollT = setInterval(() => { if (w.closed) { clearInterval(pollT); if (link.win === w) { link.win = null; sendImpl = null; setState(null, false, ''); } } }, 1000);
  // Handshake: ask until the display answers (its page may still be loading).
  let tries = 0;
  const ask = () => { if (link.win !== w || link.ready || tries++ > 40) return; sendImpl({ t: 'hello?' }); setTimeout(ask, 250); };
  ask();
  if (lastStream) setTimeout(() => link.setStream(lastStream), 600);
  return true;
};

// ------------------------------------------------------------ this device
link.openSelf = async (createDisplay) => {
  link.close(true);
  const wrap = h('div.self-display');
  const close = h('button.btn.self-close', { type: 'button', onclick: () => link.close() }, 'Exit display');
  wrap.appendChild(close);
  document.body.appendChild(wrap);
  const display = createDisplay(wrap, { post: (m) => setTimeout(() => onDisplayMsg(m), 0), self: true });
  link.self = { wrap, display };
  sendImpl = (m) => display.handle(m);
  setState('self', true, 'This device');
  try { await (wrap.requestFullscreen ? wrap.requestFullscreen({ navigationUI: 'hide' }) : wrap.webkitRequestFullscreen && wrap.webkitRequestFullscreen()); } catch (e) { /* */ }
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) { /* */ }
  const onFs = () => { if (!document.fullscreenElement && link.kind === 'self') link.close(); };
  document.addEventListener('fullscreenchange', onFs);
  link.self.onFs = onFs;
  // Swipe left/right on the screen to move through slides. A long press (or two-finger tap) shows
  // "Exit display" for a few seconds; otherwise it never appears on the hall screen.
  let sx = null, sy = null, holdT = null, hideT = null;
  const reveal = () => { wrap.classList.add('reveal'); clearTimeout(hideT); hideT = setTimeout(() => wrap.classList.remove('reveal'), 2500); };
  wrap.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    clearTimeout(holdT);
    if (e.touches.length >= 2) { reveal(); return; }
    holdT = setTimeout(reveal, 650);
  }, { passive: true });
  wrap.addEventListener('touchmove', (e) => {
    if (sx != null && (Math.abs(e.touches[0].clientX - sx) > 12 || Math.abs(e.touches[0].clientY - sy) > 12)) clearTimeout(holdT);
  }, { passive: true });
  wrap.addEventListener('touchend', (e) => {
    clearTimeout(holdT);
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) link.emit('msg', { t: 'key', key: dx < 0 ? 'ArrowRight' : 'ArrowLeft' });
  });
  display.sayHello();
  if (lastStream) display.setStream(lastStream);
  return true;
};

// ------------------------------------------------------------ Cast / wireless display
link.canCast = () => typeof window.PresentationRequest === 'function';
link.openCast = async () => {
  if (!link.canCast()) return false;
  link.close(true);
  const req = new PresentationRequest([new URL('display.html?via=cast', location.href).href]);
  const conn = await req.start();
  castConn = conn;
  conn.binaryType = 'arraybuffer';
  const dec = createDecoder(onDisplayMsg);
  castEnc = createEncoder((s) => conn.send(s), (b) => conn.send(b));
  conn.onmessage = (e) => (typeof e.data === 'string' ? dec.text(e.data) : dec.binary(e.data));
  conn.onclose = conn.onterminate = () => { if (castConn === conn) { castConn = null; sendImpl = null; setState(null, false, ''); } };
  sendImpl = (m) => castEnc(m);
  setState('cast', conn.state === 'connected', 'Cast display');
  conn.onconnect = () => { setState('cast', true); sendImpl({ t: 'hello?' }); };
  if (conn.state === 'connected') sendImpl({ t: 'hello?' });
  return true;
};

// ------------------------------------------------------------ LAN companion
link.connectSocket = (base, pin, room = 'main') => {
  link.close(true);
  const u = new URL(base || location.origin);
  const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = proto + '//' + u.host + '/ws?role=control&room=' + encodeURIComponent(room) + '&pin=' + encodeURIComponent(pin || '');
  let wait = 1000;
  const open = () => {
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const dec = createDecoder(onDisplayMsg);
    ws.onopen = () => {
      wait = 1000;
      wsEnc = createEncoder((s) => ws.send(s), (b) => ws.send(b));
      sendImpl = (m) => wsEnc && wsEnc(m);
      setState('socket', true, 'LAN display (' + u.host + ')');
      sendImpl({ t: 'hello?' });
      link.emit('reconnected');
    };
    ws.onmessage = (e) => (typeof e.data === 'string' ? dec.text(e.data) : dec.binary(e.data));
    ws.onclose = (e) => {
      wsEnc = null;
      if (link.kind !== 'socket') return;
      if (e.code === 4001) { setState(null, false, ''); link.emit('pin-wrong'); return; }
      setState('socket', false);
      wsTimer = setTimeout(open, wait); wait = Math.min(wait * 2, 10000);
    };
  };
  setState('socket', false, 'LAN display (' + u.host + ')');
  open();
};

link.close = (silent) => {
  clearInterval(pollT); clearTimeout(wsTimer);
  const kind = link.kind;
  if (kind === 'window' && link.win && !silent) { try { link.win.close(); } catch (e) { /* */ } }
  if (kind === 'self' && link.self) {
    document.removeEventListener('fullscreenchange', link.self.onFs);
    try { link.self.display.destroy(); } catch (e) { /* */ }
    link.self.wrap.remove(); link.self = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  if (kind === 'cast' && castConn) { try { castConn.terminate(); } catch (e) { /* */ } castConn = null; }
  if (kind === 'socket' && ws) { link.kind = null; try { ws.close(); } catch (e) { /* */ } ws = null; }
  link.win = null;
  sendImpl = null;
  setState(null, false, '');
};
