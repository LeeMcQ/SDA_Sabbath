// Background audio (offering music, backing tracks). Plays on the control device so the
// display can keep showing lyrics or announcements at the same time.
import { emitter } from './util.js';

const el = new Audio();
el.preload = 'auto';
let url = null, fadeT = null;

export const bgAudio = emitter({ el, title: '', active: false });

function state() { bgAudio.emit('state', { title: bgAudio.title, time: el.currentTime, dur: el.duration || 0, paused: el.paused, vol: el.volume, loop: el.loop, active: bgAudio.active }); }
['play', 'pause', 'ended', 'volumechange', 'loadedmetadata'].forEach((e) => el.addEventListener(e, state));
let last = 0;
el.addEventListener('timeupdate', () => { const n = Date.now(); if (n - last > 400) { last = n; state(); } });
el.addEventListener('ended', () => { if (!el.loop) { bgAudio.active = false; state(); bgAudio.emit('ended'); } });

bgAudio.play = (src, title, { loop = false, volume } = {}) => {
  if (url) { URL.revokeObjectURL(url); url = null; }
  el.src = typeof src === 'string' ? src : (url = URL.createObjectURL(src));
  el.loop = loop;
  if (volume != null) el.volume = volume;
  bgAudio.title = title || 'Audio';
  bgAudio.active = true;
  el.play().catch(() => {});
  state();
};
bgAudio.toggle = () => { if (el.paused) el.play().catch(() => {}); else el.pause(); };
bgAudio.stop = () => { el.pause(); bgAudio.active = false; if (url) { URL.revokeObjectURL(url); url = null; } el.removeAttribute('src'); el.load(); state(); };
bgAudio.seek = (t) => { el.currentTime = t; };
bgAudio.volume = (v) => { el.volume = Math.max(0, Math.min(1, v)); };
bgAudio.loop = (on) => { el.loop = !!on; state(); };
bgAudio.fadeOut = (ms = 3000) => {
  clearInterval(fadeT);
  const start = el.volume, t0 = Date.now();
  fadeT = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    el.volume = start * (1 - k);
    if (k >= 1) { clearInterval(fadeT); el.pause(); el.volume = start; bgAudio.stop(); }
  }, 50);
};
