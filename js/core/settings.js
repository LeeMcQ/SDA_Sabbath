// Settings: small, synchronous, stored in localStorage.
import { emitter, lowPowerDevice } from './util.js';

const KEY = 'selah.settings.v1'; // kept from the app's first name: existing settings carry over

export const DEFAULTS = {
  app: { theme: 'dark', railSide: 'left', monitors: true, lowPower: null, lastTab: 'bible', clickerKeys: true },
  display: {
    font: 'sans', fg: '#ffffff', bg: '#000000', accent: '#f2cf7a', shadow: true, align: 'center',
    pad: 96, minFont: 58, maxFont: 150, fade: 250, transition: 'fade', aspect: 'auto',
    bgImage: null, bgDim: 0.45, logo: null, logoText: '', clearShows: 'background', weight: 'bold',
  },
  bible: {
    primary: 'kjv', parallel: '', parallelLayout: 'cols', perSlide: 'auto', numbers: true, redLetter: false,
    italics: false, refPos: 'bottom', continue: true, history: [],
  },
  hymns: { book: 'sda-sample', chorusRepeat: true, titleSlide: true, showNumber: true, maxLines: 0, caps: false, refPos: 'bottom' },
  slides: { fit: 'contain', autoSec: 8, quality: 0.9 },
  video: { volume: 1, autoNext: true, repeat: 'off', fit: 'contain' },
  screen: { cursor: 'never', audio: false },
  companion: { url: '', pin: '' },
  ai: { provider: 'openai', apiKey: '', model: '' },
};

function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if (over && typeof over === 'object' && !Array.isArray(over)) {
    for (const k in over) {
      if (base && typeof base[k] === 'object' && base[k] && !Array.isArray(base[k])) out[k] = merge(base[k], over[k]);
      else out[k] = over[k];
    }
  }
  return out;
}

function load() {
  let v;
  try { v = merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { v = merge(DEFAULTS, {}); }
  // v1.1: the projector margin default grew from 80 to 96 px (safe area for cropping projectors).
  // Move people still on the old default along once; a margin they chose themselves is kept.
  if (!v.app.rev || v.app.rev < 2) {
    if (v.display.pad === 80) v.display.pad = 96;
    v.app.rev = 2;
  }
  return v;
}

/**
 * Validate settings coming from an imported backup: only known sections, values must match the
 * default's type, unknown keys may only be short primitives. The AI key is never imported.
 */
export function sanitizeImportedSettings(raw) {
  function walk(base, over, depth) {
    const out = {};
    if (!over || typeof over !== 'object' || Array.isArray(over) || depth > 4) return out;
    for (const k of Object.keys(over)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const b = base ? base[k] : undefined, v = over[k];
      if (b && typeof b === 'object' && !Array.isArray(b)) { out[k] = walk(b, v, depth + 1); continue; }
      if (Array.isArray(b)) { if (Array.isArray(v)) out[k] = v.filter((x) => x == null || ['string', 'number', 'boolean', 'object'].includes(typeof x)).slice(0, 200); continue; }
      if (b === null || b === undefined) { if (v === null || (typeof v === 'string' && v.length <= 200) || typeof v === 'number' || typeof v === 'boolean') out[k] = v; continue; }
      if (typeof v === typeof b && (typeof v !== 'string' || v.length <= 2000)) out[k] = v;
    }
    return out;
  }
  const out = walk(DEFAULTS, raw, 0);
  if (out.ai) delete out.ai.apiKey;
  if (out.companion && out.companion.url && !/^(https?|wss?):\/\//i.test(out.companion.url)) out.companion.url = '';
  for (const c of ['fg', 'bg', 'accent']) if (out.display && out.display[c] != null && !/^#[0-9a-f]{3,8}$/i.test(out.display[c])) delete out.display[c];
  return out;
}

/** Settings for a backup file: never includes the AI key. */
export function exportableSettings(v) {
  const o = JSON.parse(JSON.stringify(v));
  if (o.ai) o.ai.apiKey = '';
  return o;
}

export const settings = emitter({ v: load() });

settings.get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), settings.v);

settings.set = (path, value) => {
  const keys = path.split('.');
  let o = settings.v;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] = o[keys[i]] || {};
  o[keys[keys.length - 1]] = value;
  settings.save();
  settings.emit('change', path, value);
  settings.emit('change:' + keys[0], path, value);
};

settings.save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings.v)); } catch (e) { /* private mode */ } };

settings.reset = (section) => {
  if (section) settings.v[section] = merge(DEFAULTS[section], {});
  else settings.v = merge(DEFAULTS, {});
  settings.save();
  settings.emit('change', section || '*');
  if (section) settings.emit('change:' + section, section);
};

/** Effective low-power flag: explicit choice wins, else device heuristic. */
settings.lowPower = () => {
  const v = settings.v.app.lowPower;
  return v == null ? lowPowerDevice() : !!v;
};

/** Style object sent to the display (and used by the monitors). */
settings.displayStyle = () => {
  const d = settings.v.display;
  return {
    font: d.font, fg: d.fg, bg: d.bg, accent: d.accent, shadow: d.shadow, align: d.align, pad: d.pad,
    minFont: d.minFont, maxFont: d.maxFont, fade: settings.lowPower() || d.transition === 'cut' ? 0 : d.fade,
    bgImage: d.bgImage, bgDim: d.bgDim, logo: d.logo, logoText: d.logoText, clearShows: d.clearShows, weight: d.weight,
  };
};
