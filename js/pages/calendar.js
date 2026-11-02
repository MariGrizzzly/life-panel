// Календарь: неделя и месяц — события и задачи с датой
import { esc, todayISO, addDays, parseISO, plural } from '../util.js';
import { icon } from '../ui/icons.js';
import { EVENT_CATS, projectOf } from '../store.js';
import { CAT_COLORS } from '../ui/modals.js';

const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const monday = (d) => addDays(d, -((parseISO(d).getDay() + 6) % 7));
const dnum = (d) => parseISO(d).getDate();

export function title(s, ui) {
  const today = todayISO();
  const t = addDays(today, 1);
  const n = s.events.filter((e) => e.date === t).length;
  return ['Календарь', n ? `Завтра ${n} ${plural(n, ['событие', 'события', 'событий'])}` : 'События и задачи по дням'];
}

const evSort = (a, b) => (a.time || '99').localeCompare(b.time || '99');
const dayEvents = (s, d) => s.events.filter((e) => e.date === d).sort(evSort);
const dayTasks = (s, d) => s.tasks.filter((t) => t.date === d).sort((a, b) => (a.status === 'done') - (b.status === 'done'));

const evChip = (e, compact = false) => `<button class="cal-ev" data-action="event-edit" data-id="${esc(e.id)}" style="--c:${CAT_COLORS[e.cat] || '#9AAAB5'}" title="${esc((e.time ? e.time + ' · ' : '') + e.title)}"><b>${esc(e.time || '')}</b><span>${esc(e.title)}</span></button>`;
const taskChip = (t) => { const p = projectOf(t); return `<button class="cal-task${t.status === 'done' ? ' done' : ''}" data-action="edit-task" data-id="${esc(t.id)}" title="${esc(p.name)}"><span class="pdot" style="background:${esc(p.color)};width:7px;height:7px"></span><span>${esc(t.title)}</span></button>`; };

