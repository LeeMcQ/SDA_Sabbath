// Service plan: prepare the order of service at home, then step through it in church.
// Items point to Bible passages, hymns, slides, videos or web pages.
import { h, clear, uid, readText, download } from '../core/util.js';
import { icon } from '../core/icons.js';
import { btn, menu, toast, promptBox, confirmBox, modal, activatable, emptyState } from '../core/ui.js';
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
    { label: 'Delete this plan', icon: 'trash', onclick: deletePlan, disabled: !plan },
  ]), { cls: 'sm' });
  const nextBtn = h('button.btn.primary', { type: 'button', title: 'Select the next item in the plan', onclick: () => step(1) }, icon('next'), h('span', 'Next item'));
  const prevBtn = btn('prev', 'Previous item', () => step(-1), { cls: 'sm' });

  const el = h('section',
    h('div.toolbar', h('h2', 'Plan'), planSel, h('div.grow'), prevBtn, nextBtn, moreBtn),
    h('div.toolbar', addInput, h('button.btn', { type: 'button', onclick: addFromText }, icon('plus'), 'Add')),
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
      h('div', { style: { minWidth: 0 } }, h('div.pi-t.trunc', { style: it.heading ? { color: 'var(--muted)' } : null }, it.heading ? h('span', icon('info'), ' ', it.label) : it.label), sub(it) ? h('div.pi-s', sub(it)) : null),
      h('div.row', { onclick: (e) => e.stopPropagation() },
        it.heading ? null : btn('present', 'Present now', () => select(i).then((c) => c && live.take(c)), { cls: 'sm' }),
        btn('up', 'Move up', () => moveItem(i, -1), { cls: 'sm' }),
        btn('down', 'Move down', () => moveItem(i, 1), { cls: 'sm' }),
        btn('trash', 'Remove', () => { plan.items.splice(i, 1); if (cur >= plan.items.length) cur = plan.items.length - 1; save(); render(); }, { cls: 'sm' })));
      activatable(row);
      listEl.appendChild(row);
    });
    if (!plan.items.length) listEl.appendChild(h('p.note.pad', 'Empty plan. Type above, or use “Add to plan” in the Bible, Hymns, Slides or Video tabs.'));
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

  function step(d) {
    if (!plan) return;
    let i = cur;
    do { i += d; } while (plan.items[i] && plan.items[i].heading);
    if (i < 0 || i >= plan.items.length) { toast(d > 0 ? 'End of the plan.' : 'Start of the plan.'); return; }
    select(i);
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
