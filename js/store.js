// Хранилище данных.
// Основное место хранения — база Supabase. В браузере держим копию (кеш),
// чтобы панель открывалась мгновенно и работала без интернета.
// Изменения сначала применяются на экране, затем уходят в базу через очередь.
// Если сети нет, очередь ждёт и отправляется, когда связь вернётся.

import { uid, todayISO, addDays } from './util.js';
import { db, auth } from './remote.js';

const LEGACY_KEY = 'lifepanel:v1';           // данные из версии без сервера
const cacheKey = (u) => `lifepanel:cache:${u}`;
const queueKey = (u) => `lifepanel:queue:${u}`;
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
export const DEFAULT_TAGS = ['важно', 'созвон', 'ждёт ответа', 'рутина', 'быстро'];

const emptyState = () => ({ version: 2, profile: { name: '' }, projects: [], tags: [], tasks: [], inbox: [], habits: [], habitLog: {}, events: [], hasDemo: false, lastBackup: null, updatedAt: null });

function normalize(s) {
  const e = emptyState();
  const out = { ...e, ...(s || {}) };
  ['projects', 'tags', 'tasks', 'inbox', 'habits', 'events'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!out.habitLog || typeof out.habitLog !== 'object') out.habitLog = {};
  if (!out.profile) out.profile = { name: '' };
  return out;
}

const readJSON = (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

let userId = null;
let state = emptyState();
let queue = [];
export const sync = { status: 'idle', pending: 0, error: '', lastPull: null };

function persist() {
  if (!userId) return;
  writeJSON(cacheKey(userId), state);
  writeJSON(queueKey(userId), queue);
}
function emit() { sync.pending = queue.length; listeners.forEach((l) => l()); }

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(fn, ops = []) {
    fn(state);
    state.updatedAt = new Date().toISOString();
    if (ops.length) queue.push(...ops);
    persist();
    emit();
    if (ops.length) scheduleFlush();
  }
};

// ===== Перевод строк базы ⇄ состояние приложения =====
const nz = (v) => (v === '' || v === undefined ? null : v);
const R = {
  task: (t) => ({ id: t.id, user_id: userId, project_id: t.projectId || null, title: t.title, date: nz(t.date), time: t.time || '', deadline: nz(t.deadline), tags: t.tags || [], status: t.status || 'todo', done_at: t.doneAt || null, created_at: t.createdAt || new Date().toISOString(), updated_at: new Date().toISOString() }),
  project: (p) => ({ id: p.id, user_id: userId, name: p.name, sphere: p.sphere, color: p.color, archived: !!p.archived }),
  habit: (h) => ({ id: h.id, user_id: userId, name: h.name, archived: !!h.archived }),
  event: (e) => ({ id: e.id, user_id: userId, title: e.title, date: e.date, time: e.time || '', cat: e.cat || 'personal' }),
  inbox: (i) => ({ id: i.id, user_id: userId, text: i.text, created_at: i.createdAt || new Date().toISOString() }),
  tag: (name) => ({ user_id: userId, name }),
  habitDay: (habitId, day) => ({ user_id: userId, habit_id: habitId, day }),
  profile: (name) => ({ user_id: userId, name })
};
const up = (table, row, conflict) => ({ op: 'up', table, row, conflict });
const del = (table, match) => ({ op: 'del', table, match });