export function render(s, ui) {
  const today = todayISO();
  const view = ui.calView || 'week';
  const anchor = ui.calAnchor || today;
  const sel = ui.calSel || today;
  let head, body;

  if (view === 'week') {
    const start = monday(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = days[6];
    const sd = parseISO(start), ed = parseISO(end);
    head = sd.getMonth() === ed.getMonth() ? `${sd.getDate()}–${ed.getDate()} ${MONTHS_G[ed.getMonth()]}` : `${sd.getDate()} ${MONTHS_G[sd.getMonth()]} – ${ed.getDate()} ${MONTHS_G[ed.getMonth()]}`;
    body = `<div class="cal-week">${days.map((d, i) => {
      const ev = dayEvents(s, d); const ts = dayTasks(s, d);
      return `<div class="cal-day${d === today ? ' today' : ''}${d < today ? ' past' : ''}" data-key="cd-${d}">
        <div class="cal-dh"><span class="wd">${WD[i]}</span><span class="dn">${dnum(d)}</span><button class="iconbtn" data-action="add-event" data-date="${d}" aria-label="Событие на ${dnum(d)}" title="Добавить событие">${icon('plus', 16, 2.2)}</button></div>
        <div class="cal-list">${ev.map((e) => evChip(e)).join('')}${ts.slice(0, 4).map(taskChip).join('')}${ts.length > 4 ? `<button class="cal-more" data-action="cal-day" data-day="${d}" data-view="month">ещё ${ts.length - 4}</button>` : ''}${!ev.length && !ts.length ? '<span class="cal-empty">—</span>' : ''}</div>
      </div>`;
    }).join('')}</div>`;
  } else {
    const a = parseISO(anchor);
    const first = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-01`;
    const start = monday(first);
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    head = `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    const m = a.getMonth();
    const cells = days.map((d) => {
      const ev = dayEvents(s, d); const tn = dayTasks(s, d).filter((t) => t.status !== 'done').length;
      const out = parseISO(d).getMonth() !== m;
      return `<button class="cal-cell${out ? ' out' : ''}${d === today ? ' today' : ''}${d === sel ? ' sel' : ''}" data-action="cal-day" data-day="${d}">
        <span class="dn">${dnum(d)}</span>
        ${ev.slice(0, 3).map((e) => `<span class="cal-mev" style="--c:${CAT_COLORS[e.cat] || '#9AAAB5'}"><b>${esc(e.time || '')}</b> ${esc(e.title)}</span>`).join('')}
        ${ev.length > 3 ? `<span class="cal-mmore">+${ev.length - 3}</span>` : ''}
        ${ev.length ? `<span class="cal-dots">${ev.slice(0, 4).map((e) => `<i style="background:${CAT_COLORS[e.cat] || '#9AAAB5'}"></i>`).join('')}</span>` : ''}
        ${tn ? `<span class="cal-tn">${tn} ${plural(tn, ['задача', 'задачи', 'задач'])}</span>` : ''}
      </button>`;
    }).join('');
    const ev = dayEvents(s, sel); const ts = dayTasks(s, sel);
    const sd = parseISO(sel);
    body = `<div class="cal-month"><div class="cal-mh">${WD.map((w) => `<span>${w}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>
      <div class="cal-selday card" data-key="seld-${sel}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 class="h2">${sel === today ? 'Сегодня, ' : sel === addDays(today, 1) ? 'Завтра, ' : ''}${sd.getDate()} ${MONTHS_G[sd.getMonth()]}</h3><button class="btn ghost small" data-action="add-event" data-date="${sel}">${icon('plus', 15, 2.2)}Событие на этот день</button></div>
        <div class="cal-list wide">${ev.map((e) => evChip(e)).join('') || '<span class="muted" style="font-size:14px">Событий нет</span>'}</div>
        ${ts.length ? `<div class="label" style="margin-top:6px">Задачи</div><div class="cal-list wide">${ts.map(taskChip).join('')}</div>` : ''}
      </div>`;
  }

  // Ближайшие события (на 2 недели вперёд)
  const soon = s.events.filter((e) => e.date >= today && e.date <= addDays(today, 14)).sort((a, b) => a.date.localeCompare(b.date) || evSort(a, b)).slice(0, 8);
  const soonHtml = soon.length ? soon.map((e) => { const d = parseISO(e.date); return `<button class="cal-soon" data-action="event-edit" data-id="${esc(e.id)}"><span class="cal-sd">${e.date === today ? 'сегодня' : e.date === addDays(today, 1) ? 'завтра' : `${d.getDate()} ${MONTHS_G[d.getMonth()].slice(0, 3)}`}</span><b>${esc(e.time || '—')}</b><span class="pdot" style="background:${CAT_COLORS[e.cat] || '#9AAAB5'};width:8px;height:8px"></span><span class="t">${esc(e.title)}</span><span class="chip" style="background:${(EVENT_CATS[e.cat] || EVENT_CATS.personal).bg};color:${(EVENT_CATS[e.cat] || EVENT_CATS.personal).fg}">${(EVENT_CATS[e.cat] || EVENT_CATS.personal).label}</span></button>`; }).join('') : '<div class="muted" style="font-size:14px">В ближайшие две недели ничего не запланировано</div>';

  return `<div class="fade" data-key="page-cal" style="display:flex;flex-direction:column;gap:20px">
    <section class="card" style="display:flex;flex-direction:column;gap:16px">
      <div class="cal-top">
        <div class="cal-nav"><button class="iconbtn" data-action="cal-nav" data-dir="-1" aria-label="Назад">‹</button><b class="disp">${esc(head)}</b><button class="iconbtn" data-action="cal-nav" data-dir="1" aria-label="Вперёд">›</button>${anchor !== today || (view === 'month' && sel !== today) ? '<button class="link" data-action="cal-today" style="font-size:13px">к сегодня</button>' : ''}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto"><div class="seg" role="group" aria-label="Вид">${[['week', 'Неделя'], ['month', 'Месяц']].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-action="cal-view" data-id="${k}">${l}</button>`).join('')}</div><button class="btn" data-action="add-event" data-date="${view === 'month' ? sel : ''}">${icon('plus', 18, 2.2)}Событие</button></div>
      </div>
      ${body}
    </section>
    <section class="card" style="display:flex;flex-direction:column;gap:8px">
      <h2 class="h2">Ближайшие события</h2>
      ${soonHtml}
    </section>
  </div>`;
}
