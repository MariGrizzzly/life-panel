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

const emptyState = () => ({ version: 3, profile: { name: '', prefs: {} }, projects: [], tags: [], tasks: [], inbox: [], habits: [], habitLog: {}, events: [], diary: {}, workouts: [], billiards: [], hasDemo: false, lastBackup: null, updatedAt: null });

function normalize(s) {
  const e = emptyState();
  const out = { ...e, ...(s || {}) };
  ['projects', 'tags', 'tasks', 'inbox', 'habits', 'events', 'workouts', 'billiards'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!out.habitLog || typeof out.habitLog !== 'object') out.habitLog = {};
  if (!out.diary || typeof out.diary !== 'object' || Array.isArray(out.diary)) out.diary = {};
  if (!out.profile) out.profile = { name: '' };
  if (!out.profile.prefs) out.profile.prefs = {};
  return out;
}

const readJSON = (k) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

let userId = null;
let state = emptyState();
let queue = [];
export const sync = { status: 'idle', pending: 0, error: '', lastPull: null, needsSql: false };

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
  profile: (p) => ({ user_id: userId, name: p.name || '', prefs: p.prefs || {} }),
  workout: (w) => ({ id: w.id, user_id: userId, day: w.day, duration: w.duration || null, coach: !!w.coach, exercises: w.exercises || [], note: w.note || '', updated_at: new Date().toISOString() }),
  billiard: (b) => ({ id: b.id, user_id: userId, day: b.day, drills: b.drills || [], note: b.note || '', updated_at: new Date().toISOString() }),
  diary: (d) => ({ id: d.id, user_id: userId, day: d.day, text: d.text || '', mood: d.mood || null, sleep: d.sleep === '' || d.sleep === undefined ? null : d.sleep, energy: d.energy || null, answers: d.answers || [], photo: d.photo || null, updated_at: new Date().toISOString() })
};
const up = (table, row, conflict) => ({ op: 'up', table, row, conflict });
const del = (table, match) => ({ op: 'del', table, match });

