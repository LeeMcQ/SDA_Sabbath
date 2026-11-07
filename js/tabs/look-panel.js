// "Own look" for Bible text or hymn words: the same choices as Settings → Screen, kept apart for this part.
// Off = the Settings → Screen look. On = the choices below (they start as a copy of Settings → Screen).
import { h } from '../core/util.js';
import { seg, toggle } from '../core/ui.js';
import { settings, LOOK_KEYS } from '../core/settings.js';
import { createStage } from '../core/render.js';
import { live } from '../core/live.js';

const SAMPLE = {
  bible: { kind: 'text', variant: 'bible', refPos: 'bottom',
    html: '<span class="v"><span class="vn">16</span>For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.</span>',
    foot: 'John 3:16', footR: 'KJV' },
  hymn: { kind: 'text', variant: 'hymn', lines: true, refPos: 'bottom',
    html: ['Holy, holy, holy! Lord God Almighty!', 'Early in the morning our song shall rise to Thee;', 'Holy, holy, holy, merciful and mighty,', 'God in three Persons, blessed Trinity!'].map((l) => '<span class="ln">' + l + '</span>').join(''),
    foot: '73  Holy, Holy, Holy', footR: 'Verse 1 of 4' },
};

/** kind: 'bible' | 'hymn'. onChange: the tab rebuilds what is staged (the slides may split differently). */
export function lookPanel(kind, ctx, onChange) {
  const sec = kind === 'bible' ? 'bible' : 'hymns';
  const L = () => settings.v[sec].look || (settings.v[sec].look = { on: false });
  const D = () => settings.v.display;
  const val = (k) => (L()[k] != null && L()[k] !== '' ? L()[k] : (k === 'hymnSize' ? D().hymnSize || 'large' : D()[k]));
  const set = (k, v) => { settings.set(sec + '.look.' + k, v); redraw(); if (onChange) onChange(); };

  const host = h('div.stage-host');
  const prev = h('div.screen', { style: { maxWidth: '420px', margin: '6px 0 10px' } }, host);
  const stage = createStage(host, { placeholderOnly: true, observe: false });
  const redraw = async () => {
    try {
      stage.setAspect(ctx.link.aspect()); prev.style.aspectRatio = String(ctx.link.aspect());
      stage.applyStyle(await live.buildStyle());
      stage.show(Object.assign({}, SAMPLE[kind]));
    } catch (e) { /* the preview is only a help */ }
  };

  const color = (k, label) => h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(val(k)) ? val(k) : '#ffffff', 'aria-label': label, style: { width: '56px', height: '34px', border: 0, background: 'none' }, oninput: (e) => set(k, e.target.value) });
  const range = (k, min, max, step, fmt, label) => {
    const out = h('span.note', fmt(+val(k)));
    const r = h('input', { type: 'range', min, max, step, 'aria-label': label, style: { flex: '1', maxWidth: '240px' },
      oninput: () => { out.textContent = fmt(+r.value); }, onchange: () => set(k, +r.value) });
    r.value = val(k);
    return h('div.row', r, out);
  };

  const controls = h('div.form', { style: { marginTop: '4px' } });
  const paintControls = () => {
    controls.textContent = '';
    if (!L().on) { controls.hidden = true; prev.hidden = true; return; }
    controls.hidden = false; prev.hidden = false;
    const kids = [
      h('label', 'Font'), seg([['sans', 'Clear sans'], ['serif', 'Serif'], ['system', 'System']], val('font'), (v) => set('font', v)),
      h('label', 'Weight'), seg([['bold', 'Bold'], ['regular', 'Regular']], val('weight'), (v) => set('weight', v)),
      h('label', 'Text colour'), color('fg', 'Text colour'),
      h('label', kind === 'bible' ? 'Verse-number colour' : 'Title colour'), color('accent', kind === 'bible' ? 'Verse-number colour' : 'Title colour'),
      h('label', 'Background'), toggle('Own background colour (instead of the Screen background)', !!L().bgOwn, (v) => { set('bgOwn', v); paintControls(); }),
    ];
    if (L().bgOwn) kids.push(h('label', 'Background colour'), color('bg', 'Background colour'));
    kids.push(
      h('label', 'Text shadow'), toggle('Outline text so it reads on pictures', !!val('shadow'), (v) => set('shadow', v)),
      h('label', 'Alignment'), seg([['center', 'Centre'], ['left', 'Left']], val('align'), (v) => set('align', v)),
      h('label', 'Margin'), range('pad', 20, 200, 4, (v) => v + ' px', 'Margin'),
      h('label', 'Smallest text'), range('minFont', 36, 110, 2, (v) => v + ' px', 'Smallest text'),
      h('label', 'Largest text'), range('maxFont', 90, 240, 5, (v) => v + ' px', 'Largest text'));
    if (kind === 'hymn') kids.push(h('label', 'Hymn words'), seg([['normal', 'Normal'], ['large', 'Large'], ['largest', 'Largest']], val('hymnSize'), (v) => set('hymnSize', v)));
    kids.push(h('label', ''), h('button.btn.sm', { type: 'button', onclick: () => {
      LOOK_KEYS.concat(['bgOwn']).forEach((k) => settings.set(sec + '.look.' + k, null));
      settings.set(sec + '.look.on', true); paintControls(); redraw(); if (onChange) onChange();
    } }, 'Start again from Settings → Screen'));
    controls.append(...kids);
  };

  const what = kind === 'bible' ? 'Bible text' : 'hymn words';
  const tg = toggle('Use an own look for ' + what + ' (otherwise Settings → Screen)', !!L().on, (v) => {
    if (v) LOOK_KEYS.forEach((k) => { if (L()[k] == null || L()[k] === '') settings.set(sec + '.look.' + k, k === 'hymnSize' ? D().hymnSize || 'large' : D()[k]); });
    settings.set(sec + '.look.on', v);
    paintControls(); redraw(); if (onChange) onChange();
  });
  paintControls();
  const el = h('div', { className: 'look-panel', style: { gridColumn: '1 / -1' } },
    h('h3', { style: { marginTop: '10px' } }, 'Screen look for ' + what), tg, prev, controls,
    h('p.note', 'The look of everything else stays as set in Settings → Screen.'));
  setTimeout(() => { stage.fit(); redraw(); }, 60);
  return el;
}
