// Live translation: English captions from the SDA Sabbath translator on this PC (translator/livetranslate.py).
// The translator listens to the sound desk, recognises the Afrikaans sermon and sends finished English sentences
// here; a sentence that quotes the Bible arrives as the English verse itself. Captions go to the caption line on
// the screen (and stage screens). References and hymn numbers the preacher names are offered to the operator as
// "Set as Next" suggestions: nothing reaches the screen without the operator.
import { settings } from './settings.js';
import { h } from './util.js';
import { toast } from './ui.js';

const C = () => settings.v.captions || {};
const base = () => String(C().url || 'http://127.0.0.1:7790').replace(/\/+$/, '');
const listeners = new Set();
let es = null, ctx = null, clearTimer = 0, lastSuggest = {};

export const captions = {
  state: { connected: false, status: null, lines: [] },
  on(f) { listeners.add(f); return () => listeners.delete(f); },
};
const emit = () => listeners.forEach((f) => { try { f(captions.state); } catch (e) { /* */ } });

function show(text) {
  if (!ctx || !ctx.live) return;
  ctx.live.caption(text);
  clearTimeout(clearTimer);
  const s = +C().clearAfter || 12;
  if (text) clearTimer = setTimeout(() => ctx.live.caption(''), s * 1000);
}

function suggest(key, label, q) {
  if (C().suggest === false || !ctx || !ctx.remoteCommand) return;
  const now = Date.now();
  if (lastSuggest[key] && now - lastSuggest[key] < 60000) return;   // once a minute is enough
  lastSuggest[key] = now;
  const b = h('button.btn.sm.primary', { type: 'button', onclick: () => { ctx.remoteCommand('goto', { q }); t.remove(); } }, 'Set as Next');
  const t = toast(h('span', h('span', 'Preacher: ' + label + ' '), b), '', 15000);
}

function connect() {
  disconnect();
  if (!C().on || typeof EventSource === 'undefined') return;
  es = new EventSource(base() + '/events');
  es.onopen = () => { captions.state.connected = true; emit(); sendWords(); };
  es.onerror = () => { captions.state.connected = false; emit(); };   // EventSource tries again by itself
  es.addEventListener('status', (e) => { try { captions.state.status = JSON.parse(e.data); } catch (x) { /* */ } emit(); });
  es.addEventListener('line', (e) => {
    let l; try { l = JSON.parse(e.data); } catch (x) { return; }
    captions.state.lines = captions.state.lines.concat([l]).slice(-40);
    if (C().show !== false && l.en) show(l.verse ? l.en + ' (' + l.verse.ref + ')' : l.en);
    emit();
  });
  es.addEventListener('ref', (e) => { try { const r = JSON.parse(e.data); suggest('r:' + r.q, r.q, r.q); } catch (x) { /* */ } });
  es.addEventListener('hymn', (e) => { try { const r = JSON.parse(e.data); suggest('h:' + r.n, 'hymn ' + r.n, 'hymn ' + r.n); } catch (x) { /* */ } });
}

function disconnect() {
  if (es) { es.close(); es = null; }
  captions.state.connected = false;
  emit();
}

async function call(path, body) {
  const r = await fetch(base() + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || ('The translator answered ' + r.status));
  captions.state.status = j; emit();
  return j;
}

/** Names never to translate: the list in Tools → Translate, plus the church's name and town. */
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
captions.start = (device) => call('/start', { device: device === '' || device == null ? null : +device });
captions.stop = () => call('/stop', {});
captions.setEnglish = (english) => call('/config', { english });
captions.reconnect = connect;
captions.clear = () => { clearTimeout(clearTimer); if (ctx && ctx.live) ctx.live.caption(''); };

export function initCaptions(appCtx) {
  if (ctx) { connect(); return; }
  ctx = appCtx;
  connect();
  settings.on('change:captions', (path) => { if (path === 'captions.on' || path === 'captions.url') connect(); else if (path === 'captions.keep' && es) sendWords(); });
}
