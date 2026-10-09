import { store, toggleTask, updateTask, addInbox, removeInbox, toggleHabit, clearDemo, exportData, importData, markBackup, archiveProject, addHabit, removeHabit, setName, resetAll } from './store.js';
import { esc, todayISO } from './util.js';
import { sidebar, tabbar, SECTIONS } from './ui/nav.js';
import { patch } from './ui/morph.js';
import { taskModal, projectModal, eventModal, ask } from './ui/modals.js';
import * as Today from './pages/today.js';
import * as Tasks from './pages/tasks.js';
import * as Settings from './pages/settings.js';
import { soonPage } from './pages/shared.js';

const PAGES = { today: Today, tasks: Tasks, settings: Settings };
const SOON = {
  calendar: 'Неделя и месяц, события из Apple Календаря, задачи со временем. Добавлять события уже можно — кнопка «Событие» на «Сегодня».',
  diary: 'Запись дня, настроение смайликами, вопросы на выбор, серия дней подряд, фото дня и выгрузка в Apple Дневник.',
  goals: 'Цели на квартал и год, которые считаются сами из других разделов, и статистика привычек.',
  sport: 'Тренировки, замеры тела и графики изменений.',
  billiards: 'Сессии, упражнения и рост точности.',
  english: 'Словарь и повторение карточками.',
  reading: 'Читательский дневник и цель на год.',
  blog: 'Контент-план от идеи до публикации.',
  review: 'Итоги недели с черновиком от ИИ.'
};

const ui = { section: 'today', taskSel: 'today', taskView: 'list', todaySphere: 'all', todayPr: 'all', listMenu: false };
const app = document.getElementById('app');

