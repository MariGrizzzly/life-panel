import { esc, todayISO, addDays } from '../util.js';
import { tagInput, timeField, dateChips } from './fields.js';
import { icon } from './icons.js';
import { store, addTask, updateTask, deleteTask, addProject, addEvent, PROJECT_COLORS, EVENT_CATS, removeInbox } from '../store.js';

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

function open(title, body, mount) {
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

function projectOptions(selected) {
  const s = store.get();
  const opts = (sphere) => s.projects.filter((p) => p.sphere === sphere && (!p.archived || p.id === selected))
    .map((p) => `<option value="${esc(p.id)}"${p.id === selected ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
  return `<optgroup label="Работа">${opts('work')}</optgroup><optgroup label="Личное">${opts('personal')}<option value=""${!selected ? ' selected' : ''}>Без проекта</option></optgroup><option value="__new">+ Новый проект…</option>`;
}

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
      <div class="field"><label class="label" for="f-project">Проект</label><select id="f-project" name="projectId" class="select">${projectOptions(data.projectId)}</select></div>
      <div class="field"><label class="label" for="f-date">Когда</label><input id="f-date" name="date" type="date" class="input" value="${esc(data.date || '')}"><div class="chips" data-datechips></div></div>
      <div class="field"><label class="label" for="f-time">Время, если нужно</label><div data-time></div></div>
      <div class="field"><label class="label" for="f-deadline">Срок</label><input id="f-deadline" name="deadline" type="date" class="input" value="${esc(data.deadline || '')}"></div>
      ${t ? `<div class="field"><label class="label" for="f-status">Статус</label><select id="f-status" name="status" class="select"><option value="todo"${data.status === 'todo' ? ' selected' : ''}>К работе</option><option value="doing"${data.status === 'doing' ? ' selected' : ''}>В процессе</option><option value="done"${data.status === 'done' ? ' selected' : ''}>Готово</option></select></div>` : ''}
    </div>
    <div data-newproj hidden style="border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--surface-2);display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="flex:1 1 200px"><label class="label" for="np-name">Как назовём новый проект?</label><input id="np-name" class="input" placeholder="Например, «Сайт клиента»" autocomplete="off"></div>
      <div class="seg" role="radiogroup" aria-label="Сфера"><button type="button" class="on" data-np-sphere="work" role="radio" aria-checked="true">Работа</button><button type="button" data-np-sphere="personal" role="radio" aria-checked="false">Личное</button></div>
      <button type="button" class="btn small" data-np-create>Создать</button>
    </div>
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
    const timeF = timeField(m.querySelector('[data-time]'), { value: data.time, id: 'f-time', name: 'time' });
    dateChips(m.querySelector('#f-date'), m.querySelector('[data-datechips]'), [
      { label: 'Сегодня', value: today }, { label: 'Завтра', value: addDays(today, 1) }, { label: 'Без даты', value: '' }
    ]);
    cleanup = () => { tagsF.destroy(); timeF.destroy(); };
    const projSel = m.querySelector('#f-project');
    const np = m.querySelector('[data-newproj]');
    let prevProject = projSel.value;
    let npSphere = 'work';
    projSel.addEventListener('change', () => {
      np.hidden = projSel.value !== '__new';
      if (!np.hidden) m.querySelector('#np-name').focus(); else prevProject = projSel.value;
    });
    np.querySelectorAll('[data-np-sphere]').forEach((b) => b.addEventListener('click', () => {
      npSphere = b.dataset.npSphere;
      np.querySelectorAll('[data-np-sphere]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    }));
    const createProject = () => {
      const name = m.querySelector('#np-name').value.trim();
      if (!name) { m.querySelector('#np-name').focus(); return null; }
      const used = store.get().projects.map((p) => p.color);
      const color = PROJECT_COLORS.find((c) => !used.includes(c)) || PROJECT_COLORS[0];
      const pid = addProject({ name, sphere: npSphere, color });
      projSel.innerHTML = projectOptions(pid);
      prevProject = pid;
      np.hidden = true;
      return pid;
    };
    np.querySelector('[data-np-create]').addEventListener('click', createProject);
    m.querySelector('#np-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); createProject(); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const titleV = String(fd.get('title') || '').trim();
      if (!titleV) return;
      let pid = fd.get('projectId');
      if (pid === '__new') pid = m.querySelector('#np-name').value.trim() ? createProject() : prevProject;
      const payload = { title: titleV, projectId: pid || null, date: fd.get('date') || null, time: timeF.get(), deadline: fd.get('deadline') || '', tags: tagsF.get() };
      if (t) updateTask(t.id, { ...payload, status: fd.get('status') || t.status });
      else { addTask(payload); if (fromInbox) removeInbox(fromInbox); }
      closeModal();
    });
    const del = m.querySelector('[data-delete]');
    if (del) del.addEventListener('click', async () => { if (await ask('Удалить задачу?', { ok: 'Удалить', danger: true })) { deleteTask(t.id); closeModal(); } });
  });
}

// ===== Проект =====
export function projectModal(onCreated) {
  let color = PROJECT_COLORS.find((c) => !store.get().projects.map((p) => p.color).includes(c)) || PROJECT_COLORS[0];
  const body = `<form data-form style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label class="label" for="p-name">Название</label><input id="p-name" name="name" class="input" required autocomplete="off"></div>
    <div class="field"><span class="label">Сфера</span><div class="seg" role="radiogroup"><button type="button" class="on" data-sphere="work" role="radio" aria-checked="true">Работа</button><button type="button" data-sphere="personal" role="radio" aria-checked="false">Личное</button></div></div>
    <div class="field"><span class="label">Цвет</span><div class="swatches">${PROJECT_COLORS.map((c) => `<button type="button" class="swatch${c === color ? ' on' : ''}" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('')}</div></div>
    <div style="display:flex;gap:8px"><button class="btn" type="submit">Создать проект</button><button class="btn ghost" type="button" data-close>Отмена</button></div>
  </form>`;
  open('Новый проект', body, (m) => {
    let sphere = 'work';
    m.querySelectorAll('[data-sphere]').forEach((b) => b.addEventListener('click', () => {
      sphere = b.dataset.sphere;
      m.querySelectorAll('[data-sphere]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    }));
    m.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
      color = b.dataset.color; m.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = new FormData(e.target).get('name').trim();
      if (!name) return;
      const id = addProject({ name, sphere, color });
      closeModal();
      if (onCreated) onCreated(id);
    });
  });
}

// ===== Событие =====
export function eventModal() {
  const body = `<form data-form style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label class="label" for="e-title">Что</label><input id="e-title" name="title" class="input" required autocomplete="off"></div>
    <div class="form-grid">
      <div class="field"><label class="label" for="e-date">Дата</label><input id="e-date" name="date" type="date" class="input" value="${todayISO()}" required></div>
      <div class="field"><label class="label" for="e-time">Время</label><div data-time></div></div>
      <div class="field"><label class="label" for="e-cat">Категория</label><select id="e-cat" name="cat" class="select">${Object.entries(EVENT_CATS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
    </div>
    <div style="display:flex;gap:8px"><button class="btn" type="submit">Добавить событие</button><button class="btn ghost" type="button" data-close>Отмена</button></div>
  </form>`;
  open('Новое событие', body, (m) => {
    const timeF = timeField(m.querySelector('[data-time]'), { value: '', id: 'e-time', name: 'time' });
    cleanup = () => timeF.destroy();
    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim(); if (!title) return;
      addEvent({ title, date: fd.get('date'), time: timeF.get(), cat: fd.get('cat') });
      closeModal();
    });
  });
}
