// Tools → Translate: live translation of the sermon (Afrikaans → English captions) through the SDA Sabbath
// translator on this PC (translator/livetranslate.py, js/core/livecaptions.js). Moved here from Settings.
import { h, clear } from '../core/util.js';
import { icon } from '../core/icons.js';
import { seg, toggle, toast } from '../core/ui.js';

export default function create(ctx) {
  const { settings } = ctx;
  const box = h('div.card.st-card.tr-card');
  const el = h('section.translate-tab',
    h('div.toolbar', h('h2', 'Translate'), h('span.note.hide-sm', 'Live translation: Afrikaans sermon → English captions'), h('div.grow')),
    h('div.scroll.tr-scroll', box));
  let built = false;
  async function build() {
    if (built) return;
    built = true;
      const Cv = () => settings.v.captions || {};
      const setC = (k) => (v) => settings.set('captions.' + k, v);
      const st = h('span.note', Cv().on ? 'Connecting…' : 'Off');
      const devSel = h('select.field', { 'aria-label': 'Sound input', onchange: () => settings.set('captions.device', devSel.value) });
      const logBox = h('div.cap-log', { 'aria-live': 'off' });
      const urlInp = h('input.field', { value: Cv().url || 'http://127.0.0.1:7790', 'aria-label': 'Translator address', style: { width: '260px' },
        onchange: () => settings.set('captions.url', urlInp.value.trim() || 'http://127.0.0.1:7790') });
      let cap = null;
      const paintLog = (s) => {
        clear(logBox);
        (s.lines || []).slice(-8).forEach((l) => logBox.append(h('div.cap-line', h('div.cap-af', { lang: 'af' }, l.af),
          h('div.cap-en', l.en, l.verse ? h('b', ' (' + l.verse.ref + ')') : null))));
        if (!(s.lines || []).length) logBox.append(h('p.note', 'The last sentences appear here while the translator listens.'));
      };
      const paintStatus = (s) => {
        const x = s.status;
        if (!Cv().on) st.textContent = 'Off';
        else if (!s.connected && !x) st.textContent = 'The translator is not running on this PC. Get it below (once), or start it with the "SDA Sabbath translator" shortcut on the desktop.';
        else if (x && x.running) st.textContent = 'Listening on ' + x.device + ' · ' + x.asr + ' on ' + (x.hw === 'cuda' ? 'the graphics card' : 'the processor') + (x.rtf ? ' · ' + (x.rtf < 0.8 ? 'keeping up' : 'falling behind') + ' (' + x.rtf + '× real time)' : '');
        else if (x && x.error) st.textContent = x.error;
        else st.textContent = 'Translator ready (' + ((x && x.asr) || '') + '). Choose the sound input and press Start listening.';
        if (x && x.devices && devSel.options.length !== x.devices.length + 1) {
          clear(devSel); devSel.append(h('option', { value: '' }, 'Default input'));
          x.devices.forEach((d) => devSel.append(h('option', { value: String(d.id) }, d.name)));
          devSel.value = Cv().device || '';
        }
      };
      const ensure = async () => {
        if (!cap) { cap = (await import('../core/livecaptions.js')).captions; const off = cap.on((s) => { paintStatus(s); paintLog(s); }); box._cleanup = off; }
        return cap;
      };
      const act = (f) => async () => { try { const c = await ensure(); await f(c); } catch (e) { toast('Translator: ' + (e.message || e), 'err'); } };
      box.append(h('div.form',
        h('label', 'Live translation'), toggle('Afrikaans sermon → English captions', !!Cv().on, (v) => { settings.set('captions.on', v); if (v) setTimeout(act((c) => c.status()), 400); else paintStatus({}); }),
        h('label', 'Status'), h('div.col', { style: { gap: '6px' } }, st,
          h('div.row.wrap', h('button.btn.sm', { type: 'button', onclick: act((c) => c.status()) }, icon('check'), h('span', 'Check')))),
        h('label', 'Sound input'), h('div.row.wrap', devSel,
          h('button.btn.sm.primary', { type: 'button', onclick: act((c) => c.start(Cv().device)) }, icon('play'), h('span', 'Start listening')),
          h('button.btn.sm', { type: 'button', onclick: act((c) => c.stop()) }, icon('stop'), h('span', 'Stop'))),
        h('label', 'On the screen'), toggle('Show the English captions', Cv().show !== false, setC('show')),
        h('label', 'Caption stays'), seg([['8', '8 s'], ['12', '12 s'], ['20', '20 s']], String(Cv().clearAfter || 12), (v) => settings.set('captions.clearAfter', +v)),
        h('label', 'Bible quotes'), seg([['web', 'World English Bible'], ['kjv', 'King James']], Cv().english || 'web', (v) => { settings.set('captions.english', v); act((c) => c.setEnglish(v))(); }),
        h('label', 'Suggestions'), toggle('Offer the verses and hymns the preacher names (Set as Next)', Cv().suggest !== false, setC('suggest')),
        h('label', 'Never translate'), h('div.col', { style: { gap: '6px', minWidth: 0 } },
          h('textarea.field', { rows: 3, 'aria-label': 'Names never to translate', placeholder: 'One per line: pastor Botha, Broer Fortuin, Riebeek-Kasteel …', style: { width: '100%', maxWidth: '520px' },
            value: Cv().keep || '', onchange: (e) => settings.set('captions.keep', e.target.value) }),
          h('span.note', 'Names and words shown exactly as said (people, places, the church). The church name and town from Settings → Church are added by themselves.')),
        h('label', 'Get the translator'), h('div.col', { style: { gap: '6px', minWidth: 0 } },
          h('div.row.wrap', h('a.btn.sm.primary', { href: 'download/sda-sabbath-translator.zip', download: '' }, icon('download'), h('span', 'Download for Windows'))),
          h('ol.note.cap-steps',
            h('li', 'Unzip it, for example into Documents, on the church PC.'),
            h('li', 'Double-click start-translator.bat. The first time (with internet, about 15 minutes) it installs itself, downloads the Afrikaans models, checks how fast the PC is and tests the translation. It adds a desktop shortcut and can start by itself with Windows.'),
            h('li', 'Come back here, switch Live translation on and press Start listening.'))),
        h('label', 'Translator address'), urlInp,
        h('label', 'Last sentences'), logBox,
        h('label', ''), h('p.note', 'The translator runs on this PC, without internet: it listens to the sound desk, writes down the Afrikaans with an Afrikaans speech model, ' +
          'and translates whole sentences, with Adventist words (Sabbath, Spirit of Prophecy, Second Coming…) kept right. When the preacher quotes the Bible, the English verse itself is shown. ' +
          'Install it once from the translator folder of SDA Sabbath (README there), then start it with start-translator.bat before the service. Machine translation can make mistakes; captions help, they do not replace an interpreter.')));
      paintLog({ lines: [] });
      if (Cv().on) act((c) => { paintStatus(c.state); paintLog(c.state); return c.status(); })();
  
  }
  return { el, onShow: () => { build(); }, open() { return null; } };
}
