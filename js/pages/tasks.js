import { esc, todayISO, whenOf, WHEN_LABEL, WHEN_ORDER, dayMonth, shortDate } from '../util.js';
import { icon } from '../ui/icons.js';
import { projectOf, NO_PROJECT } from '../store.js';
import { taskRow, checkbox, dueChip } from './shared.js';

const SMART = { inbox: 'Входящие', today: 'Сегодня', upcoming: 'Предстоящие', nodate: 'Без даты', all: 'Все задачи', done: 'Выполненные' };

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
  const openCount = sel === 'inbox' ? s.inbox.length : tasks.filter((t) => t.status !== 'done').length;
  const cnt = (id) => sel === id ? openCount : (id === 'inbox' ? s.inbox.length : selection(s, id).tasks.filter((t) => t.status !== 'done').length);

  const opt = (id, label, dot) => `<button class="opt${sel === id ? ' on' : ''}" data-action="task-sel" data-id="${esc(id)}">${dot ? `<span class="pdot" style="background:${esc(dot)};width:9px;height:9px"></span>` : ''}<span style="flex:1">${esc(label)}</span><span class="muted" style="font-size:12px">${cnt(id)}</span></button>`;
  const menu = ui.listMenu ? `<div class="menu fade" style="top:58px;left:0;width:300px;max-height:460px;overflow:auto">
      ${['inbox', 'today', 'upcoming', 'nodate', 'all', 'done'].map((id) => opt(id, SMART[id])).join('')}
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
  else if (view === 'list') body = listView(s, tasks, isProject, today);
  else if (view === 'board') body = boardView(tasks);
  else body = reportView(s, today);

  return `<section class="card fade" data-key="page-tasks" style="display:flex;flex-direction:column;gap:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="position:relative">
        <button class="list-btn" data-action="toggle-list-menu" aria-expanded="${!!ui.listMenu}" aria-haspopup="true"><span class="pdot" style="background:${esc(color)};width:12px;height:12px"></span><span class="disp" style="font-size:18px">${esc(name)}</span><span class="muted" style="font-size:13px">${openCount}</span><span style="display:flex;transform:rotate(${ui.listMenu ? 180 : 0}deg);transition:transform .2s ease">${icon('chevron', 16, 2)}</span></button>
        ${menu}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="seg" role="group" aria-label="Вид">${seg}</div>
        <button class="btn" data-action="add-task" data-project="${isProject && sel !== 'none' ? esc(sel) : ''}">${icon('plus', 18, 2.2)}Задача</button>
      </div>
    </div>
    ${body}
  </section>`;
}

function listView(s, tasks, isProject, today) {
  if (!tasks.length) return '<div class="empty">Здесь пусто. Нажми «Задача», чтобы добавить.</div>';
  let groups;
  if (isProject) {
    groups = WHEN_ORDER.map((w) => ({ key: w, name: WHEN_LABEL[w], color: w === 'overdue' ? '#C2412D' : '#9AAAB5', items: tasks.filter((t) => whenOf(t, today) === w) })).filter((g) => g.items.length);
  } else {
    groups = [...s.projects, NO_PROJECT].map((p) => ({ key: p.id || 'none', name: p.name, color: p.color, items: tasks.filter((t) => (t.projectId || null) === p.id) })).filter((g) => g.items.length);
  }
  return `<div style="display:flex;flex-direction:column;gap:18px">${groups.map((g) => `
    <div data-key="g-${esc(g.key)}">
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;padding:4px 0 6px;color:${g.key === 'overdue' ? '#A23B2A' : 'inherit'}"><span class="pdot" style="background:${esc(g.color)}"></span>${esc(g.name)}<span class="muted" style="font-weight:500;font-size:13px">${g.items.length}</span></div>
      ${g.items.sort(sortTasks).map((t) => {
        const w = whenOf(t, today);
        const meta = [isProject ? '' : (w === 'today' ? '' : (t.date ? (w === 'overdue' ? 'просрочено · ' : '') + shortDate(t.date) : '')), t.time].filter(Boolean).join(' · ');
        return taskRow(t, { meta, wide: true });
      }).join('')}
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
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="chip"><span class="pdot" style="background:${esc(p.color)};width:7px;height:7px"></span>${esc(p.name)}</span>${t.date ? `<span class="chip">${esc(shortDate(t.date))}</span>` : ''}${dueChip(t)}</div>
        <button class="btn ghost small" style="align-self:flex-start" data-action="set-status" data-id="${esc(t.id)}" data-status="${next[st]}">${nextLabel[st]}</button>
      </div>`; }).join('')}
    </div>`;
  }).join('')}</div></div>`;
}

