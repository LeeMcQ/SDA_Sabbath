// Service plan: prepare the order of service at home, then step through it in church.
// Items point to Bible passages, hymns, slides, videos or web pages.
import { h, clear, uid, readText, download } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, menu, toast, promptBox, confirmBox, modal, closeModal, activatable, emptyState } from '../core/ui.js';
import { db } from '../core/db.js';
import { parseRef, refText, EN } from '../core/books.js';

const TEMPLATES = {
  'Divine Service': [
    'Reading of the 4th Commandment',
    'Sabbath Day hymn',
    'Praise My Soul',
    'Opening Prayer',
    'Scripture Reading',
    'Scripture from the Bible',
    'Opening Hymn',
    'Pastoral Prayer',
    'Tithes & Offering',
    "Children's Story",
    'Special Item',
    'Welcome & Introduction to Speaker',
    'Sermon',
    'Closing Hymn',
    'Dismiss Us Lord',
    'Closing Prayer',
  ],
  'Sabbath School': ['Song service', 'Opening hymn', 'Opening prayer', 'Mission story', 'Lesson study', 'Closing hymn', 'Closing prayer'],
  'Vespers / AY': ['Song service', 'Opening hymn', 'Prayer', 'Scripture', 'Programme', 'Closing hymn', 'Prayer'],
  'Empty plan': [],
};
const TAB_ICON = { bible: 'bible', hymns: 'hymn', slides: 'slides', video: 'video', web: 'web', note: 'info' };

