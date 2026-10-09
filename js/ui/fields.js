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
