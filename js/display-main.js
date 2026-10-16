// Boot for display.html. Works with three kinds of controller:
//   1. the control window that opened us (postMessage + direct calls for screen-share streams)
//   2. a phone/PC using the Presentation API (Chromecast / wireless displays)
//   3. the SDA Sabbath companion on the LAN (WebSocket), e.g. a smart-TV browser or second PC
import { createDisplay } from './display/display.js';
import { createDecoder, createEncoder } from './core/wire.js';

const params = new URLSearchParams(location.search);
const root = document.getElementById('root');
const outs = new Set();
const post = (m) => outs.forEach((f) => { try { f(m); } catch (e) { /* closed */ } });
const disp = createDisplay(root, { post });
window.SelahDisplay = disp; // direct API used by the opener window (streams, snapshots)

// 1) Opener / any same-origin control window that messages us
const winOuts = new Map();
function addWin(w) {
  if (!w || w === window || winOuts.has(w)) return;
  const f = (m) => { if (w.closed) { outs.delete(f); winOuts.delete(w); return; } w.postMessage(m, location.origin); };
  winOuts.set(w, f); outs.add(f);
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || !e.data.t) return;
  addWin(e.source);
  disp.handle(e.data);
});
try { addWin(window.opener); } catch (e) { /* */ }
// Lets a reloaded control tab find this window again.
try {
  const bc = new BroadcastChannel('selah-display');
  bc.onmessage = (e) => { if (e.data && e.data.t === 'who') bc.postMessage({ t: 'here' }); };
  bc.postMessage({ t: 'here' });
} catch (e) { /* old browser */ }

// 2) Presentation API receiver (Cast / wireless display)
if (navigator.presentation && navigator.presentation.receiver) {
  navigator.presentation.receiver.connectionList.then((list) => {
    const setup = (conn) => {
      conn.binaryType = 'arraybuffer';
      const dec = createDecoder((m) => disp.handle(m));
      const enc = createEncoder((s) => conn.send(s), (b) => conn.send(b));
      outs.add(enc);
      conn.onmessage = (e) => (typeof e.data === 'string' ? dec.text(e.data) : dec.binary(e.data));
      let gone = false;
      conn.onclose = conn.onterminate = () => { if (gone) return; gone = true; outs.delete(enc); live--; endSoon(); };
      live++; clearTimeout(endT);
      disp.sayHello();
    };
    // The controlling app was closed (or lost): clear the screen and end the cast, so the TV does not keep
    // showing the last slide. A short wait lets a dropped Wi-Fi connection come back first.
    let live = 0, endT = null;
    const endSoon = () => {
      clearTimeout(endT);
      if (live > 0) return;
      try { disp.handle({ t: 'clear', mode: 'black' }); } catch (e) { /* */ }
      endT = setTimeout(() => { if (live <= 0) { try { window.close(); } catch (e) { /* */ } } }, 8000);
    };
    list.connections.forEach(setup);
    list.onconnectionavailable = (e) => setup(e.connection);
  });
}

// 3) Companion WebSocket
if (params.get('via') === 'ws') {
  let ws = null, enc = null, wait = 1000;
  const connect = () => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(proto + '//' + location.host + '/ws?role=display&room=' + encodeURIComponent(params.get('room') || 'main') + '&pin=' + encodeURIComponent(params.get('pin') || ''));
    ws.binaryType = 'arraybuffer';
    const dec = createDecoder((m) => disp.handle(m));
    ws.onopen = () => {
      wait = 1000;
      enc = createEncoder((s) => ws.send(s), (b) => ws.send(b));
      outs.add(enc);
      disp.sayHello();
    };
    ws.onmessage = (e) => (typeof e.data === 'string' ? dec.text(e.data) : dec.binary(e.data));
    ws.onclose = () => { if (enc) outs.delete(enc); enc = null; setTimeout(connect, wait); wait = Math.min(wait * 2, 10000); };
  };
  connect();
}

// ---------------------------------------------------------------- full screen, keys, wake lock
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
async function goFull() {
  const el = document.documentElement;
  try {
    let screen;
    if ('getScreenDetails' in window) {
      try { const sd = await window.getScreenDetails(); screen = sd.currentScreen; } catch (e) { /* no permission */ }
    }
    if (el.requestFullscreen) await el.requestFullscreen(screen ? { screen, navigationUI: 'hide' } : { navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch (e) { /* user must click */ }
}
function toggleFull() { if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else goFull(); }

root.addEventListener('click', () => { if (!isFull()) goFull(); disp.hint(false); disp.unlockAudio(); });
root.addEventListener('dblclick', toggleFull);
document.addEventListener('fullscreenchange', () => disp.hint(false));

const FORWARD = new Set(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End',
  'b', 'B', '.', 'Escape', 'F5', 'Enter', 'c', 'C', 'l', 'L', 'w', 'W']);
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFull(); return; }
  if (FORWARD.has(e.key)) {
    if (e.key !== 'Escape' || !isFull()) e.preventDefault();
    post({ t: 'key', key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey });
  }
});

let wake = null;
async function keepAwake() {
  if (wake && !wake.released) return; // one lock is enough
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
}
document.addEventListener('visibilitychange', keepAwake);
keepAwake();

if (!params.get('via') && !isFull()) disp.hint(true);
disp.sayHello();
