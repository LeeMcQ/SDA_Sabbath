// Bottom control bar: appears while something is live and adapts to its type.
import { h, clear, fmtTime } from './core/util.js';
import { icon } from './core/icons.js';
import { btn } from './core/ui.js';
import { live, frameCount } from './core/live.js';
import { bgAudio } from './core/audio.js';

export function createControlBar(el, getTab) {
  const counter = h('span.cb-sub', '');
  const audioBox = h('div.audio-mini', { hidden: true });
  let typeBox = h('div.cb-type');
  let renderedFor = null;

  async function render() {
    const cue = live.cue;
    el.hidden = !cue && !bgAudio.active;
    document.documentElement.style.setProperty('--bar-on', el.hidden ? '0' : '1');
    if (renderedFor === cue && el.childNodes.length) { updateCounter(); return; }
    renderedFor = cue;
    clear(el);
    if (cue) {
      el.append(
        h('div.cb-live', h('span.tally-dot.live'), h('div', { style: { minWidth: 0 } }, h('div.cb-title', cue.title), counter)),
        h('div.sep'),
        btn('prev', 'Previous', () => live.prev(), { key: '←' }),
        btn('next', 'Next', () => live.next(), { key: '→' }),
      );
      typeBox = h('div.cb-type');
      el.appendChild(typeBox);
      try {
        const tab = await getTab(cue.tab);
        if (live.cue === cue && tab && tab.controls) { const c = tab.controls(cue); if (c) typeBox.appendChild(c); }
      } catch (e) { console.warn(e); }
    } else el.appendChild(h('div.grow'));
    el.append(
      h('div.cb-end',
        btn('black', 'Black screen', () => live.setBlank('black'), { key: 'B', cls: 'hide-sm' + (live.blank === 'black' ? ' live-on' : '') }),
        btn('logo', 'Logo', () => live.setBlank('logo'), { key: 'L', cls: 'hide-sm' + (live.blank === 'logo' ? ' live-on' : '') }),

        btn('clear', 'Clear screen', () => live.clear(), { key: 'Esc' })),
      audioBox,
    );
    const lb = el.querySelector('.cb-end .btn[aria-label="Logo"]');
    if (lb && !live.hasLogo()) { lb.setAttribute('aria-disabled', 'true'); lb.title = 'No logo yet: add a logo picture or church name in Settings → Screen'; }
    updateCounter();
    renderAudio();
  }

  function updateCounter() {
    const cue = live.cue;
    if (!cue) return;
    const n = frameCount(cue);
    const lab = cue.labels && cue.labels[live.index];
    counter.textContent = (cue.sub ? cue.sub + '   ' : '') + (n > 1 ? (lab ? lab + '  ·  ' : '') + (live.index + 1) + ' / ' + n : '');
    el.querySelectorAll('.cb-end .btn').forEach((b) => b.classList.remove('live-on'));
    const bb = el.querySelector('.cb-end .btn[aria-label="Black screen"]');
    const lb = el.querySelector('.cb-end .btn[aria-label="Logo"]');
    if (bb) bb.classList.toggle('live-on', live.blank === 'black');
    if (lb) lb.classList.toggle('live-on', live.blank === 'logo');
  }

  let audioUi = null;
  function renderAudio(st) {
    audioBox.hidden = !bgAudio.active;
    if (!bgAudio.active) { clear(audioBox); audioUi = null; return; }
    if (!audioUi) {
      clear(audioBox);
      const playB = btn('pause', 'Play / pause audio', () => bgAudio.toggle(), { cls: 'sm' });
      const tm = h('span.tm.cb-sub', '');
      const ttl = h('span.cb-sub.trunc', { style: { maxWidth: '140px' } }, bgAudio.title);
      audioBox.append(icon('music'), ttl, playB, tm,
        btn('fade', 'Fade out audio', () => bgAudio.fadeOut(3000), { cls: 'sm' }),
        btn('stop', 'Stop audio', () => bgAudio.stop(), { cls: 'sm' }));
      audioUi = { playB, tm, ttl };
    }
    if (st) {
      audioUi.ttl.textContent = st.title;
      audioUi.tm.textContent = fmtTime(st.time) + ' / ' + fmtTime(st.dur);
      audioUi.playB.replaceChildren(icon(st.paused ? 'play' : 'pause'));
    }
  }

  live.on('live', render);
  live.on('go', updateCounter);
  live.on('blank', updateCounter);
  bgAudio.on('state', (st) => { if (el.hidden !== (!live.cue && !bgAudio.active)) { renderedFor = undefined; render(); } else renderAudio(st); });
  render();
  return { render };
}
