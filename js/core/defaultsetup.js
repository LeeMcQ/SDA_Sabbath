// First-start defaults for a brand-new device: the screen look, hymn music sound, banners, service plan templates
// and so on, as the maintainer set them up (data/default-setup.json: no pictures, passwords or room codes).
// Applied once, and only when this device has not been set up or customised yet: a church that already has
// its own settings keeps them exactly as they are.
import { settings, DEFAULTS } from './settings.js';
import { db } from './db.js';
import { lsKey } from './storens.js';

const DONE = lsKey('defaults.v1');
const STARTER = lsKey('starter.v1');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Has anything the defaults would set been changed already? Then nothing is applied. */
function customised(setup) {
  for (const [sec, vals] of Object.entries(setup.settings || {})) {
    for (const k of Object.keys(vals)) {
      const cur = settings.v[sec] && settings.v[sec][k], def = DEFAULTS[sec] && DEFAULTS[sec][k];
      if (!same(cur, def)) return true;
    }
  }
  return false;
}

/** Apply the defaults if this is a new device. Resolves to true when they were applied. */
export async function applyDefaultSetup() {
  try {
    if (localStorage.getItem(DONE)) { if (localStorage.getItem(DONE) !== 'skipped') runStarter(); return false; }
    // An existing church (setup done before) keeps its own settings; nothing is marked, nothing is changed.
    if (settings.v.app.setupDone) { localStorage.setItem(DONE, 'skipped'); return false; }
    const r = await fetch('data/default-setup.json', { cache: 'no-cache' });
    if (!r.ok) return false;                      // try again next start
    const setup = await r.json();
    if (customised(setup)) { localStorage.setItem(DONE, 'skipped'); return false; }
    for (const [sec, vals] of Object.entries(setup.settings || {})) {
      for (const [k, v] of Object.entries(vals)) settings.set(sec + '.' + k, v);
    }
    // Banners, loops and service plan templates (only where this device has none yet).
    for (const [key, val] of Object.entries(setup.kv || {})) {
      const old = await db.get('kv', key).catch(() => null);
      if (old == null) await db.put('kv', key, val);
    }
    localStorage.setItem(DONE, String(Date.now()));
    setup.downloads && queueDownloads(setup.downloads);
    runStarter();
    return true;
  } catch (e) { return false; }                   // offline or blocked: the app starts as usual, defaults next time
}

/** Bibles the maintainer had downloaded: fetched quietly once, when online, not on weak (low-power) devices. */
function queueDownloads(list) {
  if (settings.lowPower && settings.lowPower()) return;
  setTimeout(async () => {
    if (navigator.onLine === false) return;
    try {
      const src = await import('./biblesources.js');
      const items = src.getbibleItems().concat(src.corpusItems());
      for (const want of list) {
        const t = items.find((x) => x.src === want.src && String(x.abbr).toLowerCase() === String(want.abbr).toLowerCase());
        if (!t) continue;
        try { await src.addBible(t); window.dispatchEvent(new CustomEvent('selah-bibles')); } catch (e) { /* already there, or no internet: not needed */ }
      }
    } catch (e) { /* optional */ }
  }, 25000);
}

// ------------------------------------------------------------ the starter plans, slides and video
// Plans, banners (with their pictures), one slide deck and one video that every new device starts with, in
// data/starter/starter.sdabackup (a backup file, not part of the offline copy: it is fetched once, on first start).
let starterP = null;
/** Resolves when the starter pack is installed (or after `ms`): the tabs that show it wait for this. */
export function whenStarter(ms = 45000) {
  return starterP ? Promise.race([starterP, new Promise((r) => setTimeout(r, ms))]) : Promise.resolve();
}
function runStarter() {
  if (starterP || localStorage.getItem(STARTER)) return;
  starterP = installStarter().catch(() => { /* offline or blocked: tried again next start */ }).then(() => { starterP = null; });
}
async function installStarter() {
  const r = await fetch('data/starter/starter.sdabackup');
  if (!r.ok) return;
  const { readBackup } = await import('./backup.js');
  const { manifest: m, entries } = await readBackup(await r.blob());
  const dec = (v, depth = 0) => {
    if (v == null || typeof v !== 'object' || depth > 30) return v;
    if (typeof v.$blob === 'string') { const b = entries.get(v.$blob); return b ? b.slice(0, b.size, v.type || '') : null; }
    if (Array.isArray(v)) return v.map((x) => dec(x, depth + 1));
    const o = {};
    Object.keys(v).forEach((k) => { o[k] = dec(v[k], depth + 1); });
    return o;
  };
  const st = m.stores || {};
  // Nothing the church made is replaced: plans, files and pictures are added only where that id is free.
  for (const [k, v] of st.plans || []) if ((await db.get('plans', k).catch(() => null)) == null) await db.put('plans', k, dec(v));
  for (const f of m.files || []) if (f && f.id && (await db.get('files', f.id).catch(() => null)) == null) await db.put('files', f.id, dec(f));
  for (const [k, v] of m.renders || []) if ((await db.get('renders', k).catch(() => null)) == null) await db.put('renders', k, dec(v));
  for (const [k, v] of st.kv || []) {
    const old = await db.get('kv', k).catch(() => null);
    if (k === 'banners' && Array.isArray(old) && old.length) {
      // The banners the defaults put here (no pictures) get their pictures; banners the church made itself stay as they are.
      const mine = new Set((v || []).map((x) => x && x.id));
      if (old.some((x) => x && !mine.has(x.id))) continue;
    } else if (old != null) continue;
    await db.put('kv', k, dec(v));
  }
  localStorage.setItem(STARTER, String(Date.now()));
}
