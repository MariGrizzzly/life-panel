import { esc, todayISO } from '../util.js';
import { tagInput, timeField, dateField, selectField } from './fields.js';
import { icon } from './icons.js';
import { store, addTask, updateTask, deleteTask, addProject, updateProject, addEvent, PROJECT_COLORS, EVENT_CATS, removeInbox } from '../store.js';

const root = () => document.getElementById('modal-root');
let lastFocus = null;
let cleanup = null;

export function closeModal() {
  if (cleanup) { cleanup(); cleanup = null; }
  root().innerHTML = '';
  document.removeEventListener('keydown', onKey);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function onKey(e) { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[data-ask]')) closeModal(); }

// Своё окно подтверждения (системные confirm/prompt в некоторых местах не работают)
export function ask(message, { ok = 'Да', cancel = 'Отмена', danger = false } = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'backdrop'; wrap.setAttribute('data-ask', ''); wrap.style.zIndex = '150'; wrap.style.alignItems = 'center';
    wrap.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="ask-msg" style="max-width:420px">
      <div id="ask-msg" style="font-size:16px;line-height:1.5">${esc(message)}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn ghost" data-no>${esc(cancel)}</button>
        <button class="btn${danger ? ' danger' : ''}" data-yes>${esc(ok)}</button>
      </div></div>`;
    const done = (v) => { document.removeEventListener('keydown', key, true); wrap.remove(); if (prev && prev.focus) prev.focus(); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) done(false); });
    wrap.querySelector('[data-no]').addEventListener('click', () => done(false));
    wrap.querySelector('[data-yes]').addEventListener('click', () => done(true));
    document.addEventListener('keydown', key, true);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-yes]').focus();
  });
}

export function setCleanup(fn) { cleanup = fn; }
export function open(title, body, mount) {
  lastFocus = document.activeElement;
  root().innerHTML = `<div class="backdrop" data-backdrop><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mtitle">
    <div class="modal-head"><h2 class="h2" id="mtitle" style="font-size:18px">${esc(title)}</h2><button class="link" data-close aria-label="Закрыть" style="display:flex;align-items:center">${icon('close', 18, 2)}</button></div>
    ${body}</div></div>`;
  const r = root();
  r.querySelector('[data-backdrop]').addEventListener('mousedown', (e) => { if (e.target.hasAttribute('data-backdrop')) closeModal(); });
  r.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', onKey);
  mount(r.querySelector('.modal'));
  const first = r.querySelector('input:not([type=hidden]), textarea, select');
  if (first) setTimeout(() => first.focus(), 30);
}

function projectGroups(selected) {
  const s = store.get();
  const opts = (sphere) => s.projects.filter((p) => p.sphere === sphere && (!p.archived || p.id === selected)).map((p) => ({ value: p.id, label: p.name, color: p.color }));
  return [
    { options: [{ value: '', label: 'Без проекта', color: '#9AAAB5' }] },
    { label: 'Работа', options: opts('work') },
    { label: 'Личное', options: opts('personal') },
  ].filter((g) => g.options.length);
}
export const PROJECT_CREATE = [{ key: 'work', label: '· работа' }, { key: 'personal', label: '· личное' }];
export function createProjectQuick(name, sphere) {
  if (!name) return null;
  const used = store.get().projects.map((p) => p.color);
  const color = PROJECT_COLORS.find((c) => !used.includes(c)) || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
  return addProject({ name, sphere, color });
}
export { projectGroups };
const STATUS_GROUPS = [{ options: [{ value: 'todo', label: 'К работе', color: '#9AAAB5' }, { value: 'doing', label: 'В процессе', color: '#2E8FD6' }, { value: 'done', label: 'Готово', color: '#2E8A5C' }] }];

// ===== Задача: создание и редактирование =====
export function taskModal({ id = null, projectId, title = '', date, fromInbox = null } = {}) {
  const s = store.get();
  const t = id ? s.tasks.find((x) => x.id === id) : null;
  const today = todayISO();
  const data = t ? { ...t, tags: [...(t.tags || [])] } : { title, projectId: projectId !== undefined ? projectId : (s.projects.find((p) => !p.archived) || {}).id || '', date: date !== undefined ? date : today, time: '', deadline: '', tags: [], status: 'todo' };

  const body = `<form data-form style="display:flex;flex-direction:column;gap:14px">
    <label for="f-title" class="sr">Название задачи</label>
    <input id="f-title" name="title" class="input" style="font-size:16px;min-height:50px" placeholder="Что нужно сделать?" value="${esc(data.title)}" required autocomplete="off">
    <div class="form-grid">
      <div class="field"><label class="label" for="f-project">Проект</label><div data-project></div></div>
      <div class="field"><label class="label" for="f-date">Когда</label><div data-date></div></div>
      <div class="field"><label class="label" for="f-deadline">Срок</label><div data-deadline></div></div>
      ${t ? '<div class="field"><label class="label" for="f-status">Статус</label><div data-status></div></div>' : ''}
    </div>
    <div class="field"><span class="label" id="rep-lbl">Повтор</span><div class="repeat" data-repeat role="group" aria-labelledby="rep-lbl"></div></div>
    <details class="forreport"${t && (t.bitrixUrl || t.comment) ? ' open' : ''}><summary>Для отчёта: чат в Битриксе и комментарий</summary>
      <div class="form-grid" style="margin-top:10px">
        <div class="field"><label class="label" for="f-bx">Свой чат задачи</label><input id="f-bx" class="input" type="url" inputmode="url" autocomplete="off" value="${esc(t && t.bitrixUrl ? t.bitrixUrl : '')}" data-bx placeholder=""></div>
        <div class="field"><label class="label" for="f-cm">Комментарий к статусу</label><input id="f-cm" class="input" autocomplete="off" value="${esc(t && t.comment ? t.comment : '')}" placeholder="Например: жду правки от клиента"></div>
      </div>
    </details>
    <div class="field"><span class="label" id="tags-lbl">Теги</span><div data-tags aria-labelledby="tags-lbl"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${t ? 'Сохранить' : 'Добавить задачу'}</button>
      <button class="btn ghost" type="button" data-close>Отмена</button>
      ${t ? '<button class="btn danger" type="button" data-delete style="margin-left:auto">Удалить</button>' : ''}
    </div>
  </form>`;

  open(t ? 'Задача' : 'Новая задача', body, (m) => {
    const form = m.querySelector('[data-form]');
    const tagsF = tagInput(m.querySelector('[data-tags]'), { value: data.tags, all: () => store.get().tags });
    const dateF = dateField(m.querySelector('[data-date]'), { value: data.date || '', id: 'f-date', name: 'date' });
    const dlF = dateField(m.querySelector('[data-deadline]'), { value: data.deadline || '', id: 'f-deadline', name: 'deadline', placeholder: 'без срока', clearLabel: 'Без срока' });
    const projHost = m.querySelector('[data-project]');
    let projF = null;
    projF = selectField(projHost, { value: data.projectId || '', id: 'f-project', name: 'projectId', groups: () => projectGroups(projF ? projF.get() : data.projectId), search: 'Найти или создать проект…', create: PROJECT_CREATE, onCreate: createProjectQuick });
    const stHost = m.querySelector('[data-status]');
    const stF = stHost ? selectField(stHost, { value: data.status, id: 'f-status', name: 'status', groups: () => STATUS_GROUPS }) : null;
    cleanup = () => { [tagsF, dateF, dlF, projF, stF].forEach((f) => f && f.destroy()); };
    // Подсказка в поле «свой чат»: какой чат у проекта
    const bxIn = m.querySelector('[data-bx]');
    const bxPh = () => { const pr = store.get().projects.find((x) => x.id === projF.get()); bxIn.placeholder = pr && pr.bitrixUrl ? `пусто — пойдёт в чат проекта «${pr.name}»` : 'https://… (у проекта чата нет)'; };
    bxPh(); projHost.addEventListener('pick', bxPh);
    // Повтор: дни недели кнопками + быстрые варианты
    let rep = Array.isArray(data.repeat) ? [...data.repeat] : [];
    const repHost = m.querySelector('[data-repeat]');
    const WDN = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const PRESETS = [['Будни', [1, 2, 3, 4, 5]], ['Каждый день', [1, 2, 3, 4, 5, 6, 7]]];
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    const drawRep = () => {
      repHost.innerHTML = `<div class="repdays">${WDN.map((n, i) => `<button type="button" class="repday${rep.includes(i + 1) ? ' on' : ''}" data-day="${i + 1}" aria-pressed="${rep.includes(i + 1)}">${n}</button>`).join('')}</div>
        <div class="repquick">${PRESETS.map(([l, d]) => `<button type="button" class="qchip${same(rep, d) ? ' on' : ''}" data-preset="${d.join(',')}">${l}</button>`).join('')}${rep.length ? '<button type="button" class="link" data-preset="">Не повторять</button>' : '<span class="muted" style="font-size:12px">не повторяется</span>'}</div>`;
    };
    drawRep();
    repHost.addEventListener('click', (e) => {
      const d = e.target.closest('[data-day]'); const p = e.target.closest('[data-preset]');
      if (d) { const n = Number(d.dataset.day); rep = rep.includes(n) ? rep.filter((x) => x !== n) : [...rep, n].sort(); }
      else if (p) rep = p.dataset.preset ? p.dataset.preset.split(',').map(Number) : [];
      else return;
      drawRep();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const titleV = String(fd.get('title') || '').trim();
      if (!titleV) return;
      let pid = projF.get();
      const payload = { title: titleV, projectId: pid || null, date: dateF.get() || null, deadline: dlF.get() || '', tags: tagsF.get() };
      if (rep.length || (t && t.repeat && t.repeat.length)) payload.repeat = rep;
      const bx = m.querySelector('#f-bx').value.trim(); const cm = m.querySelector('#f-cm').value.trim();
      if (bx && !/^https?:\/\/\S+$/i.test(bx)) { const i = m.querySelector('#f-bx'); m.querySelector('.forreport').open = true; i.setCustomValidity('Нужна ссылка, начинающаяся с https://'); i.reportValidity(); i.addEventListener('input', () => i.setCustomValidity(''), { once: true }); return; }
      if (bx || (t && t.bitrixUrl !== undefined)) payload.bitrixUrl = bx;
      if (cm || (t && t.comment !== undefined)) payload.comment = cm;
      if (t) updateTask(t.id, { ...payload, status: stF ? stF.get() : t.status });
      else { addTask(payload); if (fromInbox) removeInbox(fromInbox); }
      closeModal();
    });
    const del = m.querySelector('[data-delete]');
    if (del) del.addEventListener('click', async () => { if (await ask(t.repeat && t.repeat.length ? 'Удалить повторяющуюся задачу? Больше она появляться не будет, а уже выполненные останутся в истории.' : 'Удалить задачу?', { ok: 'Удалить', danger: true })) { deleteTask(t.id); closeModal(); } });
  });
}

// ===== Проект: создание и настройка =====
const isUrl = (v) => /^https?:\/\/\S+$/i.test(v);
export function projectModal(onCreated, id = null) {
  const p0 = id ? store.get().projects.find((x) => x.id === id) : null;
  let color = p0 ? p0.color : (PROJECT_COLORS.find((c) => !store.get().projects.map((p) => p.color).includes(c)) || PROJECT_COLORS[0]);
  let sphere = p0 ? p0.sphere : 'work';
  const body = `<form data-form style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label class="label" for="p-name">Название</label><input id="p-name" name="name" class="input" required autocomplete="off" value="${esc(p0 ? p0.name : '')}"></div>
    <div class="field"><span class="label">Сфера</span><div class="seg" role="radiogroup">${[['work', 'Работа'], ['personal', 'Личное']].map(([k, l]) => `<button type="button" class="${sphere === k ? 'on' : ''}" data-sphere="${k}" role="radio" aria-checked="${sphere === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><span class="label">Цвет</span><div class="swatches">${PROJECT_COLORS.map((c) => `<button type="button" class="swatch${c === color ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('')}</div></div>
    <div class="field"><label class="label" for="p-bx">Чат в Битриксе</label><input id="p-bx" name="bx" class="input" type="url" inputmode="url" autocomplete="off" placeholder="https://… — сюда бот и отчёт отправят задачи проекта" value="${esc(p0 && p0.bitrixUrl ? p0.bitrixUrl : '')}">
      <span class="muted" style="font-size:12px">Все задачи проекта отчитываются в этот чат. Если у задачи свой чат — ссылку можно задать в самой задаче.</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit">${p0 ? 'Сохранить' : 'Создать проект'}</button><button class="btn ghost" type="button" data-close>Отмена</button></div>
  </form>`;
  open(p0 ? 'Настройки проекта' : 'Новый проект', body, (m) => {
    m.querySelectorAll('[data-sphere]').forEach((b) => b.addEventListener('click', () => {
      sphere = b.dataset.sphere;
      m.querySelectorAll('[data-sphere]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    }));
    m.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
      color = b.dataset.color; m.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get('name') || '').trim(); if (!name) return;
      const bx = String(fd.get('bx') || '').trim();
      if (bx && !isUrl(bx)) { const i = m.querySelector('#p-bx'); i.setCustomValidity('Нужна ссылка, начинающаяся с https://'); i.reportValidity(); i.addEventListener('input', () => i.setCustomValidity(''), { once: true }); return; }
      if (p0) { updateProject(p0.id, { name, sphere, color, ...(bx || p0.bitrixUrl !== undefined ? { bitrixUrl: bx } : {}) }); closeModal(); return; }
      const nid = addProject({ name, sphere, color, bitrixUrl: bx || undefined });
      closeModal();
      if (onCreated) onCreated(nid);
    });
  });
}

// ===== Событие =====
export function eventModal() {
  const body = `<form data-form style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label class="label" for="e-title">Что</label><input id="e-title" name="title" class="input" required autocomplete="off"></div>
    <div class="form-grid">
      <div class="field"><label class="label" for="e-date">Дата</label><div data-date></div></div>
      <div class="field"><label class="label" for="e-time">Время</label><div data-time></div></div>
      <div class="field"><label class="label" for="e-cat">Категория</label><div data-cat></div></div>
    </div>
    <div style="display:flex;gap:8px"><button class="btn" type="submit">Добавить событие</button><button class="btn ghost" type="button" data-close>Отмена</button></div>
  </form>`;
  open('Новое событие', body, (m) => {
    const timeF = timeField(m.querySelector('[data-time]'), { value: '', id: 'e-time', name: 'time' });
    const dateF = dateField(m.querySelector('[data-date]'), { value: todayISO(), id: 'e-date', name: 'date', required: true });
    const catColors = { work: '#5A60C4', personal: '#D9733A', sport: '#2F8F83', blog: '#7A5CB8' };
    const catF = selectField(m.querySelector('[data-cat]'), { value: 'personal', id: 'e-cat', name: 'cat', groups: () => [{ options: Object.entries(EVENT_CATS).map(([k, v]) => ({ value: k, label: v.label, color: catColors[k] })) }] });
    cleanup = () => { timeF.destroy(); dateF.destroy(); catF.destroy(); };
    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim(); if (!title) return;
      addEvent({ title, date: dateF.get() || todayISO(), time: timeF.get(), cat: catF.get() });
      closeModal();
    });
  });
}
