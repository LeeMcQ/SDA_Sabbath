// "Is the control app still open?" Windows the app opened (projector, stage screen, OBS window) close themselves
// when it was closed for good, so no old slide is left behind. A reload is not a close: the app answers again
// within a few seconds. Event-driven (BroadcastChannel), so a minimised app still answers.
import { APP_SCOPE } from './util.js';

const NAME = 'selah-alive:' + APP_SCOPE;

/** The control app: answer the windows that ask. */
export function answerAlive() {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const bc = new BroadcastChannel(NAME);
    bc.onmessage = (e) => { if (e.data === 'ping') bc.postMessage('pong'); };
  } catch (e) { /* no channel: the windows fall back to watching their opener */ }
}

/** A window the app opened: calls onGone() once the app has not answered for about `secs` seconds. */
export function watchApp(onGone, secs = 12) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  let bc, last = Date.now(), seen = false;
  try { bc = new BroadcastChannel(NAME); } catch (e) { return () => {}; }
  bc.onmessage = (e) => { if (e.data === 'pong') { last = Date.now(); seen = true; } };
  const t = setInterval(() => {
    try { bc.postMessage('ping'); } catch (e) { /* */ }
    if (seen && Date.now() - last > secs * 1000) { clearInterval(t); onGone(); }
  }, 2000);
  return () => clearInterval(t);
}
