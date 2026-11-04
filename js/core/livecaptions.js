// Live translation: English captions from the SDA Sabbath translator on this PC (translator/livetranslate.py).
// The translator listens to the sound desk, recognises the Afrikaans sermon and sends finished English sentences
// here; a sentence that quotes the Bible arrives as the English verse itself. Captions go to the caption line on
// the screen (and stage screens). Verses and hymns the preacher names or quotes are offered to the operator as
// suggestion cards beside Next / Live (js/listen.js: Put on Next / Present): nothing reaches the screen without
// the operator.
import { settings } from './settings.js';
import { h } from './util.js';
import { toast } from './ui.js';

const C = () => settings.v.captions || {};
const base = () => String(C().url || 'http://127.0.0.1:7790').replace(/\/+$/, '');
const listeners = new Set();
let es = null, ctx = null, clearTimer = 0, lastSuggest = {};
// Tools → Listen may use the translator as its ears (offline) while Live translation itself is off: then nothing
// is captioned, the sentences only go to Listen.
let forListen = false;
// The Listen & Translate page keeps the connection open while it is visible (sound meter, model downloads).
let watching = false;
const wanted = () => !!C().on || forListen || watching;

export const captions = {
  state: { connected: false, status: null, lines: [], level: null, busy: '', modelEvent: null, blocked: '' },
  /** Set by Tools → Listen while it uses the translator: (type: 'line' | 'ref' | 'hymn', data) for each event. */
  onEvent: null,
  on(f) { listeners.add(f); return () => listeners.delete(f); },
};
const emit = () => listeners.forEach((f) => { try { f(captions.state); } catch (e) { /* */ } });

function show(text) {
  if (!ctx || !ctx.live || !C().on) return; // captions only while Live translation is on
  ctx.live.caption(text);
  clearTimeout(clearTimer);
  const s = +C().clearAfter || 12;
  if (text) clearTimer = setTimeout(() => ctx.live.caption(''), s * 1000);
}

/** Live translation → Suggestions: every event goes to the suggestion cards (verses, hymns by number or name). */
function toCards(type, data) {
  if (captions.onEvent || C().suggest === false || !C().on || !ctx) return false; // Listen using the translator shows its own
  if (ctx.listener && ctx.listener.suggest) { ctx.listener.suggest(type, data); return true; }
  return false;
}
function suggest(key, label, q) {
  if (captions.onEvent) return; // Tools → Listen shows these as its own cards
  if (ctx && ctx.listener && ctx.listener.suggest) return; // shown as cards (toCards)
  if (C().suggest === false || !C().on || !ctx || !ctx.remoteCommand) return;
  const now = Date.now();
  if (lastSuggest[key] && now - lastSuggest[key] < 60000) return;   // once a minute is enough
  lastSuggest[key] = now;
  const b = h('button.btn.sm.primary', { type: 'button', onclick: () => { ctx.remoteCommand('goto', { q }); t.remove(); } }, 'Set as Next');
  const t = toast(h('span', h('span', 'Preacher: ' + label + ' '), b), '', 15000);
}

// Chrome (142+) asks before a website may reach programs on this computer ("Local network access", called
// "Apps on device" from Chrome 145). Blocked or not answered, the translator looks closed — so ask the browser and
// say the right thing (same check and words as for OBS in obsctl.js).
async function lnaState() {
  if (location.protocol !== 'https:' || !navigator.permissions || !navigator.permissions.query) return null;
  for (const name of ['loopback-network', 'local-network-access']) {
    try { return (await navigator.permissions.query({ name })).state; } catch (e) { /* this browser does not know the name */ }
  }
  return null;
}
export const LNA_BLOCKED = 'Chrome is blocking SDA Sabbath from reaching the translator on this computer. Click the site icon left of the address bar → Site settings → “Local network access” (in newer Chrome “Apps on device”) → Allow. Then reload this page.';
export const LNA_PROMPT = 'Chrome asks whether SDA Sabbath may reach programs on this computer: press Allow in the box under the address bar. (Missed it? Click the site icon left of the address bar → Site settings → “Local network access” / “Apps on device” → Allow, then reload.)';
async function checkBlocked() {
  if (captions.state.connected) return;
  const st = await captions.lnaState();
  const msg = st === 'denied' ? LNA_BLOCKED : st === 'prompt' ? LNA_PROMPT : '';
  if (msg !== captions.state.blocked && !captions.state.connected) { captions.state.blocked = msg; emit(); }
}
captions.checkBlocked = checkBlocked;
captions.lnaState = lnaState;   // tests replace it (the check only answers on https)

