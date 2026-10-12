// Окна «Тренировка» (спорт) и «Тренировка по бильярду»
import { esc, todayISO, uid, shortDate } from '../util.js';
import { dateField } from './fields.js';
import { icon } from './icons.js';
import { open, closeModal, setCleanup, ask } from './modals.js';
import { store, saveWorkout, deleteWorkout, saveBilliard, deleteBilliard } from '../store.js';
import { exerciseNames, lastExercise, weightStep, fmtKg, parseNum, normalizeEx, topWeight, formatSets, drillNames, drillPct, sessionPct, pctText } from '../sport.js';
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
// Каждое упражнение — карточка с подходами. У каждого подхода свой вес и повторы,
// в подход можно добавить ступени дроп-сета (снизила вес, не отдыхая).
const emptySet = () => ({ key: uid(), w: '', r: '', d: [] });
const toEdit = (e) => {
  const n = normalizeEx(e);
  return { key: uid(), name: n.name || '', note: n.note || '', showNote: !!n.note, delta: n.delta || null,
    sets: (n.sets || []).map((x) => ({ key: uid(), w: fmtKg(x.w), r: x.r ?? '', d: (x.d || []).map((y) => ({ key: uid(), w: fmtKg(y.w), r: y.r ?? '' })) })) };
};
const parseReps = (v) => { const t = String(v ?? '').trim().replace(/\s+/g, ''); if (!t) return null; const n = Number(t.replace(',', '.')); return isNaN(n) ? t.replace(/[–—]/g, '-') : n; };

