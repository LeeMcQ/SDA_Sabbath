// Tools → Listen: switch the verse and hymn suggestions on and off (js/listen.js does the listening).
// The suggestions themselves appear beside Next / Live (on phones above the tabs), where the operator looks.
import { h, clear } from '../core/util.js';
import { icon } from '../core/icons.js';
import { seg } from '../core/ui.js';

export default function create(ctx) {
  const L = ctx.listener;
  const card = (title, ...kids) => h('div.card.st-card', h('h3', title), ...kids);

  const status = h('div.ls-status');
  const toggleBtn = h('button.btn.primary.ls-toggle', { type: 'button', onclick: () => L && L.toggle() });
  function paint() {
    clear(status); clear(toggleBtn);
    if (!L) return;
    const by = L.source === 'offline' ? ' · offline translator' : L.source === 'browser' ? ' · browser (online)' : '';
    status.append(h('span' + (L.on ? '.ls-dot' : '.ls-off-dot')), h('b', L.on ? 'Listening' + by : 'Off'),
      h('span.note', L.on ? (L.problem || 'Suggestions appear under Black / Logo / Clear (on phones, above the tabs).') : 'Nothing is heard while it is off.'));
    toggleBtn.classList.toggle('primary', !L.on);
    toggleBtn.append(icon(L.on ? 'stop' : 'mic'), h('span', L.on ? 'Stop listening' : 'Start listening'));
  }

  const S = ctx.settings;
  const hearWith = seg([['auto', 'Automatic'], ['offline', 'Offline translator'], ['browser', 'Browser (online)']], S.v.app.listenSource || 'auto',
    (v) => { S.set('app.listenSource', v); if (L && L.on) { L.stop(); L.start(); } });
  const main = card('Listen for verses & hymns',
    h('p.note', 'Listens through the microphone. When a Bible verse or a hymn is mentioned, it is offered as a card with Put on Next and Present. While a hymn is on the screen it follows the singing and offers the stanza being sung. Nothing goes on the screen by itself.'),
    h('div.ls-src', h('span.ls-src-l', 'Hear with'), hearWith),
    h('p.note', 'Offline translator: the SDA Sabbath translator on this PC (Tools → Listen & Translate) listens to the sound desk without internet, for Afrikaans sermons. It also recognises Bible verses the preacher quotes without naming them. Live translation does not need to be switched on. ' +
      'Browser: Chrome or Edge with the internet and the microphone, in English (or Afrikaans when your main Bible is Afrikaans). Automatic uses the translator when it is running on this PC, otherwise the browser.'),
    status,
    h('div.row', toggleBtn));

  const ex = (said, gets) => h('li', h('span.ls-said', '“' + said + '”'), h('span.note', ' → ' + gets));
  const examples = card('What it listens for',
    h('ul.ls-examples',
      ex('as it says in John chapter three verse sixteen', 'John 3:16'),
      ex('turn with me to Romans 8 28', 'Romans 8:28'),
      ex('Johannes drie vers sestien', 'Johannes 3:16'),
      ex('let us sing hymn number one hundred', 'Hymn 100'),
      ex('please turn to number 73 in your hymnal', 'Hymn 73'),
      ex('let us stand and sing Great Is Thy Faithfulness', 'Hymn 100, by its name'),
      ex('(the congregation sings the third stanza)', 'Being sung now: Verse 3'),
      ex('Want so lief het God die wêreld gehad… (quoted, with the offline translator)', 'John 3:16')));

  const el = h('section.listen-tab',
    h('div.toolbar', h('h2', 'Listen'), h('span.note.hide-sm', 'Verse and hymn suggestions while the service runs'), h('div.grow')),
    h('div.scroll.st-grid', h('div.st-col', main), h('div.st-col', examples)));

  if (L && L.onChange) L.onChange(paint);
  paint();
  return { el, onShow: paint, open() { return null; } };
}
