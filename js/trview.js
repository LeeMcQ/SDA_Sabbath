// Live translation on a phone (stage.html#c=CODE&v=tr): the English sentences of the sermon as the SDA Sabbath
// translator writes them, newest at the bottom in large type. Light, quiet and readable in a church: the
// Church symbol, the church's name, Advent Sans headings and Atkinson Hyperlegible text.
// It follows the media desk over the same room code as the stage screen (js/stage-main.js does the connecting).
import { h, clear } from './core/util.js';
import { SYMBOL_ROUND } from './core/symbol.js';

const SIZES = [17, 20, 24, 29, 35];

export function createTrView({ local, saveLocal }) {
  document.documentElement.classList.add('tr-mode');
  document.title = 'Live English translation';
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = '#f4f6f8';

  let on = false, list = [], church = '';
  let size = Math.max(0, Math.min(SIZES.length - 1, local.trSize == null ? 1 : +local.trSize));
  let showAf = !!local.trAf;

  const mark = h('span.tr-mark'); mark.innerHTML = SYMBOL_ROUND;
  const churchEl = h('div.tr-church', 'Seventh-day Adventist Church');
  const conn = h('span.tr-conn', h('i'), h('span', 'Connecting…'));
  const smaller = h('button.tr-btn', { type: 'button', 'aria-label': 'Smaller text', onclick: () => setSize(size - 1) }, 'A−');
  const bigger = h('button.tr-btn', { type: 'button', 'aria-label': 'Bigger text', onclick: () => setSize(size + 1) }, 'A+');
  const afBtn = h('button.tr-btn.tr-af-btn', { type: 'button', 'aria-pressed': String(showAf), onclick: () => { showAf = !showAf; local.trAf = showAf; saveLocal(); afBtn.setAttribute('aria-pressed', String(showAf)); paint(); } }, 'Afrikaans too');
  const state = h('div.tr-state');
  const listEl = h('div.tr-list', { 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const scroller = h('main.tr-scroll', state, listEl);
  const newBtn = h('button.tr-new', { type: 'button', hidden: true, onclick: () => toEnd(true) }, 'New sentences ↓');
  const view = h('div.tr-view',
    h('header.tr-head', mark, h('div.tr-titles', churchEl, h('h1', 'Live English translation')), conn),
    h('div.tr-tools', smaller, bigger, h('span.tr-grow'), afBtn),
    scroller, newBtn,
    h('footer.tr-foot', 'Machine translation of the sermon. It can make mistakes; Bible quotes are shown as written in the English Bible.'));
  document.body.append(view);

  function setSize(n) {
    size = Math.max(0, Math.min(SIZES.length - 1, n));
    local.trSize = size; saveLocal();
    view.style.setProperty('--tr-size', SIZES[size] + 'px');
    smaller.disabled = size === 0; bigger.disabled = size === SIZES.length - 1;
    toEnd(false);
  }

  // Follow the newest sentence, unless the reader scrolled up to read an earlier one.
  let pinned = true;
  scroller.addEventListener('scroll', () => {
    pinned = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60;
    if (pinned) newBtn.hidden = true;
  });
  function toEnd(force) {
    if (!force && !pinned) { newBtn.hidden = false; return; }
    requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; newBtn.hidden = true; pinned = true; });
  }

  function line(c, last) {
    return h('article.tr-line' + (last ? '.now' : ''),
      h('p.tr-en', c.en, c.ref ? h('b.tr-ref', ' (' + c.ref + ')') : null),
      showAf && c.af ? h('p.tr-orig', { lang: 'af' }, c.af) : null);
  }
  function paint() {
    clear(listEl);
    list.forEach((c, i) => listEl.append(line(c, i === list.length - 1)));
    state.textContent = !on ? 'The translation has not started yet. It appears here as soon as the preacher speaks.'
      : !list.length ? 'Listening… the first sentence appears in a moment.' : '';
    state.hidden = !state.textContent;
    toEnd(false);
  }

  setSize(size);
  paint();
  return {
    /** All sentences so far and whether Live translation is on (when joining, and when it is switched). */
    all(m) { on = !!m.on; list = Array.isArray(m.list) ? m.list.slice(-30) : []; paint(); },
    /** One new sentence. */
    add(c) {
      if (!c || !c.en) return;
      on = true;
      list = list.concat([c]).slice(-30);
      const prev = listEl.querySelector('.tr-line.now');
      if (prev) prev.classList.remove('now');
      state.hidden = true;
      listEl.append(line(c, true));
      while (listEl.children.length > 30) listEl.firstChild.remove();
      toEnd(false);
    },
    church(name) { if (name && name !== church) { church = name; churchEl.textContent = name; } },
    conn(st, text) {
      conn.className = 'tr-conn ' + st;
      conn.lastChild.textContent = st === 'on' ? 'Live' : st === 'connecting' || st === 'waiting' ? 'Connecting…' : st === 'lost' ? 'Reconnecting…' : st === 'offline' ? 'No internet' : 'Not connected';
      conn.title = text || '';
    },
  };
}