function connect() {
  disconnect();
  if (!wanted() || typeof EventSource === 'undefined') return;
  es = new EventSource(base() + '/events');
  es.onopen = () => { captions.state.connected = true; captions.state.blocked = ''; emit(); sendWords(); };
  es.onerror = () => { captions.state.connected = false; emit(); checkBlocked(); };   // EventSource tries again by itself
  es.addEventListener('status', (e) => { try { captions.state.status = JSON.parse(e.data); } catch (x) { /* */ } emit(); });
  es.addEventListener('line', (e) => {
    let l; try { l = JSON.parse(e.data); } catch (x) { return; }
    captions.state.lines = captions.state.lines.concat([l]).slice(-40);
    if (C().show !== false && l.en) show(l.verse ? l.en + ' (' + l.verse.ref + ')' : l.en);
    if (C().on && ctx && ctx.stage && ctx.stage.addCaption) ctx.stage.addCaption(l); // phones following the translation
    emit();
    pass('line', l);
    toCards('line', l);
  });
  es.addEventListener('level', (e) => { try { captions.state.level = JSON.parse(e.data).db; } catch (x) { /* */ } emit(); });
  es.addEventListener('model', (e) => { try { const m = JSON.parse(e.data); captions.state.busy = m.busy || ''; captions.state.modelEvent = m; } catch (x) { /* */ } emit(); });
  es.addEventListener('ref', (e) => { try { const r = JSON.parse(e.data); pass('ref', r); toCards('ref', r); suggest('r:' + r.q, r.q, r.q); } catch (x) { /* */ } });
  es.addEventListener('hymn', (e) => { try { const r = JSON.parse(e.data); pass('hymn', r); toCards('hymn', r); suggest('h:' + r.n, 'hymn ' + r.n, 'hymn ' + r.n); } catch (x) { /* */ } });
}

function pass(type, data) { if (captions.onEvent) { try { captions.onEvent(type, data); } catch (e) { console.warn(e); } } }

function disconnect() {
  if (es) { es.close(); es = null; }
  captions.state.connected = false;
  emit();
}

async function call(path, body) {
  let r;
  try { r = await fetch(base() + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { await checkBlocked(); throw captions.state.blocked ? new Error(captions.state.blocked) : e; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || ('The translator answered ' + r.status));
  captions.state.status = j; emit();
  return j;
}

/** Names never to translate: the list in Tools → Listen & Translate, plus the church's name and town. */
export function keepWords() {
  const s = settings.v, out = [];
  String((s.captions && s.captions.keep) || '').split(/[\n,;]+/).forEach((w) => { w = w.trim(); if (w) out.push(w); });
  const ch = s.church || {};
  [ch.name, ch.town].forEach((w) => { if (w && String(w).trim()) out.push(String(w).trim()); });
  return out.slice(0, 300);
}
function sendWords() { call('/config', { keep: keepWords(), english: C().english || 'web' }).catch(() => {}); }
captions.sendWords = sendWords;
captions.status = () => call('/status');
/** Questions that are not the status: the speech models, the step-by-step checks. */
async function ask(path, body) {
  const r = await fetch(base() + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false && j.error) throw new Error(j.error || ('The translator answered ' + r.status));
  return j;
}
captions.models = () => ask('/models');
captions.setModel = (asr) => ask('/model', { asr });
captions.check = (step, device) => ask('/check', { step, device: device === '' || device == null ? null : +device });
captions.watch = (onOff) => { watching = !!onOff; if (onOff && es) return; if (wanted()) connect(); else disconnect(); };
captions.start = (device) => call('/start', { device: device === '' || device == null ? null : +device });
captions.stop = () => call('/stop', {});
captions.setEnglish = (english) => call('/config', { english });
captions.reconnect = connect;
/** For tests: an event as the translator sends it (captions, phones and suggestion cards). */
captions.inject = (type, data) => {
  if (type === 'line') { captions.state.lines = captions.state.lines.concat([data]).slice(-40); if (C().on && ctx && ctx.stage && ctx.stage.addCaption) ctx.stage.addCaption(data); emit(); }
  toCards(type, data);
};
/** Tools → Listen: keep the connection to the translator open while it listens (also with Live translation off). */
captions.listen = (onOff) => { forListen = !!onOff; if (onOff && es) return; if (wanted()) connect(); else disconnect(); };
captions.clear = () => { clearTimeout(clearTimer); if (ctx && ctx.live) ctx.live.caption(''); };

export function initCaptions(appCtx) {
  if (ctx) { connect(); return; }
  ctx = appCtx;
  const trState = () => { if (ctx.stage && ctx.stage.setTranslation) ctx.stage.setTranslation(!!C().on); };
  trState();
  settings.on('change:captions', (path) => { if (path === 'captions.on') trState(); });
  connect();
  settings.on('change:captions', (path) => { if (path === 'captions.on' || path === 'captions.url') { if (wanted()) connect(); else disconnect(); } else if (path === 'captions.keep' && es) sendWords(); });
}
