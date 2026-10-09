import { esc, todayISO } from '../util.js';
import { icon } from './icons.js';
import { store, addTask, updateTask, deleteTask, addProject, addEvent, PROJECT_COLORS, EVENT_CATS, removeInbox } from '../store.js';

const root = () => document.getElementById('modal-root');
let lastFocus = null;

export function closeModal() {
  root().innerHTML = '';
  document.removeEventListener('keydown', onKey);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
function onKey(e) { if (e.key === 'Escape' && !document.querySelector('[data-ask]')) closeModal(); }

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
export function taskModal({ id = null, projectId = '', title = '', fromInbox = null } = {}) {
  const s = store.get();
  const t = id ? s.tasks.find((x) => x.id === id) : null;
  const data = t ? { ...t, tags: [...(t.tags || [])] } : { title, projectId: projectId || (s.projects[0] ? s.projects[0].id : ''), date: todayISO(), time: '', deadline: '', tags: [], status: 'todo' };
  let tags = [...data.tags];
  let menuOpen = false;

  const body = `<form data-form style="display:flex;flex-direction:column;gap:14px">
    <label for="f-title" class="sr">Название задачи</label>
    <input id="f-title" name="title" class="input" style="font-size:16px;min-height:50px" placeholder="Что нужно сделать?" value="${esc(data.title)}" required autocomplete="off">
    <div class="form-grid">
      <div class="field"><label class="label" for="f-project">Проект</label><select id="f-project" name="projectId" class="select">${projectOptions(data.projectId)}</select></div>
      <div class="field"><label class="label" for="f-date">Когда</label><input id="f-date" name="date" type="date" class="input" value="${esc(data.date || '')}"></div>
      <div class="field"><label class="label" for="f-time">Время, если нужно</label><input id="f-time" name="time" type="time" class="input" value="${esc(data.time || '')}"></div>
      <div class="field"><label class="label" for="f-deadline">Срок</label><input id="f-deadline" name="deadline" type="date" class="input" value="${esc(data.deadline || '')}"></div>
      ${t ? `<div class="field"><label class="label" for="f-status">Статус</label><select id="f-status" name="status" class="select"><option value="todo"${data.status === 'todo' ? ' selected' : ''}>К работе</option><option value="doing"${data.status === 'doing' ? ' selected' : ''}>В процессе</option><option value="done"${data.status === 'done' ? ' selected' : ''}>Готово</option></select></div>` : ''}
    </div>
    <div data-newproj hidden style="border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--surface-2);display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="flex:1 1 200px"><label class="label" for="np-name">Новый проект</label><input id="np-name" class="input" placeholder="Название" autocomplete="off"></div>
      <div class="seg" role="radiogroup" aria-label="Сфера"><button type="button" class="on" data-np-sphere="work" role="radio" aria-checked="true">Работа</button><button type="button" data-np-sphere="personal" role="radio" aria-checked="false">Личное</button></div>
      <button type="button" class="btn small" data-np-create>Создать</button>
    </div>
    <div class="field" style="position:relative"><span class="label">Теги</span><div data-tags></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${t ? 'Сохранить' : 'Добавить задачу'}</button>
      <button class="btn ghost" type="button" data-close>Отмена</button>
      ${t ? '<button class="btn danger" type="button" data-delete style="margin-left:auto">Удалить</button>' : '<span class="muted" style="font-size:13px">Личное или работа — по проекту</span>'}
    </div>
  </form>`;

  open(t ? 'Задача' : 'Новая задача', body, (m) => {
    const form = m.querySelector('[data-form]');
    const tagsEl = m.querySelector('[data-tags]');
    const renderTags = () => {
      const all = store.get().tags;
      tagsEl.innerHTML = `<div class="tagbox">
        ${tags.map((tg) => `<span class="tagchip">#${esc(tg)}<button type="button" data-rm="${esc(tg)}" aria-label="Убрать тег ${esc(tg)}">×</button></span>`).join('')}
        ${tags.length ? '' : '<span class="muted" style="font-size:13px">без тегов — можно оставить пустым</span>'}
        <button type="button" data-tagmenu aria-expanded="${menuOpen}" style="margin-left:auto;min-height:34px;border:0;background:var(--bg);border-radius:9px;padding:0 12px;font-size:13px;font-weight:600;cursor:pointer;color:var(--accent)">+ Тег ▾</button>
      </div>
      ${menuOpen ? `<div class="menu fade" style="top:74px;right:0;width:300px">
        ${all.map((tg) => { const on = tags.includes(tg); return `<button type="button" class="opt" data-tg="${esc(tg)}"><span style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${on ? 'var(--accent)' : '#9AAAB5'};background:${on ? 'var(--accent)' : '#FFFFFF'};color:#FFFFFF;font-size:12px;display:flex;align-items:center;justify-content:center">${on ? '✓' : ''}</span>#${esc(tg)}</button>`; }).join('')}
        <div style="border-top:1px solid var(--line-soft);margin-top:6px;padding-top:8px;display:flex;gap:6px">
          <label for="f-newtag" class="sr">Новый тег</label><input id="f-newtag" class="input" style="min-height:38px" placeholder="Новый тег" autocomplete="off">
          <button type="button" class="btn small" data-newtag>Создать</button>
        </div></div>` : ''}`;
    };
    renderTags();
    tagsEl.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm]'); if (rm) { tags = tags.filter((x) => x !== rm.dataset.rm); renderTags(); return; }
      if (e.target.closest('[data-tagmenu]')) { menuOpen = !menuOpen; renderTags(); return; }
      const tg = e.target.closest('[data-tg]'); if (tg) { const v = tg.dataset.tg; tags = tags.includes(v) ? tags.filter((x) => x !== v) : [...tags, v]; renderTags(); return; }
      if (e.target.closest('[data-newtag]')) createTag();
    });
    tagsEl.addEventListener('keydown', (e) => { if (e.target.id === 'f-newtag' && e.key === 'Enter') { e.preventDefault(); createTag(); } });
    function createTag() {
      const inp = tagsEl.querySelector('#f-newtag');
      const v = (inp && inp.value || '').trim().replace(/^#/, '');
      if (!v) return;
      store.update((s) => { if (!s.tags.includes(v)) s.tags.push(v); });
      if (!tags.includes(v)) tags.push(v);
      renderTags();
      const again = tagsEl.querySelector('#f-newtag'); if (again) again.focus();
    }
    const projSel = m.querySelector('#f-project');
    const np = m.querySelector('[data-newproj]');
    let npSphere = 'work';
    projSel.addEventListener('change', () => {
      np.hidden = projSel.value !== '__new';
      if (!np.hidden) m.querySelector('#np-name').focus();
    });
    np.querySelectorAll('[data-np-sphere]').forEach((b) => b.addEventListener('click', () => {
      npSphere = b.dataset.npSphere;
      np.querySelectorAll('[data-np-sphere]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    }));
    const createProject = () => {
      const name = m.querySelector('#np-name').value.trim();
      if (!name) { m.querySelector('#np-name').focus(); return; }
      const used = store.get().projects.map((p) => p.color);
      const color = PROJECT_COLORS.find((c) => !used.includes(c)) || PROJECT_COLORS[0];
      const pid = addProject({ name, sphere: npSphere, color });
      projSel.innerHTML = projectOptions(pid);
      np.hidden = true;
    };
    np.querySelector('[data-np-create]').addEventListener('click', createProject);
    m.querySelector('#np-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); createProject(); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const titleV = String(fd.get('title') || '').trim();
      if (!titleV) return;
      const payload = { title: titleV, projectId: fd.get('projectId') === '__new' ? null : (fd.get('projectId') || null), date: fd.get('date') || null, time: fd.get('time') || '', deadline: fd.get('deadline') || '', tags };
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
      <div class="field"><label class="label" for="e-time">Время</label><input id="e-time" name="time" type="time" class="input"></div>
      <div class="field"><label class="label" for="e-cat">Категория</label><select id="e-cat" name="cat" class="select">${Object.entries(EVENT_CATS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
    </div>
    <div style="display:flex;gap:8px"><button class="btn" type="submit">Добавить событие</button><button class="btn ghost" type="button" data-close>Отмена</button></div>
  </form>`;
  open('Новое событие', body, (m) => {
    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim(); if (!title) return;
      addEvent({ title, date: fd.get('date'), time: fd.get('time'), cat: fd.get('cat') });
      closeModal();
    });
  });
}
