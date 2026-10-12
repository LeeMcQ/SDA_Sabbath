// AI tab: on-the-spot banner / screensaver generator and quick child-safe research summaries.
// Banner generation is fully offline (canvas). Research uses a built-in safe knowledge base
// for common topics and produces short, readable slides. Content is filtered for church use.
import { h, clear } from '../core/util.js';
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
      slides: slides.map((s) => ({
        lines: (s.h ? s.h + '\n\n' : '') + s.t,
        notes: '',
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

    // Background gradient based on template
    const g = ctx2.createLinearGradient(0, 0, w, hgt);
    if (t.id === 'verse') {
      g.addColorStop(0, '#1a3a32');
      g.addColorStop(1, '#0d1f1a');
    } else if (t.id === 'offering') {
      g.addColorStop(0, '#3d2e1f');
      g.addColorStop(1, '#1a120c');
    } else if (t.id === 'closing') {
      g.addColorStop(0, '#1e2a4a');
      g.addColorStop(1, '#0c1220');
    } else {
      g.addColorStop(0, '#2c3e50');
      g.addColorStop(1, '#1a252f');
    }
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, w, hgt);

    // Soft light circle
    const rg = ctx2.createRadialGradient(w * 0.5, hgt * 0.4, 50, w * 0.5, hgt * 0.4, 700);
    rg.addColorStop(0, 'rgba(255,255,255,0.08)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx2.fillStyle = rg;
    ctx2.fillRect(0, 0, w, hgt);

    ctx2.fillStyle = '#f5f0e6';
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';

    if (t.id === 'welcome') {
      ctx2.font = 'bold 92px system-ui, sans-serif';
      ctx2.fillText(vals[0] || 'Welcome', w / 2, hgt * 0.38);
      ctx2.font = '48px system-ui, sans-serif';
      ctx2.fillStyle = '#d4cfc4';
      ctx2.fillText(vals[1] || 'Sabbath Worship', w / 2, hgt * 0.52);
      if (vals[2]) {
        ctx2.font = '36px system-ui, sans-serif';
        ctx2.fillText(vals[2], w / 2, hgt * 0.66);
      }
    } else if (t.id === 'verse') {
      ctx2.font = 'italic 64px system-ui, serif';
      wrapText(ctx2, vals[0], w / 2, hgt * 0.42, w * 0.8, 78);
      ctx2.font = '42px system-ui, sans-serif';
      ctx2.fillStyle = '#c9b99a';
      ctx2.fillText(vals[1] || '', w / 2, hgt * 0.72);
    } else if (t.id === 'event') {
      ctx2.font = 'bold 80px system-ui, sans-serif';
      ctx2.fillText(vals[0] || 'Event', w / 2, hgt * 0.4);
      ctx2.font = '44px system-ui, sans-serif';
      ctx2.fillStyle = '#d4cfc4';
      ctx2.fillText(vals[1] || '', w / 2, hgt * 0.55);
      ctx2.font = '36px system-ui, sans-serif';
      ctx2.fillText(vals[2] || '', w / 2, hgt * 0.66);
    } else if (t.id === 'offering') {
      ctx2.font = 'bold 86px system-ui, sans-serif';
      ctx2.fillText(vals[0] || 'Offering', w / 2, hgt * 0.4);
      ctx2.font = '42px system-ui, sans-serif';
      ctx2.fillStyle = '#e0d4c0';
      wrapText(ctx2, vals[1], w / 2, hgt * 0.56, w * 0.75, 52);
    } else {
      ctx2.font = 'italic 58px system-ui, serif';
      wrapText(ctx2, vals[0], w / 2, hgt * 0.42, w * 0.8, 70);
      ctx2.font = '36px system-ui, sans-serif';
      ctx2.fillStyle = '#c9b99a';
      ctx2.fillText(vals[1] || '', w / 2, hgt * 0.68);
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
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const cue = {
        tab: 'ai',
        title: currentTemplate.name,
        sub: 'Banner',
        deck: {
          kind: 'image',
          slides: [{ url, notes: '' }],
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

  const el = h('section',
    h('div.toolbar', h('h2', 'AI'), h('div.grow')),
    h('div.scroll', { style: { flex: '1', padding: '4px' } },
      h('div.card', { style: { marginBottom: '14px', padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 6px' } }, 'AI Banner / Screensaver'),
        h('p.note', 'Choose a master style, edit the fields, then generate a full-screen banner. Works offline.'),
        templateSel,
        fieldsWrap,
        h('div.row', { style: { gap: '8px', marginTop: '6px' } },
          btn('reload', 'Preview', drawBanner),
          btn('present', 'Generate & Present', presentBanner)),
        preview),
      h('div.card', { style: { padding: '12px', border: '1px solid var(--line)', borderRadius: '10px' } },
        h('h3', { style: { margin: '0 0 6px' } }, 'Quick Research'),
        h('p.note', 'Short, easy-to-read summaries suitable for all ages. Content is limited to safe church topics.'),
        researchInput,
        h('div.row', { style: { marginTop: '8px' } }, btn('search', 'Summarise', doResearch)),
        researchOut)
    ));

  // Initial preview
  setTimeout(drawBanner, 50);

  return { el, open() { return null; } };
}
