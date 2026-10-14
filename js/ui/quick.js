// Быстрое добавление: одно поле, откуда угодно (кнопка «+», клавиша N или ⌘K).
// Проект подтягивается по тексту: «@» — выбрать из списка, а слово из названия проекта — подсказка.
import { esc, todayISO, addDays } from '../util.js';
import { icon } from './icons.js';
import { store, addTask, addInbox, NO_PROJECT } from '../store.js';
import { createProjectQuick, taskModal } from './modals.js';

let openEl = null;
const low = (x) => String(x || '').toLowerCase();

export function quickOpen() { return !!openEl; }

export function openQuick({ projectId = '', date = todayISO(), title = '', toast = () => {} } = {}) {
  if (openEl) { openEl.querySelector('[data-qt]').focus(); return; }
  const prevFocus = document.activeElement;
  let proj = projectId || '';
  let day = date;
  let sug = []; let hi = -1; let mode = 'none';   // 'at' — выбор после «@», 'auto' — подсказка по слову

  const wrap = document.createElement('div');
  wrap.className = 'qa-back';
  wrap.innerHTML = `<div class="qa-panel fade" role="dialog" aria-modal="true" aria-label="Быстро добавить задачу">
    <div class="qa-inputrow">${icon('plus', 20, 2.2)}<input data-qt placeholder="Что сделать? «@» — выбрать проект" autocomplete="off" enterkeyhint="done" aria-label="Новая задача" value="${esc(title)}"></div>
    <div class="qa-sug" data-sug hidden role="listbox"></div>
    <div class="qa-row">
      <button type="button" class="qa-chip" data-proj title="Проект"></button>
      <div class="qa-dates" role="group" aria-label="Когда">
        <button type="button" data-day="${todayISO()}">Сегодня</button><button type="button" data-day="${addDays(todayISO(), 1)}">Завтра</button><button type="button" data-day="">Без даты</button>
      </div>
    </div>
    <div class="qa-foot">
      <button type="button" class="link" data-more>Подробнее: срок, теги, повтор</button>
      <span style="flex:1"></span>
      <button type="button" class="btn ghost small" data-inbox title="Shift+Enter">В улов</button>
      <button type="button" class="btn small" data-add>Добавить</button>
    </div>
  </div>`;
  document.body.appendChild(wrap);
  openEl = wrap;
  const input = wrap.querySelector('[data-qt]');
  const sugEl = wrap.querySelector('[data-sug]');
  const projBtn = wrap.querySelector('[data-proj]');

  const projects = () => store.get().projects.filter((p) => !p.archived);
  const projOf = (id) => projects().find((p) => p.id === id) || null;
  const drawChips = () => {
    const p = projOf(proj) || NO_PROJECT;
    projBtn.innerHTML = `<span class="pdot" style="background:${esc(p.color)};width:9px;height:9px"></span>${esc(p.name)}<span class="muted" style="font-size:12px">▾</span>`;
    wrap.querySelectorAll('[data-day]').forEach((b) => b.classList.toggle('on', b.dataset.day === (day || '')));
  };
  // Что сейчас набирают после «@»
  const atToken = () => { const m = input.value.slice(0, input.selectionStart ?? input.value.length).match(/(^|\s)@([^\s@]*)$/); return m ? m[2] : null; };
  const lastWord = () => { const m = input.value.match(/([\p{L}\d-]{3,})$/u); return m ? m[1] : null; };
  const compute = () => {
    const at = atToken();
    if (at !== null) {
      mode = 'at';
      const ws = (p) => low(p.name).split(/[\s«»"'().,-]+/).some((x) => x.startsWith(low(at)));
      const list = !at ? projects() : [...projects().filter(ws), ...projects().filter((p) => !ws(p) && low(p.name).includes(low(at)))].slice(0, 7);
      sug = [{ id: '', name: NO_PROJECT.name, color: NO_PROJECT.color }, ...list].filter((p) => p.id || !at || low(p.name).includes(low(at)));
      if (at && !projects().some((p) => low(p.name) === low(at))) sug.push({ create: 'work', name: at }, { create: 'personal', name: at });
      hi = sug.length ? 0 : -1;
    } else {
      mode = 'auto';
      const w = lastWord();
      sug = w ? projects().filter((p) => p.id !== proj && low(p.name).split(/[\s«»"'().,-]+/).some((x) => x.startsWith(low(w)))).slice(0, 3) : [];
      hi = -1;
    }
    drawSug();
  };
  const drawSug = () => {
    if (!sug.length) { sugEl.hidden = true; sugEl.innerHTML = ''; return; }
    sugEl.hidden = false;
    sugEl.innerHTML = (mode === 'auto' ? '<div class="qa-sugcap">В проект? Tab — выбрать</div>' : '<div class="qa-sugcap">Проект</div>') + sug.map((p, i) => p.create
      ? `<button type="button" class="opt${i === hi ? ' hi' : ''}" data-i="${i}" style="color:var(--accent);font-weight:600"><span style="font-size:16px;line-height:1">＋</span><span style="flex:1">Создать «${esc(p.name)}» · ${p.create === 'work' ? 'работа' : 'личное'}</span></button>`
      : `<button type="button" class="opt${i === hi ? ' hi' : ''}${p.id === proj && mode === 'at' ? ' on' : ''}" data-i="${i}"><span class="pdot" style="background:${esc(p.color)};width:9px;height:9px"></span><span style="flex:1">${esc(p.name)}</span></button>`).join('');
  };
  const choose = (i) => {
    const p = sug[i]; if (!p) return;
    if (p.create) proj = createProjectQuick(p.name, p.create) || proj;
    else proj = p.id || '';
    if (mode === 'at') {
      const pos = input.selectionStart ?? input.value.length;
      const before = input.value.slice(0, pos).replace(/(^|\s)@[^\s@]*$/, '$1');
      input.value = (before + input.value.slice(pos)).replace(/\s{2,}/g, ' ');
    }
    sug = []; drawSug(); drawChips(); input.focus();
  };
  const close = () => {
    wrap.remove(); openEl = null;
    document.removeEventListener('keydown', onKey, true);
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
  };
  const title_ = () => input.value.replace(/(^|\s)@[^\s@]*$/, '').trim();
  const add = () => {
    const t = title_(); if (!t) { input.focus(); return; }
    addTask({ title: t, projectId: proj || null, date: day || null });
    const p = projOf(proj);
    toast(p ? `Задача добавлена в «${p.name}»` : 'Задача добавлена');
    close();
  };
  const toInbox = () => { const t = title_(); if (!t) { input.focus(); return; } addInbox(t); toast('Поймала! Лежит в улове'); close(); };
  function onKey(e) {
    if (!openEl) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!sugEl.hidden && mode === 'at') { sug = []; drawSug(); } else close(); return; }
    if (e.target !== input) return;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sug.length) { e.preventDefault(); hi = (hi + (e.key === 'ArrowDown' ? 1 : sug.length - 1) + (hi < 0 && e.key === 'ArrowUp' ? 1 : 0)) % sug.length; drawSug(); return; }
    if (e.key === 'Tab' && sug.length) { e.preventDefault(); choose(hi >= 0 ? hi : 0); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (sug.length && hi >= 0) { choose(hi); return; }
      if (e.shiftKey) toInbox(); else add();
    }
  }
  document.addEventListener('keydown', onKey, true);
  input.addEventListener('input', compute);
  input.addEventListener('click', compute);
  sugEl.addEventListener('mousedown', (e) => { const b = e.target.closest('[data-i]'); if (b) { e.preventDefault(); choose(Number(b.dataset.i)); } });
  projBtn.addEventListener('click', () => {
    if (!/(^|\s)@[^\s@]*$/.test(input.value)) input.value = input.value.replace(/\s*$/, input.value.trim() ? ' @' : '@');
    input.focus(); input.setSelectionRange(input.value.length, input.value.length); compute();
  });
  wrap.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { day = b.dataset.day; drawChips(); input.focus(); }));
  wrap.querySelector('[data-add]').addEventListener('click', add);
  wrap.querySelector('[data-inbox]').addEventListener('click', toInbox);
  wrap.querySelector('[data-more]').addEventListener('click', () => { const t = title_(); const p = proj; const d = day; close(); taskModal({ title: t, projectId: p, date: d }); });
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  drawChips();
  input.focus(); input.setSelectionRange(input.value.length, input.value.length);
}
