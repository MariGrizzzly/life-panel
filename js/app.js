import { store, sync, toggleTask, updateTask, addInbox, removeInbox, toggleHabit, exportData, importData, markBackup, archiveProject, addHabit, removeHabit, setName, resetAll, startSession, endSession, pull, flush, legacyData, forgetLegacy, setupFresh } from './store.js';
import { auth } from './remote.js';
import * as Auth from './pages/auth.js';
import { esc, todayISO } from './util.js';
import { sidebar, tabbar, SECTIONS } from './ui/nav.js';
import { patch } from './ui/morph.js';
import { taskModal, projectModal, eventModal, ask } from './ui/modals.js';
import * as Today from './pages/today.js';
import * as Tasks from './pages/tasks.js';
import * as Settings from './pages/settings.js';
import { syncText } from './pages/settings.js';
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

const ui = { screen: 'loading', section: 'today', taskSel: 'today', taskView: 'list', todaySphere: 'all', todayPr: 'all', listMenu: false, authTab: 'login', authMsg: '', authMsgKind: '', authBusy: false, authEmail: '', email: '' };
const app = document.getElementById('app');

function readHash() {
  const id = (location.hash || '').replace(/^#\/?/, '');
  ui.section = SECTIONS.some((s) => s.id === id) ? id : 'today';
}

function render() {
  if (ui.screen !== 'app') {
    const html = ui.screen === 'login' ? Auth.login(ui)
      : ui.screen === 'new-password' ? Auth.newPassword(ui)
      : ui.screen === 'onboard' ? Auth.onboarding(ui, legacyData())
      : Auth.loading(ui.loadingText);
    patch(app, html);
    document.title = 'Моя панель';
    return;
  }
  const s = store.get();
  const today = todayISO();
  const openToday = s.tasks.filter((t) => t.status !== 'done' && t.date && t.date <= today).length;
  const backupWarn = sync.status !== 'ok' && sync.status !== 'saving';
  const backupTitle = sync.status === 'ok' ? 'Сохранено в облаке' : sync.status === 'saving' ? 'Сохраняю…' : sync.status === 'offline' ? 'Нет связи' : 'Проверь подключение';
  const backupText = sync.status === 'offline' ? (sync.pending ? `в очереди: ${sync.pending}` : 'работаю с копией') : sync.status === 'ok' ? 'бэкап каждую ночь' : syncText();

  const page = PAGES[ui.section];
  const label = (SECTIONS.find((x) => x.id === ui.section) || {}).label;
  const [h1, sub] = page ? page.title(s) : [label, ''];
  ui.email = (auth.user() || {}).email || '';
  const body = page ? page.render(s, ui) : soonPage(label, SOON[ui.section] || '');

  const html = `<div class="layout">
    ${sidebar({ section: ui.section, name: s.profile.name, badges: { tasks: openToday || '' }, backupTitle, backupText, backupWarn })}
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
  'sign-out': async () => { if (await ask('Выйти из аккаунта на этом устройстве?', { ok: 'Выйти' })) { await auth.signOut(); } },
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
  'add-habit': (form) => { const v = form.name.value.trim(); if (!v) return; addHabit(v); form.name.value = ''; },
  'change-password': async (form) => {
    const v = form.password.value;
    if (v.length < 6) { toast('Пароль — минимум 6 символов'); return; }
    try { await auth.setPassword(v); form.password.value = ''; toast('Пароль изменён'); } catch (e) { toast(e.message); }
  }
};

// ===== Вход и запуск =====
const setMsg = (text, kind = '') => { ui.authMsg = text; ui.authMsgKind = kind; };

async function enterApp() {
  ui.screen = 'loading'; ui.loadingText = 'Загружаю данные…'; render();
  let user = auth.user();
  if (!user) {
    try { user = await auth.loadUser(); }
    catch (e) {
      if (e.offline) { ui.screen = 'loading'; ui.loadingText = 'Нет связи с сервером. Проверь интернет и обнови страницу.'; render(); return; }
      ui.screen = 'login'; setMsg('Ссылка устарела — войди с паролем', 'err'); render(); return;
    }
  }
  const r = await startSession(user.id);
  if (r && r.empty) {
    ui.screen = 'onboard'; ui.onboardName = ''; setMsg(''); render(); return;
  }
  if (r && r.error && !r.offline && !store.get().updatedAt) {
    ui.screen = 'loading'; ui.loadingText = 'Не получилось загрузить данные: ' + r.error.message; render(); return;
  }
  ui.screen = 'app'; render();
  if (r && r.offline) toast('Нет связи — показываю сохранённую копию');
}

const authForms = {
  async login(f) {
    ui.authEmail = f.email.value.trim();
    ui.authBusy = true; setMsg(''); render();
    try { await auth.signIn(ui.authEmail, f.password.value); ui.authBusy = false; await enterApp(); }
    catch (e) { ui.authBusy = false; setMsg(e.offline ? 'Нет связи с сервером — проверь интернет' : e.message, 'err'); render(); }
  },
  async signup(f) {
    ui.authEmail = f.email.value.trim();
    ui.authBusy = true; setMsg(''); render();
    try {
      const r = await auth.signUp(ui.authEmail, f.password.value);
      ui.authBusy = false;
      if (r.signedIn) await enterApp();
      else { ui.authTab = 'login'; setMsg('Готово! Открой письмо от Supabase и нажми ссылку подтверждения — панель откроется сама.', 'ok'); render(); }
    } catch (e) { ui.authBusy = false; setMsg(e.offline ? 'Нет связи с сервером — проверь интернет' : e.message, 'err'); render(); }
  },
  async reset(f) {
    ui.authEmail = f.email.value.trim();
    ui.authBusy = true; setMsg(''); render();
    try { await auth.resetPassword(ui.authEmail); ui.authBusy = false; setMsg('Письмо отправлено. Открой ссылку из него на этом устройстве.', 'ok'); render(); }
    catch (e) { ui.authBusy = false; setMsg(e.message, 'err'); render(); }
  },
  async 'new-password'(f) {
    ui.authBusy = true; render();
    try { await auth.setPassword(f.password.value); ui.authBusy = false; toast('Пароль сохранён'); await enterApp(); }
    catch (e) { ui.authBusy = false; setMsg(e.message, 'err'); render(); }
  },
  onboard(f) {
    const name = f.name.value.trim();
    const start = f.start ? f.start.value : 'clean';
    const legacy = legacyData();
    setupFresh({ name, legacy: start === 'legacy' && legacy ? legacy.state : null });
    forgetLegacy();
    ui.screen = 'app'; location.hash = '#today'; render();
    toast(name ? `Добро пожаловать, ${name}!` : 'Готово');
  }
};

app.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-auth-tab]');
  if (tab) { e.preventDefault(); const em = document.getElementById('a-email'); if (em) ui.authEmail = em.value; ui.authTab = tab.dataset.authTab; setMsg(''); render(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM') {
    if (ui.listMenu && !e.target.closest('.menu')) { ui.listMenu = false; render(); }
    return;
  }
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
app.addEventListener('submit', (e) => {
  const af = e.target.closest('form[data-auth]');
  if (af) { e.preventDefault(); authForms[af.dataset.auth](af); return; }
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
store.subscribe(() => { if (ui.screen === 'app') render(); });
auth.onChange((sess) => {
  if (!sess && ui.screen !== 'login') { endSession(); ui.screen = 'login'; ui.authTab = 'login'; setMsg('Ты вышла из аккаунта'); render(); }
});

// Возвращаемся в приложение (например, с другого устройства что-то добавили) — подтягиваем свежие данные
let lastPullAt = 0;
function refresh() {
  if (ui.screen !== 'app' || document.hidden) return;
  if (Date.now() - lastPullAt < 15000) return;
  lastPullAt = Date.now();
  pull().catch(() => {});
}
document.addEventListener('visibilitychange', refresh);
window.addEventListener('focus', refresh);
window.addEventListener('online', () => { if (ui.screen === 'app') flush().then(() => pull()).catch(() => {}); });
setInterval(() => { if (ui.screen === 'app' && sync.pending) flush().catch(() => {}); }, 30000);

const link = auth.init();
readHash();
if (link.linkError) { ui.screen = 'login'; setMsg('Ссылка из письма не сработала: ' + link.linkError, 'err'); render(); }
else if (link.linkType === 'recovery') { ui.screen = 'new-password'; render(); }
else if (auth.session()) { enterApp(); }
else { ui.screen = 'login'; render(); }

// Работа без интернета (после первого открытия)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
