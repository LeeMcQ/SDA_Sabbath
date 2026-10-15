// Service tools: stage monitor, lower thirds, timer, responsive readings,
// communion sequence, offering graphics, streaming overlay, basic captions.
// Children's story templates intentionally omitted.
import { h, clear, uid } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, toast, modal } from '../core/ui.js';

const RESPONSIVE = [
  { title: 'Call to Worship', text: 'Leader: O come, let us worship and bow down.\nPeople: Let us kneel before the Lord our maker.\nLeader: For he is our God.\nPeople: And we are the people of his pasture, and the sheep of his hand.' },
  { title: 'Offering Response', text: 'Leader: The earth is the Lord’s, and the fullness thereof.\nPeople: The world, and they that dwell therein.\nLeader: Let us give with cheerful hearts.\nPeople: For God loves a cheerful giver.' },
  { title: 'Benediction Response', text: 'Leader: The Lord bless you and keep you.\nPeople: The Lord make his face shine upon you and be gracious unto you.\nLeader: The Lord lift up his countenance upon you.\nPeople: And give you peace. Amen.' },
];

const COMMUNION = [
  { title: 'Ordinance of Humility', text: 'Jesus said, “If I then, your Lord and Master, have washed your feet; ye also ought to wash one another’s feet.”\n\nJohn 13:14\n\nMen and women separate for the foot-washing. This is a symbol of humility and service.' },
  { title: 'Lord’s Supper — Bread', text: 'The Lord Jesus the same night in which he was betrayed took bread:\nAnd when he had given thanks, he brake it, and said,\n“Take, eat: this is my body, which is broken for you: this do in remembrance of me.”\n\n1 Corinthians 11:23–24' },
  { title: 'Lord’s Supper — Cup', text: 'After the same manner also he took the cup, when he had supped, saying,\n“This cup is the new testament in my blood: this do ye, as oft as ye drink it, in remembrance of me.”\n\n1 Corinthians 11:25' },
  { title: 'Closing', text: 'For as often as ye eat this bread, and drink this cup, ye do shew the Lord’s death till he come.\n\n1 Corinthians 11:26' },
];

