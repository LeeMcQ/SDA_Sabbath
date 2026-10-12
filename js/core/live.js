// Live controller: what is staged (Next) and what is on screen (Live).
// Nothing reaches the display until Present is pressed.
import { emitter } from './util.js';
import { link } from './link.js';
import { settings } from './settings.js';
import { db } from './db.js';

export const live = emitter({ staged: null, cue: null, index: 0, blank: null, media: null, frozen: false });

let styleSentFor = null;
let pendingStyle = true;
const restyle = () => { pendingStyle = true; if (link.ready) live.sendStyle(); else live.buildStyle(); };
settings.on('change:display', restyle);
settings.on('change:app', (p) => { if (p === 'app.lowPower') restyle(); });

link.on('state', () => {
  if (link.ready && styleSentFor !== link) { pendingStyle = true; }
});
link.on('hello', () => {
  // A (re)connected display gets the current style and live item again.
  live.sendStyle().then(() => {
    if (live.cue) {
      if (live.cue.deck.kind === 'stream') link.setStream(live.cue.stream);
      link.send({ t: 'deck', deck: live.cue.deck, index: live.index, blank: live.blank });
    }
  });
});
link.on('msg', (m) => {
  if (m.t === 'media') { live.media = m; live.emit('media', m); }
  else if (m.t === 'frozen') { live.frozen = m.on; live.emit('frozen', m.on); }
  else if (m.t === 'notice') live.emit('notice', m);
  else if (m.t === 'snapshot') live.emit('snapshot', m.blob);
  else if (m.t === 'key') live.emit('remote-key', m);
});

async function fileBlob(id) {
  if (!id) return null;
  try { const f = await db.get('files', id); return f && f.blob ? f.blob : null; } catch (e) { return null; }
}

/** Resolve the display style (including background / logo images) without sending it. */
live.buildStyle = async () => {
  const s = settings.displayStyle();
  s.bgBlob = await fileBlob(s.bgImage);
  s.logoBlob = await fileBlob(s.logo);
  live.style = s;
  live.emit('style', s);
  return s;
};

live.sendStyle = async () => {
  const s = await live.buildStyle();
  link.send({ t: 'style', style: s });
  pendingStyle = false; styleSentFor = link;
};

live.stage = (cue) => {
  live.staged = cue || null;
  live.emit('staged', live.staged);
};


let streamPumpTimer = null;
let streamPumpVideo = null;
let streamPumpBusy = false;
let streamPumpQuality = 0.78;
let streamPumpMaxW = 1280;
let streamPumpInterval = 200;

function stopStreamPump() {
  if (streamPumpTimer) { clearTimeout(streamPumpTimer); streamPumpTimer = null; }
  if (streamPumpVideo) {
    try { streamPumpVideo.srcObject = null; } catch (e) {}
    streamPumpVideo = null;
  }
  streamPumpBusy = false;
}

function startStreamPump(stream) {
  stopStreamPump();
  if (!stream) return;
  streamPumpQuality = 0.78;
  streamPumpMaxW = 1280;
  streamPumpInterval = 200;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.play().catch(() => {});
  streamPumpVideo = video;
  const canvas = document.createElement('canvas');

  const schedule = (ms) => {
    if (streamPumpTimer) clearTimeout(streamPumpTimer);
    streamPumpTimer = setTimeout(sendFrame, ms);
  };

  const sendFrame = () => {
    if (!streamPumpVideo || streamPumpVideo.readyState < 2) { schedule(streamPumpInterval); return; }
    if (streamPumpBusy) { schedule(Math.max(streamPumpInterval, 100)); return; }
    const vw = streamPumpVideo.videoWidth || 1280;
    const vh = streamPumpVideo.videoHeight || 720;
    const targetW = Math.min(vw, streamPumpMaxW);
    canvas.width = targetW;
    canvas.height = Math.round(targetW * (vh / vw));
    const c = canvas.getContext('2d');
    try { c.drawImage(streamPumpVideo, 0, 0, canvas.width, canvas.height); } catch (e) { schedule(streamPumpInterval); return; }
    streamPumpBusy = true;
    const t0 = performance.now();
    canvas.toBlob((blob) => {
      streamPumpBusy = false;
      if (!blob || !live.cue || live.cue.deck.kind !== 'stream') { schedule(streamPumpInterval); return; }
      const elapsed = performance.now() - t0;
      // Adapt: slow sends → lower quality/size and slower rate; fast sends → raise them.
      if (elapsed > 180 || blob.size > 180000) {
        streamPumpQuality = Math.max(0.45, streamPumpQuality - 0.06);
        streamPumpMaxW = Math.max(640, streamPumpMaxW - 80);
        streamPumpInterval = Math.min(800, streamPumpInterval + 40);
      } else if (elapsed < 60 && blob.size < 90000) {
        streamPumpQuality = Math.min(0.88, streamPumpQuality + 0.03);
        streamPumpMaxW = Math.min(1600, streamPumpMaxW + 40);
        streamPumpInterval = Math.max(120, streamPumpInterval - 15);
      }
      link.send({
        t: 'deck',
        deck: { kind: 'image', frames: [{ kind: 'image', src: blob, fit: 'contain' }] },
        index: 0,
        blank: null,
      });
      schedule(streamPumpInterval);
    }, 'image/jpeg', streamPumpQuality);
  };
  schedule(300);
}

