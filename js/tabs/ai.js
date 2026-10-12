// AI tab: on-the-spot banner / screensaver generator and quick child-safe research summaries.
// Banner generation is fully offline (canvas). Research uses a built-in safe knowledge base
// for common topics and produces short, readable slides. Content is filtered for church use.
import { h, clear, esc } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, toast } from '../core/ui.js';

const BANNER_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Sabbath Welcome',
    master: 'Peaceful Sabbath morning welcome banner with soft light, open Bible, and warm tones',
    fields: ['Church name', 'Welcome message', 'Date'],
    defaults: ['Malmesbury SDA', 'Welcome to Sabbath Worship', ''],
  },
  {
    id: 'verse',
    name: 'Verse of the Day',
    master: 'Elegant scripture banner with large verse text and soft background',
    fields: ['Verse text', 'Reference', 'Theme colour'],
    defaults: ['Remember the sabbath day, to keep it holy.', 'Exodus 20:8', '#2c5f4e'],
  },
  {
    id: 'event',
    name: 'Event / Announcement',
    master: 'Clean event banner with clear title, date and location',
    fields: ['Event title', 'When', 'Where / details'],
    defaults: ['Family Week of Prayer', 'This Sabbath', 'Main sanctuary'],
  },
  {
    id: 'offering',
    name: 'Offering Invitation',
    master: 'Gentle offering banner with giving theme',
    fields: ['Heading', 'Verse or note', 'Church name'],
    defaults: ['Offering', 'God loves a cheerful giver', ''],
  },
  {
    id: 'closing',
    name: 'Closing / Benediction',
    master: 'Calm closing banner with blessing text',
    fields: ['Blessing text', 'Reference', 'Church name'],
    defaults: ['The Lord bless you and keep you', 'Numbers 6:24', ''],
  },
];

const BANNER_STYLES = [
  { id: 'classic', name: 'Classic' },
  { id: 'warm', name: 'Warm' },
  { id: 'cool', name: 'Cool' },
  { id: 'gold', name: 'Gold' },
  { id: 'deep', name: 'Deep' },
  { id: 'light', name: 'Light' },
];

const SAFE_TOPICS = {
  sabbath: {
    title: 'The Sabbath',
    slides: [
      { h: 'What is the Sabbath?', t: 'The Sabbath is the seventh day of the week. God rested on this day after creating the world and blessed it.\n\nIt is a gift of rest and worship for everyone.' },
      { h: 'Why we keep it', t: 'Jesus said the Sabbath was made for people. We rest from everyday work, spend time with God and family, and remember that He is our Creator.\n\nExodus 20:8–11 · Mark 2:27' },
    ],
  },
  creation: {
    title: 'Creation',
    slides: [
      { h: 'In the beginning', t: 'God made the heavens, the earth, the sea, and everything in them in six days. On the seventh day He rested.\n\nEverything He made was good.' },
      { h: 'Why it matters', t: 'We are not an accident. God made us with love and purpose. The Sabbath reminds us of His creative power every week.\n\nGenesis 1–2' },
    ],
  },
  secondcoming: {
    title: 'Jesus is Coming Again',
    slides: [
      { h: 'The promise', t: 'Jesus promised He would come back. He will come in the clouds with great glory so that everyone can see Him.\n\nJohn 14:1–3 · Acts 1:11' },
      { h: 'How we wait', t: 'We wait with hope, not fear. We love others, share the good news, and keep our hearts ready by trusting Jesus every day.' },
    ],
  },
  prayer: {
    title: 'Prayer',
    slides: [
      { h: 'Talking with God', t: 'Prayer is talking to God as a friend. We can thank Him, ask for help, and pray for others.\n\nHe always listens.' },
      { h: 'A simple way', t: '1. Thank God for something.\n2. Tell Him what is on your heart.\n3. Ask for help for yourself and others.\n4. End in Jesus’ name.\n\n1 Thessalonians 5:17' },
    ],
  },
  baptism: {
    title: 'Baptism',
    slides: [
      { h: 'What is baptism?', t: 'Baptism is a special way of showing that we belong to Jesus. A person is lowered into water and raised again.\n\nIt pictures dying to the old life and rising to a new one with Jesus.' },
      { h: 'Who can be baptised?', t: 'Anyone who believes in Jesus and wants to follow Him can be baptised. It is a joyful public step of faith.\n\nMatthew 28:19 · Acts 2:38' },
    ],
  },
  communion: {
    title: 'The Lord’s Supper',
    slides: [
      { h: 'Remembering Jesus', t: 'Before the cross, Jesus shared bread and grape juice with His disciples. He asked us to do this to remember Him.\n\nThe bread reminds us of His body. The cup reminds us of His blood.' },
      { h: 'The Ordinance of Humility', t: 'Jesus also washed His disciples’ feet. In many SDA churches we do the same before communion as a symbol of love and service.\n\nJohn 13 · 1 Corinthians 11:23–26' },
    ],
  },
  tithing: {
    title: 'Tithe and Offerings',
    slides: [
      { h: 'Returning to God', t: 'A tithe is one tenth of what we receive. Many people also give offerings as a thank-you gift to God.\n\nIt is a way of trusting Him and supporting His work.' },
      { h: 'A cheerful heart', t: 'God loves a cheerful giver. We give because He first gave to us, not because we are forced.\n\nMalachi 3:10 · 2 Corinthians 9:7' },
    ],
  },
};

