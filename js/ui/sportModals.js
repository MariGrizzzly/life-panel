// Окна «Тренировка» (спорт) и «Тренировка по бильярду»
import { esc, todayISO, uid, shortDate } from '../util.js';
import { dateField } from './fields.js';
import { icon } from './icons.js';
import { open, closeModal, setCleanup, ask } from './modals.js';
import { store, saveWorkout, deleteWorkout, saveBilliard, deleteBilliard } from '../store.js';
import { exerciseNames, lastExercise, weightStep, fmtKg, parseNum, drillNames, drillPct, sessionPct, pctText } from '../sport.js';
import { splash } from './fx.js';

const CHEERS = [
  (d, w) => `Ого, +${d} кг! Теперь ${w} 🌊`,
  (d, w) => `Новая высота — ${w} кг! 💪`,
  (d, w) => `Волна силы: +${d} кг`,
  (d, w) => `${w} кг — красота, Марина!`
];
const norm = (n) => String(n || '').trim().toLowerCase();

// Поле с подсказками названий (как теги, но одно значение)
function nameSuggest(input, all, onPick) {
  const wrap = input.parentElement;
  const sug = document.createElement('div');
  sug.className = 'suggest'; sug.hidden = true; sug.setAttribute('role', 'listbox');
  wrap.appendChild(sug);
  let hi = 0; let list = [];
  const draw = () => {
    const q = norm(input.value);
    list = all().filter((n) => !q || norm(n).includes(q)).filter((n) => norm(n) !== q).slice(0, 8);
    if (!list.length) { sug.hidden = true; return; }
    hi = Math.min(hi, list.length - 1);
    sug.innerHTML = list.map((n, i) => `<button type="button" class="opt${i === hi ? ' hi' : ''}" data-n="${esc(n)}" role="option">${esc(n)}</button>`).join('');
    sug.hidden = false;
  };
  const pick = (n) => { input.value = n; sug.hidden = true; onPick(n); };
  input.addEventListener('focus', draw);
  input.addEventListener('input', () => { hi = 0; draw(); });
  input.addEventListener('keydown', (e) => {
    if (sug.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); hi = (hi + 1) % list.length; draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = (hi - 1 + list.length) % list.length; draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(list[hi]); }
    else if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); sug.hidden = true; }
  });
  sug.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-n]'); if (b) { e.preventDefault(); pick(b.dataset.n); } });
  input.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 120));
}

