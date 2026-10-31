// Tools → Listen & Translate: everything that listens to the service in one place.
//   Listen for verses & hymns   (listen-part.js; the cards appear beside Next / Live)
//   Translation on phones       the "translation on your phone" slide with its QR code (trjoin.js)
//   Live translation            the SDA Sabbath translator settings (translate-part.js)
import { h, clear } from '../core/util.js';
import { icon } from '../core/icons.js';
import { fmtCode } from '../core/stagenet.js';
import createListen from './listen-part.js';
import createTranslate from './translate-part.js';
import { translationJoinSlide } from './trjoin.js';

export default function create(ctx) {
  const { settings, ui } = ctx;
  const hub = ctx.stage;
  const L = createListen(ctx);
  const T = createTranslate(ctx);
  const listenCols = [...L.el.querySelectorAll('.st-grid > .st-col')];
  const trCard = T.el.querySelector('.tr-card');
  trCard.prepend(h('h3', 'Live translation · Afrikaans sermon → English'));

  // ------------------------------------------------------------ translation on phones
  const preview = h('div.trp-prev');
  const netNote = h('p.note.trp-net');
  const card = (title, ...kids) => h('div.card.st-card', h('h3', title), ...kids);
  const phones = card('Translation on phones',
    h('p.note', 'People in the church can read the English translation on their own phones. Put this slide on the screen: they scan the QR code and the sermon appears on their phone as it is translated.'),
    preview,
    h('div.row.wrap',
      h('button.btn.primary', { type: 'button', onclick: () => stage(false) }, icon('next'), h('span', 'Put on Next')),
      h('button.btn', { type: 'button', onclick: () => stage(true) }, icon('present'), h('span', 'Show it now')),
      h('button.btn', { type: 'button', onclick: () => tryOnPhone() }, icon('phone'), h('span', 'Try it here'))),
    netNote);

  let slide = null; // { key, blob, url }
  async function ensureOnline() {
    if (!settings.v.stage.online || hub.net.state === 'off') await hub.goOnline(true);
    return settings.v.stage.code;
  }
  async function build() {
    const code = await ensureOnline();
    const url = hub.translateUrl(code);
    const typed = hub.shortUrl() + '?v=tr';
    const church = ((settings.v.church && settings.v.church.name) || '').trim();
    const key = url + '|' + church;
    if (slide && slide.key === key) return slide;
    const blob = await translationJoinSlide({ url, typed, code: fmtCode(code), church });
    if (slide && slide.src) URL.revokeObjectURL(slide.src);
    slide = { key, blob, url, src: URL.createObjectURL(blob) };
    clear(preview);
    preview.append(h('img', { src: slide.src, alt: 'The translation on your phone slide' }));
    return slide;
  }
  async function stage(andShow) {
    try {
      const s = await build();
      ctx.setStaged('tools', { id: 'trjoin:' + s.key, tab: 'tools', title: 'Translation on your phone', sub: 'QR code slide',
        deck: { kind: 'image', frames: [{ kind: 'image', src: s.blob, fit: 'contain' }] }, index: 0 });
      if (andShow && ctx.present) await ctx.present();
      else ui.toast('The phone slide is on Next. Press Present (F5) to show it.', 'ok', 3000);
    } catch (e) { ui.toast('Could not make the phone slide: ' + ((e && e.message) || e), 'err'); }
  }
  async function tryOnPhone() {
    const s = await build();
    window.open(s.url, '_blank', 'noopener');
  }
  function paintNet() {
    const st = hub.net && hub.net.state;
    const n = hub.readers ? hub.readers().length : 0;
    netNote.textContent = !settings.v.stage.online ? 'Phones connect over the internet with the room code (the same as Tools → Stage → Phones & laptops). The translator itself works without internet; this PC needs internet only to reach the phones.'
      : st === 'on' ? 'Ready · ' + n + ' phone' + (n === 1 ? ' is' : 's are') + ' reading the translation. Room code ' + fmtCode(settings.v.stage.code) + '.'
      : st === 'offline' ? 'This PC has no internet, so phones cannot connect. The translation still shows on the screen.'
      : st === 'error' ? 'Could not reach the phones: ' + (hub.net.error || '') : 'Starting…';
  }
  hub.on('net', paintNet); hub.on('outlets', paintNet);

  // When Live translation is switched on, offer the phone slide once.
  settings.on('change:captions', (p) => {
    if (p !== 'captions.on' || !settings.v.captions.on) return;
    ui.toast(h('span', 'Live translation is on. ', h('button.btn.sm.primary', { type: 'button', onclick: () => stage(false) }, 'Put the phone QR slide on Next')), 'ok', 12000);
  });

  const el = h('section.listen-tab',
    h('div.toolbar', h('h2', 'Listen & Translate'), h('div.grow')),
    h('div.scroll',
      h('div.st-grid.lt-grid',
        h('div.st-col', ...listenCols[0].childNodes, phones),
        h('div.st-col', ...listenCols[1].childNodes)),
      h('div.lt-full', trCard)));

  return {
    el,
    onShow() { L.onShow && L.onShow(); T.onShow && T.onShow(); paintNet(); if (settings.v.stage.online) build().catch(() => {}); },
    open() { return null; },
  };
}
