// First start: a short setup — sign in, install on this device, your church and its languages, your screens, the
// hymn sound, the Bibles and hymnbooks for your languages (downloaded now, so they work offline), ready for Sabbath
// without internet, statistics — then the app.
// Shown once (Settings → About → Run the setup again shows it again). Everything can be changed later.
import { h, clear } from '../core/util.js';
import { icon } from '../core/icons.js';
import { seg, toast } from '../core/ui.js';
import { settings } from '../core/settings.js';
import { cloud } from '../core/cloud.js';
import { churchForm } from './church-form.js';
import { screensPanel } from './screens-panel.js';
import { signInBox, statsToggle } from './account.js';
import { restoreButtons } from './backup-ui.js';
import { installed, installSteps } from '../core/installer.js';
import { persistStorage } from '../core/db.js';
import { languageChoices, langKey, langName, sortBibles, sortHymnals } from '../core/langs.js';

// How this device is used on Sabbath decides the sound preset (js/core/musicengine.js SOUND_PRESETS).
const ROLES = [['pc', 'The church PC', 'best'], ['laptop', 'A laptop', 'balanced'], ['phone', 'A phone or tablet', 'light']];
const HALLS = [['small', 'Small'], ['church', 'Medium'], ['large', 'Large']];
const SPEAKERS = [['pa', 'Sound desk / PA'], ['small', 'Built-in or small speakers'], ['tv', 'TV or projector speakers']];

const L3 = () => { const L = settings.v.church && Array.isArray(settings.v.church.languages) ? settings.v.church.languages : []; return [L[0] || 'en', L[1] || '', L[2] || '']; };

export function needsSetup() { return !settings.v.app.setupDone || (cloud.requireSignIn() && !cloud.user && navigator.onLine !== false); }