const BLOCKED = /\b(violence|weapon|drug|sex|adult|horror|occult|hate|kill|murder)\b/i;

function makeTextCue(title, slides) {
  return {
    tab: 'ai',
    title,
    sub: 'AI',
    deck: {
      kind: 'text',
      frames: slides.map((s) => ({
        kind: 'text',
        variant: 'plain',
        html: (s.h ? '<div class="f-head">' + esc(s.h) + '</div>' : '') + '<div>' + esc(s.t).replace(/\n/g, '<br>') + '</div>',
      })),
    },
  };
}

export default function create(ctx) {
  const { live, toast: showToast } = ctx;
  let currentTemplate = BANNER_TEMPLATES[0];
  const fieldInputs = [];
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const preview = h('div', { style: { marginTop: '8px', borderRadius: '8px', overflow: 'hidden', maxWidth: '100%', background: '#111' } });
  preview.appendChild(canvas);
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.display = 'block';

  const templateSel = h('select.field', {
    onchange: () => {
      currentTemplate = BANNER_TEMPLATES.find((t) => t.id === templateSel.value) || BANNER_TEMPLATES[0];
      renderFields();
    },
  });
  BANNER_TEMPLATES.forEach((t) => templateSel.appendChild(h('option', { value: t.id }, t.name)));
  const styleSel = h('select.field', { style: { marginTop: '6px' }, onchange: () => drawBanner() });
  BANNER_STYLES.forEach((s) => styleSel.appendChild(h('option', { value: s.id }, s.name)));

  const fieldsWrap = h('div.col', { style: { gap: '8px', margin: '8px 0' } });

  function renderFields() {
    clear(fieldsWrap);
    fieldInputs.length = 0;
    currentTemplate.fields.forEach((label, i) => {
      const inp = h('input.field', { placeholder: label, value: currentTemplate.defaults[i] || '', style: { width: '100%' } });
      fieldInputs.push(inp);
      fieldsWrap.append(h('label.muted', label), inp);
    });
  }
  renderFields();

  function drawBanner() {
    const ctx2 = canvas.getContext('2d');
    const w = canvas.width, hgt = canvas.height;
    const vals = fieldInputs.map((i) => i.value.trim() || ' ');
    const t = currentTemplate;
    const style = (styleSel && styleSel.value) || 'classic';

    const palettes = {
      classic: ['#1a3a5c', '#0d1f33'],
      warm: ['#5c3a1a', '#2a1a0d'],
      cool: ['#1a4a5c', '#0d2a33'],
      gold: ['#5c4a1a', '#2a220d'],
      deep: ['#2c1a5c', '#140d2a'],
      light: ['#e8e0d0', '#c9bfa8'],
    };
    const [c1, c2] = palettes[style] || palettes.classic;
    const g = ctx2.createLinearGradient(0, 0, w, hgt);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, w, hgt);

    // Soft light circle
    const rg = ctx2.createRadialGradient(w * 0.5, hgt * 0.4, 50, w * 0.5, hgt * 0.4, 700);
    rg.addColorStop(0, 'rgba(255,255,255,0.08)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx2.fillStyle = rg;
    ctx2.fillRect(0, 0, w, hgt);

    ctx2.fillStyle = style === 'light' ? '#2a2418' : '#f5f0e6';
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';

    const accent = style === 'light' ? '#6b5a40' : '#d4cfc4';
    const mainSize = vals[0] && vals[0].length > 40 ? 56 : 80;
    ctx2.font = 'bold ' + mainSize + 'px system-ui, sans-serif';
    wrapText(ctx2, vals[0] || t.name, w / 2, hgt * 0.36, w * 0.82, mainSize + 6);
    if (vals[1]) {
      ctx2.font = '40px system-ui, sans-serif';
      ctx2.fillStyle = accent;
      wrapText(ctx2, vals[1], w / 2, hgt * 0.54, w * 0.78, 48);
    }
    if (vals[2]) {
      ctx2.font = '30px system-ui, sans-serif';
      ctx2.fillStyle = accent;
      ctx2.fillText(vals[2], w / 2, hgt * 0.7);
    }

    // Small footer
    ctx2.fillStyle = 'rgba(255,255,255,0.35)';
    ctx2.font = '24px system-ui, sans-serif';
    ctx2.fillText('SDA Sabbath', w / 2, hgt - 40);
  }

  function wrapText(ctx2, text, x, y, maxWidth, lineHeight) {
    const words = (text || '').split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx2.measureText(test).width > maxWidth && line) {
        lines.push(line.trim());
        line = word + ' ';
      } else line = test;
    }
    if (line) lines.push(line.trim());
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((ln, i) => ctx2.fillText(ln, x, startY + i * lineHeight));
  }

  function presentBanner() {
    drawBanner();
    canvas.toBlob((blob) => {
      if (!blob) { showToast('Could not create banner image.', 'err'); return; }
      const cue = {
        tab: 'ai',
        title: currentTemplate.name,
        sub: 'Banner',
        deck: {
          kind: 'image',
          frames: [{ kind: 'image', src: blob, fit: 'contain' }],
        },
      };
      ctx.setStaged('ai', cue);
      live.take(cue);
      showToast('Banner generated and presented.', 'ok');
    }, 'image/jpeg', 0.92);
  }

  // ---------- Research
  const researchInput = h('input.field', { placeholder: 'Topic e.g. Sabbath, prayer, baptism, second coming…', style: { width: '100%' } });
  const researchOut = h('div', { style: { marginTop: '10px' } });

  function doResearch() {
    const q = researchInput.value.trim().toLowerCase();
    if (!q) return;
    if (BLOCKED.test(q)) {
      showToast('This topic is not suitable for church presentation.', 'err');
      return;
    }
    let found = null;
    for (const key of Object.keys(SAFE_TOPICS)) {
      if (q.includes(key) || SAFE_TOPICS[key].title.toLowerCase().includes(q)) {
        found = SAFE_TOPICS[key];
        break;
      }
    }
    clear(researchOut);
    if (found) {
      researchOut.append(
        h('p.note', 'Child-friendly summary ready. Present to show on screen.'),
        h('div.col', { style: { gap: '6px', marginTop: '8px' } },
          ...found.slides.map((s, i) => h('div.card', { style: { padding: '10px', border: '1px solid var(--line)', borderRadius: '8px' } },
            h('strong', s.h), h('p', { style: { margin: '6px 0 0', whiteSpace: 'pre-wrap' } }, s.t))),
          btn('present', 'Present these slides', () => {
            const cue = makeTextCue(found.title, found.slides);
            ctx.setStaged('ai', cue);
            live.take(cue);
          }))
      );
    } else {
      researchOut.append(
        h('p.note', 'No built-in summary for this exact topic. Try: Sabbath, creation, prayer, baptism, communion, second coming, or tithe.'),
        h('p.note', 'Tip: you can also type a short safe summary yourself in the box below and present it.')
      );
      const custom = h('textarea.field', { rows: 4, placeholder: 'Type a short child-friendly summary (1–2 slides)…', style: { width: '100%', marginTop: '6px' } });
      researchOut.append(custom, btn('present', 'Present my summary', () => {
        const txt = custom.value.trim();
        if (!txt || BLOCKED.test(txt)) { showToast('Please enter suitable text.', 'err'); return; }
        const parts = txt.split(/\n\s*\n/).slice(0, 2);
        const slides = parts.map((p, i) => ({ h: i === 0 ? researchInput.value : '', t: p }));
        const cue = makeTextCue(researchInput.value || 'Summary', slides);
        ctx.setStaged('ai', cue);
        live.take(cue);
      }));
    }
  }


  async function callLLM(prompt, system) {
    const cfg = ctx.settings.v.ai || {};
    const key = (cfg.apiKey || '').trim();
    const provider = cfg.provider || 'openai';
    const model = (cfg.model || '').trim();
    if (!key) throw new Error('Add an API key in Settings → AI first.');
    if (BLOCKED.test(prompt)) throw new Error('Topic not suitable for church use.');

    if (provider === 'openai') {
      const m = model || 'gpt-5-mini';
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: system || 'You are a helpful assistant for a Seventh-day Adventist church. Keep answers short, clear, and suitable for all ages including children. Use simple language. Never include violence, adult content, or anything inappropriate for a church service.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.4,
        }),
      });
      if (!r.ok) throw new Error('OpenAI error ' + r.status);
      const j = await r.json();
      return j.choices?.[0]?.message?.content || '';
    }

    if (provider === 'google') {
      const m = model || 'gemini-3.8-flash';
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent?key=' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (system ? system + '\n\n' : '') + prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      });
      if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error('Gemini error ' + r.status + (t ? ': ' + t.slice(0, 140) : '')); }
      const j = await r.json();
      return j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    if (provider === 'xai') {
      const m = model || 'grok-4.7';
      const r = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: system || 'You are a helpful assistant for a Seventh-day Adventist church. Keep answers short, clear, and suitable for all ages including children.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.4,
        }),
      });
      if (!r.ok) throw new Error('Grok error ' + r.status);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }

    if (provider === 'together') {
      const m = model || 'MiniMaxAI/MiniMax-M3';
      const r = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: system || 'You are a helpful assistant for a Seventh-day Adventist church. Keep answers short, clear, and suitable for all ages including children.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.4,
        }),
      });
      if (!r.ok) throw new Error('Together error ' + r.status);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }

    if (provider === 'openrouter') {
      const m = model || 'google/gemini-3.8-flash';
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'system', content: system || 'You are a helpful assistant for a Seventh-day Adventist church. Keep answers short, clear, and suitable for all ages including children.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
          temperature: 0.4,
        }),
      });
      if (!r.ok) throw new Error('OpenRouter error ' + r.status);
      return (await r.json()).choices?.[0]?.message?.content || '';
    }

    if (provider === 'anthropic') {
      const m = model || 'claude-haiku-5-5';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: m,
          max_tokens: 600,
          system: system || 'You are a helpful assistant for a Seventh-day Adventist church. Keep answers short, clear, and suitable for all ages including children.',
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!r.ok) throw new Error('Claude error ' + r.status);
      const j = await r.json();
      return j.content?.[0]?.text || '';
    }
    throw new Error('Unknown provider');
  }

  async function generateOnlineBanner() {
    const cfg = ctx.settings.v.ai || {};
    const key = (cfg.apiKey || '').trim();
    const provider = cfg.provider || 'openai';
    if (!key) { showToast('Add an API key in Settings → AI first.', 'err'); return; }

    const vals = fieldInputs.map((i) => i.value.trim()).filter(Boolean);
    const prompt = currentTemplate.master + '. ' + vals.join('. ') + '. Colour style: ' + ((styleSel && styleSel.value) || 'classic') + '. Beautiful, elegant, church-appropriate, high quality, soft lighting, suitable for a projector in a Seventh-day Adventist church. Peaceful, no violence, no adult content.';
    showToast('Generating image…');
    try {
      let url = null;
      if (provider === 'openai') {
        const r = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-image-2.5-flare', prompt, n: 1, size: '1792x1024' }),
        });
        if (!r.ok) throw new Error('OpenAI image ' + r.status);
        url = (await r.json()).data?.[0]?.url;
      } else if (provider === 'google') {
        // Imagen is shut down. Use the current Gemini native image model.
        const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent?key=' + key, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt + ' Aspect ratio 16:9, suitable for a church projector.' }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        });
        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          throw new Error('Gemini image ' + r.status + (errText ? ': ' + errText.slice(0, 160) : ''));
        }
        const j = await r.json();
        const parts = j.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find((p) => p.inlineData || p.inline_data);
        const b64 = imgPart && (imgPart.inlineData?.data || imgPart.inline_data?.data);
        const mime = imgPart && (imgPart.inlineData?.mimeType || imgPart.inline_data?.mime_type) || 'image/png';
        if (b64) url = 'data:' + mime + ';base64,' + b64;
      } else if (provider === 'xai') {
        const r = await fetch('https://api.x.ai/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'grok-imagine-image-2.0', prompt, n: 1 }),
        });
        if (!r.ok) throw new Error('Grok image ' + r.status);
        url = (await r.json()).data?.[0]?.url;
      } else if (provider === 'together') {
        const r = await fetch('https://api.together.xyz/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'black-forest-labs/FLUX.2-dev', prompt, n: 1, width: 1792, height: 1024 }),
        });
        if (!r.ok) throw new Error('Together image ' + r.status);
        url = (await r.json()).data?.[0]?.url;
      } else if (provider === 'openrouter') {
        const r = await fetch('https://openrouter.ai/api/v1/images/generations', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin },
          body: JSON.stringify({ model: 'black-forest-labs/flux.2-dev', prompt }),
        });
        if (!r.ok) throw new Error('OpenRouter image ' + r.status);
        url = (await r.json()).data?.[0]?.url;
      } else {
        throw new Error('This provider does not support images. Use OpenAI, Gemini, Grok, Together, or OpenRouter.');
      }
      if (!url) throw new Error('No image returned');
      const cue = {
        tab: 'ai',
        title: currentTemplate.name + ' (AI)',
        sub: 'Online banner',
        deck: { kind: 'image', frames: [{ kind: 'image', src: url, fit: 'contain' }] },
      };
      ctx.setStaged('ai', cue);
      live.take(cue);
      showToast('AI banner presented.', 'ok');
    } catch (e) {
      showToast(e.message, 'err');
    }
  }

  async function doOnlineResearch() {
    const q = researchInput.value.trim();
    if (!q) return;
    if (BLOCKED.test(q)) { showToast('Topic not suitable.', 'err'); return; }
    showToast('Researching…');
    try {
      const text = await callLLM(
        'Summarise the following topic for a Seventh-day Adventist church service. Use simple language suitable for children and adults. Maximum 2 short slides. Format as:\nSlide 1 title: ...\nSlide 1 text: ...\nSlide 2 title: ...\nSlide 2 text: ...\n\nTopic: ' + q,
        'Keep it accurate, biblical where relevant, short, and completely appropriate for all ages. No controversy, no adult content.'
      );
      clear(researchOut);
      const slides = [];
      const blocks = text.split(/Slide \d+/i).filter(Boolean);
      if (blocks.length) {
        blocks.forEach((b) => {
          const titleM = /title:\s*(.+)/i.exec(b);
          const textM = /text:\s*([\s\S]+)/i.exec(b);
          slides.push({ h: titleM ? titleM[1].trim() : '', t: textM ? textM[1].trim() : b.trim() });
        });
      } else {
        slides.push({ h: q, t: text });
      }
      researchOut.append(
        h('p.note', 'AI summary ready.'),
        ...slides.map((s) => h('div.card', { style: { padding: '10px', border: '1px solid var(--line)', borderRadius: '8px', marginTop: '6px' } },
          s.h ? h('strong', s.h) : null,
          h('p', { style: { margin: '6px 0 0', whiteSpace: 'pre-wrap' } }, s.t))),
        btn('present', 'Present AI summary', () => {
          const cue = makeTextCue(q, slides);
          ctx.setStaged('ai', cue);
          live.take(cue);
        })
      );
    } catch (e) {
      showToast(e.message, 'err');
    }
  }

  const el = h('section',
    h('div.toolbar', h('h2', 'AI'), h('div.grow')),
    h('div.scroll', { style: { flex: '1', padding: '4px' } },
      h('div.card', { style: { marginBottom: '14px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 6px' } }, 'AI Banner / Screensaver'),
        h('p.note', 'Choose a master style and edit the fields. Offline generates a clean banner immediately. Online (Settings → AI) creates a richer AI image.'),
        templateSel,
        h('label.note', { style: { display: 'block', marginTop: '8px' } }, 'Colour style'),
        styleSel,
        fieldsWrap,
        h('div.row', { style: { gap: '8px', marginTop: '6px', flexWrap: 'wrap' } },
          btn('reload', 'Preview (offline)', drawBanner),
          btn('present', 'Present offline', presentBanner),
          btn('present', 'AI image (online)', generateOnlineBanner)),
        preview),
      h('div.card', { style: { padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 6px' } }, 'Quick Research'),
        h('p.note', 'Offline uses built-in safe summaries. Online uses your configured LLM for a fresh child-friendly summary.'),
        researchInput,
        h('div.row', { style: { marginTop: '8px', gap: '8px', flexWrap: 'wrap' } },
          btn('search', 'Offline summary', doResearch),
          btn('search', 'AI research (online)', doOnlineResearch)),
        researchOut)
    ));

  // Initial preview
  setTimeout(drawBanner, 50);

  return { el, open() { return null; } };
}