function fromRemote(r) {
  const s = emptyState();
  s.profile.name = (r.profiles[0] && r.profiles[0].name) || '';
  s.profile.prefs = r.profiles[0] && r.profiles[0].prefs ? r.profiles[0].prefs : (state.profile.prefs || {});
  (r.diary || []).forEach((d) => { s.diary[d.day] = { id: d.id, day: d.day, text: d.text || '', mood: d.mood, sleep: d.sleep, energy: d.energy, answers: d.answers || [], photo: d.photo }; });
  s.workouts = (r.workouts || []).map((w) => ({ id: w.id, day: w.day, duration: w.duration, coach: !!w.coach, exercises: w.exercises || [], note: w.note || '' }));
  s.billiards = (r.billiards || []).map((b) => ({ id: b.id, day: b.day, drills: b.drills || [], note: b.note || '' }));
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
        if (o.op === 'up' && o.table === 'diary' && state.diary[o.row.day]) state.diary[o.row.day].unsynced = false;
        else if (o.op === 'up' && (o.table === 'workouts' || o.table === 'billiards')) { const x = state[o.table].find((y) => y.id === o.row.id); if (x) x.unsynced = false; }
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

const TABLES = ['profiles', 'projects', 'tags', 'tasks', 'inbox', 'habits', 'habit_log', 'events', 'diary', 'workouts', 'billiards'];
// Таблица дневника появляется после запуска SQL — без неё панель всё равно работает
const OPTIONAL = new Set(['diary', 'workouts', 'billiards']);
export async function pull() {
  if (!userId) return null;
  await flush();
  sync.needsSql = false;
  const res = await Promise.all(TABLES.map((t) => db.select(t, t === 'tasks' ? 'select=*&order=created_at.asc' : 'select=*').catch((e) => {
    if (OPTIONAL.has(t) && !e.offline && e.status !== 401) { sync.needsSql = true; return []; }
    throw e;
  })));
  const r = Object.fromEntries(TABLES.map((t, i) => [t, res[i] || []]));
  const empty = !r.projects.length && !r.tasks.length && !r.habits.length && !r.inbox.length && !r.events.length && !r.profiles.length;
  if (!queue.length) {
    const prev = state;
    state = fromRemote(r);
    // Записи дневника, которые ещё не дошли до базы (например, до создания таблицы), не теряем и досылаем
    Object.values(prev.diary || {}).forEach((d) => {
      if (!state.diary[d.day] && d.unsynced) { state.diary[d.day] = d; if (!sync.needsSql) queue.push(up('diary', R.diary(d), 'user_id,day')); }
    });
    // То же для тренировок: несохранённые в базе не теряем
    [['workouts', R.workout], ['billiards', R.billiard]].forEach(([k, row]) => {
      const have = new Set(state[k].map((x) => x.id));
      (prev[k] || []).forEach((x) => { if (x.unsynced && !have.has(x.id)) { state[k].push(x); if (!sync.needsSql) queue.push(up(k, row(x))); } });
    });
    persist();
    if (queue.length) scheduleFlush(0);
  }
  sync.lastPull = Date.now(); sync.status = 'ok'; emit();
  rolloverTasks();
  return { empty };
}

// Вход выполнен: подгружаем кеш этого человека и обновляем с сервера
export async function startSession(id) {
  userId = id;
  state = normalize(readJSON(cacheKey(id)));
  queue = readJSON(queueKey(id)) || [];
  emit();
  try { return await pull(); }
  catch (e) { sync.status = e.offline ? 'offline' : 'error'; sync.error = e.message; emit(); rolloverTasks(); return { offline: !!e.offline, error: e }; }
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
    s.diary = L.diary || {};
    s.workouts = (L.workouts || []).map((w) => ({ ...w, unsynced: true }));
    s.billiards = (L.billiards || []).map((b) => ({ ...b, unsynced: true }));
  } else {
    s.tags = [...DEFAULT_TAGS];
  }
  s.profile.prefs = (legacy && legacy.profile && legacy.profile.prefs) || {};
  const ops = [up('profiles', R.profile(s.profile))];
  s.projects.forEach((p) => ops.push(up('projects', R.project(p))));
  s.tags.forEach((t) => ops.push(up('tags', R.tag(t), 'user_id,name')));
  s.habits.forEach((h) => ops.push(up('habits', R.habit(h))));
  Object.entries(s.habitLog).forEach(([day, hs]) => Object.keys(hs).forEach((hid) => ops.push(up('habit_log', R.habitDay(hid, day), 'habit_id,day'))));
  s.tasks.forEach((t) => ops.push(up('tasks', R.task(t))));
  s.inbox.forEach((i) => ops.push(up('inbox', R.inbox(i))));
  s.events.forEach((e) => ops.push(up('events', R.event(e))));
  Object.values(s.diary).forEach((d) => { if (!d.id) d.id = uid(); ops.push(up('diary', R.diary(d), 'user_id,day')); });
  s.workouts.forEach((w) => ops.push(up('workouts', R.workout(w))));
  s.billiards.forEach((b) => ops.push(up('billiards', R.billiard(b))));
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
// Невыполненные задачи с прошедшей датой сами переезжают на сегодня
export function rolloverTasks(today = todayISO()) {
  const late = state.tasks.filter((t) => t.status !== 'done' && t.date && t.date < today);
  if (!late.length) return 0;
  late.forEach((t) => { t.date = today; });
  store.update(() => {}, late.map((t) => up('tasks', R.task(t))));
  return late.length;
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
export function setName(name) { const ops = []; store.update((s) => { s.profile.name = name; ops.push(up('profiles', R.profile(s.profile))); }, ops); }
export function setPrefs(patch) { const ops = []; store.update((s) => { s.profile.prefs = { ...(s.profile.prefs || {}), ...patch }; ops.push(up('profiles', R.profile(s.profile))); }, ops); }

// ===== Спорт и бильярд =====
export function saveWorkout(w) {
  store.update((s) => {
    const i = s.workouts.findIndex((x) => x.id === w.id);
    const x = { ...w, unsynced: true };
    if (i >= 0) s.workouts[i] = x; else s.workouts.push(x);
  }, [up('workouts', R.workout(w))]);
}
export function deleteWorkout(id) { store.update((s) => { s.workouts = s.workouts.filter((x) => x.id !== id); }, [del('workouts', { id })]); }
export function saveBilliard(b) {
  store.update((s) => {
    const i = s.billiards.findIndex((x) => x.id === b.id);
    const x = { ...b, unsynced: true };
    if (i >= 0) s.billiards[i] = x; else s.billiards.push(x);
  }, [up('billiards', R.billiard(b))]);
}
export function deleteBilliard(id) { store.update((s) => { s.billiards = s.billiards.filter((x) => x.id !== id); }, [del('billiards', { id })]); }

// ===== Дневник =====
export function saveDiary(day, patch) {
  const ops = [];
  store.update((s) => {
    const d = s.diary[day] || (s.diary[day] = { id: uid(), day, text: '', mood: null, sleep: null, energy: null, answers: [], photo: null });
    Object.assign(d, patch, { unsynced: true });
    ops.push(up('diary', R.diary(d), 'user_id,day'));
  }, ops);
}
const hasEntry = (d) => !!(d && ((d.text || '').trim() || d.mood || (d.answers || []).some((a) => (a.a || '').trim()) || d.photo));
export const diaryHasEntry = hasEntry;
export function diaryStreak(today = todayISO()) {
  let d = hasEntry(state.diary[today]) ? today : addDays(today, -1);
  let n = 0;
  while (hasEntry(state.diary[d])) { n++; d = addDays(d, -1); }
  return n;
}
export const currentUserId = () => userId;
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
    Object.values(s.diary).forEach((d) => ops.push(del('diary', { day: d.day })));
    s.workouts.forEach((w) => ops.push(del('workouts', { id: w.id })));
    s.billiards.forEach((b) => ops.push(del('billiards', { id: b.id })));
    s.tasks = []; s.inbox = []; s.events = []; s.projects = []; s.habitLog = {}; s.diary = {}; s.workouts = []; s.billiards = [];
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