export function workoutModal({ id = null } = {}) {
  const s = store.get();
  const w0 = id ? s.workouts.find((x) => x.id === id) : null;
  const w = w0 ? JSON.parse(JSON.stringify(w0)) : { id: uid(), day: todayISO(), duration: 60, coach: false, exercises: [], note: '' };
  let exs = (w.exercises || []).map(toEdit);
  const blankEx = () => ({ key: uid(), name: '', note: '', showNote: false, delta: null, sets: [emptySet()] });
  if (!exs.length) exs.push(blankEx());
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
    <div class="field"><label class="label" for="w-note">Заметка к тренировке</label><textarea id="w-note" class="input" rows="2" placeholder="Как прошло? Что болело, что порадовало">${esc(w.note || '')}</textarea></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${w0 ? 'Сохранить' : 'Записать тренировку'}</button>
      <button class="btn ghost" type="button" data-close>Отмена</button>
      ${w0 ? '<button class="btn danger" type="button" data-delete style="margin-left:auto">Удалить</button>' : ''}
    </div>
  </form>`;

  open(w0 ? 'Тренировка' : 'Новая тренировка', body, (m) => {
    m.style.maxWidth = '720px';
    const dateF = dateField(m.querySelector('[data-date]'), { value: w.day, id: 'w-date', name: 'day', required: true });
    setCleanup(() => dateF.destroy());
    m.querySelector('[data-date]').addEventListener('pick', () => { w.day = dateF.get() || todayISO(); exs.forEach(updateHint); });
    const dur = m.querySelector('#w-dur');
    m.querySelectorAll('[data-dur]').forEach((b) => b.addEventListener('click', () => { dur.value = b.dataset.dur; }));
    const coachBtns = m.querySelectorAll('[data-coach]');
    const setCoach = (v) => { w.coach = v; coachBtns.forEach((b) => { const on = (b.dataset.coach === '1') === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); };
    setCoach(!!w.coach);
    coachBtns.forEach((b) => b.addEventListener('click', () => setCoach(b.dataset.coach === '1')));

    const list = m.querySelector('[data-rows]');
    const cardEl = (ex) => list.querySelector(`[data-ex="${ex.key}"]`);
    const exOf = (el) => exs.find((x) => x.key === el.closest('[data-ex]').dataset.ex);
    const readEx = (ex) => {
      const el = cardEl(ex); if (!el) return;
      ex.name = el.querySelector('[data-f=name]').value.trim();
      const n = el.querySelector('[data-f=note]'); if (n) ex.note = n.value.trim();
      ex.sets.forEach((st) => {
        const r = el.querySelector(`[data-set="${st.key}"]`); if (!r) return;
        st.w = r.querySelector('[data-f=w]').value.trim(); st.r = r.querySelector('[data-f=r]').value.trim();
        st.d.forEach((dd) => { const q = el.querySelector(`[data-drop="${dd.key}"]`); if (q) { dd.w = q.querySelector('[data-f=w]').value.trim(); dd.r = q.querySelector('[data-f=r]').value.trim(); } });
      });
    };
    const readAll = () => exs.forEach(readEx);
    const editTop = (ex) => { let mx = null; ex.sets.forEach((st) => [st, ...st.d].forEach((x) => { const v = parseNum(x.w); if (v !== null && (mx === null || v > mx)) mx = v; })); return mx; };
    const allEmpty = (ex) => ex.sets.every((st) => !st.w && !st.r && !st.d.length);

    function updateHint(ex) {
      const el = cardEl(ex); if (!el) return;
      readEx(ex);
      const hint = el.querySelector('[data-hint]');
      if (!ex.name) { hint.innerHTML = ''; return; }
      const prev = prevOf(ex.name);
      if (!prev) { hint.innerHTML = '<span class="muted">Новое упражнение — запомню его</span>'; return; }
      const cur = editTop(ex), pw = topWeight(prev);
      let ch = '';
      if (cur !== null && pw !== null && cur !== pw) ch = cur > pw ? ` <b class="up">↑ +${fmtKg(cur - pw)} кг</b>` : ` <b class="down">↓ −${fmtKg(pw - cur)} кг</b>`;
      hint.innerHTML = `<span class="muted">В прошлый раз (${esc(shortDate(prev.day))}): ${esc(formatSets(prev) || 'без подходов')}</span>${ch}`;
    }
    const setRow = (st, i) => `<div class="setrow" data-set="${st.key}">
        <span class="setno">${i + 1}</span>
        <input class="input num" data-f="w" inputmode="decimal" value="${esc(st.w)}" placeholder="—" aria-label="Вес, подход ${i + 1}">
        <span class="setx">×</span>
        <input class="input num" data-f="r" inputmode="numeric" value="${esc(st.r)}" placeholder="—" aria-label="Повторы, подход ${i + 1}">
        <button type="button" class="iconbtn" data-act="add-drop" title="Дроп-сет: снизить вес в этом же подходе" aria-label="Добавить ступень дроп-сета">↘</button>
        <button type="button" class="iconbtn" data-act="del-set" aria-label="Убрать подход">${icon('close', 14, 2)}</button>
      </div>${st.d.map((dd) => `<div class="setrow dropstep" data-drop="${dd.key}" data-parent="${st.key}">
        <span class="setno" title="Ступень дроп-сета">↳</span>
        <input class="input num" data-f="w" inputmode="decimal" value="${esc(dd.w)}" placeholder="—" aria-label="Вес, ступень">
        <span class="setx">×</span>
        <input class="input num" data-f="r" inputmode="numeric" value="${esc(dd.r)}" placeholder="—" aria-label="Повторы, ступень">
        <span></span>
        <button type="button" class="iconbtn" data-act="del-drop" aria-label="Убрать ступень">${icon('close', 14, 2)}</button>
      </div>`).join('')}`;
    const cardInner = (ex) => `
      <div class="exhead">
        <div class="exname"><input class="input" data-f="name" placeholder="Упражнение, например «Ягодичный мостик»" value="${esc(ex.name)}" autocomplete="off" aria-label="Упражнение"></div>
        <div class="exbtns">
          <button type="button" class="iconbtn" data-act="down" title="Снизить вес" aria-label="Снизить вес">−</button>
          <button type="button" class="btn small raise" data-act="up">↑ Поднять вес</button>
          <button type="button" class="iconbtn" data-act="del-ex" title="Убрать упражнение" aria-label="Убрать упражнение">${icon('close', 15, 2)}</button>
        </div>
      </div>
      <div class="exhint" data-hint></div>
      <div class="sets">
        <div class="sethead"><span></span><span>кг</span><span></span><span>повторы</span></div>
        ${ex.sets.map(setRow).join('')}
      </div>
      ${ex.showNote ? `<input class="input" data-f="note" value="${esc(ex.note)}" placeholder="Заметка к упражнению: тренажёр, ощущения, техника" autocomplete="off">` : ''}
      <div class="exfoot"><button type="button" class="link" data-act="add-set">+ Подход</button>${ex.showNote ? '' : '<button type="button" class="link" data-act="note">+ Заметка</button>'}</div>`;
    const bindCard = (ex) => {
      const el = cardEl(ex);
      const nameI = el.querySelector('[data-f=name]');
      nameSuggest(nameI, () => exerciseNames(history()), () => fill(ex));
      nameI.addEventListener('change', () => fill(ex));
      updateHint(ex);
    };
    const drawCard = (ex) => { readEx(ex); cardEl(ex).innerHTML = cardInner(ex); bindCard(ex); };
    const draw = () => {
      readAll();
      list.innerHTML = exs.map((ex) => `<div class="excard" data-ex="${ex.key}">${cardInner(ex)}</div>`).join('');
      exs.forEach(bindCard);
    };
    // Выбрала упражнение — подставляем подходы с прошлого раза
    const fill = (ex) => {
      readEx(ex);
      const prev = prevOf(ex.name);
      if (prev && allEmpty(ex) && (prev.sets || []).length) {
        ex.sets = toEdit(prev).sets;
        drawCard(ex);
      } else updateHint(ex);
    };
    const shift = (ex, dir, btn) => {
      readEx(ex);
      const prev = prevOf(ex.name);
      if (editTop(ex) === null && prev && topWeight(prev) !== null) ex.sets = toEdit(prev).sets;
      const top = editTop(ex);
      if (top === null) { const i = cardEl(ex).querySelector('[data-f=w]'); if (i) i.focus(); return; }
      const step = weightStep(top);
      ex.sets.forEach((st) => [st, ...st.d].forEach((x) => { const v = parseNum(x.w); if (v !== null) x.w = fmtKg(Math.max(0, Math.round((v + dir * step) * 100) / 100)); }));
      ex.delta = dir > 0 ? 'up' : 'down';
      cardEl(ex).innerHTML = cardInner(ex); bindCard(ex);
      if (dir > 0) {
        const b = cardEl(ex).querySelector('[data-act=up]').getBoundingClientRect();
        splash(b.left + b.width / 2, b.top + b.height / 2, CHEERS[Math.floor(Math.random() * CHEERS.length)](fmtKg(step), fmtKg(editTop(ex))));
      }
    };
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const ex = exOf(b); const act = b.dataset.act;
      readEx(ex);
      if (act === 'up' || act === 'down') { shift(ex, act === 'up' ? 1 : -1, b); return; }
      if (act === 'del-ex') { readAll(); exs = exs.filter((x) => x !== ex); if (!exs.length) exs.push(blankEx()); draw(); return; }
      if (act === 'add-set') {
        const last = ex.sets[ex.sets.length - 1];
        ex.sets.push(last ? { key: uid(), w: last.w, r: last.r, d: [] } : emptySet());
        drawCard(ex);
        const rows = cardEl(ex).querySelectorAll('.setrow:not(.dropstep) [data-f=w]'); rows[rows.length - 1].focus();
        return;
      }
      if (act === 'note') { ex.showNote = true; drawCard(ex); cardEl(ex).querySelector('[data-f=note]').focus(); return; }
      const rowKey = b.closest('[data-set]') ? b.closest('[data-set]').dataset.set : b.closest('[data-drop]').dataset.parent;
      const st = ex.sets.find((x) => x.key === rowKey);
      if (act === 'del-set') { ex.sets = ex.sets.filter((x) => x !== st); if (!ex.sets.length) ex.sets.push(emptySet()); drawCard(ex); }
      if (act === 'add-drop') {
        const base = st.d.length ? st.d[st.d.length - 1] : st;
        const v = parseNum(base.w);
        const dd = { key: uid(), w: v !== null ? fmtKg(Math.max(0, v - weightStep(v) * 2)) : '', r: '' };
        st.d.push(dd); drawCard(ex);
        cardEl(ex).querySelector(`[data-drop="${dd.key}"] [data-f=r]`).focus();
      }
      if (act === 'del-drop') { const dk = b.closest('[data-drop]').dataset.drop; st.d = st.d.filter((x) => x.key !== dk); drawCard(ex); }
    });
    list.addEventListener('input', (e) => { if (e.target.dataset.f === 'w') updateHint(exOf(e.target)); });
    draw();
    m.querySelector('[data-add-row]').addEventListener('click', () => {
      readAll();
      const ex = blankEx(); exs.push(ex);
      list.insertAdjacentHTML('beforeend', `<div class="excard" data-ex="${ex.key}">${cardInner(ex)}</div>`);
      bindCard(ex);
      cardEl(ex).querySelector('[data-f=name]').focus();
    });

    m.querySelector('[data-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      readAll();
      const exercises = exs.filter((ex) => ex.name).map((ex) => {
        const sets = ex.sets.map((st) => ({ w: parseNum(st.w), r: parseReps(st.r), d: st.d.map((dd) => ({ w: parseNum(dd.w), r: parseReps(dd.r) })).filter((dd) => dd.w !== null || dd.r !== null) }))
          .filter((st) => st.w !== null || st.r !== null || st.d.length);
        const prev = prevOf(ex.name);
        const top = topWeight({ sets }), pw = prev ? topWeight(prev) : null;
        const delta = top !== null && pw !== null && top !== pw ? (top > pw ? 'up' : 'down') : null;
        return { name: ex.name, sets, note: ex.note || '', delta };
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
