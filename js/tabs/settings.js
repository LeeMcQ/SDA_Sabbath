// Settings: how the screen looks, displays, Bibles, the app itself, and what's coming next.
import { h, clear, uid, fmtBytes, download, readText } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, seg, toggle, toast, confirmBox, select } from '../core/ui.js';
import { db, persistStorage } from '../core/db.js';
import { createStage } from '../core/render.js';
import { listTranslations, deleteImported, resetCaches } from '../core/bibledata.js';
import { importBibleDialog } from './bible-import.js';
import { listScreens } from '../core/link.js';

export default function create(ctx) {
  const { settings, live, link } = ctx;
  const D = () => settings.v.display;
  const setD = (k) => (v) => settings.set('display.' + k, v);
  const el = h('section');
  const scroll = h('div.scroll.pad', { style: { flex: '1' } });
  const nav = h('div.row.wrap');
  el.append(h('div.toolbar', h('h2', 'Settings'), h('div.grow'), nav), scroll);

  const sections = [];
  const section = (id, title, build) => { sections.push({ id, title, build }); };

  // ------------------------------------------------------------ Screen
  section('screen', 'Screen', (box) => {
    const host = h('div.stage-host');
    const prev = h('div.screen', { style: { maxWidth: '560px', marginBottom: '14px' } }, host);
    const stage = createStage(host, { placeholderOnly: true });
    const sample = { kind: 'text', variant: 'bible', refPos: settings.v.bible.refPos,
      html: '<span class="v"><span class="vn">16</span>For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.</span>',
      foot: 'John 3:16', footR: 'KJV' };
    const redraw = async () => { stage.setAspect(link.aspect()); prev.style.aspectRatio = String(link.aspect()); const s = await live.buildStyle(); stage.applyStyle(s); stage.show(sample); };
    const off = settings.on('change:display', redraw);
    box._cleanup = off;

    const imgPick = (key, label) => {
      const inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onchange: async () => {
        const f = inp.files[0]; if (!f) return;
        const { prepareImage } = await import('../lib/pdf.js');
        const r = await prepareImage(f, { boxW: 1920, boxH: 1080, quality: 0.88 });
        const id = 'img-' + uid();
        await db.put('files', id, { id, kind: 'image', name: f.name, type: r.full.type, size: r.full.size, blob: r.full, added: Date.now() });
        const old = D()[key];
        settings.set('display.' + key, id);
        if (old) db.del('files', old);
        rebuild();
      } });
      return h('div.row', h('button.btn.sm', { type: 'button', onclick: () => inp.click() }, icon('upload'), D()[key] ? 'Change' : 'Choose…'),
        D()[key] ? h('button.btn.sm', { type: 'button', onclick: () => { const old = D()[key]; settings.set('display.' + key, null); db.del('files', old); rebuild(); } }, 'Remove') : null,
        h('span.note', label), inp);
    };
    const color = (k, label) => { const c = h('input', { type: 'color', value: D()[k], 'aria-label': label, style: { width: '56px', height: '34px', border: 0, background: 'none' }, oninput: () => setD(k)(c.value) }); c.value = D()[k]; return c; };
    const range = (k, min, max, step, fmt, label) => {
      const out = h('span.note', fmt(D()[k]));
      const r = h('input', { type: 'range', min, max, step, 'aria-label': label, style: { flex: '1', maxWidth: '260px' }, oninput: () => { out.textContent = fmt(+r.value); r.setAttribute('aria-valuetext', fmt(+r.value)); }, onchange: () => setD(k)(+r.value) });
      r.value = D()[k];
      return h('div.row', r, out);
    };
    box.append(prev, h('div.form',
      h('label', 'Font'), seg([['sans', 'Clear sans'], ['serif', 'Serif'], ['system', 'System']], D().font, setD('font')),
      h('label', 'Weight'), seg([['bold', 'Bold'], ['regular', 'Regular']], D().weight, setD('weight')),
      h('label', 'Text colour'), color('fg', 'Text colour'),
      h('label', 'Verse-number colour'), color('accent', 'Verse-number colour'),
      h('label', 'Background colour'), color('bg', 'Background colour'),
      h('label', 'Background picture'), imgPick('bgImage', 'Shown behind Bible and hymn text'),
      h('label', 'Darken picture'), range('bgDim', 0, 0.85, 0.05, (v) => Math.round(v * 100) + '%', 'Darken picture'),
      h('label', 'Text shadow'), toggle('Outline text so it reads on pictures', D().shadow, setD('shadow')),
      h('label', 'Alignment'), seg([['center', 'Centre'], ['left', 'Left']], D().align, setD('align')),
      h('label', 'Margin'), range('pad', 20, 200, 4, (v) => v + ' px', 'Margin'),
      h('label', 'Smallest text'), range('minFont', 36, 110, 2, (v) => v + ' px', 'Smallest text'),
      h('label', 'Largest text'), range('maxFont', 90, 240, 5, (v) => v + ' px', 'Largest text'),
      h('label', 'Changing slides'), seg([['fade', 'Fade'], ['cut', 'Cut']], D().transition, setD('transition')),
      h('label', 'Fade time'), range('fade', 100, 1000, 50, (v) => v + ' ms', 'Fade time'),
      h('label', 'Screen shape'), seg([['auto', 'Automatic'], ['16:9', '16:9'], ['16:10', '16:10'], ['4:3', '4:3']], D().aspect, setD('aspect')),
      h('label', 'Clear shows'), seg([['background', 'Background'], ['black', 'Black'], ['logo', 'Logo']], D().clearShows, setD('clearShows')),
      h('label', 'Logo picture'), imgPick('logo', 'Church logo for the Logo button'),
      h('label', 'Logo text'), (() => { const i = h('input.field', { value: D().logoText || '', 'aria-label': 'Logo text', placeholder: 'e.g. Malmesbury SDA Church', onchange: () => setD('logoText')(i.value) }); return i; })(),
    ), h('p.note', { style: { marginTop: '10px' } }, 'Text always grows to fill the screen. “Smallest text” decides when a passage is split over more slides.'));
    setTimeout(redraw, 30);
  });

  // ------------------------------------------------------------ Displays
  section('display', 'Displays', (box) => {
    const stateLine = h('p', link.kind ? (link.ready ? 'Presenting to ' : 'Connecting to ') + link.info.label + (link.info.w ? ' (' + link.info.w + ' × ' + link.info.h + ')' : '') : 'No display connected.');
    const screens = h('div.list');
    box.append(stateLine,
      h('div.row.wrap', { style: { margin: '10px 0' } },
        h('button.btn', { type: 'button', onclick: () => link.openWindow({ prompt: true }) }, icon('present'), 'Open display window'),
        'getScreenDetails' in window ? h('button.btn', { type: 'button', onclick: async () => {
          const r = await listScreens();
          clear(screens);
          if (!r) { toast('Screen list not allowed. Allow “Window management” for this site.', 'err'); return; }
          r.screens.forEach((s, i) => screens.appendChild(h('button', { type: 'button', onclick: () => { settings.set('display.screenLabel', s.label || ''); link.openWindow({ prompt: true }); } },
            icon('pc'), h('span.grow', (s.label || 'Screen ' + (i + 1)) + (s === r.current ? ' (this one)' : '') + (settings.v.display.screenLabel === s.label ? '  ✓ default' : '')), h('span.faint', s.width + ' × ' + s.height))));
        } }, icon('pc'), 'Detect screens') : null,
        link.canCast() ? h('button.btn', { type: 'button', onclick: () => link.openCast().catch((e) => toast(e.message, 'err')) }, icon('cast'), 'Cast') : null,
        link.kind ? h('button.btn.danger', { type: 'button', onclick: () => { link.close(); rebuild(); } }, icon('x'), 'Close display') : null),
      screens,
      h('p.note', 'Tip: in Chrome or Edge, allow “Window management” once and SDA Sabbath opens the display straight onto the projector every time. Click the projector screen once at the start so videos may play with sound (not needed once Selah is installed).'));
    // Phone remote via the companion
    const comp = ctx.companion;
    const rc = h('div.card', h('h3', 'Phone remote and network displays'));
    if (comp) {
      const url = (comp.urls && comp.urls[0] || location.origin) + '/?remote=1' + (comp.pin_hint ? '' : '');
      rc.append(h('p.note', 'Scan with a phone on the church Wi-Fi to control the screen from the phone. PIN: ' + (comp.pin || 'shown in the companion window') + '.'));
      const qrBox = h('div.qr');
      import('../../vendor/qrcode.min.js').then((m) => {
        const q = m.default(0, 'M'); q.addData(url); q.make();
        qrBox.appendChild(h('img', { src: q.createDataURL(6, 0), alt: 'QR code for ' + url }));
      }).catch(() => {});
      rc.append(h('div.row.wrap', qrBox, h('div.col', h('code', url), h('p.note', 'TV or second PC as the screen: open ' + (comp.urls && comp.urls[0] || location.origin) + '/display.html?via=ws&pin=' + (comp.pin || 'PIN')))));
    } else {
      rc.append(h('p.note', 'Run the SDA Sabbath companion on the church PC to control the screen from a phone, use a smart-TV browser as the screen, play videos straight from the PC’s Videos folder, and convert PowerPoint files exactly. Then open Selah from the address it shows.'));
    }
    box.append(rc);
  });

  // ------------------------------------------------------------ Bibles & hymns
  section('bibles', 'Bibles & hymns', async (box) => {
    const list = h('div.list');
    box.append(h('div.row.wrap', { style: { marginBottom: '10px' } },
      h('button.btn.primary', { type: 'button', onclick: () => importBibleDialog(async () => { resetCaches(); rebuild(); }) }, icon('plus'), 'Add a Bible (NIV, Xhosa, …)'),
      h('button.btn', { type: 'button', onclick: async () => { const t = await ctx.tab('hymns'); await ctx.showTab('hymns'); toast('Use the ⋯ menu in Hymns to import, export or add hymns.'); return t; } }, icon('hymn'), 'Manage hymnbooks')),
    list,
    h('p.note', { style: { marginTop: '10px' } }, 'Built in: KJV and WEB (public domain) and the Afrikaans 1933/53 Bible. NIV and the 1975 Xhosa Bible are copyrighted, so each church adds its own licensed copy here; it is converted once and stays offline on this device.'));
    const ts = await listTranslations(true);
    ts.forEach((t) => list.appendChild(h('div.li', icon('bible'), h('span.grow', h('div', t.abbr + ' — ' + t.name), h('div.note', { builtin: 'Built in', private: 'Included with this installation', imported: 'Added on this device' }[t.src] + (t.license ? ' · ' + t.license : ''))),
      t.src === 'imported' ? btn('trash', 'Remove ' + t.abbr, async () => {
        if (await confirmBox('Remove ' + t.abbr + '?', 'Delete the offline copy of ' + t.name + ' from this device?', 'Remove', true)) { await deleteImported(t.id); rebuild(); }
      }, { cls: 'sm' }) : null)));
  });

  // ------------------------------------------------------------ App
  section('app', 'App', async (box) => {
    const A = settings.v.app;
    const lpNow = settings.lowPower();
    const storage = h('span.note', '…');
    const cache = h('span.note', 'Checking…');
    const onCache = (e) => { cache.textContent = e.detail.done >= e.detail.total ? 'Everything is stored for offline use.' : 'Downloading for offline use: ' + e.detail.done + ' / ' + e.detail.total + ' files'; };
    window.addEventListener('selah-cache', onCache);
    box._cleanup = () => window.removeEventListener('selah-cache', onCache);
    if (ctx.cacheProgress) onCache({ detail: ctx.cacheProgress });
    else offlineStatus().then((t) => { if (cache.textContent === 'Checking…') cache.textContent = t; });
    box.append(h('div.form',
      h('label', 'Colours'), seg([['dark', 'Dark'], ['light', 'Light'], ['auto', 'Follow device']], A.theme, (v) => settings.set('app.theme', v)),
      h('label', 'Tabs on the'), seg([['left', 'Left'], ['right', 'Right']], A.railSide, (v) => settings.set('app.railSide', v)),
      h('label', 'Next / Live monitors'), toggle('Show monitors', A.monitors !== false, (v) => settings.set('app.monitors', v)),
      h('label', 'Low-power mode'), seg([['auto', 'Automatic' + (A.lowPower == null ? (lpNow ? ' (on)' : ' (off)') : '')], ['on', 'On'], ['off', 'Off']], A.lowPower == null ? 'auto' : A.lowPower ? 'on' : 'off', (v) => settings.set('app.lowPower', v === 'auto' ? null : v === 'on')),
      h('label', ''), h('p.note', 'Low-power mode turns off fades and the live video thumbnail, renders slides at 1280 px and shares screens at 15 frames per second — for old PCs and 1–2 GB phones.'),
      h('label', 'Install'), ctx.installPrompt ? h('button.btn', { type: 'button', onclick: async () => { await ctx.promptInstall(); rebuild(); } }, icon('download'), 'Install SDA Sabbath') : h('span.note', window.matchMedia('(display-mode: standalone)').matches ? 'Installed.' : 'Use the browser menu → Install app / Add to Home screen.'),
      h('label', 'Offline'), cache,
      h('label', 'Storage'), h('div.row.wrap', storage, h('button.btn.sm', { type: 'button', onclick: async () => { const ok = await persistStorage(); toast(ok ? 'SDA Sabbath’s data is protected from automatic clean-up.' : 'The browser did not allow it yet — install Selah first.', ok ? 'ok' : ''); } }, 'Protect data')),
      h('label', 'Backup'), h('div.row.wrap',
        h('button.btn.sm', { type: 'button', onclick: exportBackup }, icon('download'), 'Export settings & plans'),
        h('button.btn.sm', { type: 'button', onclick: importBackup }, icon('upload'), 'Import')),
      h('label', 'Reset'), h('button.btn.sm.danger', { type: 'button', onclick: async () => { if (await confirmBox('Reset settings?', 'Return all settings to their defaults? Bibles, slides, hymns and plans stay.', 'Reset', true)) { settings.reset(); rebuild(); } } }, 'Reset settings'),
      h('label', 'Version'), h('span.note', 'SDA Sabbath ' + ctx.VERSION)));
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      storage.textContent = fmtBytes(e.usage) + ' used of ' + fmtBytes(e.quota) + ' available';
    }
  });


  // ------------------------------------------------------------ AI providers
  section('ai', 'AI', (box) => {
    const A = settings.v.ai || {};
    const PROVIDERS = {
      openai: {
        name: 'OpenAI',
        text: true, image: true,
        hint: 'Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a>. Needs a paid account. Keys start with <strong>sk-</strong>.',
        models: 'Text: gpt-5-mini · Images: gpt-image-2.5-flare',
      },
      google: {
        name: 'Google Gemini',
        text: true, image: true,
        hint: 'Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>. No credit card needed. Keys start with <strong>AIza</strong> or <strong>AQ.</strong>',
        models: 'Text: gemini-3.8-flash · Images: gemini-nano-banana-2.1',
      },
      xai: {
        name: 'xAI Grok',
        text: true, image: true,
        hint: 'Get a key at <a href="https://console.x.ai" target="_blank" rel="noopener">console.x.ai</a>. Keys start with <strong>xai-</strong>.',
        models: 'Text: grok-4.7 · Images: grok-imagine-image-2.0',
      },
      together: {
        name: 'Together AI',
        text: true, image: true,
        hint: 'Get a key at <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener">api.together.xyz</a>. Free tier available. Keys start with <strong>tgp_</strong> or similar.',
        models: 'Text: MiniMax-M3 · Images: FLUX.2-dev',
      },
      openrouter: {
        name: 'OpenRouter',
        text: true, image: true,
        hint: 'Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>. One key for many models. Keys start with <strong>sk-or-</strong>.',
        models: 'Text + image models via one key',
      },
      anthropic: {
        name: 'Anthropic Claude',
        text: true, image: false,
        hint: 'Get a key at <a href="https://console.anthropic.com" target="_blank" rel="noopener">console.anthropic.com</a>. Text only (excellent research). Keys start with <strong>sk-ant-</strong>.',
        models: 'Text: claude-haiku-5-5',
      },
    };

    const providerSel = h('select.field', {
      value: A.provider || 'openai',
      onchange: () => { settings.set('ai.provider', providerSel.value); updateHint(); },
    });
    Object.keys(PROVIDERS).forEach((id) => {
      const p = PROVIDERS[id];
      const label = p.name + (p.image ? ' · text + images' : ' · text only');
      providerSel.appendChild(h('option', { value: id }, label));
    });

    const keyInp = h('input.field', {
      type: 'password',
      value: A.apiKey || '',
      placeholder: 'Paste API key',
      style: { width: '100%' },
      onchange: () => settings.set('ai.apiKey', keyInp.value.trim()),
    });
    const showBtn = h('button.btn.sm', { type: 'button', onclick: () => {
      keyInp.type = keyInp.type === 'password' ? 'text' : 'password';
      showBtn.textContent = keyInp.type === 'password' ? 'Show' : 'Hide';
    } }, 'Show');

    const hintEl = h('div.note', { style: { marginTop: '6px', lineHeight: '1.45' } });
    const modelEl = h('p.note', { style: { marginTop: '4px' } });

    function updateHint() {
      const p = PROVIDERS[providerSel.value] || PROVIDERS.openai;
      hintEl.innerHTML = p.hint;
      modelEl.textContent = p.models;
    }
    updateHint();

    const modelInp = h('input.field', {
      value: A.model || '',
      placeholder: 'Optional model override',
      style: { width: '100%' },
      onchange: () => settings.set('ai.model', modelInp.value.trim()),
    });

    box.append(h('div.form',
      h('label', 'Provider'), providerSel,
      hintEl,
      modelEl,
      h('label', 'API key'),
      h('div.row', { style: { gap: '8px', alignItems: 'center' } }, keyInp, showBtn),
      h('p.note', 'Stored only on this device. Never share it.'),
      h('label', 'Model (optional)'), modelInp,
      h('p.note', 'Leave blank to use the recommended default for the selected provider.')));
  });

  // ------------------------------------------------------------ Coming next
  section('next', 'Live translation', (box) => {
    box.append(h('div.card', h('h3', h('span', icon('translate'), ' Live translation — coming later')),
      h('p.note', 'The sermon will be heard through a microphone, turned into text and translated (for example English → Afrikaans or isiXhosa), and shown as a caption line at the bottom of the screen while Bible verses and hymns stay visible. The caption line is already built into the display; the speech and translation part will be added in a later version.'),
      h('label.switch', { title: 'Not available yet' }, h('input', { type: 'checkbox', disabled: true }), h('span', 'Show live captions (not available yet)'))));
  });

  section('about', 'About', (box) => {
    box.append(h('p', 'SDA Sabbath — a free, offline church presenter made for Seventh-day Adventist media teams.'),
      h('p.note', { style: { marginTop: '8px' } }, 'Bibles: KJV (public domain), World English Bible (public domain), Afrikaanse Bybel 1933/53. Fonts: Atkinson Hyperlegible Next and Source Serif 4 (SIL Open Font License). PDF rendering: pdf.js (Apache 2.0). ZIP reading: fflate (MIT). QR codes: qrcode-generator (MIT). Sample hymn words are in the public domain.'));
  });

  // How much of the app is stored for offline use (shown even when the download finished in an earlier visit).
  async function offlineStatus() {
    try {
      if (!('serviceWorker' in navigator) || !window.isSecureContext) return 'Offline use needs https:// or the SDA Sabbath companion.';
      if (!navigator.serviceWorker.controller || !window.caches) return 'Not stored yet — keep this page open for a minute, or install SDA Sabbath.';
      const man = await (await fetch('asset-manifest.json', { cache: 'no-store' })).json();
      const c = await caches.open('selah-' + man.version);
      const have = (await c.keys()).length;
      return have >= man.files.length ? 'Everything is stored for offline use (' + fmtBytes(man.bytes) + ').' : 'Stored for offline use: ' + have + ' / ' + man.files.length + ' files.';
    } catch (e) { return navigator.serviceWorker && navigator.serviceWorker.controller ? 'Stored for offline use.' : ''; }
  }

  async function exportBackup() {
    const data = { app: 'selah', version: 1, settings: settings.v, plans: await db.all('plans'), hymnbooks: await db.all('hymnbooks') };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'sda-sabbath-backup.json');
  }
  function importBackup() {
    const inp = h('input', { type: 'file', accept: '.json' });
    inp.onchange = async () => {
      try {
        const d = JSON.parse(await readText(inp.files[0]));
        if (d.app !== 'selah') throw new Error('Not an SDA Sabbath backup.');
        if (d.settings) { localStorage.setItem('selah.settings.v1', JSON.stringify(d.settings)); }
        for (const p of d.plans || []) await db.put('plans', p.id, p);
        for (const b of d.hymnbooks || []) await db.put('hymnbooks', b.id, b);
        toast('Backup restored. Reloading…', 'ok'); setTimeout(() => location.reload(), 800);
      } catch (e) { toast(e.message, 'err'); }
    };
    inp.click();
  }

  let active = 'screen';
  let curBox = null;
  async function rebuild() {
    if (curBox && curBox._cleanup) curBox._cleanup();
    clear(nav); clear(scroll);
    sections.forEach((s) => nav.appendChild(h('button.chip', { type: 'button', 'aria-pressed': String(s.id === active), onclick: () => { active = s.id; rebuild(); } }, s.title)));
    const sec = sections.find((s) => s.id === active);
    curBox = h('div', { style: { maxWidth: '920px' } });
    scroll.appendChild(curBox);
    await sec.build(curBox);
  }
  link.on('state', () => { if (active === 'display' && !el.hidden) rebuild(); });

  return { el, onShow: rebuild, onHide() { if (curBox && curBox._cleanup) curBox._cleanup(); }, open() { return null; } };
}
