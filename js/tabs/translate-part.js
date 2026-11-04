// Tools → Listen & Translate → Live translation: the Afrikaans sermon as English captions, through the SDA Sabbath
// translator on this PC (translator/livetranslate.py, js/core/livecaptions.js).
// Kept simple: one bar (on/off, status, start/stop, sound level), sound input and speech model, then the sentences.
// Everything else is under Settings; explanations sit behind (i) and show when pointed at. "Check each part" runs
// the translator's own checks one by one, with the PC speed test and the recommended speech model.
import { h, clear } from '../core/util.js';
import { icon } from '../core/icons.js';
import { seg, toggle, toast, modal, confirmBox } from '../core/ui.js';

export const INSTALLER_URL = 'https://github.com/LeeMcQ/SDA_Sabbath/releases/download/translator/SDA-Sabbath-Translator-Setup.exe';

/** An (i) that shows its words when pointed at, focused or tapped. */
let tipN = 0;
export function tip(text) {
  const id = 'tip' + (++tipN);
  // Named "More information"; the words are its description (screen readers read them after the name).
  return h('button.tip', { type: 'button', 'aria-label': 'More information', 'aria-describedby': id, 'data-tip': text,
    onclick: (e) => e.currentTarget.classList.toggle('open') }, icon('info'), h('span.sr-only', { id }, text));
}

const MODEL_NAMES = { tiny: 'Tiny', base: 'Base', small: 'Small', medium: 'Medium', turbo: 'Turbo', 'large-v3': 'Large' };

