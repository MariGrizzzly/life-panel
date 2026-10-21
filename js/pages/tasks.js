import { esc, todayISO, whenOf, WHEN_LABEL, WHEN_ORDER, dayMonth, shortDate, doneDay, longDate } from '../util.js';
import { icon } from '../ui/icons.js';
import { projectOf, NO_PROJECT } from '../store.js';
import { taskRow, checkbox, dueChip, repeatChip } from './shared.js';
import { quickAddForm } from './today.js';
import { addDays } from '../util.js';
import { reportText, chatGroups, reportDue } from '../report.js';
export { reportText };

const SMART = { inbox: 'Улов', today: 'Сегодня', upcoming: 'Предстоящие', nodate: 'Без даты', all: 'Все задачи', done: 'Сделано' };

export function title() { return ['Задачи', 'По проектам — списком, доской или отчётом за день']; }

function selection(s, sel) {
  const today = todayISO();
  const proj = s.projects.find((p) => p.id === sel);
  const isProject = !!proj || sel === 'none';
  const match = (t) => {
    const w = whenOf(t, today);
    if (sel === 'today') return (w === 'today' || w === 'overdue');
    if (sel === 'upcoming') return ['tomorrow', 'week', 'later'].includes(w) && t.status !== 'done';
    if (sel === 'nodate') return !t.date && t.status !== 'done';
    if (sel === 'done') return t.status === 'done';
    if (sel === 'all') return t.status !== 'done' || t.date === today;
    if (sel === 'none') return !t.projectId;
    return t.projectId === sel;
  };
  const name = proj ? proj.name : sel === 'none' ? NO_PROJECT.name : SMART[sel];
  const color = proj ? proj.color : sel === 'none' ? NO_PROJECT.color : '#14629E';
  return { tasks: s.tasks.filter(match), name, color, isProject };
}

