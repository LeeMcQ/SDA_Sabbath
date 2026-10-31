// The "Live English translation on your phone" slide: a light 1920 × 1080 picture for the projector with the
// QR code and three easy steps (English with Afrikaans underneath). Drawn once on a canvas, so it shows the same
// on every display (window, Cast, TV, companion). Adventist identity: the Church symbol (unaltered, one solid
// colour), denim blue as the core colour, Advent Sans for the headings and Atkinson Hyperlegible for reading.
import { SYMBOL_ROUND } from '../core/symbol.js';

const W = 1920, H = 1080;
const C = { bg: '#f6f7f9', denim: '#1f4e79', ink: '#1c2633', muted: '#5b6878', line: '#dde3ea', card: '#ffffff', soft: '#e9eff5' };
const HEAD = '"Advent Sans", "Hyperlegible", sans-serif';
const BODY = '"Hyperlegible", system-ui, sans-serif';

function wrap(g, text, x, y, maxW, lh, maxLines = 3) {
  const words = String(text).split(/\s+/);
  let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + n * lh); n++; line = words[i];
      if (n >= maxLines - 1) { line = words.slice(i).join(' '); break; }
    } else line = test;
  }
  g.fillText(line, x, y + n * lh);
  return n + 1;
}
/** Set the largest font size up to max at which text fits in width. */
function fit(g, text, width, max, weight, family) {
  let px = max;
  g.font = weight + ' ' + px + 'px ' + family;
  while (px > 12 && g.measureText(text).width > width) { px -= 1; g.font = weight + ' ' + px + 'px ' + family; }
  return px;
}
function round(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const symbolImage = (color) => new Promise((res) => {
  const img = new Image();
  img.onload = () => res(img); img.onerror = () => res(null);
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(SYMBOL_ROUND.replace('fill="currentColor"', 'fill="' + color + '"'));
});

/** The slide as a PNG blob. url: the phone address in the QR code; typed: the short address; code: the room code. */
export async function translationJoinSlide({ url, typed, code, church }) {
  try {
    await Promise.all(['700 96px "Advent Sans"', '600 40px "Advent Sans"', '400 40px "Hyperlegible"', '700 40px "Hyperlegible"'].map((f) => document.fonts.load(f)));
  } catch (e) { /* the fallback fonts still read well */ }
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  // A quiet denim band at the top with the symbol and the church's name.
  g.fillStyle = C.denim; g.fillRect(0, 0, W, 132);
  const sym = await symbolImage('#ffffff');
  if (sym) g.drawImage(sym, 96, 26, 80, 80);
  g.fillStyle = '#ffffff'; g.textBaseline = 'alphabetic';
  g.font = '600 40px ' + HEAD;
  g.fillText(church || 'Seventh-day Adventist Church', 200, 70);
  g.globalAlpha = 0.82; g.font = '400 26px ' + BODY;
  g.fillText(church ? 'Seventh-day Adventist Church' : 'Welcome · Welkom', 200, 106);
  g.globalAlpha = 1;

  // Left: the heading and the steps.
  const L = 96, colW = 1000;
  g.fillStyle = C.denim; g.font = '700 84px ' + HEAD;
  fit(g, 'Live English translation', 1060, 84, '700', HEAD);
  g.fillText('Live English translation', L, 268);
  g.fillText('on your phone', L, 362);
  g.fillStyle = C.muted; g.font = '400 38px ' + BODY;
  g.fillText('Lewendige Engelse vertaling op jou foon', L, 428);

  const steps = [
    ['Open your phone’s camera and point it at the code.', 'Maak jou kamera oop en rig dit op die kode.'],
    ['Tap the link that appears.', 'Tik op die skakel wat verskyn.'],
    ['Read the sermon in English as it is preached. A+ makes the words bigger.', 'Lees die preek in Engels terwyl dit gepreek word.'],
  ];
  let y = 520;
  steps.forEach(([en, af], i) => {
    g.fillStyle = C.denim; g.beginPath(); g.arc(L + 34, y + 2, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = '700 38px ' + BODY; g.textAlign = 'center'; g.fillText(String(i + 1), L + 34, y + 16); g.textAlign = 'left';
    g.fillStyle = C.ink; g.font = '700 38px ' + BODY;
    const n = wrap(g, en, L + 96, y + 14, colW - 96, 48, 2);
    g.fillStyle = C.muted; g.font = '400 29px ' + BODY;
    wrap(g, af, L + 96, y + 14 + n * 48 + 2, colW - 96, 38, 2);
    y += 92 + n * 48;
  });

  // Right: the QR code on a white card, the address and the code for typing.
  const cx = 1252, cy = 186, cw = 572, ch = 800;
  g.save(); g.shadowColor = 'rgba(31,78,121,.16)'; g.shadowBlur = 40; g.shadowOffsetY = 12;
  g.fillStyle = C.card; round(g, cx, cy, cw, ch, 28); g.fill(); g.restore();
  g.strokeStyle = C.line; g.lineWidth = 2; round(g, cx, cy, cw, ch, 28); g.stroke();
  const m = await import('../../vendor/qrcode.min.js');
  const q = m.default(0, 'M'); q.addData(url); q.make();
  const n = q.getModuleCount(), qs = 430, cell = Math.floor(qs / n), qw = cell * n;
  const qx = cx + (cw - qw) / 2, qy = cy + 48;
  g.fillStyle = '#ffffff'; g.fillRect(qx - 16, qy - 16, qw + 32, qw + 32);
  g.fillStyle = '#10243a';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect(qx + c * cell, qy + r * cell, cell, cell);
  g.textAlign = 'center';
  g.fillStyle = C.denim; g.font = '700 34px ' + BODY;
  g.fillText('Scan with your camera', cx + cw / 2, qy + qw + 66);
  // No camera: the address to type and the room code, inside one soft box.
  const bx = cx + 32, bw = cw - 64, by = cy + ch - 32 - 232;
  g.fillStyle = C.soft; round(g, bx, by, bw, 232, 18); g.fill();
  g.fillStyle = C.muted; g.font = '400 25px ' + BODY;
  g.fillText('No camera? Open', cx + cw / 2, by + 44);
  g.fillStyle = C.ink;
  fit(g, typed, bw - 32, 26, '700', BODY);
  g.fillText(typed, cx + cw / 2, by + 86);
  g.fillStyle = C.muted; g.font = '400 25px ' + BODY;
  g.fillText('and type the code', cx + cw / 2, by + 128);
  g.fillStyle = C.denim; g.font = '700 54px ' + BODY;
  g.fillText(code, cx + cw / 2, by + 200);
  g.textAlign = 'left';

  // Footer.
  g.fillStyle = C.muted; g.font = '400 27px ' + BODY;
  g.fillText('Free · no app to install · no sound · works on any phone with internet', L, 1010);
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}
