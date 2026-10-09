// Хранилище данных.
// Сейчас данные живут в браузере (localStorage). Когда подключим Supabase,
// поменяется только этот файл — экраны работают через функции ниже.

import { uid, todayISO, addDays } from './util.js';

const KEY = 'lifepanel:v1';
const listeners = new Set();

export const SPHERES = {
  work: { label: 'Работа', bg: '#E6E7F7', fg: '#3A3F95' },
  personal: { label: 'Личное', bg: '#FCEADF', fg: '#9A4214' }
};
export const EVENT_CATS = {
  work: { label: 'Работа', bg: '#E6E7F7', fg: '#3A3F95' },
  personal: { label: 'Личное', bg: '#FCEADF', fg: '#9A4214' },
  sport: { label: 'Спорт', bg: '#DDF0EE', fg: '#1C5F59' },
  blog: { label: 'Блог', bg: '#EEE6F7', fg: '#5A3E86' }
};
export const PROJECT_COLORS = ['#5A60C4', '#2F8F83', '#B0802A', '#D9733A', '#C24D6B', '#7A5CB8', '#14629E', '#4B8B3B'];

function seed() {
  const t = todayISO();
  const p = (name, sphere, color) => ({ id: uid(), name, sphere, color, archived: false });
  const projects = [
    p('Редизайн сайта', 'work', '#5A60C4'), p('Отчётность', 'work', '#2F8F83'), p('Найм', 'work', '#B0802A'),
    p('Дом', 'personal', '#D9733A'), p('Здоровье и спорт', 'personal', '#C24D6B'), p('Блог', 'personal', '#7A5CB8')
  ];
  const [site, rep, hire, home, health, blog] = projects;
  const task = (title, project, date, extra = {}) => ({ id: uid(), title, projectId: project ? project.id : null, date, time: '', deadline: '', tags: [], status: 'todo', doneAt: null, createdAt: new Date().toISOString(), demo: true, ...extra });
  const tasks = [
    task('Созвон с командой', site, t, { time: '11:00', tags: ['созвон'] }),
    task('Согласовать макет главной', site, t, { status: 'doing', tags: ['важно'] }),
    task('Правки по форме заявки', site, t),
    task('Отчёт за месяц', rep, t, { status: 'doing', deadline: addDays(t, 1), tags: ['важно'] }),
    task('Сверить цифры с бухгалтерией', rep, addDays(t, 1), { tags: ['ждёт ответа'] }),
    task('Собеседование с дизайнером', hire, t, { time: '15:00' }),
    task('Разместить вакансию', hire, t),
    task('Тренировка: ноги и кор', health, t, { time: '08:00' }),
    task('Записаться к стоматологу', health, addDays(t, -2)),
    task('Купить продукты на неделю', home, t),
    task('Разобрать шкаф', home, addDays(t, 4)),
    task('Черновик видео «Утренняя рутина»', blog, t, { status: 'doing', tags: ['видео'] }),
    task('Прочитать 30 страниц', null, t)
  ];
  return {
    version: 1,
    profile: { name: 'Марина' },
    projects,
    tags: ['важно', 'созвон', 'ждёт ответа', 'рутина', 'видео', 'быстро'],
    tasks,
    inbox: [
      { id: uid(), text: 'Идея для видео: «мой день в цифрах»', createdAt: new Date().toISOString(), demo: true },
      { id: uid(), text: 'Посмотреть курс по мобильной фотографии', createdAt: new Date().toISOString(), demo: true }
    ],
    habits: [
      { id: uid(), name: 'Зарядка' }, { id: uid(), name: 'Английский' }, { id: uid(), name: 'Чтение 20 стр' },
      { id: uid(), name: 'Без сладкого' }, { id: uid(), name: '8 000 шагов' }, { id: uid(), name: '2 л воды' }
    ],
    habitLog: {},
    events: [
      { id: uid(), title: 'Созвон с командой', date: t, time: '11:00', cat: 'work', demo: true },
      { id: uid(), title: 'Собеседование', date: t, time: '15:00', cat: 'work', demo: true },
      { id: uid(), title: 'Бильярд', date: t, time: '19:00', cat: 'sport', demo: true }
    ],
    hasDemo: true,
    lastBackup: null,
    updatedAt: new Date().toISOString()
  };
}

function migrate(s) {
  // Здесь будут обновления формата данных между версиями.
  s.tags = s.tags || [];
  s.inbox = s.inbox || [];
  s.habits = s.habits || [];
  s.habitLog = s.habitLog || {};
  s.events = s.events || [];
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('Не удалось прочитать данные', e); }
  return seed();
}