export default function create(ctx) {
  const { live, toast: showToast } = ctx;
  let timerInterval = null;
  let timerStart = 0;
  let timerElapsed = 0;
  let countdownTarget = 0;
  let isCountdown = false;
  let stageWin = null;
  let overlayWin = null;
  let captionRec = null;

  const timerDisplay = h('div', { style: { fontSize: '2.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' } }, '00:00');
  const lowerText = h('input.field', { placeholder: 'Lower third text (e.g. John 3:16 or Hymn 73)', style: { width: '100%' } });
  const lowerKind = h('select.field', { 'aria-label': 'Lower third type', style: { width: '140px' } },
    h('option', { value: 'scripture' }, 'Scripture'),
    h('option', { value: 'hymn' }, 'Hymn'),
    h('option', { value: 'speaker' }, 'Speaker'),
    h('option', { value: 'offering' }, 'Offering'),
    h('option', { value: 'custom' }, 'Custom'));

  function makeTextCue(title, lines, kind = 'note') {
    const text = Array.isArray(lines) ? lines.join('\n') : lines;
    return {
      tab: 'tools',
      title,
      sub: kind,
      deck: {
        kind: 'text',
        slides: [{ lines: text.split('\n'), notes: '' }],
      },
    };
  }

  function presentText(title, text) {
    const cue = makeTextCue(title, text);
    ctx.setStaged('tools', cue);
    live.take(cue);
  }

  function openStage() {
    if (stageWin && !stageWin.closed) { stageWin.focus(); return; }
    stageWin = window.open('', 'sda-stage', 'width=420,height=720,menubar=0,toolbar=0');
    if (!stageWin) { showToast('Pop-up blocked. Allow pop-ups for the stage monitor.', 'err'); return; }
    stageWin.document.write(`<!doctype html><html><head><title>Stage Monitor</title>
      <style>body{margin:0;background:#0d1117;color:#e6edf3;font:15px/1.45 system-ui,sans-serif;padding:16px}
      h1{font-size:1.1rem;margin:0 0 12px;color:#8b949e} .big{font-size:1.6rem;font-weight:700;margin:8px 0}
      .time{font-size:2.4rem;font-variant-numeric:tabular-nums;font-weight:700;color:#3fb950}
      .next{opacity:.75;margin-top:18px}</style></head><body>
      <h1>Stage / Confidence</h1><div class="time" id="t">--:--</div>
      <div class="big" id="cur">Waiting…</div><div class="next" id="nxt">Next: —</div></body></html>`);
    stageWin.document.close();
    updateStage();
  }

  function updateStage() {
    if (!stageWin || stageWin.closed) return;
    const cur = live.cue;
    const nxt = live.staged;
    const tEl = stageWin.document.getElementById('t');
    const cEl = stageWin.document.getElementById('cur');
    const nEl = stageWin.document.getElementById('nxt');
    if (tEl) tEl.textContent = timerDisplay.textContent;
    if (cEl) cEl.textContent = cur ? (cur.title || 'Live') : '—';
    if (nEl) nEl.textContent = nxt ? 'Next: ' + (nxt.title || '') : 'Next: —';
  }

  function openOverlay() {
    if (overlayWin && !overlayWin.closed) { overlayWin.focus(); return; }
    overlayWin = window.open('', 'sda-overlay', 'width=1280,height=720,menubar=0,toolbar=0');
    if (!overlayWin) { showToast('Pop-up blocked for overlay window.', 'err'); return; }
    overlayWin.document.write(`<!doctype html><html><head><title>Lower Third Overlay</title>
      <style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}
      #bar{position:fixed;left:0;right:0;bottom:0;padding:18px 32px;background:rgba(0,0,0,.72);
      color:#fff;font:22px/1.3 system-ui,sans-serif;display:none;backdrop-filter:blur(4px)}
      #bar.show{display:block} .kind{font-size:13px;opacity:.7;letter-spacing:.08em;text-transform:uppercase}</style></head>
      <body><div id="bar"><div class="kind" id="k"></div><div id="txt"></div></div></body></html>`);
    overlayWin.document.close();
  }

  function showLower() {
    const text = lowerText.value.trim();
    if (!text) return;
    openOverlay();
    if (overlayWin && !overlayWin.closed) {
      const bar = overlayWin.document.getElementById('bar');
      const k = overlayWin.document.getElementById('k');
      const txt = overlayWin.document.getElementById('txt');
      k.textContent = lowerKind.value;
      txt.textContent = text;
      bar.classList.add('show');
      setTimeout(() => bar && bar.classList.remove('show'), 12000);
    }
    // Also stage as a full slide for projector use
    presentText(text, text);
    showToast('Lower third shown (and staged for Present).', 'ok');
  }

  function tick() {
    if (isCountdown) {
      const left = Math.max(0, countdownTarget - Date.now());
      const s = Math.ceil(left / 1000);
      const m = Math.floor(s / 60);
      timerDisplay.textContent = String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (left <= 0) { clearInterval(timerInterval); timerInterval = null; showToast('Timer finished.', 'ok'); }
    } else {
      const s = Math.floor((timerElapsed + (Date.now() - timerStart)) / 1000);
      const m = Math.floor(s / 60);
      timerDisplay.textContent = String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
    updateStage();
  }

  function startTimer(secs) {
    clearInterval(timerInterval);
    if (secs) {
      isCountdown = true;
      countdownTarget = Date.now() + secs * 1000;
    } else {
      isCountdown = false;
      timerStart = Date.now();
      timerElapsed = 0;
    }
    timerInterval = setInterval(tick, 250);
    tick();
  }

  function stopTimer() {
    if (timerInterval) {
      if (!isCountdown) timerElapsed += Date.now() - timerStart;
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function startCaptions() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Speech recognition not available in this browser.', 'err'); return; }
    if (captionRec) { captionRec.stop(); captionRec = null; showToast('Captions stopped.'); return; }
    captionRec = new SR();
    captionRec.continuous = true;
    captionRec.interimResults = true;
    captionRec.onresult = (e) => {
      let txt = '';
      for (let i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      if (txt) presentText('Caption', txt);
    };
    captionRec.onerror = () => showToast('Caption error. Stopped.', 'err');
    captionRec.start();
    showToast('Listening for captions (experimental).', 'ok');
  }

  const el = h('section',
    h('div.toolbar', h('h2', 'Service tools'), h('div.grow')),
    h('div.scroll', { style: { flex: '1', padding: '8px 4px' } },
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Stage / confidence monitor'),
        h('p.note', 'Opens a small window showing the current live item, next item, and service timer. Place it on a stage monitor or second laptop.'),
        btn('present', 'Open stage monitor', openStage, { label: true })),
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Lower third / overlay'),
        h('div.row', { style: { gap: '8px', marginBottom: '8px' } }, lowerKind, lowerText),
        h('div.row', btn('present', 'Show lower third', showLower, { label: true }),
          btn('x', 'Clear overlay', () => { if (overlayWin && !overlayWin.closed) overlayWin.document.getElementById('bar')?.classList.remove('show'); }, { label: true })),
        h('p.note', 'Also stages the text so you can Present it full-screen on the projector. For streaming, use the overlay window as a browser source in OBS (transparent background).')),
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Service timer'),
        timerDisplay,
        h('div.row', { style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
          btn('play', 'Start', () => startTimer(0), { label: true }),
          btn('stop', 'Stop', stopTimer, { label: true }),
          btn('reload', 'Reset', () => { stopTimer(); timerElapsed = 0; timerDisplay.textContent = '00:00'; updateStage(); }, { label: true }),
          btn('clock', '5 min', () => startTimer(300), { label: true }),
          btn('clock', '10 min', () => startTimer(600), { label: true }),
          btn('clock', '20 min', () => startTimer(1200), { label: true }))),
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Responsive readings'),
        h('div.col', { style: { gap: '6px' } },
          ...RESPONSIVE.map((r) => h('button.btn', { type: 'button', onclick: () => presentText(r.title, r.text) }, r.title)))),
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Communion / Ordinance of Humility'),
        h('p.note', 'Step through the sequence. Present each slide when ready.'),
        h('div.col', { style: { gap: '6px' } },
          ...COMMUNION.map((c, i) => h('button.btn', { type: 'button', onclick: () => presentText(c.title, c.text) }, (i + 1) + '. ' + c.title)))),
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Offering & tithe'),
        h('p.note', 'Offering banners (with a verse and a QR code for online giving) are made in Banners.'),
        h('button.btn', { type: 'button', style: { marginTop: '8px' }, onclick: () => ctx.showTab('ai') }, icon('banner'), h('span', 'Open Banners'))),
      h('div.card', { style: { marginBottom: '12px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Streaming output'),
        h('p.note', 'Open the overlay window above, then in OBS add a Browser Source pointing at this page (or the overlay window). Use a transparent background for lower thirds over camera. The main display.html remains the full projector output.'),
        btn('link', 'Open streaming overlay window', openOverlay, { label: true })),
      h('div.card', { style: { padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 8px' } }, 'Live captions (experimental)'),
        h('p.note', 'Uses the browser’s speech recognition. Works best in Chrome/Edge on a quiet system. Captions are staged as text slides. Full multi-language translation remains planned.'),
        btn('mic', 'Start / stop captions', startCaptions, { label: true }))
    ));

  live.on('live', updateStage);
  live.on('staged', updateStage);

  return {
    el,
    open() { return null; },
  };
}