/** Present the staged cue. Opens a display first if none is connected. */
live.take = async (cue) => {
  cue = cue || live.staged;
  if (!cue) { live.emit('notice', { code: 'nothing', text: 'Select something to present first.' }); return false; }
  // Background audio plays on this device and leaves the screen as it is.
  if (cue.deck.kind === 'audio') { if (cue.run) cue.run(); return true; }
  if (!link.kind) {
    const ok = await live.ensureDisplay();
    if (!ok) return false;
  }
  if (cue.deck.kind === 'stream') {
    if (link.canStream()) {
      stopStreamPump();
      link.setStream(cue.stream);
    } else {
      // Cast and LAN cannot receive a live MediaStream. Pump JPEG frames instead.
      startStreamPump(cue.stream);
      live.emit('notice', { code: 'stream-pump', text: 'Sharing via frame capture (Cast/LAN). Picture updates a few times a second.' });
    }
  } else {
    stopStreamPump();
  }
  if (pendingStyle || !live.style) await live.sendStyle();
  live.cue = cue;
  live.index = Math.max(0, Math.min(cue.index || 0, frameCount(cue) - 1));
  live.blank = null;
  live.frozen = false;
  live.media = null;
  link.send({ t: 'deck', deck: cue.deck, index: live.index, blank: null });
  live.emit('live', cue);
  live.emit('go', live.index);
  if (cue.onTake) try { cue.onTake(); } catch (e) { console.warn(e); }
  return true;
};

/** Replace the live deck in place (e.g. hymn options changed while it is on screen). */
live.replace = (cue, index) => {
  if (!live.cue) return;
  live.cue = cue;
  live.index = Math.max(0, Math.min(index == null ? live.index : index, frameCount(cue) - 1));
  link.send({ t: 'deck', deck: cue.deck, index: live.index, blank: live.blank });
  live.emit('live', cue);
  live.emit('go', live.index);
};

export function frameCount(cue) {
  if (!cue) return 0;
  const d = cue.deck;
  return d.frames ? d.frames.length : 1;
}
live.count = () => frameCount(live.cue);

live.go = (i) => {
  if (!live.cue) return;
  const n = frameCount(live.cue);
  i = Math.max(0, Math.min(n - 1, i));
  if (i === live.index && live.blank !== 'black') return;
  live.index = i;
  if (live.blank === 'black') live.setBlank(null);
  link.send({ t: 'go', index: i });
  live.emit('go', i);
};

live.next = async () => {
  const c = live.cue;
  if (!c) return;
  if (c.deck.kind === 'video') return live.media && live.media.paused ? live.mediaCmd('play') : null;
  if (live.index < frameCount(c) - 1) return live.go(live.index + 1);
  if (c.extend) {
    const more = await c.extend(1);
    if (more) { live.cue = more; live.index = more.index || 0; link.send({ t: 'deck', deck: more.deck, index: live.index }); live.emit('live', more); live.emit('go', live.index); }
  } else if (c.autoLoop) live.go(0);
};

live.prev = async () => {
  const c = live.cue;
  if (!c) return;
  if (live.index > 0) return live.go(live.index - 1);
  if (c.extend) {
    const more = await c.extend(-1);
    if (more) { live.cue = more; live.index = more.index != null ? more.index : frameCount(more) - 1; link.send({ t: 'deck', deck: more.deck, index: live.index }); live.emit('live', more); live.emit('go', live.index); }
  }
};

/** Is a logo picture or church name set? Without one, "Logo" would look exactly like "Black". */
live.hasLogo = () => !!(settings.v.display.logo || (settings.v.display.logoText || '').trim());

/** Is the staged item exactly what is on screen now (same item, same slide)? */
live.sameAsLive = () => {
  const s = live.staged, c = live.cue;
  if (!s || !c || !s.id || s.id !== c.id) return false;
  return frameCount(c) < 2 || (s.index || 0) === live.index;
};

/** mode: 'black' | 'logo' | null. Toggles when the same mode is chosen again. */
live.setBlank = (mode) => {
  if (mode === 'logo' && live.blank !== 'logo' && !live.hasLogo()) {
    live.emit('notice', { code: 'nologo', text: 'No logo yet. Add a logo picture or your church name in Settings → Screen, then press Logo again.' });
    return;
  }
  if (mode && live.blank === mode) mode = null;
  live.blank = mode;
  link.send({ t: 'blank', mode });
  live.emit('blank', mode);
};

/** Remove the live item: the screen shows the background (or logo). */
live.clear = () => {
  stopStreamPump();
  const mode = settings.v.display.clearShows === 'logo' ? 'logo' : settings.v.display.clearShows === 'black' ? 'black' : null;
  link.send({ t: 'clear', mode });
  live.cue = null; live.index = 0; live.media = null; live.blank = mode;
  live.emit('live', null);
  live.emit('blank', mode);
};

live.mediaCmd = (op, v) => link.send({ t: 'media', op, v });
live.caption = (text) => link.send({ t: 'caption', text });

// Set by app.js: opens the right kind of display for this device.
live.ensureDisplay = async () => false;
