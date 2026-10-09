// Поля формы: теги с подсказками и выбор времени. Оба закрываются кликом мимо.
import { esc } from '../util.js';

// Закрывать всплывающее окно, если нажали где-то ещё
function onOutside(el, close) {
  const h = (e) => { if (!el.contains(e.target)) close(); };
  document.addEventListener('pointerdown', h, true);
  return () => document.removeEventListener('pointerdown', h, true);
}

// ===== Теги =====
// Печатаешь — подсказываются существующие теги; Enter или запятая — добавить; Backspace — убрать последний.
export function tagInput(host, { value = [], all = () => [] } = {}) {
  let tags = [...value];
  let open = false;
  let hi = 0;
  host.innerHTML = `<div class="taginput"><span data-chips style="display:contents"></span><input type="text" data-tag-input aria-label="Теги" autocomplete="off" enterkeyhint="done"><div class="suggest" data-suggest hidden role="listbox"></div></div>`;
  const box = host.querySelector('.taginput');
  const input = host.querySelector('[data-tag-input]');
  const chipsEl = host.querySelector('[data-chips]');
  const sug = host.querySelector('[data-suggest]');

  const options = () => {
    const q = input.value.trim().replace(/^#/, '').toLowerCase();
    const list = all().filter((t) => !tags.includes(t) && (!q || t.toLowerCase().includes(q)));
    const exact = all().some((t) => t.toLowerCase() === q) || tags.some((t) => t.toLowerCase() === q);
    const out = list.map((t) => ({ t, label: '#' + t }));
    if (q && !exact) out.push({ t: input.value.trim().replace(/^#/, ''), label: `Создать тег «${input.value.trim().replace(/^#/, '')}»`, isNew: true });
    return out;
  };
  const drawChips = () => {
    chipsEl.innerHTML = tags.map((tg) => `<span class="tagchip">#${esc(tg)}<button type="button" data-rm="${esc(tg)}" aria-label="Убрать тег ${esc(tg)}">×</button></span>`).join('');
    input.placeholder = tags.length ? 'ещё тег…' : 'Начни печатать, например «важно», или оставь пустым';
  };
  const drawSug = () => {
    const opts = options();
    if (!open || !opts.length) { sug.hidden = true; return; }
    if (hi >= opts.length) hi = 0;
    sug.hidden = false;
    sug.innerHTML = opts.map((o, i) => `<button type="button" class="opt${i === hi ? ' hi' : ''}" data-pick="${esc(o.t)}" role="option" aria-selected="${i === hi}" style="${o.isNew ? 'color:var(--accent);font-weight:600' : ''}">${esc(o.label)}</button>`).join('');
  };
  const add = (t) => {
    t = (t || '').trim().replace(/^#/, '');
    if (!t || tags.includes(t)) return;
    tags.push(t); input.value = ''; hi = 0; drawChips(); drawSug();
  };
  let off = null;
  const setOpen = (v) => {
    open = v; drawSug();
    if (v && !off) off = onOutside(box, () => setOpen(false));
    if (!v && off) { off(); off = null; }
  };
  box.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (rm) { tags = tags.filter((x) => x !== rm.dataset.rm); drawChips(); drawSug(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) { add(pick.dataset.pick); input.focus(); return; }
    input.focus();
  });
  input.addEventListener('focus', () => setOpen(true));
  input.addEventListener('input', () => {
    if (input.value.includes(',')) { input.value.split(',').forEach((p, i, arr) => { if (i < arr.length - 1) add(p); else input.value = p; }); }
    hi = 0; setOpen(true);
  });
  input.addEventListener('keydown', (e) => {
    const opts = options();
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(hi + 1, opts.length - 1); drawSug(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); drawSug(); }
    else if (e.key === 'Enter') {
      if (input.value.trim() || (open && opts.length && input.value)) { e.preventDefault(); add(opts[hi] ? opts[hi].t : input.value); }
    } else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); drawChips(); drawSug(); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  });
  drawChips();
  return {
    get: () => { const pending = input.value.trim().replace(/^#/, ''); if (pending && !tags.includes(pending)) tags.push(pending); return [...tags]; },
    destroy: () => { if (off) off(); }
  };
}

// ===== Время =====
// Можно напечатать («930», «9:30») или выбрать час и минуты в окошке.
const HOURS = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);
const MINUTES = ['00', '15', '30', '45'];
export function normTime(v) {
  const d = String(v || '').replace(/[^\d]/g, '');
  if (!d) return '';
  let h, m;
  if (d.length <= 2) { h = +d; m = 0; } else if (d.length === 3) { h = +d[0]; m = +d.slice(1); } else { h = +d.slice(0, 2); m = +d.slice(2, 4); }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function timeField(host, { value = '', id, name, placeholder = 'без времени' } = {}) {
  let val = value || '';
  host.classList.add('timefield');
  host.innerHTML = `<input id="${id}" name="${name}" class="input" inputmode="numeric" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(val)}" aria-haspopup="dialog"><div class="timepop" hidden></div>`;
  const input = host.querySelector('input');
  const pop = host.querySelector('.timepop');
  let off = null;
  const curH = () => (val ? +val.slice(0, 2) : null);
  const curM = () => (val ? val.slice(3, 5) : null);
  const draw = () => {
    pop.innerHTML = `<div class="cap">Час</div><div class="timegrid">${HOURS.map((h) => `<button type="button" class="tslot${curH() === h ? ' on' : ''}" data-h="${h}">${String(h).padStart(2, '0')}</button>`).join('')}</div>
      <div class="cap">Минуты</div><div class="timegrid min">${MINUTES.map((m) => `<button type="button" class="tslot${curM() === m ? ' on' : ''}" data-m="${m}">:${m}</button>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center"><button type="button" class="link" data-clear>Без времени</button><button type="button" class="btn small" data-done>Готово</button></div>`;
  };
  const show = (v) => {
    if (v && pop.hidden) { draw(); pop.hidden = false; off = onOutside(host, () => show(false)); }
    if (!v && !pop.hidden) { pop.hidden = true; if (off) { off(); off = null; } }
  };
  const set = (v) => { val = v; input.value = v; draw(); };
  input.addEventListener('focus', () => show(true));
  input.addEventListener('click', () => show(true));
  input.addEventListener('input', () => { const n = normTime(input.value); if (n && input.value.replace(/\D/g, '').length >= 3) { val = n; draw(); } });
  input.addEventListener('blur', () => { const n = normTime(input.value); if (n === null) { input.value = val; } else { val = n; input.value = n; } });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); show(false); } if (e.key === 'Enter') { e.preventDefault(); input.blur(); show(false); } });
  pop.addEventListener('pointerdown', (e) => e.preventDefault()); // не терять фокус поля
  pop.addEventListener('click', (e) => {
    const h = e.target.closest('[data-h]');
    if (h) { set(`${String(h.dataset.h).padStart(2, '0')}:${curM() || '00'}`); return; }
    const m = e.target.closest('[data-m]');
    if (m) { set(`${String(curH() === null ? 9 : curH()).padStart(2, '0')}:${m.dataset.m}`); show(false); return; }
    if (e.target.closest('[data-clear]')) { set(''); show(false); return; }
    if (e.target.closest('[data-done]')) show(false);
  });
  return { get: () => { const n = normTime(input.value); return n || ''; }, destroy: () => { if (off) off(); } };
}