/** Show the setup. onClose is called when it is finished or skipped. */
export function openWelcome({ onClose, only } = {}) {
  const steps = [];
  // Installing comes first of all (before signing in): the app then has its own icon and works offline, and the
  // rest of the setup can carry on in the installed app.
  if (only !== 'account' && !installed()) steps.push('install');
  if (cloud.enabled() && (!cloud.user || only === 'account')) steps.push('account');
  // Phones and tablets (touch only) do not drive projector windows, and the statistics step only makes sense
  // when this copy has the cloud switched on.
  const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
  if (only !== 'account') steps.push('church', ...(touchOnly ? [] : ['screens']), 'sound', 'languages', 'ready', ...(cloud.enabled() ? ['stats'] : []), 'done');
  let i = 0;
  const returnTo = document.activeElement;
  const live = h('div.sr', { 'aria-live': 'polite' });
  const wrap = h('div.welcome', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcome-title', 'aria-label': 'Set up SDA Sabbath' });
  const card = h('div.welcome-card');
  wrap.append(card, live);
  // A real modal for keyboard and screen-reader users: the page behind is inert, Tab stays inside,
  // Escape skips the rest of the setup, and focus goes back where it was afterwards.
  const behind = Array.prototype.filter.call(document.body.children, (el) => el !== wrap && !el.inert && !el.classList.contains('toasts'));
  behind.forEach((el) => { el.inert = true; });
  document.body.append(wrap);
  const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (e.target && e.target.closest && e.target.closest('select')) return;
      e.preventDefault(); e.stopPropagation();
      if (steps[i] === 'account') { if (!mustSignIn()) next(); } else close();
      return;
    }
    if (e.key !== 'Tab') return;
    const f = Array.prototype.filter.call(wrap.querySelectorAll(FOCUSABLE), (x) => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === first || !wrap.contains(at) || at === wrap.querySelector('#welcome-title'))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !wrap.contains(at))) { e.preventDefault(); first.focus(); }
  });
  // Focus the step's heading and say which step this is.
  const focusStep = () => {
    const t = wrap.querySelector('#welcome-title');
    if (t) { try { t.focus({ preventScroll: false }); } catch (e) { /* */ } }
    live.textContent = 'Step ' + (i + 1) + ' of ' + steps.length + (t ? ': ' + t.textContent : '');
  };
  const mustSignIn = () => cloud.requireSignIn() && !cloud.user && navigator.onLine !== false;

  const stopTest = () => import('../core/hymnmusic.js').then((m) => { if (m.music.state && m.music.state.title === 'Sound test') m.music.stop(); }).catch(() => {});
  const close = () => {
    stopTest();
    if (mustSignIn()) { i = Math.max(0, steps.indexOf('account')); paint(); toast('Please sign in first. (Without internet you can carry on and sign in later.)', 'err', 5000); return; }
    if (only !== 'account') settings.set('app.setupDone', true);
    wrap.remove();
    behind.forEach((el) => { el.inert = false; });
    if (returnTo && returnTo.isConnected && typeof returnTo.focus === 'function') { try { returnTo.focus({ preventScroll: true }); } catch (e) { /* */ } }
    if (onClose) onClose();
  };
  const next = () => { if (i < steps.length - 1) { i++; paint(); } else close(); };
  const back = () => { if (i > 0) { i--; paint(); } };

  let head, navFor;
  function paint() { paintStep(); setTimeout(focusStep, 60); }
  function paintStep() {
    clear(card);
    stopTest();
    const step = steps[i];
    const dots = h('div.welcome-dots', ...steps.map((s, j) => h('span' + (j === i ? '.on' : j < i ? '.done' : ''))));
    head = (title, sub) => h('div', h('div.welcome-brand', h('img', { src: 'icons/favicon.svg', alt: '', width: 34, height: 34 }), h('span', 'SDA Sabbath')), dots, h('h2#welcome-title', { tabindex: '-1' }, title), sub ? h('p.note', sub) : null);
    const nav = (label = 'Next', { skip = true, onNext = null } = {}) => h('div.welcome-nav',
      i > 0 ? h('button.btn', { type: 'button', onclick: back }, 'Back') : h('span'),
      h('div.grow'),
      skip && step !== 'done' && !(step === 'account' && mustSignIn()) ? h('button.btn.ghost', { type: 'button', onclick: step === 'account' || step === 'install' ? next : close }, step === 'account' || step === 'install' ? 'Not now' : 'Skip the rest') : null,
      h('button.btn.primary', { type: 'button', onclick: onNext || next }, label));
    navFor = nav;
    let body;
    if (step === 'account') {
      body = h('div.col', { style: { gap: '12px' } },
        h('p', 'Sign in once on this device. It lets you send suggestions and see the answers, and it helps us see how many churches use SDA Sabbath. SDA Sabbath keeps working without internet.'),
        signInBox({ onDone: () => next(), compact: true }));
      card.append(head('Welcome!', 'Free presentation software for Seventh-day Adventist churches.'), body,
        h('div.welcome-nav', h('div.grow'), mustSignIn() ? null : h('button.btn.ghost', { type: 'button', onclick: next }, 'Not now')));
      return;
    }
    if (step === 'install') { paintInstall(); return; }
    if (step === 'church') {
      body = h('div.col', { style: { gap: '12px' } },
        restoreButtons(),
        h('label.muted', 'Languages of your services'),
        languagePickers(),
        h('p.note', 'The main language opens first; the second can be shown beside it (two Bibles side by side). Later in this setup the Bible and hymnbook of each language are downloaded, so they are ready without internet on Sabbath. Change them any time in Settings → Bibles & hymns.'),
        churchForm(settings));
      card.append(head('Your church', 'Used on banners (name, sunset times for Sabbath), the logo slide and the stage screen.'), body, nav());
      return;
    }
    if (step === 'languages') { paintLanguages(); return; }
    if (step === 'screens') {
      card.append(head('Your screens', 'What does this PC drive on Sabbath? You can change this any time in Settings → Displays.'), screensPanel({ intro: true }), nav());
      return;
    }
    if (step === 'sound') { paintSound(); return; }
    if (step === 'ready') { paintReady(); return; }
    if (step === 'stats') {
      card.append(head('Help make SDA Sabbath better'),
        h('div.col', { style: { gap: '12px' } },
          statsToggle(),
          h('p.note', 'Ideas or problems? Press the speech bubble at the top.')),
        nav());
      return;
    }
    const tips = touchOnly
      ? [['Tap', 'A verse, stanza or slide: it goes on Next (green)'], ['Present', 'The button at the top right shows Next on the screen (red: Live)'], ['‹ ›', 'Previous / next slide in the bar at the bottom'], ['■ ◎ ✕', 'Black screen, logo and clear: in the bottom bar while a screen is connected'], ['🔍', 'Go to: type “John 3:16” or “hymn 73”']]
      : [['F5', 'Present: show what is Next on the projector'], ['→ / Space', 'Next slide'], ['B', 'Black screen'], ['L', 'Logo'], ['C', 'Clear'], ['/', 'Go to: type “John 3:16” or “hymn 73”'], ['Ctrl+Z', 'Back to what was on screen before'], ['?', 'All keyboard shortcuts']];
    card.append(head('All set!', touchOnly ? 'How it works on this device:' : 'A few keys to remember:'),
      h('div.welcome-keys', ...tips.map(([k, t]) => h('div.row', h('kbd', k), h('span', t)))),
      h('p.note', 'Ideas or problems? The speech-bubble button at the top (or Settings → Account) sends a comment at any time.'),
      h('div.welcome-nav', i > 0 ? h('button.btn', { type: 'button', onclick: back }, 'Back') : h('span'), h('div.grow'),
        h('button.btn.primary', { type: 'button', onclick: close }, icon('check'), h('span', 'Start using SDA Sabbath'))));
  }
  // ------------------------------------------------------------ install first
  function paintInstall() {
    const ctx = window.selah || {};
    const row = h('div.col', { style: { gap: '10px' } });
    const paintRow = () => {
      clear(row);
      if (installed()) { row.append(h('p.inst-ok', icon('check'), h('span', 'Installed. SDA Sabbath now has its own icon and opens without the browser or internet. Carry on with the setup here, or in the app window.'))); return; }
      // One clear button on the first page. When the browser offers its own install window, the button opens it;
      // when it does not (Safari, Firefox, or the browser is not ready yet), the button shows the steps instead.
      const steps = h('p', { hidden: true }, installSteps());
      const btn = h('button.btn.primary', { type: 'button', style: { alignSelf: 'flex-start' }, onclick: async () => {
        if (ctx.installPrompt) { await ctx.promptInstall(); paintRow(); return; }
        steps.hidden = false;
      } }, icon('download'), h('span', 'Install SDA Sabbath'));
      row.append(btn, steps,
        h('p.note', 'It then opens from its own icon and works without internet on Sabbath.'));
    };
    paintRow();
    if (ctx.onInstallChange) ctx.onInstallChange(() => { if (row.isConnected) paintRow(); });
    card.append(head('Install SDA Sabbath', 'First, put SDA Sabbath on this device as an app.'), row, navFor());
  }

  // ------------------------------------------------------------ the church's languages
  // A name in another script sorts by its English name in brackets: "Русский (Russian)" under R, not after Z.
  const langSortKey = (n) => (/^[^\u0000-ɏ]/.test(n) && /\(([^)]+)\)\s*$/.test(n) ? /\(([^)]+)\)\s*$/.exec(n)[1] : n);
  function languagePickers() {
    // Only the languages, A to Z (no headings): every one has a Bible or a hymnbook to download, or one built in.
    // Left out: names that are only a code, and Klingon (in the Bible lists, not a language of a service).
    const list = languageChoices()
      .filter((l) => (l.hymns.length || l.bibles.length || l.builtinBible || l.builtinHymns) && l.name !== l.key && l.key !== 'tlh')
      .sort((a, b) => langSortKey(a.name).localeCompare(langSortKey(b.name), 'en', { sensitivity: 'base' }));
    const opts = (none) => [none ? h('option', { value: '' }, 'None') : null, ...list.map((l) => h('option', { value: l.key }, l.name))];
    const L = L3();
    const sel = [0, 1, 2].map((k) => {
      const x = h('select.field', { 'aria-label': ['Main language', 'Second language', 'Third language'][k] }, opts(k > 0));
      x.value = L[k];
      if (x.value !== L[k]) x.value = k ? '' : 'en';
      x.addEventListener('change', () => save(k));
      return x;
    });
    function save(changed) {
      const v = sel.map((x) => x.value);
      for (let k = 1; k < 3; k++) if (v[k] && v.indexOf(v[k]) < k) { v[k] = ''; sel[k].value = ''; }   // each language once
      if (!v[0]) { v[0] = 'en'; sel[0].value = 'en'; }
      settings.set('church.languages', v);
      // Each service language gets its Shared Hymns book (songs churches share in that language).
      import('./hymn-import.js').then((m) => m.setSharedLangs(settings, v.filter(Boolean))).catch(() => {});
      // Until the downloads: the built-in books of the main language.
      if (changed === 0) {
        if (v[0] === 'en') { settings.set('bible.primary', 'kjv'); settings.set('hymns.book', 'sda-online'); }
        if (v[0] === 'af') settings.set('hymns.book', 'afrikaans-sda');
      }
    }
    return h('div.form', h('label', 'Main language'), sel[0], h('label', 'Second language'), sel[1], h('label', 'Third language'), sel[2]);
  }

  // ------------------------------------------------------------ Bibles and hymnbooks for those languages
  // Choices and downloads live outside the step, so Back / Next and a download still running keep them.
  const pick = {};            // language → { bible: option value, hymn: option value }
  const jobs = new Map();     // 'b:xh' / 'h:xh' → { state: 'run' | 'ok' | 'err', text }
  const statusEls = new Map();
  let aoItems = null, aoTried = false, running = null;
  async function paintLanguages() {
    const [bd, hi, bs] = await Promise.all([import('../core/bibledata.js'), import('./hymn-import.js'), import('../core/biblesources.js')]);
    if (steps[i] !== 'languages') return;
    if (!aoTried && navigator.onLine !== false) {   // bible.helloao.org has Bibles the built-in lists lack (Sesotho, Setswana …)
      aoTried = true;
      bs.loadAoList(15000).then((x) => { aoItems = x; if (steps[i] === 'languages' && !running) paintLanguages(); }).catch(() => {});
    }
    const haveBibles = new Set((await bd.listTranslations(true)).map((t) => t.id));
    const builtin = (await bd.listTranslations(true)).filter((t) => t.src !== 'imported');
    const haveHymns = new Set((await hi.addedHymnbooks()).map((b) => String(b.id)));
    const counts = await hi.overlayCounts();
    const filled = (counts['sda-online'] || 0) > 0, afWords = counts['afrikaans-sda'] || 0;
    if (steps[i] !== 'languages') return;
    const langs = L3().filter(Boolean).filter((x, k, a) => a.indexOf(x) === k);
    const all = languageChoices();
    // Option values: 'have:<translation id>' (built in or already added), 'b:<n>' / 'h:<n>' (to download), 'builtin', ''.
    const plan = langs.map((key) => {
      const L = all.find((l) => l.key === key) || { key, name: langName(key), hymns: [], bibles: [] };
      const extra = (aoItems || []).filter((t) => langKey(t.lang, t.langName) === key);
      const dlB = sortBibles(L.bibles.concat(extra));
      const own = builtin.filter((t) => langKey(t.lang) === key || (key === 'af' && t.id === 'afr53'));
      const bOpts = [
        ...own.map((t) => ['have:' + t.id, t.name + (t.src === 'private' ? ' (included with this installation)' : ' (built in)')]),
        ...dlB.map((t, n) => [haveBibles.has(bs.bibleIdOf(t)) ? 'have:' + bs.bibleIdOf(t) : 'b:' + n,
          t.name + ' · ' + (t.full ? 'whole Bible' : 'New Testament') + (t.mb ? ', ' + t.mb + ' MB' : '') + ' · ' + bs.BIBLE_SOURCES[t.src].label + (haveBibles.has(bs.bibleIdOf(t)) ? ' ✓' : '')]),
        ...(pick[key] && pick[key].ownBible ? [['have:' + pick[key].ownBible.id, pick[key].ownBible.name + ' (your file) ✓']] : []),
        ['', 'No Bible for this language'],
        ['file', 'Our church’s own Bible file…'],
      ];
      const dlH = sortHymnals(L.hymns);
      const hOpts = [
        ...dlH.map((e, n) => [haveHymns.has(e.id) || (e.id === 'web-rejnac-english' && filled) ? 'hhave:' + e.id : 'h:' + n,
          (e.id === 'web-rejnac-english' ? 'SDA Hymnal 1985 with words (keeps the hymn music)' : e.name) + ' · ' + e.hymns + ' hymns' + (haveHymns.has(e.id) ? ' ✓' : '')]),
        L.builtinHymns ? ['builtin', key === 'en' ? 'Only the built-in books (SDA Hymnal titles, Church Hymnal 1941 words)'
          : 'Advent Lofliedere (built in' + (afWords ? ', words for ' + afWords + ' hymns added ✓)' : ', numbers and titles)')] : null,
        pick[key] && pick[key].ownHymn ? ['own', pick[key].ownHymn.name + ' (your file) ✓'] : null,
        ['', 'No hymnbook for this language'],
        ['file', 'Our church’s own hymnbook file…'],
      ].filter(Boolean);
      const p = pick[key] || (pick[key] = {});
      const first = (opts) => (opts.find(([v]) => v !== 'file') || opts[0])[0];
      if (!bOpts.some(([v]) => v === p.bible)) p.bible = first(bOpts);
      if (!hOpts.some(([v]) => v === p.hymn)) p.hymn = first(hOpts);
      return { key, L, dlB, dlH, bOpts, hOpts, p, own };
    });
    const pending = () => plan.flatMap((x) => [
      /^b:/.test(x.p.bible) ? { job: 'b:' + x.key, kind: 'bible', item: x.dlB[+x.p.bible.slice(2)], label: x.L.name + ' Bible' } : null,
      /^h:/.test(x.p.hymn) ? { job: 'h:' + x.key, kind: 'hymn', item: x.dlH[+x.p.hymn.slice(2)], label: x.L.name + ' hymnbook' } : null,
    ]).filter((j) => j && !(jobs.get(j.job) && jobs.get(j.job).state === 'ok'));
    statusEls.clear();
    const status = (job) => { const j = jobs.get(job); const el = h('span.note', j ? j.text : ''); statusEls.set(job, el); return el; };
    const select = (opts, value, onchange, label) => {
      const x = h('select.field', { 'aria-label': label }, opts.map(([v, t]) => h('option', { value: v }, t)));
      x.value = value; x.addEventListener('change', () => { onchange(x.value); paintLanguages(); });
      return x;
    };
    // A church's own licensed file, where nothing can be downloaded (a Bible Society text, Advent Lofliedere words …).
    const fileBox = (x, kind) => {
      const inp = h('input', { type: 'file', accept: kind === 'bible' ? '.json,.xml,.csv,.tsv,.txt' : '.vpc,.json,.txt', 'aria-label': x.L.name + (kind === 'bible' ? ' Bible file' : ' hymnbook file') });
      const msg = h('span.note', kind === 'bible' ? 'Zefania or OSIS XML, JSON or CSV, from the Bible Society or your church. It stays on this device.'
        : 'VideoPsalm (.vpc or .json), SDA Sabbath (.json) or text with “# 73 Title”. Only words your church may use; they stay on this device.');
      inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        msg.textContent = 'Reading ' + f.name + '…';
        try {
          if (kind === 'bible') {
            const parsed = await bd.parseBibleFile(f);
            const m = parsed.meta || {};
            const id = 'imp-own-' + x.key.replace(/[^a-z0-9]/g, '');
            const name = m.name || m.shortname || x.L.name + ' Bible';
            await bd.saveImported({ id, abbr: String(m.abbr || x.key).toUpperCase().slice(0, 8), name, lang: bs.langOf({ lang: x.key, langName: x.L.name }), license: 'Imported on this device' }, parsed);
            x.p.ownBible = { id, name }; x.p.bible = 'have:' + id;
          } else {
            const book = await (await import('../core/hymnparse.js')).parseHymnFile(f);
            if (!book.hymns.length) throw new Error('No hymns found in ' + f.name + '.');
            if (x.key === 'af' || x.key === 'en') {   // the words go into the built-in book, by number
              const n = await hi.fillBuiltInWords(x.key === 'af' ? 'afrikaans-sda' : 'sda-online', book.hymns);
              if (!n) throw new Error('None of its numbers match ' + (x.key === 'af' ? 'Advent Lofliedere' : 'the SDA Hymnal') + '.');
              x.p.hymn = 'builtin';
              toast('Words added for ' + n + ' hymns.', 'ok');
            } else {
              const id = 'book-own-' + x.key.replace(/[^a-z0-9]/g, '');
              const name = book.name && book.name !== f.name.replace(/\.[^.]+$/, '') ? book.name : x.L.name + ' hymnbook';
              await (await import('../core/db.js')).db.put('hymnbooks', id, { id, name, short: String(book.short || x.key.toUpperCase()).slice(0, 8), lang: x.key, hymns: book.hymns, licence: 'Imported on this device', added: Date.now() });
              x.p.ownHymn = { id, name }; x.p.hymn = 'own';
            }
            hi.announceHymnbooks(null);
          }
          paintLanguages();
        } catch (e) { msg.textContent = e.message; }
      });
      return h('div.col', { style: { gap: '4px' } }, inp, msg);
    };
    const gapNote = (x, kind) => {
      if (kind === 'bible' && !x.dlB.length && !x.own.length && !x.p.ownBible) return h('span.note', 'No ' + x.L.name + ' Bible is openly available to download. If your church has one as a file (for example from the Bible Society), choose “Our church’s own Bible file”.');
      if (kind === 'hymn' && x.key === 'af' && !afWords) return h('span.note', 'The words of Advent Lofliedere are copyrighted, so they cannot be downloaded. If your church has them as a file (VideoPsalm or another program), choose “Our church’s own hymnbook file”: the words fill the built-in book by number.');
      if (kind === 'hymn' && !x.dlH.length && !x.L.builtinHymns && !x.p.ownHymn) return h('span.note', 'No ' + x.L.name + ' hymnbook is in the download list yet. If your church has one as a file, choose “Our church’s own hymnbook file”.');
      return null;
    };
    const rows = plan.map((x, n) => h('div.card', { style: { padding: '12px 14px' } },
      h('b', (n === 0 ? 'Main language: ' : n === 1 ? 'Second language: ' : 'Third language: ') + x.L.name),
      h('div.form', { style: { marginTop: '8px' } },
        h('label', 'Bible'), h('div.col', { style: { gap: '4px' } }, select(x.bOpts, x.p.bible, (v) => { x.p.bible = v; }, x.L.name + ' Bible'), status('b:' + x.key),
          x.p.bible === 'file' ? fileBox(x, 'bible') : gapNote(x, 'bible')),
        h('label', 'Hymns'), h('div.col', { style: { gap: '4px' } }, select(x.hOpts, x.p.hymn, (v) => { x.p.hymn = v; }, x.L.name + ' hymnbook'), status('h:' + x.key),
          x.p.hymn === 'file' ? fileBox(x, 'hymn') : gapNote(x, 'hymn')),
        h('label', 'Shared Hymns'), h('p.inst-ok', icon('check'), h('span', 'Shared Hymns – ' + x.L.name + ' is added: songs churches share in ' + x.L.name + ' arrive by themselves when online, and you can add your own.')))));
    const todo = pending();
    const goBtn = h('button.btn.primary', { type: 'button', disabled: !!running || !todo.length || navigator.onLine === false, onclick: () => start() },
      icon('download'), h('span', running ? 'Downloading…' : todo.length ? 'Download now (' + todo.length + ')' : 'Everything is on this device'));
    const body = h('div.col', { style: { gap: '10px' } },
      ...rows,
      h('div.row.wrap', goBtn,
        navigator.onLine === false ? h('span.note', 'No internet now: you can add them later in Settings → Bibles & hymns.') : h('span.note', todo.length ? 'Once only; afterwards they work without internet.' : '')),
      h('p.note', 'Bible and hymn words belong to their owners. These are shared for worship, but check that your church may use them (for example, many SDA Hymnal texts are under copyright, and a live stream needs a CCLI Streaming Licence).'));
    clear(card);
    card.append(head('Bibles and hymns for your languages', 'Choose what to download for each language. Everything is kept on this device, so it is ready on Sabbath without internet.'), body,
      navFor('Next', { onNext: () => { if (!running && pending().length && navigator.onLine !== false) { start(); toast('Your Bibles and hymnbooks are downloading in the background.', '', 4000); } else if (!running) apply(); next(); } }));

    function setJob(job, state, text) { jobs.set(job, { state, text }); const el = statusEls.get(job); if (el && el.isConnected) el.textContent = text; }
    function start() {
      if (running) return running;
      const list = pending();
      running = (async () => {
        let ok = 0, bad = 0;
        for (const j of list) {
          setJob(j.job, 'run', 'Starting…');
          try {
            if (j.kind === 'bible') await bs.addBible(j.item, (t) => setJob(j.job, 'run', t));
            else await hi.installHymnal(j.item, (t) => setJob(j.job, 'run', t));
            setJob(j.job, 'ok', 'On this device ✓'); ok++;
          } catch (e) {
            setJob(j.job, 'err', 'Failed: ' + (e.name === 'AbortError' ? 'it took too long' : e.name === 'TypeError' ? 'no connection' : e.message) + '. Try again here or in Settings → Bibles & hymns.'); bad++;
          }
        }
        running = null;
        apply();
        toast(bad ? ok + ' downloaded, ' + bad + ' failed: try again in Settings → Bibles & hymns.' : 'Your Bibles and hymnbooks are ready without internet.', bad ? 'err' : 'ok', 6000);
        if (steps[i] === 'languages') paintLanguages();
      })();
      paintLanguages();
      return running;
    }
    // The main language opens first; the second language's Bible goes beside it.
    async function apply() {
      const ids = new Set((await bd.listTranslations(true)).map((t) => t.id));
      const books = new Set((await hi.addedHymnbooks()).map((b) => String(b.id)));
      const bibleId = (x) => {
        const v = x.p.bible || '';
        const id = v.startsWith('have:') ? v.slice(5) : v.startsWith('b:') ? bs.bibleIdOf(x.dlB[+v.slice(2)]) : '';
        return id && ids.has(id) ? id : '';
      };
      const hymnBook = (x) => {
        const v = x.p.hymn || '';
        const e = v.startsWith('h:') ? x.dlH[+v.slice(2)] : v.startsWith('hhave:') ? x.dlH.find((d) => d.id === v.slice(6)) : null;
        if (v === 'own' && x.p.ownHymn) return x.p.ownHymn.id;
        if (v === 'builtin' || (e && e.id === 'web-rejnac-english')) return x.key === 'af' ? 'afrikaans-sda' : 'sda-online';
        return e && books.has(e.id) ? e.id : '';
      };
      const [m, second] = plan;
      if (m) {
        const b = bibleId(m); if (b) settings.set('bible.primary', b);
        const hb = hymnBook(m) || (second && hymnBook(second)); if (hb) settings.set('hymns.book', hb);
      }
      settings.set('bible.parallel', second ? bibleId(second) : '');
      window.dispatchEvent(new CustomEvent('selah-bibles'));
      hi.announceHymnbooks(settings.v.hymns.book);
    }
  }

  // ------------------------------------------------------------ hymn sound
  async function paintSound() {
    const hm = await import('../core/hymnmusic.js');
    if (steps[i] !== 'sound') return;
    const { music, SOUND_PRESETS, EQ_PRESETS, PACKS, packFor, hqStored, hqPrefetch } = hm;
    const H = () => settings.v.hymns;
    const set = (k, v) => settings.set('hymns.' + k, v);
    let role = settings.v.app.deviceRole || (touchOnly ? 'phone' : 'pc');
    let hall = H().musicRoom === 'small' || H().musicRoom === 'large' ? H().musicRoom : 'church';
    let spk = settings.v.app.speakers || (touchOnly ? 'small' : 'pa');
    // The role's preset, then the hall and the speakers on top of it.
    const applyAll = () => {
      const pr = SOUND_PRESETS[ROLES.find((r) => r[0] === role)[2]];
      Object.entries(pr[1]).forEach(([k, v]) => set(k, v));
      set('musicPreset', ROLES.find((r) => r[0] === role)[2]);
      if (pr[1].musicRoom !== 'off' || role !== 'phone') set('musicRoom', hall);
      const eq = spk === 'small' ? 'small' : spk === 'tv' ? 'clear' : hall === 'large' ? 'hall' : (pr[1].musicEqPreset || 'flat');
      set('musicEqPreset', eq); set('musicEq', EQ_PRESETS[eq][1].slice());
      if (hall !== (pr[1].musicRoom || 'church') || eq !== (pr[1].musicEqPreset || 'flat')) set('musicPreset', 'custom');
      settings.set('app.deviceRole', role); settings.set('app.speakers', spk);
      music.applyEffects();
      paintPack();
    };
    const packBox = h('div.col', { style: { gap: '6px', alignItems: 'flex-start' } });
    async function paintPack() {
      const pack = packFor(H().musicHQ);
      clear(packBox);
      if (!pack) { packBox.append(h('p.note', 'Standard instruments, built in: light enough for any phone. Change this any time in Hymns → options.')); return; }
      const P = PACKS[pack];
      if (await hqStored(pack)) { packBox.append(h('p.inst-ok', icon('check'), h('span', P.label + ' instruments are downloaded on this device and work without internet.'))); return; }
      const prog = h('span.note');
      const dl = h('button.btn', { type: 'button', onclick: async () => {
        dl.disabled = true; prog.textContent = 'Starting…';
        const ok = await hqPrefetch(pack, (t, pct) => { prog.textContent = pct + '%'; });
        // Say what happened and what to do: the download only works while this device can reach the website.
        if (ok) paintPack(); else { dl.disabled = false; prog.textContent = navigator.onLine === false ? 'No internet. Connect, then press Download again.'
          : 'Could not reach ' + location.host + '. Check the internet, then press Download again.'; }
      } }, icon('download'), h('span', 'Download now (' + P.mb + ' MB, once)'));
      packBox.append(h('p.note', (pack === 'studio'
        ? 'Studio instruments: a concert grand recorded at 16 loudness levels with its full natural ring, and a pipe organ with five stops. '
        : 'High-quality instruments: a recorded concert grand and a church pipe organ. ') + 'Until the download is done, hymns play with the standard sounds.'),
        h('div.row.wrap', dl, prog));
    }
    const testBtn = h('button.btn', { type: 'button', onclick: async () => {
      if (music.state && music.state.playing && music.state.title === 'Sound test') { music.stop(); testBtn.replaceChildren(icon('play'), h('span', 'Play a test')); return; }
      testBtn.replaceChildren(icon('stop'), h('span', 'Stop the test'));
      try { await music.playTest(); } catch (e) { testBtn.replaceChildren(icon('play'), h('span', 'Play a test')); toast(e.message, 'err'); }
    } }, icon('play'), h('span', 'Play a test'));
    const body = h('div.col', { style: { gap: '10px' } },
      h('label.muted', 'This device on Sabbath'),
      seg(ROLES.map(([k, l]) => [k, l]), role, (v) => { role = v; applyAll(); }),
      packBox,
      h('label.muted', 'Your church hall'),
      seg(HALLS, hall, (v) => { hall = v; applyAll(); }),
      h('label.muted', 'The music is heard through'),
      seg(SPEAKERS, spk, (v) => { spk = v; applyAll(); }),
      h('div.row.wrap', testBtn, h('span.note', 'Hymn 73 with these settings. Adjust the volume on the sound desk, not only here.')),
      h('p.note', spk === 'pa' ? 'Best sound: connect the PC to the sound desk with a USB audio interface or a DI box (not the headphone socket), and avoid Bluetooth (it lags behind the words).'
        : 'For a bigger sound later, connect the PC to a sound desk with a USB audio interface or DI box. Fine-tune everything in Hymns → options → Music.'));
    applyAll();
    card.append(head('Hymn music', 'Accompaniment for the hymns, played by this device. Three questions set the best sound for your church.'), body, navFor());
    focusStep();
  }

  // ------------------------------------------------------------ ready for Sabbath (offline, install, data)
  function paintReady() {
    const ctx = window.selah || {};
    const offRow = h('div'), instRow = h('div'), dataRow = h('div');
    const paintOff = () => {
      clear(offRow);
      const off = ctx.offlineState ? ctx.offlineState() : { ready: false, total: 0, done: 0 };
      const pct = off.total ? Math.min(100, Math.round(off.done / off.total * 100)) : 0;
      offRow.append(off.ready ? h('p.inst-ok', icon('check'), h('span', 'Saved on this device: Bibles, hymns, music and the app work without internet.'))
        : h('p.note', off.total ? 'Saving everything for use without internet… ' + pct + '%. Keep the internet on until it finishes.' : 'Checking that everything is saved on this device…'));
    };
    const paintInst = () => {
      clear(instRow);
      if (installed()) { instRow.append(h('p.inst-ok', icon('check'), h('span', 'Installed: SDA Sabbath has its own icon and opens without the browser.'))); return; }
      instRow.append(ctx.installPrompt
        ? h('button.btn.primary', { type: 'button', onclick: async () => { await ctx.promptInstall(); paintInst(); } }, icon('download'), h('span', 'Install SDA Sabbath'))
        : h('p.note', h('b', 'Install it: '), installSteps()));
    };
    persistStorage().then((ok) => {
      clear(dataRow);
      dataRow.append(ok ? h('p.inst-ok', icon('check'), h('span', 'Your plans, hymnbooks, Bibles and slides are kept even when the device runs low on space.'))
        : h('p.note', 'This browser may clear saved plans and slides when space runs low. Installing the app (above) protects them; Settings → Backup keeps a copy.'));
    });
    paintOff(); paintInst();
    if (ctx.onInstallChange) ctx.onInstallChange(() => { if (offRow.isConnected) { paintOff(); paintInst(); } });
    const body = h('div.col', { style: { gap: '10px' } }, offRow, instRow, dataRow,
      touchOnly ? null : h('div.row.wrap', h('button.btn', { type: 'button', onclick: () => ctx.clickerSetup && ctx.clickerSetup() }, icon('settings'), h('span', 'Test a presentation clicker')),
        h('span.note', 'If you use one: check every button does what you expect.')));
    card.append(head('Ready for Sabbath', 'So nothing depends on the internet or the browser during the service.'), body, navFor());
  }
  paint();
}