function fromRemote(r) {
  const s = emptyState();
  s.profile.name = (r.profiles[0] && r.profiles[0].name) || '';
  s.projects = r.projects.map((p) => ({ id: p.id, name: p.name, sphere: p.sphere, color: p.color, archived: p.archived }));
  s.tags = r.tags.map((t) => t.name);
  const local = new Map(state.tasks.map((t) => [t.id, t]));
  s.tasks = r.tasks.map((t) => ({ id: t.id, title: t.title, projectId: t.project_id, date: t.date, time: t.time || '', deadline: t.deadline || '', tags: t.tags || [], status: t.status, doneAt: t.done_at, createdAt: t.created_at, prevStatus: local.get(t.id) && local.get(t.id).prevStatus }));
  s.inbox = r.inbox.map((i) => ({ id: i.id, text: i.text, createdAt: i.created_at })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  s.habits = r.habits.filter((h) => !h.archived).map((h) => ({ id: h.id, name: h.name }));
  r.habit_log.forEach((l) => { (s.habitLog[l.day] || (s.habitLog[l.day] = {}))[l.habit_id] = true; });
  s.events = r.events.map((e) => ({ id: e.id, title: e.title, date: e.date, time: e.time || '', cat: e.cat }));
  s.lastBackup = state.lastBackup;
  return s;
}

// ===== Синхронизация =====
let flushing = null;
let flushTimer = null;
function scheduleFlush(delay = 300) { clearTimeout(flushTimer); flushTimer = setTimeout(() => { flush().catch(() => {}); }, delay); }

export async function flush() {
  if (!userId) return;
  if (flushing) return flushing;
  flushing = (async () => {
    sync.status = queue.length ? 'saving' : sync.status; emit();
    while (queue.length) {
      const o = queue[0];
      try {
        if (o.op === 'up') await db.upsert(o.table, o.row, o.conflict);
        else if (o.op === 'del') await db.remove(o.table, o.match);
        queue.shift(); persist();
      } catch (e) {
        if (e.offline) { sync.status = 'offline'; emit(); throw e; }
        if (e.status === 401) { sync.status = 'auth'; emit(); throw e; }
        // Ошибка в данных: пропускаем запись, чтобы очередь не застряла, и сообщаем
        console.warn('Не удалось сохранить', o, e);
        sync.error = e.message; queue.shift(); persist();
      }
    }
    sync.status = 'ok'; emit();
  })();
  try { return await flushing; } finally { flushing = null; }
}

const TABLES = ['profiles', 'projects', 'tags', 'tasks', 'inbox', 'habits', 'habit_log', 'events'];
export async function pull() {
  if (!userId) return null;
  await flush();
  const res = await Promise.all(TABLES.map((t) => db.select(t, t === 'tasks' ? 'select=*&order=created_at.asc' : 'select=*')));
  const r = Object.fromEntries(TABLES.map((t, i) => [t, res[i] || []]));
  const empty = !r.projects.length && !r.tasks.length && !r.habits.length && !r.inbox.length && !r.events.length && !r.profiles.length;
  if (!queue.length) { state = fromRemote(r); persist(); }
  sync.lastPull = Date.now(); sync.status = 'ok'; emit();
  return { empty };
}

// Вход выполнен: подгружаем кеш этого человека и обновляем с сервера
export async function startSession(id) {
  userId = id;
  state = normalize(readJSON(cacheKey(id)));
  queue = readJSON(queueKey(id)) || [];
  emit();
  try { return await pull(); }
  catch (e) { sync.status = e.offline ? 'offline' : 'error'; sync.error = e.message; emit(); return { offline: !!e.offline, error: e }; }
}
export function endSession() { userId = null; state = emptyState(); queue = []; sync.status = 'idle'; emit(); }

// Данные из версии без сервера (если пользовались ею в этом браузере)
export function legacyData() {
  const s = readJSON(LEGACY_KEY);
  if (!s || !Array.isArray(s.tasks)) return null;
  const real = s.tasks.filter((t) => !t.demo).length + (s.inbox || []).filter((i) => !i.demo).length + (s.events || []).filter((e) => !e.demo).length;
  return { state: s, realCount: real };
}
export function forgetLegacy() { try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ничего */ } }

// Первая настройка пустой базы: перенос старых данных или чистый старт
export function setupFresh({ name, legacy = null, keepDemo = false }) {
  const s = emptyState();
  s.profile.name = name || '';
  if (legacy) {
    const L = normalize(legacy);
    s.projects = L.projects.map((p) => ({ id: p.id, name: p.name, sphere: p.sphere, color: p.color, archived: !!p.archived }));
    s.tags = [...new Set(L.tags)];
    s.habits = L.habits.map((h) => ({ id: h.id, name: h.name }));
    const habitIds = new Set(s.habits.map((h) => h.id));
    Object.entries(L.habitLog).forEach(([day, hs]) => Object.keys(hs).forEach((hid) => { if (habitIds.has(hid)) (s.habitLog[day] || (s.habitLog[day] = {}))[hid] = true; }));
    const keep = (x) => keepDemo || !x.demo;
    const projIds = new Set(s.projects.map((p) => p.id));
    s.tasks = L.tasks.filter(keep).map((t) => ({ ...t, projectId: projIds.has(t.projectId) ? t.projectId : null, demo: undefined }));
    s.inbox = L.inbox.filter(keep).map((i) => ({ ...i, demo: undefined }));
    s.events = L.events.filter(keep).map((e) => ({ ...e, demo: undefined }));
  } else {
    s.tags = [...DEFAULT_TAGS];
  }
  const ops = [up('profiles', R.profile(s.profile.name))];
  s.projects.forEach((p) => ops.push(up('projects', R.project(p))));
  s.tags.forEach((t) => ops.push(up('tags', R.tag(t), 'user_id,name')));
  s.habits.forEach((h) => ops.push(up('habits', R.habit(h))));
  Object.entries(s.habitLog).forEach(([day, hs]) => Object.keys(hs).forEach((hid) => ops.push(up('habit_log', R.habitDay(hid, day), 'habit_id,day'))));
  s.tasks.forEach((t) => ops.push(up('tasks', R.task(t))));
  s.inbox.forEach((i) => ops.push(up('inbox', R.inbox(i))));
  s.events.forEach((e) => ops.push(up('events', R.event(e))));
  state = s;
  queue.push(...ops);
  persist(); emit(); scheduleFlush(0);
}

// ===== Действия =====
export const project = (id) => state.projects.find((p) => p.id === id) || null;
export const NO_PROJECT = { id: null, name: 'Без проекта', sphere: 'personal', color: '#9AAAB5' };
export const projectOf = (t) => project(t.projectId) || NO_PROJECT;