function readHash() {
  const id = (location.hash || '').replace(/^#\/?/, '');
  ui.section = SECTIONS.some((s) => s.id === id) ? id : 'today';
}

function render() {
  const s = store.get();
  const today = todayISO();
  const openToday = s.tasks.filter((t) => t.status !== 'done' && t.date && t.date <= today).length;
  const lastB = s.lastBackup ? new Date(s.lastBackup) : null;
  const daysSince = lastB ? Math.floor((Date.now() - lastB.getTime()) / 86400000) : null;
  const backupWarn = daysSince === null || daysSince > 7;
  const backupText = lastB ? (daysSince === 0 ? 'сегодня' : `${daysSince} дн. назад`) : 'сохрани файл в Настройках';

  const page = PAGES[ui.section];
  const label = (SECTIONS.find((x) => x.id === ui.section) || {}).label;
  const [h1, sub] = page ? page.title(s) : [label, ''];
  const body = page ? page.render(s, ui) : soonPage(label, SOON[ui.section] || '');

  const html = `<div class="layout">
    ${sidebar({ section: ui.section, name: s.profile.name, badges: { tasks: openToday || '' }, backupText, backupWarn })}
    <main class="main" id="main" data-key="main">
      <div class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px" data-key="hdr">
          <div><h1 class="disp" style="margin:0;font-size:28px;color:var(--deep)">${esc(h1)}</h1><div class="muted" style="font-size:14px;margin-top:6px">${esc(sub)}</div></div>
        </header>
        ${body}
      </div>
    </main>
    ${tabbar(ui.section)}
  </div>`;
  patch(app, html);
  document.title = `${label || 'Сегодня'} — Моя панель`;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ===== Действия по кнопкам =====
const actions = {
  'toggle-task': (el) => toggleTask(el.dataset.id),
  'edit-task': (el) => taskModal({ id: el.dataset.id }),
  'add-task': (el) => taskModal({ projectId: el.dataset.project || '' }),
  'set-status': (el) => updateTask(el.dataset.id, { status: el.dataset.status }),
  'add-event': () => eventModal(),
  'add-project': () => { ui.listMenu = false; projectModal((id) => { if (ui.section === 'tasks') { ui.taskSel = id; render(); } }); },
  'habit': (el) => toggleHabit(el.dataset.id),
  'clear-demo': async () => { if (await ask('Удалить демо-задачи, события и входящие? Проекты и привычки останутся, их можно поменять в настройках.', { ok: 'Удалить демо', danger: true })) { clearDemo(); toast('Демо-данные удалены'); } },
  'today-sphere': (el) => { ui.todaySphere = el.dataset.id; ui.todayPr = 'all'; render(); },
  'go': (el) => { if (el.dataset.view) { ui.taskView = el.dataset.view; ui.taskSel = 'today'; } location.hash = '#' + el.dataset.to; },
  'toggle-list-menu': () => { ui.listMenu = !ui.listMenu; render(); },
  'task-sel': (el) => { ui.taskSel = el.dataset.id; ui.listMenu = false; render(); },
  'task-view': (el) => { ui.taskView = el.dataset.id; if (ui.taskSel === 'inbox') ui.taskSel = 'today'; render(); },
  'inbox-to-task': (el) => { const i = store.get().inbox.find((x) => x.id === el.dataset.id); if (i) taskModal({ title: i.text, fromInbox: i.id }); },
  'inbox-delete': (el) => removeInbox(el.dataset.id),
  'copy-report': async () => {
    const txt = document.getElementById('report-text').textContent + ((document.getElementById('rc') || {}).value ? '\n\nКомментарий:\n' + document.getElementById('rc').value : '');
    try { await navigator.clipboard.writeText(txt); toast('Отчёт скопирован'); } catch (e) { toast('Не получилось скопировать — выдели текст вручную'); }
  },
  'mail-report': () => {
    const txt = document.getElementById('report-text').textContent + ((document.getElementById('rc') || {}).value ? '\n\nКомментарий:\n' + document.getElementById('rc').value : '');
    location.href = `mailto:?subject=${encodeURIComponent(txt.split('\n')[0])}&body=${encodeURIComponent(txt)}`;
  },
  'copy-backup': async () => { try { await navigator.clipboard.writeText(exportData()); markBackup(); toast('Бэкап скопирован — вставь его в заметку или файл'); } catch (e) { toast('Не получилось скопировать'); } },
  'export': () => { download(`panel-backup-${todayISO()}.json`, exportData()); markBackup(); toast('Бэкап сохранён в Загрузки'); },
  'archive-project': async (el) => { if (await ask('Убрать проект в архив? Задачи останутся.', { ok: 'В архив' })) archiveProject(el.dataset.id); },
  'remove-habit': async (el) => { if (await ask('Убрать привычку?', { ok: 'Убрать' })) removeHabit(el.dataset.id); },
  'reset-all': async () => { if (await ask('Точно удалить всё? Сначала лучше скачать бэкап.', { ok: 'Удалить всё', danger: true })) { resetAll(); toast('Начинаем с чистого листа'); } }
};

const forms = {
  'quick-inbox': (form) => { const v = form.text.value.trim(); if (!v) return; addInbox(v); form.text.value = ''; toast('Записано во входящие'); },
  'save-name': (form) => { setName(form.name.value.trim()); toast('Сохранено'); },
  'add-habit': (form) => { const v = form.name.value.trim(); if (!v) return; addHabit(v); form.name.value = ''; }
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM') {
    if (ui.listMenu && !e.target.closest('.menu')) { ui.listMenu = false; render(); }
    return;
  }
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
app.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-action]');
  if (f && forms[f.dataset.action]) { e.preventDefault(); forms[f.dataset.action](f); }
});
app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.change === 'today-project') { ui.todayPr = el.value; render(); }
  if (el.dataset.change === 'import' && el.files && el.files[0]) {
    const r = new FileReader();
    r.onload = async () => {
      try { if (await ask('Заменить текущие данные данными из файла?', { ok: 'Заменить' })) { importData(r.result); toast('Данные восстановлены'); } }
      catch (err) { toast('Не получилось: ' + err.message); }
      el.value = '';
    };
    r.readAsText(el.files[0]);
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.listMenu) { ui.listMenu = false; render(); } });

window.addEventListener('hashchange', () => { readHash(); ui.listMenu = false; render(); window.scrollTo(0, 0); });
store.subscribe(render);
readHash();
render();

// Работа без интернета (после первого открытия)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