let state = load();
let storageOk = true;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch (e) { storageOk = false; console.warn('Не удалось сохранить', e); }
}
persist();

export const store = {
  get: () => state,
  storageOk: () => storageOk,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(fn) {
    fn(state);
    state.updatedAt = new Date().toISOString();
    persist();
    listeners.forEach((l) => l());
  }
};

// ===== Действия =====
export const project = (id) => state.projects.find((p) => p.id === id) || null;
export const NO_PROJECT = { id: null, name: 'Без проекта', sphere: 'personal', color: '#9AAAB5' };
export const projectOf = (t) => project(t.projectId) || NO_PROJECT;

export function addTask(data) {
  store.update((s) => {
    s.tasks.push({ id: uid(), title: data.title, projectId: data.projectId || null, date: data.date || null, time: data.time || '', deadline: data.deadline || '', tags: data.tags || [], status: 'todo', doneAt: null, createdAt: new Date().toISOString() });
    (data.tags || []).forEach((t) => { if (!s.tags.includes(t)) s.tags.push(t); });
  });
}
export function updateTask(id, patch) {
  store.update((s) => {
    const t = s.tasks.find((x) => x.id === id); if (!t) return;
    Object.assign(t, patch);
    if (patch.status) t.doneAt = patch.status === 'done' ? (t.doneAt || new Date().toISOString()) : null;
    (patch.tags || []).forEach((tg) => { if (!s.tags.includes(tg)) s.tags.push(tg); });
  });
}
export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id); if (!t) return;
  updateTask(id, { status: t.status === 'done' ? (t.prevStatus || 'todo') : 'done', prevStatus: t.status === 'done' ? t.prevStatus : t.status });
}
export function deleteTask(id) { store.update((s) => { s.tasks = s.tasks.filter((t) => t.id !== id); }); }

export function addInbox(text) { store.update((s) => { s.inbox.unshift({ id: uid(), text, createdAt: new Date().toISOString() }); }); }
export function removeInbox(id) { store.update((s) => { s.inbox = s.inbox.filter((i) => i.id !== id); }); }

export function addProject(data) {
  let id = uid();
  store.update((s) => { s.projects.push({ id, name: data.name, sphere: data.sphere, color: data.color, archived: false }); });
  return id;
}
export function archiveProject(id) { store.update((s) => { const p = s.projects.find((x) => x.id === id); if (p) p.archived = true; }); }
export function addHabit(name) { store.update((s) => { s.habits.push({ id: uid(), name }); }); }
export function removeHabit(id) { store.update((s) => { s.habits = s.habits.filter((h) => h.id !== id); }); }
export function setName(name) { store.update((s) => { s.profile.name = name; }); }
export function resetAll() {
  store.update((s) => {
    s.tasks = []; s.inbox = []; s.events = []; s.projects = []; s.habitLog = {}; s.hasDemo = false;
  });
}
export function addTag(tag) { store.update((s) => { if (!s.tags.includes(tag)) s.tags.push(tag); }); }

export function toggleHabit(habitId, date = todayISO()) {
  store.update((s) => {
    const day = s.habitLog[date] || (s.habitLog[date] = {});
    if (day[habitId]) delete day[habitId]; else day[habitId] = true;
  });
}
export function habitStreak(habitId, date = todayISO()) {
  // Сколько дней подряд до вчерашнего включительно (сегодня добавляется, если отмечено)
  let n = 0; let d = addDays(date, -1);
  while (state.habitLog[d] && state.habitLog[d][habitId]) { n++; d = addDays(d, -1); }
  return n;
}

export function addEvent(data) { store.update((s) => { s.events.push({ id: uid(), title: data.title, date: data.date, time: data.time || '', cat: data.cat || 'personal' }); }); }

export function clearDemo() {
  store.update((s) => {
    s.tasks = s.tasks.filter((t) => !t.demo);
    s.inbox = s.inbox.filter((i) => !i.demo);
    s.events = s.events.filter((e) => !e.demo);
    s.hasDemo = false;
  });
}

export function exportData() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}
export function markBackup() { store.update((s) => { s.lastBackup = new Date().toISOString(); }); }
export function importData(json) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.projects)) throw new Error('Это не файл бэкапа панели');
  state = migrate(data);
  persist();
  listeners.forEach((l) => l());
}