// ===== Спорт =====
export function workoutModal({ id = null } = {}) {
  const s = store.get();
  const w0 = id ? s.workouts.find((x) => x.id === id) : null;
  const w = w0 ? JSON.parse(JSON.stringify(w0)) : { id: uid(), day: todayISO(), duration: 60, coach: false, exercises: [], note: '' };
  let rows = (w.exercises || []).map((e) => ({ ...e, key: uid() }));
  if (!rows.length) rows.push({ key: uid(), name: '', sets: '', reps: '', weight: '', delta: null });
  const history = () => store.get().workouts;
  const prevOf = (name) => (name ? lastExercise(history(), name, { exceptId: w.id, beforeDay: w.day }) : null);

  const body = `<form data-form class="wform" style="display:flex;flex-direction:column;gap:16px">
    <div class="form-grid">
      <div class="field"><label class="label" for="w-date">Дата</label><div data-date></div></div>
      <div class="field"><label class="label" for="w-dur">Длительность, мин</label>
        <div style="display:flex;gap:6px;align-items:center"><input id="w-dur" class="input num" inputmode="numeric" value="${esc(w.duration || '')}" placeholder="60" style="width:76px">
        ${[45, 60, 90].map((m) => `<button type="button" class="qchip" data-dur="${m}">${m}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Тренер</span><div class="seg" role="radiogroup" aria-label="Тренер">
        <button type="button" data-coach="1" role="radio">С тренером</button><button type="button" data-coach="0" role="radio">Сама</button></div></div>
    </div>
    <div class="field"><span class="label">Упражнения</span><div class="exlist" data-rows></div>
      <div><button type="button" class="btn ghost small" data-add-row>${icon('plus', 16, 2.2)}Упражнение</button></div></div>
    <div class="field"><label class="label" for="w-note">Заметка</label><textarea id="w-note" class="input" rows="2" placeholder="Как прошло? Что болело, что порадовало">${esc(w.note || '')}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${w0 ? 'Сохранить' : 'Записать тренировку'}</button>
      <button class="btn ghost" type="button" data-close>Отмена</button>
      ${w0 ? '<button class="btn danger" type="button" data-delete style="margin-left:auto">Удалить</button>' : ''}
    </div>
  </form>`;

  open(w0 ? 'Тренировка' : 'Новая тренировка', body, (m) => {
    m.style.maxWidth = '780px';
    const dateF = dateField(m.querySelector('[data-date]'), { value: w.day, id: 'w-date', name: 'day', required: true });
    setCleanup(() => dateF.destroy());
    m.querySelector('[data-date]').addEventListener('pick', () => { w.day = dateF.get() || todayISO(); rows.forEach(updateHint); });
    const dur = m.querySelector('#w-dur');
    m.querySelectorAll('[data-dur]').forEach((b) => b.addEventListener('click', () => { dur.value = b.dataset.dur; }));
    const coachBtns = m.querySelectorAll('[data-coach]');
    const setCoach = (v) => { w.coach = v; coachBtns.forEach((b) => { const on = (b.dataset.coach === '1') === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); };
    setCoach(!!w.coach);
    coachBtns.forEach((b) => b.addEventListener('click', () => setCoach(b.dataset.coach === '1')));

    const list = m.querySelector('[data-rows]');
    const rowEl = (r) => list.querySelector(`[data-row="${r.key}"]`);
    const readRow = (r) => {
      const el = rowEl(r); if (!el) return;
      r.name = el.querySelector('[data-f=name]').value.trim();
      r.sets = el.querySelector('[data-f=sets]').value.trim();
      r.reps = el.querySelector('[data-f=reps]').value.trim();
      r.weight = el.querySelector('[data-f=weight]').value.trim();
    };
    function updateHint(r) {
      const el = rowEl(r); if (!el) return;
      readRow(r);
      const prev = prevOf(r.name);
      const hint = el.querySelector('[data-hint]');
      if (!r.name) { hint.innerHTML = ''; return; }
      if (!prev) { hint.innerHTML = '<span class="muted">Новое упражнение — запомню его</span>'; return; }
      const cur = parseNum(r.weight), pw = parseNum(prev.weight);
      let ch = '';
      if (cur !== null && pw !== null && cur !== pw) ch = cur > pw ? ` <b class="up">↑ +${fmtKg(cur - pw)} кг</b>` : ` <b class="down">↓ −${fmtKg(pw - cur)} кг</b>`;
      hint.innerHTML = `<span class="muted">В прошлый раз (${esc(shortDate(prev.day))}): ${esc(prev.sets || '?')}×${esc(prev.reps || '?')}${prev.weight !== '' && prev.weight !== null && prev.weight !== undefined ? ` · ${esc(fmtKg(prev.weight))} кг` : ''}</span>${ch}`;
    }
    const fill = (r) => {
      readRow(r);
      const prev = prevOf(r.name); if (!prev) { updateHint(r); return; }
      const el = rowEl(r);
      [['sets', prev.sets], ['reps', prev.reps], ['weight', fmtKg(prev.weight)]].forEach(([f, v]) => { const i = el.querySelector(`[data-f=${f}]`); if (!i.value && v !== undefined && v !== null) i.value = v; });
      updateHint(r);
    };
    const draw = () => {
      rows.forEach(readRow);
      list.innerHTML = rows.map((r) => `<div class="exrow" data-row="${r.key}">
        <div class="exname"><input class="input" data-f="name" placeholder="Упражнение, например «Присед»" value="${esc(r.name)}" autocomplete="off" aria-label="Упражнение"></div>
        <label class="exnum"><input class="input num" data-f="sets" inputmode="numeric" value="${esc(r.sets ?? '')}" placeholder="3"><span>подх.</span></label>
        <label class="exnum"><input class="input num" data-f="reps" inputmode="numeric" value="${esc(r.reps ?? '')}" placeholder="10"><span>повт.</span></label>
        <label class="exnum"><input class="input num" data-f="weight" inputmode="decimal" value="${esc(fmtKg(r.weight))}" placeholder="0"><span>кг</span></label>
        <div class="exbtns">
          <button type="button" class="iconbtn" data-down title="Уменьшить вес" aria-label="Уменьшить вес">−</button>
          <button type="button" class="btn small raise" data-up>↑ Поднять вес</button>
          <button type="button" class="iconbtn" data-del title="Убрать упражнение" aria-label="Убрать упражнение">${icon('close', 15, 2)}</button>
        </div>
        <div class="exhint" data-hint></div>
      </div>`).join('');
      rows.forEach((r) => {
        const el = rowEl(r);
        const nameI = el.querySelector('[data-f=name]');
        nameSuggest(nameI, () => exerciseNames(history()), () => fill(r));
        nameI.addEventListener('change', () => fill(r));
        el.querySelector('[data-f=weight]').addEventListener('input', () => updateHint(r));
        const shift = (dir, btn) => {
          readRow(r);
          const prev = prevOf(r.name);
          const base = parseNum(r.weight) ?? (prev ? parseNum(prev.weight) : null) ?? 0;
          const step = weightStep(base);
          const nv = Math.max(0, Math.round((base + dir * step) * 100) / 100);
          el.querySelector('[data-f=weight]').value = fmtKg(nv);
          r.weight = fmtKg(nv); r.delta = dir > 0 ? 'up' : 'down';
          updateHint(r);
          if (dir > 0) {
            const b = btn.getBoundingClientRect();
            splash(b.left + b.width / 2, b.top + b.height / 2, CHEERS[Math.floor(Math.random() * CHEERS.length)](fmtKg(step), fmtKg(nv)));
          }
        };
        el.querySelector('[data-up]').addEventListener('click', (e) => shift(1, e.currentTarget));
        el.querySelector('[data-down]').addEventListener('click', (e) => shift(-1, e.currentTarget));
        el.querySelector('[data-del]').addEventListener('click', () => { rows.forEach(readRow); rows = rows.filter((x) => x !== r); if (!rows.length) rows.push({ key: uid(), name: '', sets: '', reps: '', weight: '', delta: null }); draw(); });
        updateHint(r);
      });
    };
    draw();
    m.querySelector('[data-add-row]').addEventListener('click', () => {
      rows.forEach(readRow);
      rows.push({ key: uid(), name: '', sets: '', reps: '', weight: '', delta: null });
      draw();
      rowEl(rows[rows.length - 1]).querySelector('[data-f=name]').focus();
    });

    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      rows.forEach(readRow);
      const exercises = rows.filter((r) => r.name).map((r) => {
        const prev = prevOf(r.name);
        const wv = parseNum(r.weight), pw = prev ? parseNum(prev.weight) : null;
        const delta = wv !== null && pw !== null && wv !== pw ? (wv > pw ? 'up' : 'down') : null;
        return { name: r.name, sets: parseNum(r.sets), reps: parseNum(r.reps), weight: wv, delta };
      });
      saveWorkout({ id: w.id, day: dateF.get() || todayISO(), duration: parseNum(dur.value), coach: !!w.coach, exercises, note: m.querySelector('#w-note').value.trim() });
      closeModal();
    });
    const del = m.querySelector('[data-delete]');
    if (del) del.addEventListener('click', async () => { if (await ask('Удалить тренировку?', { ok: 'Удалить', danger: true })) { deleteWorkout(w.id); closeModal(); } });
  });
}

// ===== Бильярд =====
export function billiardModal({ id = null } = {}) {
  const s = store.get();
  const b0 = id ? s.billiards.find((x) => x.id === id) : null;
  const b = b0 ? JSON.parse(JSON.stringify(b0)) : { id: uid(), day: todayISO(), drills: [], note: '' };
  const last = [...s.billiards].sort((x, y) => y.day.localeCompare(x.day))[0];
  let rows = b0 ? b.drills.map((d) => ({ ...d, key: uid() }))
    : (last ? last.drills.map((d) => ({ name: d.name, hits: '', attempts: '', key: uid() })) : [{ name: '', hits: '', attempts: '', key: uid() }]);
  const extra = (s.profile.prefs && s.profile.prefs.drills) || [];
  const names = () => drillNames(store.get().billiards, extra);

  const body = `<form data-form style="display:flex;flex-direction:column;gap:16px">
    <div class="form-grid">
      <div class="field"><label class="label" for="b-date">Дата</label><div data-date></div></div>
      <div class="field"><span class="label">Общий процент</span><div class="bigpct" data-total>—</div></div>
    </div>
    <div class="field"><span class="label">Упражнения — попаданий из попыток</span><div class="exlist" data-rows></div>
      <div class="chips" data-quick style="display:flex;gap:6px;flex-wrap:wrap"></div></div>
    <div class="field"><label class="label" for="b-note">Заметка</label><textarea id="b-note" class="input" rows="2" placeholder="Что получалось, над чем работать">${esc(b.note || '')}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${b0 ? 'Сохранить' : 'Записать тренировку'}</button>
      <button class="btn ghost" type="button" data-close>Отмена</button>
      ${b0 ? '<button class="btn danger" type="button" data-delete style="margin-left:auto">Удалить</button>' : ''}
    </div>
  </form>`;

  open(b0 ? 'Бильярд' : 'Тренировка по бильярду', body, (m) => {
    m.style.maxWidth = '720px';
    const dateF = dateField(m.querySelector('[data-date]'), { value: b.day, id: 'b-date', name: 'day', required: true });
    setCleanup(() => dateF.destroy());
    const list = m.querySelector('[data-rows]');
    const quick = m.querySelector('[data-quick]');
    const rowEl = (r) => list.querySelector(`[data-row="${r.key}"]`);
    const readRow = (r) => { const el = rowEl(r); if (!el) return; r.name = el.querySelector('[data-f=name]').value.trim(); r.hits = el.querySelector('[data-f=hits]').value.trim(); r.attempts = el.querySelector('[data-f=attempts]').value.trim(); };
    const recalc = () => {
      rows.forEach(readRow);
      rows.forEach((r) => { const el = rowEl(r); if (el) { const p = drillPct({ hits: parseNum(r.hits), attempts: parseNum(r.attempts) }); el.querySelector('[data-pct]').textContent = pctText(p); el.querySelector('[data-pct]').className = 'pctv ' + (p === null ? '' : p >= 0.75 ? 'good' : p >= 0.5 ? 'mid' : 'low'); } });
      const tot = sessionPct({ drills: rows.map((r) => ({ hits: parseNum(r.hits), attempts: parseNum(r.attempts) })) });
      m.querySelector('[data-total]').textContent = pctText(tot);
      const used = new Set(rows.map((r) => norm(r.name)));
      quick.innerHTML = names().filter((n) => !used.has(norm(n))).map((n) => `<button type="button" class="qchip" data-addq="${esc(n)}">+ ${esc(n)}</button>`).join('') + '<button type="button" class="qchip" data-addq="">+ Своё упражнение</button>';
    };
    const draw = () => {
      rows.forEach(readRow);
      list.innerHTML = rows.map((r) => `<div class="exrow bil" data-row="${r.key}">
        <div class="exname"><input class="input" data-f="name" placeholder="Упражнение" value="${esc(r.name)}" autocomplete="off" aria-label="Упражнение"></div>
        <label class="exnum"><input class="input num" data-f="hits" inputmode="numeric" value="${esc(r.hits ?? '')}" placeholder="0"><span>попал</span></label>
        <label class="exnum"><input class="input num" data-f="attempts" inputmode="numeric" value="${esc(r.attempts ?? '')}" placeholder="0"><span>из</span></label>
        <span class="pctv" data-pct>—</span>
        <button type="button" class="iconbtn" data-del aria-label="Убрать упражнение">${icon('close', 15, 2)}</button>
      </div>`).join('');
      rows.forEach((r) => {
        const el = rowEl(r);
        nameSuggest(el.querySelector('[data-f=name]'), names, recalc);
        el.querySelectorAll('input').forEach((i) => i.addEventListener('input', recalc));
        el.querySelector('[data-del]').addEventListener('click', () => { rows.forEach(readRow); rows = rows.filter((x) => x !== r); draw(); });
      });
      recalc();
    };
    draw();
    quick.addEventListener('click', (e) => {
      const q = e.target.closest('[data-addq]'); if (!q) return;
      rows.forEach(readRow);
      const r = { name: q.dataset.addq, hits: '', attempts: '', key: uid() };
      rows.push(r); draw();
      rowEl(r).querySelector(q.dataset.addq ? '[data-f=hits]' : '[data-f=name]').focus();
    });
    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      rows.forEach(readRow);
      const drills = rows.filter((r) => r.name && parseNum(r.attempts) > 0).map((r) => ({ name: r.name, hits: Math.min(parseNum(r.hits) || 0, parseNum(r.attempts)), attempts: parseNum(r.attempts) }));
      if (!drills.length) { const i = list.querySelector('[data-f=attempts]'); if (i) i.focus(); return; }
      saveBilliard({ id: b.id, day: dateF.get() || todayISO(), drills, note: m.querySelector('#b-note').value.trim() });
      closeModal();
    });
    const del = m.querySelector('[data-delete]');
    if (del) del.addEventListener('click', async () => { if (await ask('Удалить тренировку?', { ok: 'Удалить', danger: true })) { deleteBilliard(b.id); closeModal(); } });
  });
}