// Быстрые даты рядом с полем «Когда»
export function dateChips(input, chipsHost, presets) {
  const draw = () => {
    chipsHost.innerHTML = presets.map((p) => `<button type="button" class="qchip${(input.value || '') === (p.value || '') ? ' on' : ''}" data-d="${esc(p.value || '')}">${esc(p.label)}</button>`).join('');
  };
  chipsHost.addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b) return; input.value = b.dataset.d; draw(); });
  input.addEventListener('change', draw);
  draw();
}

// ===== Дата: свой календарь в стиле окна времени =====
const MONTHS_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const shortDate = (iso) => {
  const p = prettyDate(iso);
  return /^(Сегодня|Завтра|Вчера)/.test(p) ? p.split(',')[0] : p;
};
export const prettyDate = (iso) => {
  if (!iso) return '';
  const d = fromIso(iso); const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((d - t) / 86400000);
  const base = `${d.getDate()} ${MONTHS_G[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : ''}`;
  if (diff === 0) return `Сегодня, ${base}`;
  if (diff === 1) return `Завтра, ${base}`;
  if (diff === -1) return `Вчера, ${base}`;
  return `${WD[d.getDay()]}, ${base}`;
};

export function dateField(host, { value = '', id, name, placeholder = 'без даты', clearLabel = 'Без даты', required = false } = {}) {
  let val = value || '';
  let view = val ? fromIso(val) : new Date(); view.setDate(1);
  host.classList.add('timefield');
  host.innerHTML = `<button type="button" id="${id}" class="input pick" aria-haspopup="dialog" aria-expanded="false"><span data-label></span>${CHEV}</button><input type="hidden" name="${name}"><div class="timepop datepop" hidden role="dialog" aria-label="Выбор даты"></div>`;
  const btn = host.querySelector('button.pick');
  const hidden = host.querySelector('input[type=hidden]');
  const label = host.querySelector('[data-label]');
  const pop = host.querySelector('.timepop');
  let off = null;
  const sync = () => { hidden.value = val; label.textContent = val ? shortDate(val) : placeholder; btn.title = val ? prettyDate(val) : ''; label.classList.toggle('ph', !val); };
  const draw = () => {
    const y = view.getFullYear(), m = view.getMonth();
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = isoOf(new Date());
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells += `<button type="button" class="tslot day${iso === val ? ' on' : ''}${iso === today ? ' today' : ''}" data-day="${iso}">${d}</button>`;
    }
    pop.innerHTML = `<div class="cal-head"><button type="button" class="iconbtn" data-nav="-1" aria-label="Предыдущий месяц">${CHEV_L}</button><b>${MONTHS_N[m]} ${y}</b><button type="button" class="iconbtn" data-nav="1" aria-label="Следующий месяц">${CHEV_R}</button></div>
      <div class="calgrid">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((w) => `<span class="cap" style="text-align:center">${w}</span>`).join('')}${cells}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${required ? '<span></span>' : `<button type="button" class="link" data-clear>${esc(clearLabel)}</button>`}<span style="display:flex;gap:6px"><button type="button" class="qchip" data-quick="0">Сегодня</button><button type="button" class="qchip" data-quick="1">Завтра</button></span></div>`;
  };
  const show = (v) => {
    if (v && pop.hidden) { view = val ? fromIso(val) : new Date(); view.setDate(1); draw(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); off = onOutside(host, () => show(false)); }
    if (!v && !pop.hidden) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (off) { off(); off = null; } }
  };
  const set = (v) => { val = v; sync(); show(false); host.dispatchEvent(new CustomEvent('pick', { detail: v })); };
  btn.addEventListener('click', () => show(pop.hidden));
  btn.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); e.preventDefault(); show(false); } });
  pop.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { view.setMonth(view.getMonth() + Number(nav.dataset.nav)); draw(); return; }
    const d = e.target.closest('[data-day]'); if (d) { set(d.dataset.day); btn.focus(); return; }
    const q = e.target.closest('[data-quick]'); if (q) { const t = new Date(); t.setDate(t.getDate() + Number(q.dataset.quick)); set(isoOf(t)); btn.focus(); return; }
    if (e.target.closest('[data-clear]')) { set(''); btn.focus(); }
  });
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); show(false); btn.focus(); } });
  sync();
  return { get: () => val, set: (v) => { val = v || ''; sync(); }, destroy: () => { if (off) off(); } };
}