export default function create(ctx) {
  const { live } = ctx;
  let plans = [], plan = null, cur = -1;

  const planSel = h('select.field', { 'aria-label': 'Plan', onchange: () => openPlan(planSel.value) });
  const addInput = h('input.field.grow', { placeholder: 'Add: John 3:16, hymn 73, or a heading like “Offering”', onkeydown: (e) => { if (e.key === 'Enter') addFromText(); } });
  const listEl = h('div');
  const moreBtn = btn('more', 'Plan options', () => menu(moreBtn, [
    { label: 'New plan…', icon: 'plus', onclick: newPlan },
    { label: 'Rename', icon: 'edit', onclick: renamePlan, disabled: !plan },
    { label: 'Export (to use on another device)', icon: 'download', onclick: exportPlan, disabled: !plan },
    { label: 'Import a plan…', icon: 'upload', onclick: importPlan },
    { label: 'Mark all as not done', icon: 'reload', onclick: () => { if (plan) { plan.items.forEach((i) => { i.done = false; }); save(); render(); } } },
    { label: 'Duplicate this plan', icon: 'plus', onclick: duplicatePlan, disabled: !plan },
    { label: plan && plan.autoAdvance ? 'Auto-advance: on' : 'Auto-advance: off', icon: 'next', onclick: toggleAuto, disabled: !plan },
    { label: 'Delete this plan', icon: 'trash', onclick: deletePlan, disabled: !plan },
  ]), { cls: 'sm' });
  const nextBtn = h('button.btn.primary', { type: 'button', title: 'Select the next item in the plan', onclick: () => step(1) }, icon('next'), h('span', 'Next item'));
  const prevBtn = btn('prev', 'Previous item', () => step(-1), { cls: 'sm' });

  const el = h('section',
    h('div.toolbar', h('h2', 'Plan'), planSel, h('div.grow'), prevBtn, nextBtn, moreBtn),
    h('div.toolbar', addInput, h('button.btn', { type: 'button', onclick: addFromText }, icon('plus'), 'Add'), h('button.btn', { type: 'button', onclick: () => linkMedia() }, icon('link'), 'Link media')),
    h('div.scroll', { style: { flex: '1' } }, listEl));

  async function load() {
    plans = (await db.all('plans')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const curId = await db.get('kv', 'plan-current');
    clear(planSel);
    planSel.hidden = !plans.length;
    plans.forEach((p) => planSel.appendChild(h('option', { value: p.id }, p.name)));
    if (!plans.length) { plan = null; render(); return; }
    openPlan(plans.some((p) => p.id === curId) ? curId : plans[0].id);
  }

  function openPlan(id) {
    plan = plans.find((p) => p.id === id) || null;
    planSel.value = id; cur = -1;
    db.put('kv', 'plan-current', id);
    render();
  }

  const save = () => { if (plan) { plan.updated = Date.now(); return db.put('plans', plan.id, plan); } };

  function makePlan(name, template) {
    const items = (TEMPLATES[template] || []).map((t) => {
      const [label, ref] = t.split('|');
      if (ref && ref.startsWith('hymn:')) return { id: uid(), tab: 'hymns', n: +ref.slice(5), label: label + ' — hymn ' + ref.slice(5) };
      return { id: uid(), tab: 'note', heading: true, label };
    });
    return { id: uid(), name, items, updated: Date.now() };
  }

  async function newPlan() {
    const body = h('div.col');
    const name = h('input.field', { value: 'Sabbath ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) });
    let tpl = 'Divine Service';
    const tplList = h('div.row.wrap');
    Object.keys(TEMPLATES).forEach((k) => tplList.appendChild(h('button.chip', { type: 'button', 'aria-pressed': String(k === tpl), onclick: (e) => { tpl = k; Array.from(tplList.children).forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); } }, k)));
    body.append(h('label.muted', 'Name'), name, h('label.muted', 'Start from'), tplList);
    modal({ title: 'New service plan', body, actions: [{ label: 'Cancel' }, { label: 'Create', primary: true, onclick: async () => {
      const p = makePlan(name.value.trim() || 'Service', tpl);
      await db.put('plans', p.id, p); await db.put('kv', 'plan-current', p.id); await load();
    } }] });
  }
  async function renamePlan() { const n = await promptBox('Rename plan', 'Name', plan.name); if (n) { plan.name = n; await save(); await load(); } }
  async function deletePlan() { if (await confirmBox('Delete plan?', 'Delete “' + plan.name + '”?', 'Delete', true)) { await db.del('plans', plan.id); plan = null; await load(); } }
  async function duplicatePlan() {
    if (!plan) return;
    const copy = JSON.parse(JSON.stringify(plan));
    copy.id = uid(); copy.name = plan.name + ' (copy)';
    copy.items.forEach((i) => { i.done = false; i.id = uid(); });
    copy.updated = Date.now();
    await db.put('plans', copy.id, copy); await db.put('kv', 'plan-current', copy.id); await load();
    toast('Plan duplicated.', 'ok');
  }
  function toggleAuto() {
    if (!plan) return;
    plan.autoAdvance = !plan.autoAdvance;
    save(); render();
    toast(plan.autoAdvance ? 'Auto-advance on.' : 'Auto-advance off.', 'ok');
  }
  function exportPlan() { download(new Blob([JSON.stringify(plan, null, 1)], { type: 'application/json' }), plan.name.replace(/[^\w-]+/g, '_') + '.sda-sabbath-plan.json'); }
  function importPlan() {
    const inp = h('input', { type: 'file', accept: '.json' });
    inp.onchange = async () => {
      try {
        const p = JSON.parse(await readText(inp.files[0]));
        if (!p.items) throw new Error('Not an SDA Sabbath plan file.');
        p.id = uid(); p.updated = Date.now();
        await db.put('plans', p.id, p); await db.put('kv', 'plan-current', p.id); await load();
        toast('Plan imported. Slides and videos must also exist on this device.', 'ok', 5000);
      } catch (e) { toast(e.message, 'err'); }
    };
    inp.click();
  }

  function sub(it) {
    if (it.heading) return '';
    return { bible: 'Bible' + (it.tr ? ' · ' + it.tr.toUpperCase() : ''), hymns: 'Hymn', slides: 'Slides', video: 'Video', web: 'Web' }[it.tab] || '';
  }

  function render() {
    clear(listEl);
    // No plan yet: nothing to step through, so no Next / Previous item buttons.
    nextBtn.hidden = prevBtn.hidden = planSel.hidden = !plan;
    if (!plan) {
      listEl.appendChild(emptyState('plan', 'No service plan yet', 'Prepare the order of service before Sabbath: Bible readings, hymns, slides and videos in the order you need them.',
        { label: 'New plan', icon: 'plus', primary: true, onclick: newPlan }));
      return;
    }
    plan.items.forEach((it, i) => {
      const row = h('div.plan-item' + (i === cur ? '.cur' : '') + (it.done ? '.done' : ''), {
        onclick: () => select(i), ondblclick: () => select(i).then((c) => c && live.take(c)) },
      h('span.pi-n', it.heading ? '' : String(plan.items.slice(0, i + 1).filter((x) => !x.heading).length)),
      h('div', { style: { minWidth: 0 } },
        h('div.pi-t.trunc', { style: it.heading ? { color: 'var(--muted)' } : null }, it.heading ? h('span', icon('info'), ' ', it.label) : it.label),
        sub(it) ? h('div.pi-s', sub(it)) : null,
        it.role ? h('div.pi-s', { style: { color: 'var(--next)' } }, it.role) : null),
      h('div.row', { onclick: (e) => e.stopPropagation() },
        it.heading ? null : btn('present', 'Present now', () => select(i).then((c) => { if (c) { live.take(c); if (plan.autoAdvance) setTimeout(() => step(1), 400); } }), { cls: 'sm' }),
        btn('edit', 'Role', () => { const r = prompt('Role (e.g. Elder, Deacon, Speaker)', it.role || ''); if (r != null) { it.role = r.trim(); save(); render(); } }, { cls: 'sm' }),
        btn('link', 'Link', () => linkMedia(i), { cls: 'sm', label: 'Link' }),
        btn('up', 'Move up', () => moveItem(i, -1), { cls: 'sm' }),
        btn('down', 'Move down', () => moveItem(i, 1), { cls: 'sm' }),
        btn('trash', 'Remove', () => { plan.items.splice(i, 1); if (cur >= plan.items.length) cur = plan.items.length - 1; save(); render(); }, { cls: 'sm' })));
      activatable(row);
      listEl.appendChild(row);
    });
    if (!plan.items.length) listEl.appendChild(h('p.note.pad', 'Empty plan. Type above, use Link to attach Bible verses, hymns, slides, videos or web pages, or use “Add to plan” in the other tabs.'));
  }

  function moveItem(i, d) {
    const j = i + d;
    if (j < 0 || j >= plan.items.length) return;
    const t = plan.items[i]; plan.items[i] = plan.items[j]; plan.items[j] = t;
    if (cur === i) cur = j; else if (cur === j) cur = i;
    save(); render();
  }

  /** Open the item in its own tab so it becomes Next. Returns the staged cue. */
  async function select(i) {
    cur = i;
    const it = plan.items[i];
    render();
    if (!it || it.heading) return null;
    let c = null;
    ctx.hold = 'plan';
    try {
      const t = await ctx.tab(it.tab);
      c = await t.open(it);
      if (c) { it.done = true; save(); }
    } catch (e) { toast('Could not open this item: ' + e.message, 'err'); }
    finally { ctx.hold = null; }
    ctx.setStaged('plan', c);
    render();
    return c;
  }

  async function step(d) {
    if (!plan) return;
    let i = cur;
    do { i += d; } while (plan.items[i] && plan.items[i].heading);
    if (i < 0 || i >= plan.items.length) { toast(d > 0 ? 'End of the plan.' : 'Start of the plan.'); return; }
    const next = plan.items[i];
    if (d > 0) {
      const label = next.label || 'next item';
      const ok = await confirmBox('Next item?', 'Go to “' + label + '”?', 'Next', false);
      if (!ok) return;
    }
    select(i);
  }

  async function linkMedia(replaceIndex) {
    if (!plan) { toast('Create a plan first.'); return; }
    const target = replaceIndex != null ? plan.items[replaceIndex] : null;
    const title = target ? 'Link to: ' + (target.label || 'item') : 'Add linked item';
    const body = h('div.col', { style: { gap: '12px', minWidth: '300px' } });
    const kindSel = h('select.field', {},
      h('option', { value: 'bible' }, 'Bible verse'),
      h('option', { value: 'hymns' }, 'Hymn'),
      h('option', { value: 'slides' }, 'Slides'),
      h('option', { value: 'video' }, 'Video'),
      h('option', { value: 'web' }, 'Web page / link'));
    const input = h('input.field', { placeholder: 'John 3:16  or  hymn number' });
    const list = h('div.list', { style: { maxHeight: '260px', overflow: 'auto' } });
    body.append(h('p.note', target ? 'Attach media to this part of the plan.' : 'Add a new item that links to media.'), kindSel, input, list);

    async function refresh() {
      clear(list);
      const k = kindSel.value;
      input.placeholder = k === 'bible' ? 'e.g. John 3:16 or Psalm 23' : k === 'hymns' ? 'Hymn number (e.g. 73)' : k === 'web' ? 'https://…' : 'Filter…';
      input.hidden = k === 'slides' || k === 'video';
      if (k === 'slides') {
        const files = (await db.all('files')).filter((f) => f.kind === 'deck').sort((a, b) => (b.added || 0) - (a.added || 0));
        if (!files.length) list.appendChild(h('p.note', 'No slide decks yet. Add some in the Slides tab first.'));
        files.forEach((f) => list.appendChild(h('button', { type: 'button', onclick: () => pick({ tab: 'slides', deck: f.id, label: f.name }) },
          icon('slides'), h('span.grow', f.name), h('span.note', (f.count || 0) + ' slides'))));
      } else if (k === 'video') {
        const files = (await db.all('files')).filter((f) => f.kind === 'media').sort((a, b) => (b.added || 0) - (a.added || 0));
        if (!files.length) list.appendChild(h('p.note', 'No videos yet. Add some in the Video tab first.'));
        files.forEach((f) => list.appendChild(h('button', { type: 'button', onclick: () => pick({ tab: 'video', item: f.id, label: f.name }) },
          icon('video'), h('span.grow', f.name))));
      } else if (k === 'web') {
        list.appendChild(h('p.note', 'Paste a full https:// link above and press Link.'));
      } else if (k === 'hymns') {
        list.appendChild(h('p.note', 'Type a hymn number above and press Link. The title will be filled in automatically.'));
      } else {
        list.appendChild(h('p.note', 'Type a Bible reference above and press Link.'));
      }
    }
    kindSel.onchange = refresh;
    input.onkeydown = (e) => { if (e.key === 'Enter') doAdd(); };
    refresh();

    function pick(ref) {
      closeModal();
      if (target) {
        // Keep the original part name if it was a plain heading, otherwise use the new label.
        const keepName = target.heading || !target.tab || target.tab === 'note';
        Object.assign(target, ref);
        target.heading = false;
        if (keepName && target.label && ref.label !== target.label) {
          target.label = (target.label || '') + ' — ' + ref.label;
        }
        save(); render();
        toast('Linked to this part of the plan.', 'ok');
      } else {
        api.addItem(ref);
      }
    }
    function doAdd() {
      const k = kindSel.value;
      const v = input.value.trim();
      if (k === 'bible') {
        const r = parseRef(v);
        if (!r) { toast('Could not understand that Bible reference.', 'err'); return; }
        pick({ tab: 'bible', ref: refText(EN, r.book, r.segs), tr: ctx.settings.v.bible.primary, label: refText(EN, r.book, r.segs) });
      } else if (k === 'hymns') {
        const n = parseInt(v, 10);
        if (!n) { toast('Enter a hymn number.', 'err'); return; }
        pick({ tab: 'hymns', n, label: 'Hymn ' + n });
      } else if (k === 'web') {
        if (!/^https?:\/\//i.test(v)) { toast('Enter a full https:// link.', 'err'); return; }
        pick({ tab: 'web', url: v, label: v.replace(/^https?:\/\//, '').slice(0, 48) });
      } else if (k === 'slides' || k === 'video') {
        toast('Choose an item from the list.', 'err');
      }
    }

    modal({
      title,
      body,
      actions: [
        { label: 'Link', primary: true, onclick: doAdd },
        { label: 'Cancel' },
      ],
    });
  }

  async function addFromText() {
    const t = addInput.value.trim();
    if (!t) return;
    const hm = /^(?:h|hymn|lied|ingoma|#)\s*(\d{1,4})$/i.exec(t) || (/^\d{1,4}$/.test(t) ? [t, t] : null);
    if (hm) await api.addItem({ tab: 'hymns', n: +hm[1], label: 'Hymn ' + hm[1] });
    else {
      const r = parseRef(t);
      if (r) await api.addItem({ tab: 'bible', ref: refText(EN, r.book, r.segs), tr: ctx.settings.v.bible.primary, label: refText(EN, r.book, r.segs) });
      else await api.addItem({ tab: 'note', heading: true, label: t });
    }
    addInput.value = '';
  }

  const api = {
    el,
    async addItem(ref) {
      if (!ref) return;
      await ready;
      if (!plan) { const p = makePlan('Service plan', 'Empty plan'); await db.put('plans', p.id, p); await db.put('kv', 'plan-current', p.id); await load(); }
      const item = Object.assign({ id: uid() }, ref);
      // Hymn labels: fill in the title when the hymnbook knows it.
      if (item.tab === 'hymns' && /^Hymn \d+$/.test(item.label)) {
        try {
          const x = (await ctx.tab('hymns')).lookup(item.n)[0];
          // Remember the hymnbook too, so the item still opens the same hymn if another book is chosen later.
          if (x) { item.label = 'Hymn ' + x.n + ' — ' + x.t; if (!item.book) item.book = x.bookId; }
        } catch (e) { /* */ }
      }
      const at = cur >= 0 ? cur + 1 : plan.items.length;
      plan.items.splice(at, 0, item);
      cur = at;
      await save(); render();
      toast('Added to “' + plan.name + '”.', 'ok');
    },
    open() { return null; },
  };
  const ready = load();
  return api;
}