export function reportText(s, today) {
  const work = s.tasks.filter((t) => projectOf(t).sphere === 'work');
  const done = work.filter((t) => t.status === 'done' && (t.doneAt || '').slice(0, 10) === today);
  const doing = work.filter((t) => t.status === 'doing');
  const tomorrow = work.filter((t) => t.status !== 'done' && t.date && t.date > today && t.date <= nextWorkday(today));
  const byProject = (list) => {
    const out = [];
    [...s.projects, NO_PROJECT].forEach((p) => {
      const items = list.filter((t) => (t.projectId || null) === p.id);
      if (items.length) out.push(p.name + '\n' + items.map((t) => '— ' + t.title).join('\n'));
    });
    return out.join('\n\n');
  };
  return `Отчёт за ${dayMonth(today)}\n\nСделано:\n${byProject(done) || '— пока ничего не отмечено'}\n\nВ работе:\n${doing.map((t) => `— ${t.title} (${projectOf(t).name})${t.deadline ? `, до ${shortDate(t.deadline)}` : ''}`).join('\n') || '—'}\n\nПлан на следующий день:\n${tomorrow.map((t) => `— ${t.title} (${projectOf(t).name})`).join('\n') || '—'}`;
}

function nextWorkday(today) {
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function reportView(s, today) {
  const text = reportText(s, today);
  const work = s.tasks.filter((t) => projectOf(t).sphere === 'work');
  const doneN = work.filter((t) => t.status === 'done' && (t.doneAt || '').slice(0, 10) === today).length;
  const doingN = work.filter((t) => t.status === 'doing').length;
  return `<div style="display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start">
    <div style="flex:2 1 380px;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div class="muted" style="font-size:13px">Собирается сам из рабочих задач. Отметь задачу выполненной — она появится в отчёте.</div>
      <div class="report" id="report-text">${esc(text)}</div>
      <label for="rc" style="font-size:13px;font-weight:600">Комментарий, блокеры</label>
      <textarea id="rc" class="ta" rows="3" placeholder="Например: жду ответ от бухгалтерии по цифрам"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="copy-report">Скопировать</button>
        <button class="btn ghost" data-action="mail-report">Открыть письмо</button>
      </div>
    </div>
    <div style="flex:1 1 220px;min-width:0;display:flex;flex-direction:column;gap:10px">
      <div class="tile"><div class="muted" style="font-size:13px">Сделано сегодня</div><div class="tile-v">${doneN}</div></div>
      <div class="tile"><div class="muted" style="font-size:13px">В работе</div><div class="tile-v">${doingN}</div></div>
      <div class="tile muted" style="font-size:13px;line-height:1.55">Отправка начальнику автоматически и архив отчётов появятся, когда подключим сервер.</div>
    </div>
  </div>`;
}

function inboxView(s) {
  if (!s.inbox.length) return '<div class="empty">Входящие пусты. Мысли и идеи из строки на «Сегодня» попадают сюда.</div>';
  return `<div style="display:flex;flex-direction:column;gap:10px">
    <div class="muted" style="font-size:14px">Сюда падают мысли и идеи из быстрой записи. Раз в день раскидывай их по местам.</div>
    ${s.inbox.map((i) => `<div data-key="in-${esc(i.id)}" style="border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <div style="flex:1 1 240px;font-size:14px">${esc(i.text)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ghost small" data-action="inbox-to-task" data-id="${esc(i.id)}">В задачи</button><button class="btn ghost small" data-action="inbox-delete" data-id="${esc(i.id)}">Удалить</button></div>
    </div>`).join('')}
  </div>`;
}