const newTagOps = (s, tags) => (tags || []).filter((t) => !s.tags.includes(t)).map((t) => { s.tags.push(t); return up('tags', R.tag(t), 'user_id,name'); });

export function addTask(data) {
  const t = { id: uid(), title: data.title, projectId: data.projectId || null, date: data.date || null, time: data.time || '', deadline: data.deadline || '', tags: data.tags || [], status: 'todo', doneAt: null, createdAt: new Date().toISOString() };
  const ops = [];
  store.update((s) => { ops.push(...newTagOps(s, t.tags)); s.tasks.push(t); ops.push(up('tasks', R.task(t))); }, ops);
}
export function updateTask(id, patch) {
  const ops = [];
  store.update((s) => {
    const t = s.tasks.find((x) => x.id === id); if (!t) return;
    ops.push(...newTagOps(s, patch.tags));
    Object.assign(t, patch);
    if (patch.status) t.doneAt = patch.status === 'done' ? (t.doneAt || new Date().toISOString()) : null;
    ops.push(up('tasks', R.task(t)));
  }, ops);
}
export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id); if (!t) return;
  updateTask(id, { status: t.status === 'done' ? (t.prevStatus || 'todo') : 'done', prevStatus: t.status === 'done' ? t.prevStatus : t.status });
}
export function deleteTask(id) { store.update((s) => { s.tasks = s.tasks.filter((t) => t.id !== id); }, [del('tasks', { id })]); }

export function addInbox(text) {
  const i = { id: uid(), text, createdAt: new Date().toISOString() };
  store.update((s) => { s.inbox.unshift(i); }, [up('inbox', R.inbox(i))]);
}
export function removeInbox(id) { store.update((s) => { s.inbox = s.inbox.filter((i) => i.id !== id); }, [del('inbox', { id })]); }

export function addProject(data) {
  const p = { id: uid(), name: data.name, sphere: data.sphere, color: data.color, archived: false };
  store.update((s) => { s.projects.push(p); }, [up('projects', R.project(p))]);
  return p.id;
}
export function archiveProject(id) {
  const ops = [];
  store.update((s) => { const p = s.projects.find((x) => x.id === id); if (p) { p.archived = true; ops.push(up('projects', R.project(p))); } }, ops);
}
export function addHabit(name) {
  const h = { id: uid(), name };
  store.update((s) => { s.habits.push(h); }, [up('habits', R.habit(h))]);
}
export function removeHabit(id) {
  const ops = [];
  store.update((s) => { const h = s.habits.find((x) => x.id === id); if (h) ops.push(up('habits', R.habit({ ...h, archived: true }))); s.habits = s.habits.filter((x) => x.id !== id); }, ops);
}
export function setName(name) { store.update((s) => { s.profile.name = name; }, [up('profiles', R.profile(name))]); }
export function addTag(tag) { const ops = []; store.update((s) => { ops.push(...newTagOps(s, [tag])); }, ops); }

export function toggleHabit(habitId, date = todayISO()) {
  const ops = [];
  store.update((s) => {
    const day = s.habitLog[date] || (s.habitLog[date] = {});
    if (day[habitId]) { delete day[habitId]; ops.push(del('habit_log', { habit_id: habitId, day: date })); }
    else { day[habitId] = true; ops.push(up('habit_log', R.habitDay(habitId, date), 'habit_id,day')); }
  }, ops);
}
export function habitStreak(habitId, date = todayISO()) {
  let n = 0; let d = addDays(date, -1);
  while (state.habitLog[d] && state.habitLog[d][habitId]) { n++; d = addDays(d, -1); }
  return n;
}

export function addEvent(data) {
  const e = { id: uid(), title: data.title, date: data.date, time: data.time || '', cat: data.cat || 'personal' };
  store.update((s) => { s.events.push(e); }, [up('events', R.event(e))]);
}

export function resetAll() {
  const ops = [];
  store.update((s) => {
    s.tasks.forEach((t) => ops.push(del('tasks', { id: t.id })));
    s.inbox.forEach((i) => ops.push(del('inbox', { id: i.id })));
    s.events.forEach((e) => ops.push(del('events', { id: e.id })));
    s.projects.forEach((p) => ops.push(del('projects', { id: p.id })));
    Object.entries(s.habitLog).forEach(([day, hs]) => Object.keys(hs).forEach((hid) => ops.push(del('habit_log', { habit_id: hid, day }))));
    s.tasks = []; s.inbox = []; s.events = []; s.projects = []; s.habitLog = {};
  }, ops);
}

export function exportData() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}
export function markBackup() { store.update((s) => { s.lastBackup = new Date().toISOString(); }); }

// Восстановление из файла: стираем текущее и загружаем всё из файла
export function importData(json) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.projects)) throw new Error('Это не файл бэкапа панели');
  resetAll();
  store.update((s) => { s.habits.forEach((h) => queue.push(up('habits', R.habit({ ...h, archived: true })))); s.habits = []; });
  setupFresh({ name: (data.profile && data.profile.name) || state.profile.name, legacy: data, keepDemo: true });
}

export const currentUser = () => auth.user();
