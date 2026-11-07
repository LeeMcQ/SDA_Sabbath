// Moving to the new address (ssdesk.online). A browser keeps each address's data apart, so plans, hymnbooks,
// Bibles, banners and settings saved at the previous address stay there. Once the new address answers, the copy at the
// old address offers to carry everything over in one step: it makes a backup and hands it to the new address
// (the new address must be opened from here, and checks where the backup came from). Slides are included;
// videos are not (they are often large: add them again, or keep using them at the old address).
import { h } from './core/util.js';
import { modal, toast, confirmBox, closeModal } from './core/ui.js';
import { lsKey } from './core/storens.js';
import { NEW_SITE, NEW_HOST, OLD_ORIGIN, onOldSite, onNewSite } from './core/site.js';

const NEW_ORIGIN = new URL(NEW_SITE).origin;
const LATER = lsKey('move-later');

/** At the old address: when the new address answers, offer the move (not more than once a day after "Not now"). */
export async function checkMove() {
  if (!onOldSite()) return;
  try { if (Date.now() - (+localStorage.getItem(LATER) || 0) < 24 * 3600 * 1000) return; } catch (e) { /* */ }
  if (navigator.onLine === false) return;
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(NEW_SITE + 'manifest.webmanifest', { cache: 'no-store', signal: c.signal }).finally(() => clearTimeout(t));
    if (!r.ok) return;
  } catch (e) { return; }   // not live yet
  offerMove();
}

export function offerMove() {
  modal({ title: 'Sabbath Service Desk has a new address', body: h('div.col', { style: { gap: '10px' } },
    h('p', h('b', NEW_HOST), ' — Sabbath Service Desk. From now on, open Sabbath Service Desk there (and install it there).'),
    h('p', 'Your plans, hymnbooks, Bibles, banners, slides and settings are saved at this old address. ', h('b', 'Move my data'), ' copies them to the new address in one step. Videos are not copied: add them again there.'),
    h('p.note', 'Keep this window open until the new address says it is done.')),
  actions: [
    { label: 'Not now', onclick: () => { try { localStorage.setItem(LATER, String(Date.now())); } catch (e) { /* */ } } },
    { label: 'Only open the new address', onclick: () => { window.open(NEW_SITE, '_blank', 'noopener'); } },
    { label: 'Move my data', primary: true, onclick: () => { moveNow(); return false; } },
  ] });
}

async function moveNow() {
  closeModal();
  const say = (t) => toast(t, '', 4000);
  say('Making a copy of your data…');
  let blob;
  try {
    const b = await import('./core/backup.js');
    blob = await b.buildBackup({ slides: true, videos: false }, (t) => { if (typeof t === 'string') say(t); });
    if (blob && blob.blob) blob = blob.blob;
  } catch (e) { toast('Could not copy your data: ' + (e.message || e) + '. Use Settings → Backup instead.', 'err', 9000); return; }
  const w = window.open(NEW_SITE + '#move', 'ssdesk-move');
  if (!w) { toast('The new address could not open (pop-up blocked?). Allow pop-ups for this site and try again.', 'err', 9000); return; }
  let sent = false;
  const onMsg = (ev) => {
    if (ev.origin !== NEW_ORIGIN || ev.source !== w || !ev.data || typeof ev.data !== 'object') return;
    if (ev.data.t === 'move-ready' && !sent) { sent = true; w.postMessage({ t: 'move-data', blob }, NEW_ORIGIN); say('Sending your data to ' + NEW_HOST + '…'); }
    if (ev.data.t === 'move-done') {
      window.removeEventListener('message', onMsg);
      modal({ title: 'Moved ✓', body: h('p', 'Your data is at ', h('b', NEW_HOST), ' now. Use that address from now on, and install it there (the install icon in the address bar, or the browser menu). This old copy keeps working too.'),
        actions: [{ label: 'OK', primary: true }] });
    }
    if (ev.data.t === 'move-fail') { window.removeEventListener('message', onMsg); toast('The new address could not take the data: ' + (ev.data.why || 'unknown') + '. Use Settings → Backup instead.', 'err', 9000); }
  };
  window.addEventListener('message', onMsg);
}

/** At the new address, opened by the old one with #move: take the backup it sends, after the person agrees. */
export function receiveMove() {
  if (!onNewSite() || !/#move$/.test(location.hash) || !window.opener) return false;
  const from = window.opener;
  history.replaceState(null, '', location.pathname + location.search);
  const onMsg = async (ev) => {
    if (ev.origin !== OLD_ORIGIN || ev.source !== from || !ev.data || ev.data.t !== 'move-data' || !(ev.data.blob instanceof Blob)) return;
    window.removeEventListener('message', onMsg);
    const b = await import('./core/backup.js');
    let pkg;
    try { pkg = await b.readBackup(ev.data.blob); } catch (e) { from.postMessage({ t: 'move-fail', why: e.message }, OLD_ORIGIN); return; }
    const st = pkg.manifest.stats || {};
    const w = document.querySelector('.welcome'); if (w) w.hidden = true;   // the first-start setup waits
    const ok = await confirmBox('Bring in your data from the old address?', 'From the old address: ' + [st.plans + ' plans', st.hymnbooks + ' hymnbooks', st.bibles + ' Bibles', st.banners + ' banners', st.slides + ' slide decks'].join(', ') + ', and the settings. The app restarts afterwards.', 'Bring it in');
    if (!ok) { if (w) w.hidden = false; from.postMessage({ t: 'move-fail', why: 'not accepted' }, OLD_ORIGIN); return; }
    try {
      await b.restoreBackup(pkg, () => {});
      from.postMessage({ t: 'move-done' }, OLD_ORIGIN);
      toast('Your data is here. Restarting…', 'ok', 3000);
      setTimeout(() => location.reload(), 1500);
    } catch (e) { from.postMessage({ t: 'move-fail', why: e.message }, OLD_ORIGIN); toast('Could not bring in the data: ' + e.message, 'err', 8000); }
  };
  window.addEventListener('message', onMsg);
  from.postMessage({ t: 'move-ready' }, OLD_ORIGIN);
  return true;
}