export default function create(ctx) {
  const { settings } = ctx;
  const box = h('div.card.st-card.tr-card');
  const el = h('section.translate-tab',
    h('div.toolbar', h('h2', 'Translate'), h('span.note.hide-sm', 'Live translation: Afrikaans sermon → English captions'), h('div.grow')),
    h('div.scroll.tr-scroll', box));
  const Cv = () => settings.v.captions || {};
  const setC = (k) => (v) => settings.set('captions.' + k, v);
  let cap = null, built = false, models = null;

  const ensure = async () => {
    if (!cap) {
      cap = (await import('../core/livecaptions.js')).captions;
      cap.on(paint);
    }
    return cap;
  };
  const act = (f) => async () => { try { const c = await ensure(); return await f(c); } catch (e) { toast('Translator: ' + (e.message || e), 'err'); } };

  // ---------------------------------------------------------------- the bar
  const dot = h('span.tr-dot');
  const stText = h('span.tr-st');
  const startBtn = h('button.btn.primary', { type: 'button', onclick: () => act((c) => (c.state.status && c.state.status.running ? c.stop() : c.start(Cv().device)))() });
  const meter = h('div.tr-meter', { title: 'Sound level from the sound desk', role: 'meter', 'aria-label': 'Sound level', 'aria-valuemin': -60, 'aria-valuemax': 0 }, h('span'));
  const devSel = h('select.field', { 'aria-label': 'Sound input', onchange: () => settings.set('captions.device', devSel.value) });
  const modelSel = h('select.field', { 'aria-label': 'Speech model', onchange: () => pickModel(modelSel.value) });
  const busy = h('div.tr-busy');
  const logBox = h('div.cap-log.tr-log', { 'aria-live': 'off' });
  const getBox = h('div.tr-get');

  function paint(s) {
    s = s || (cap && cap.state) || {};
    const x = s.status;
    const running = !!(x && x.running);
    const reachable = !!(s.connected || x);
    dot.className = 'tr-dot' + (running ? ' on' : reachable ? ' ready' : '');
    stText.textContent = !reachable ? (s.blocked || 'Translator not running on this PC')
      : running ? 'Listening' + (x.rtf ? (x.rtf < 0.8 ? ' · keeping up' : ' · falling behind: choose a smaller speech model') : '')
      : x && x.error ? x.error : 'Ready';
    clear(startBtn);
    startBtn.append(icon(running ? 'stop' : 'play'), h('span', running ? 'Stop' : 'Start listening'));
    startBtn.classList.toggle('primary', !running);
    startBtn.disabled = !reachable;
    const db = running && s.level != null ? s.level : null;
    meter.firstChild.style.width = db == null ? '0%' : Math.max(0, Math.min(100, (db + 60) / 60 * 100)) + '%';
    meter.classList.toggle('hot', db != null && db > -3);
    meter.classList.toggle('low', db != null && db < -45);
    meter.setAttribute('aria-valuenow', db == null ? -60 : Math.round(db));
    if (x && x.devices && devSel.options.length !== x.devices.length + 1) {
      clear(devSel); devSel.append(h('option', { value: '' }, 'Automatic (sound desk if found)'));
      x.devices.forEach((d) => devSel.append(h('option', { value: String(d.id) }, d.name)));
      devSel.value = Cv().device || '';
    }
    busy.textContent = s.busy || (x && x.busy) || '';
    busy.hidden = !busy.textContent;
    if (s.modelEvent && s.modelEvent.models) { models = s.modelEvent.models; s.modelEvent.models = null; paintModels(); }
    if (s.modelEvent && s.modelEvent.error) { toast('Speech model: ' + s.modelEvent.error, 'err'); s.modelEvent.error = null; }
    if (x && x.model && modelSel.value !== x.model && !busy.textContent && [...modelSel.options].some((o) => o.value === x.model)) { modelSel.value = x.model; }
    getBox.hidden = reachable;
    logBox.hidden = !reachable;
    paintLog(s);
  }

  function paintLog(s) {
    clear(logBox);
    const lines = (s.lines || []).slice(-15);
    lines.forEach((l) => logBox.append(h('div.cap-line', h('div.cap-af', { lang: 'af' }, l.af),
      h('div.cap-en', l.en, l.verse ? h('b', ' (' + l.verse.ref + ')') : null))));
    if (!lines.length) logBox.append(h('p.note.tr-empty', 'The sentences appear here while the translator listens: the Afrikaans that was heard, and the English shown on the screen.'));
    logBox.scrollTop = logBox.scrollHeight;
  }

  function paintModels() {
    if (!models) return;
    clear(modelSel);
    models.models.forEach((m) => {
      const sec = m.speed != null ? ' · ' + Math.round(60 * m.speed) + ' s per minute' : '';
      const tag = m.recommended ? ' ★ recommended' : m.live === false && m.speed != null ? ' · too slow here' : '';
      modelSel.append(h('option', { value: m.id }, MODEL_NAMES[m.id] + tag + sec + (m.downloaded ? '' : ' · ' + m.mb + ' MB download')));
    });
    const st = cap && cap.state.status && cap.state.status.model;
    const cur = models.models.some((m) => m.id === st) ? st : (models.current || models.recommended);
    if (cur) modelSel.value = cur;
  }
  async function loadModels() { try { models = await (await ensure()).models(); paintModels(); } catch (e) { /* not running */ } }
  async function pickModel(id) {
    const m = models && models.models.find((x) => x.id === id);
    if (m && m.live === false && m.speed != null && !(await confirmBox('Use the ' + MODEL_NAMES[id] + ' model?', 'It is likely too slow on this PC: the captions may fall behind the preacher.', 'Use it anyway'))) { paintModels(); return; }
    await act((c) => c.setModel(id))();
  }

  // ---------------------------------------------------------------- check each part
  const STEPS = [
    ['parts', 'Program parts', 'Everything the translator needs is installed (and whether there is a graphics card).'],
    ['words', 'Bibles and word list', 'The Afrikaans and English Bibles for exact verse quotes, and the never-translate, Adventist and slang lists.'],
    ['mt', 'Translation model', 'Translates three test sentences: Adventist words, a name that must stay, and slang.'],
    ['speed', 'PC speed and speech model', 'Measures how fast this PC recognises speech and recommends the most accurate model that keeps up live.'],
    ['speech', 'Speech recognition', 'Recognises a short Afrikaans recording and counts the words it got right.'],
    ['sound', 'Sound input', 'Listens to the chosen input for 3 seconds: play something from the sound desk, or speak, while it runs.'],
    ['quality', 'Translation quality', 'Translates 50 test sentences (Adventist, names, slang and Kaaps, sermon, Bible quotes) and counts the correct ones.'],
    ['link', 'Captions on the screen', 'Shows a test caption on the screen for 4 seconds.'],
  ];
  function openChecks() {
    const rows = STEPS.map(([id, title, info]) => {
      const mark = h('span.ck-mark', '•');
      const detail = h('div.note.ck-detail');
      const row = h('li.ck-row', mark, h('div.ck-body', h('div.ck-title', h('b', title), tip(info)), detail));
      return { id, row, mark, detail };
    });
    const modelsBox = h('div.ck-models');
    const runBtn = h('button.btn.primary', { type: 'button', onclick: () => runAll() }, icon('check'), h('span', 'Run all checks'));
    const body = h('div.ck', h('ol.ck-list', ...rows.map((r) => r.row)), modelsBox);
    modal({ title: 'Check each part of the translator', body: h('div', h('div.row.wrap', runBtn, tip('Each part of the translator is checked in turn, the same checks as the first-time setup. It takes about a minute; the sound check listens for 3 seconds.')), body), wide: true });
    const set = (r, ok, text) => {
      r.mark.textContent = ok === true ? '✔' : ok === false ? '✘' : ok === 'run' ? '…' : '!';
      r.mark.className = 'ck-mark ' + (ok === true ? 'ok' : ok === false ? 'bad' : ok === 'run' ? 'run' : 'warn');
      r.detail.textContent = text || '';
    };
    async function runAll() {
      runBtn.disabled = true;
      const c = await ensure();
      for (const r of rows) {
        set(r, 'run', r.id === 'sound' ? 'Listening for 3 seconds: play sound from the sound desk now…' : 'Checking…');
        if (r.id === 'link') {
          if (ctx.live) { ctx.live.caption('Test caption · live translation is working'); setTimeout(() => ctx.live.caption(''), 4000); }
          set(r, ctx.live ? true : false, ctx.live ? 'A test caption is on the screen now (if a screen is connected).' : 'No screen connected.');
          continue;
        }
        try {
          const res = await c.check(r.id, Cv().device);
          set(r, res.ok, res.detail);
          if (r.id === 'speed' && res.models) { models = res.models; paintModels(); showModels(modelsBox); }
        } catch (e) {
          set(r, false, r.id === 'parts' ? 'The translator is not running on this PC. Start it, then check again.' : String(e.message || e));
          if (r.id === 'parts') break;
        }
      }
      runBtn.disabled = false;
    }
  }
  function showModels(where) {
    clear(where);
    if (!models) return;
    where.append(h('h3', 'Speech model for this PC ', tip('Bigger models hear more accurately but need a faster PC. Times are how long this PC takes to recognise one minute of speech; under ' + Math.round(60 * models.limit) + ' seconds keeps up live. Change it at any time.')));
    const list = h('div.ck-mlist');
    models.models.forEach((m) => {
      const cur = ((cap && cap.state.status && cap.state.status.model) || models.current) === m.id;
      list.append(h('label.ck-m' + (m.recommended ? '.rec' : '') + (cur ? '.cur' : ''),
        h('input', { type: 'radio', name: 'ckm', value: m.id, checked: cur, onchange: () => pickModel(m.id) }),
        h('b', MODEL_NAMES[m.id]), m.recommended ? h('span.ck-rec', '★ recommended') : null,
        h('span.note', m.words),
        h('span.note', (m.speed != null ? (m.measured ? '' : '≈ ') + Math.round(60 * m.speed) + ' s per minute' + (m.live ? '' : ' · too slow here') : '') +
          (m.downloaded ? ' · downloaded' : ' · ' + m.mb + ' MB download'))));
    });
    where.append(list);
  }

  // ---------------------------------------------------------------- build
  async function build() {
    if (built) return;
    built = true;
    getBox.append(h('h3', 'Get the translator ', tip('A small program for the church PC: it listens to the sound desk, writes down the Afrikaans and translates whole sentences into English, without internet. Install it once; afterwards it starts with its desktop shortcut (or by itself with Windows).')),
      h('div.row.wrap',
        h('a.btn.primary', { href: INSTALLER_URL }, icon('download'), h('span', 'Download the installer (Windows)')),
        h('a.btn.sm', { href: 'download/sda-sabbath-translator.zip', download: '' }, h('span', 'Zip instead')),
        tip('The zip is the same translator without an installer: unzip it and double-click start-translator.bat.')),
      h('ol.note.cap-steps',
        h('li', 'Run SDA-Sabbath-Translator-Setup.exe. If Windows warns, choose More info → Run anyway.'),
        h('li', 'The first start sets itself up step by step (about 15 minutes, with internet): it checks each part, tests the PC speed and lets you choose the speech model.'),
        h('li', 'Come back here and press Start listening.')));
    const settingsBox = h('details.tr-more', h('summary', icon('settings'), h('span', 'Settings')),
      h('div.form.tr-form',
        h('label', 'Captions on the screen'), h('div.row', toggle('Show the English captions', Cv().show !== false, setC('show')), tip('The English sentence appears on the caption line at the bottom of the screen; Bible verses and hymns stay visible above it.')),
        h('label', 'Caption stays'), seg([['8', '8 s'], ['12', '12 s'], ['20', '20 s']], String(Cv().clearAfter || 12), (v) => settings.set('captions.clearAfter', +v)),
        h('label', 'Bible quotes in'), h('div.row', seg([['web', 'World English Bible'], ['kjv', 'King James']], Cv().english || 'web', (v) => { settings.set('captions.english', v); act((c) => c.setEnglish(v))(); }),
          tip('When the preacher quotes the Afrikaans Bible, the caption is that verse from this English Bible, word for word, with its reference.')),
        h('label', 'Suggestions'), h('div.row', toggle('Offer the verses and hymns that are mentioned', Cv().suggest !== false, setC('suggest')),
          tip('Cards beside Next / Live with Put on Next and Present. Nothing goes on the screen by itself.')),
        h('label', 'Never translate'), h('div.col', { style: { gap: '6px', minWidth: 0 } },
          h('textarea.field', { rows: 3, 'aria-label': 'Names never to translate', placeholder: 'One per line: Pastoor Botha, Broer Fortuin, Riebeek-Kasteel …', style: { width: '100%', maxWidth: '520px' },
            value: Cv().keep || '', onchange: (e) => settings.set('captions.keep', e.target.value) }),
          h('div.row', h('span.note', 'People, places, the church'), tip('Shown exactly as said, never translated. The church name and town (Settings → Church) are added by themselves, and the translator has its own list of common names, places and church words.'))),
        h('label', 'Translator address'), h('div.row', h('input.field', { value: Cv().url || 'http://127.0.0.1:7790', 'aria-label': 'Translator address', style: { width: '240px' },
          onchange: (e) => settings.set('captions.url', e.target.value.trim() || 'http://127.0.0.1:7790') }), tip('Only change this when the translator runs on another PC (started with --lan).')),
        h('label', 'Get the translator'), h('div.row.wrap', h('a.btn.sm', { href: INSTALLER_URL }, icon('download'), h('span', 'Installer (Windows)')),
          h('a.btn.sm', { href: 'download/sda-sabbath-translator.zip', download: '' }, h('span', 'Zip')))));
    box.append(
      h('div.tr-bar',
        toggle('Live translation', !!Cv().on, (v) => { settings.set('captions.on', v); setTimeout(act((c) => c.status()), 300); }),
        h('div.tr-state', dot, stText), h('div.grow'), meter, startBtn,
        tip('Live translation listens to the sermon in Afrikaans and shows it in English on the screen, a few seconds behind the preacher. It runs on this PC without internet. Machine translation can make mistakes: captions help, they do not replace an interpreter.')),
      h('div.tr-pick',
        h('label.tr-l', h('span', 'Sound input'), devSel),
        h('label.tr-l', h('span', 'Speech model'), modelSel),
        h('button.btn', { type: 'button', onclick: openChecks }, icon('check'), h('span', 'Check each part'))),
      busy, getBox, logBox, settingsBox);
    paint({});
    const c = await ensure();
    c.watch(true);
    c.status().then(() => loadModels()).catch(() => paint(c.state));
  }
  return {
    el,
    onShow: () => { build(); if (cap) { cap.watch(true); cap.status().catch(() => {}); loadModels(); } },
    onHide: () => { if (cap) cap.watch(false); },
    open() { return null; },
  };
}