// ===== Выпадающий список (проект, статус, категория) =====
const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>';
const CHEV_L = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>';
const CHEV_R = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';
export const chevron = CHEV;

// groups: [{ label?, options: [{ value, label, color?, accent? }] }]
export function selectField(host, { value = '', id, name, groups = () => [], placeholder = 'Выбрать' } = {}) {
  let val = value;
  host.classList.add('timefield');
  host.innerHTML = `<button type="button" id="${id}" class="input pick" aria-haspopup="listbox" aria-expanded="false"><span data-label></span>${CHEV}</button><input type="hidden" name="${name}"><div class="timepop listpop" hidden role="listbox"></div>`;
  const btn = host.querySelector('button.pick');
  const hidden = host.querySelector('input[type=hidden]');
  const label = host.querySelector('[data-label]');
  const pop = host.querySelector('.timepop');
  let off = null; let hi = -1;
  const flat = () => groups().flatMap((g) => g.options);
  const find = (v) => flat().find((o) => o.value === v);
  const dot = (o) => (o && o.color ? `<span class="pdot" style="background:${esc(o.color)};width:10px;height:10px"></span>` : '');
  const sync = () => { const o = find(val); hidden.value = val; label.innerHTML = o ? `${dot(o)}<span>${esc(o.label)}</span>` : `<span class="ph">${esc(placeholder)}</span>`; };
  const draw = () => {
    const opts = flat();
    pop.innerHTML = groups().map((g) => `${g.label ? `<div class="menu-sec">${esc(g.label)}</div>` : ''}${g.options.map((o) => { const i = opts.indexOf(o); return `<button type="button" class="opt${o.value === val ? ' on' : ''}${i === hi ? ' hi' : ''}" data-v="${esc(o.value)}" role="option" aria-selected="${o.value === val}" style="${o.accent ? 'color:var(--accent);font-weight:600' : ''}">${dot(o)}<span style="flex:1">${esc(o.label)}</span>${o.value === val ? '<span aria-hidden="true">✓</span>' : ''}</button>`; }).join('')}`).join('');
  };
  const show = (v) => {
    if (v && pop.hidden) { hi = flat().findIndex((o) => o.value === val); draw(); pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); off = onOutside(host, () => show(false)); }
    if (!v && !pop.hidden) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (off) { off(); off = null; } }
  };
  const pick = (v) => { show(false); if (v !== '__new') { val = v; sync(); } host.dispatchEvent(new CustomEvent('pick', { detail: v })); };
  btn.addEventListener('click', () => show(pop.hidden));
  btn.addEventListener('keydown', (e) => {
    const opts = flat();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (pop.hidden) show(true); hi = Math.max(0, Math.min(opts.length - 1, hi + (e.key === 'ArrowDown' ? 1 : -1))); draw(); }
    else if (e.key === 'Enter' && !pop.hidden && opts[hi]) { e.preventDefault(); pick(opts[hi].value); }
    else if (e.key === 'Escape' && !pop.hidden) { e.preventDefault(); e.stopPropagation(); show(false); }
  });
  pop.addEventListener('click', (e) => { const o = e.target.closest('[data-v]'); if (o) { pick(o.dataset.v); btn.focus(); } });
  sync();
  return { get: () => val, set: (v) => { val = v; sync(); }, refresh: () => { sync(); if (!pop.hidden) draw(); }, destroy: () => { if (off) off(); } };
}