export function render(s, ui) {
  const sel = ui.taskSel;
  const today = todayISO();
  const { tasks, name, color, isProject } = selection(s, sel);
  const openCount = sel === 'inbox' ? s.inbox.length : sel === 'done' ? tasks.length : tasks.filter((t) => t.status !== 'done').length;
  const cnt = (id) => id === 'done' ? '' : sel === id ? openCount : (id === 'inbox' ? s.inbox.length : selection(s, id).tasks.filter((t) => t.status !== 'done').length);

  const opt = (id, label, dot) => `<button class="opt${sel === id ? ' on' : ''}" data-action="task-sel" data-id="${esc(id)}">${dot ? `<span class="pdot" style="background:${esc(dot)};width:9px;height:9px"></span>` : ''}<span style="flex:1">${esc(label)}</span><span class="muted" style="font-size:12px">${cnt(id)}</span></button>`;
  const menu = ui.listMenu ? `<div class="menu fade" style="top:58px;left:0;width:300px;max-height:460px;overflow:auto">
      ${['inbox', 'today', 'done', 'upcoming', 'nodate', 'all'].map((id) => opt(id, SMART[id])).join('')}
      <div class="menu-sec">Работа</div>
      ${s.projects.filter((p) => p.sphere === 'work' && !p.archived).map((p) => opt(p.id, p.name, p.color)).join('')}
      <div class="menu-sec">Личное</div>
      ${s.projects.filter((p) => p.sphere === 'personal' && !p.archived).map((p) => opt(p.id, p.name, p.color)).join('')}
      ${opt('none', NO_PROJECT.name, NO_PROJECT.color)}
      <button class="opt" data-action="add-project" style="color:#14629E;font-weight:600;margin-top:4px">+ Новый проект</button>
    </div>` : '';

  const view = sel === 'inbox' ? 'inbox' : ui.taskView;
  const seg = [['list', 'Список'], ['board', 'Канбан'], ['report', 'Отчёт за день']].map(([id, label]) =>
    `<button class="${view === id ? 'on' : ''}" data-action="task-view" data-id="${id}">${label}</button>`).join('');

  let body = '';
  if (view === 'inbox') body = inboxView(s);
  else if (view === 'list' && sel === 'done') body = doneView(s, tasks, today);
  else if (view === 'list') body = listView(s, tasks, isProject, today, ui, sel);
  else if (view === 'board') body = boardView(tasks);
  else body = reportView(s, ui.reportDay && ui.reportDay <= today ? ui.reportDay : today, today);

  return `<section class="card fade" data-key="page-tasks" style="display:flex;flex-direction:column;gap:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="position:relative">
        <button class="list-btn" data-action="toggle-list-menu" aria-expanded="${!!ui.listMenu}" aria-haspopup="true"><span class="pdot" style="background:${esc(color)};width:12px;height:12px"></span><span class="disp" style="font-size:18px">${esc(name)}</span><span class="muted" style="font-size:13px">${openCount}</span><span style="display:flex;transform:rotate(${ui.listMenu ? 180 : 0}deg);transition:transform .2s ease">${icon('chevron', 16, 2)}</span></button>
        ${menu}
      </div>
      ${isProject && sel !== 'none' ? `<button class="link projcfg" data-action="edit-project" data-id="${esc(sel)}" title="Название, цвет, ссылка на чат Битрикса">${(s.projects.find((p) => p.id === sel) || {}).bitrixUrl ? '💬 чат привязан · ' : ''}Настроить</button>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-left:auto">
        <div class="seg" role="group" aria-label="Вид">${seg}</div>
        <button class="btn" data-action="quick-add" data-project="${isProject && sel !== 'none' ? esc(sel) : ''}">${icon('plus', 18, 2.2)}Задача</button>
      </div>
    </div>
    ${body}
  </section>`;
}

function listView(s, tasks, isProject, today, ui, sel) {
  if (!tasks.length) return '<div class="empty">Тут пока пусто. Нажми «Задача», и появится первая.</div>';
  const qDate = sel === 'upcoming' ? addDays(today, 1) : sel === 'nodate' ? '' : today;
  let groups;
  if (isProject) {
    groups = WHEN_ORDER.map((w) => ({ key: w, name: WHEN_LABEL[w], color: w === 'overdue' ? '#C2412D' : '#9AAAB5', items: tasks.filter((t) => whenOf(t, today) === w) })).filter((g) => g.items.length);
  } else {
    groups = [...s.projects, NO_PROJECT].map((p) => ({ key: p.id || 'none', name: p.name, color: p.color, items: tasks.filter((t) => (t.projectId || null) === p.id) })).filter((g) => g.items.length);
  }
  return `<div style="display:flex;flex-direction:column;gap:18px">${groups.map((g) => `
    <div data-key="g-${esc(g.key)}">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;padding:4px 0 6px;color:${g.key === 'overdue' ? '#A23B2A' : 'inherit'}"><span class="pdot" style="background:${esc(g.color)}"></span>${esc(g.name)}<span class="muted" style="font-weight:500;font-size:13px">${g.items.length}</span>${isProject ? '' : `<button class="iconbtn" data-action="quick-open" data-project="${esc(g.key)}" aria-label="Добавить задачу в «${esc(g.name)}»" title="Добавить задачу">${icon('plus', 18, 2.2)}</button>`}</div>
      ${g.items.sort(sortTasks).map((t) => {
        const w = whenOf(t, today);
        const meta = [isProject ? '' : (w === 'today' ? '' : (t.date ? (w === 'overdue' ? 'просрочено · ' : '') + shortDate(t.date) : '')), t.time].filter(Boolean).join(' · ');
        return taskRow(t, { meta, wide: true });
      }).join('')}
      ${isProject ? '' : quickAddForm(ui, g.key, qDate)}
    </div>`).join('')}</div>`;
}

// История: всё сделанное по дням, свежее сверху
const dayLabel = (d, today) => d === today ? 'Сегодня' : d === addDays(today, -1) ? 'Вчера' : longDate(d);
function doneView(s, tasks, today) {
  if (!tasks.length) return '<div class="empty">Тут будет всё, что сделано, — по дням.</div>';
  const by = {};
  tasks.forEach((t) => { const d = doneDay(t) || 'nodate'; (by[d] ||= []).push(t); });
  const days = Object.keys(by).sort().reverse();
  return `<div style="display:flex;flex-direction:column;gap:18px">${days.map((d) => `<div data-key="dd-${esc(d)}">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;padding:4px 0 6px">${esc(d === 'nodate' ? 'Без даты' : dayLabel(d, today))}<span class="muted" style="font-weight:500;font-size:13px">${by[d].length}</span>${d !== 'nodate' ? `<button class="link" style="margin-left:auto;font-size:13px" data-action="report-day" data-day="${esc(d)}">отчёт за день</button>` : ''}</div>
      ${by[d].sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).map((t) => taskRow(t, { meta: projectOf(t).name, wide: true })).join('')}
    </div>`).join('')}</div>`;
}

function sortTasks(a, b) {
  const d = (a.status === 'done') - (b.status === 'done');
  if (d) return d;
  return (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99');
}

function boardView(tasks) {
  const cols = [['todo', 'К работе'], ['doing', 'В процессе'], ['done', 'Готово']];
  const next = { todo: 'doing', doing: 'done', done: 'todo' };
  const nextLabel = { todo: 'В работу →', doing: 'Готово ✓', done: 'Вернуть' };
  return `<div style="overflow-x:auto"><div class="board">${cols.map(([st, label]) => {
    const items = tasks.filter((t) => (t.status || 'todo') === st).sort(sortTasks);
    return `<div class="bcol" data-key="col-${st}">
      <div style="display:flex;justify-content:space-between;padding:4px 6px"><span style="font-size:14px;font-weight:600">${label}</span><span class="muted" style="font-size:13px;font-weight:600">${items.length}</span></div>
      ${items.map((t) => { const p = projectOf(t); return `<div class="bcard lift" data-key="b-${esc(t.id)}">
        <button class="task-title${t.status === 'done' ? ' done-text' : ''}" style="padding:0;font-weight:500;line-height:1.35" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}</button>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="chip"><span class="pdot" style="background:${esc(p.color)};width:7px;height:7px"></span>${esc(p.name)}</span>${t.date ? `<span class="chip">${esc(shortDate(t.date))}</span>` : ''}${dueChip(t)}${repeatChip(t)}</div>
        <button class="btn ghost small" style="align-self:flex-start" data-action="set-status" data-id="${esc(t.id)}" data-status="${next[st]}">${nextLabel[st]}</button>
      </div>`; }).join('')}
    </div>`;
  }).join('')}</div></div>`;
}



// Отчитаться в чатах Битрикса: текст по каждому чату + ссылка + отметка «Отчиталась»
function chatsBlock(s, day, realToday) {
  const groups = chatGroups(s, day);
  const st = reportDue(s, day);
  const linked = groups.filter((g) => g.url);
  const mark = st.done
    ? `<div class="rep-done">✓ Отчиталась${st.reportedAt ? ` в ${new Date(st.reportedAt).toTimeString().slice(0, 5)}` : ''} <button class="link" data-action="report-undo" data-day="${esc(day)}" style="font-size:12px">отменить</button></div>`
    : `<button class="btn" data-action="report-done" data-day="${esc(day)}">✓ Отчиталась по задачам</button>`;
  return `<div class="chats" data-key="chats-${esc(day)}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 class="h2" style="font-size:15px">Отчитаться в чатах Битрикса</h3>${mark}</div>
    ${groups.length ? groups.map((g, i) => `<div class="chatblock">
      <div class="chathead"><span class="pdot" style="background:${esc(g.color)};width:9px;height:9px"></span><b>${esc(g.title)}</b>${g.url ? `<a class="btn ghost small" href="${esc(g.url)}" target="_blank" rel="noopener">Открыть чат ↗</a>` : '<span class="muted" style="font-size:12px">нет ссылки на чат — добавь в проекте</span>'}</div>
      <pre class="chattext" id="ct-${i}">${esc(g.text)}</pre>
      <button class="link" data-action="copy-chat" data-target="ct-${i}" style="font-size:13px">Скопировать текст</button>
    </div>`).join('') : '<div class="muted" style="font-size:14px">За этот день по рабочим задачам пока нечего отправлять.</div>'}
    ${groups.length && !linked.length ? '<div class="muted" style="font-size:12px">Ссылки на чаты задаются в настройках проекта (Задачи → проект → «Настроить») или у отдельной задачи.</div>' : ''}
  </div>`;
}

function reportView(s, day, realToday) {
  const today = day;
  const text = reportText(s, today);
  const work = s.tasks.filter((t) => projectOf(t).sphere === 'work');
  const doneN = work.filter((t) => t.status === 'done' && doneDay(t) === today).length;
  const doingN = work.filter((t) => t.status === 'doing').length;
  return `<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">
    <div style="flex:2 1 380px;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div class="daynav"><button class="iconbtn" data-action="report-day" data-day="${esc(addDays(day, -1))}" aria-label="Предыдущий день">‹</button><b>${esc(dayLabel(day, realToday))}${day !== realToday ? `, ${esc(dayMonth(day))}` : ''}</b><button class="iconbtn" data-action="report-day" data-day="${esc(addDays(day, 1))}" aria-label="Следующий день"${day >= realToday ? ' disabled' : ''}>›</button>${day !== realToday ? '<button class="link" data-action="report-day" data-day="" style="font-size:13px">к сегодня</button>' : ''}</div>
      <div class="muted" style="font-size:13px">Собирается сам из рабочих задач. Отметь задачу выполненной — она появится в отчёте.</div>
      <div class="report" id="report-text">${esc(text)}</div>
      <label for="rc" style="font-size:13px;font-weight:600">Комментарий, блокеры</label>
      <textarea id="rc" class="ta" rows="3" placeholder="Например: жду ответ от бухгалтерии по цифрам"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="copy-report">Скопировать</button>
        <button class="btn ghost" data-action="mail-report">Открыть письмо</button>
      </div>
      ${chatsBlock(s, day, realToday)}
    </div>
    <div style="flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div class="tile"><div class="muted" style="font-size:13px">Сделано ${day === realToday ? 'сегодня' : esc(dayLabel(day, realToday).toLowerCase())}</div><div class="tile-v">${doneN}</div></div>
      <div class="tile"><div class="muted" style="font-size:13px">В работе</div><div class="tile-v">${doingN}</div></div>
      <button class="tile" data-action="task-sel" data-id="done" style="text-align:left;cursor:pointer;border:1px solid var(--line);font:inherit"><div class="muted" style="font-size:13px">Вся история</div><div style="font-weight:600;margin-top:4px;color:var(--deep)">Что сделано по дням →</div></button>
    </div>
  </div>`;
}

function inboxView(s) {
  if (!s.inbox.length) return '<div class="empty">Улов пуст. Мысли и идеи, которые ты закидываешь со страницы «Сегодня», появятся здесь.</div>';
  return `<div style="display:flex;flex-direction:column;gap:10px">
    <div class="muted" style="font-size:14px;line-height:1.55">Мысли, идеи и ссылки, пойманные на лету. Загляни сюда раз в день: что-то станет задачей, что-то можно отпустить.</div>
    ${s.inbox.map((i) => `<div data-key="in-${esc(i.id)}" style="border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <div style="flex:1 1 240px;font-size:14px">${esc(i.text)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ghost small" data-action="inbox-to-task" data-id="${esc(i.id)}">Сделать задачей</button><button class="btn ghost small" data-action="inbox-delete" data-id="${esc(i.id)}">Отпустить</button></div>
    </div>`).join('')}
  </div>`;
}
