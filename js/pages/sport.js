// Спорт: серия недель, прогресс по упражнениям, история тренировок
import { esc, todayISO, plural, shortDate, parseISO } from '../util.js';
import { icon } from '../ui/icons.js';
import { sync } from '../store.js';
import { sportStreak, WEEK_GOAL, exerciseProgress, fmtKg, sparkline } from '../sport.js';
import { heroDeco, waterOrb } from './shared.js';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const DROP = 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z';
const weeks = (n) => `${n} ${plural(n, ['неделя', 'недели', 'недель'])}`;

export function title(s) {
  const n = s.workouts.length;
  return ['Спорт', n ? `${n} ${plural(n, ['тренировка', 'тренировки', 'тренировок'])} в копилке` : 'Записывай тренировки — прогресс посчитаю сама'];
}

export const durText = (m) => { if (!m) return ''; const h = Math.floor(m / 60), r = m % 60; return h ? `${h} ч${r ? ` ${r} мин` : ''}` : `${r} мин`; };

export function exSummary(e) {
  const sr = e.sets && e.reps ? `${e.sets}×${e.reps}` : e.sets ? `${e.sets} подх.` : '';
  const wt = e.weight ? `${fmtKg(e.weight)} кг` : '';
  const arrow = e.delta === 'up' ? '<b class="up">↑</b>' : e.delta === 'down' ? '<b class="down">↓</b>' : '';
  return `<span class="exs">${esc(e.name)}${sr || wt ? ` <span class="muted">${esc([sr, wt].filter(Boolean).join(' · '))}</span>` : ''}${arrow}</span>`;
}

export function render(s, ui) {
  const today = todayISO();
  const list = [...s.workouts].sort((a, b) => b.day.localeCompare(a.day));
  const { streak, thisWeek, best } = sportStreak(s.workouts, today);
  const left = Math.max(0, WEEK_GOAL - thisWeek);
  const lastWeekOk = streak > (thisWeek >= WEEK_GOAL ? 1 : 0);
  const sub = thisWeek >= WEEK_GOAL ? 'План недели выполнен — серия в безопасности 🌊'
    : lastWeekOk ? `На этой неделе ${thisWeek} из ${WEEK_GOAL}. Ещё ${left} — и серия продолжится`
    : `На этой неделе ${thisWeek} из ${WEEK_GOAL}. Две тренировки за неделю — и начнётся серия`;
  const drops = Array.from({ length: Math.max(WEEK_GOAL, thisWeek) }, (_, i) => `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}" fill="${i < thisWeek ? '#6BC0F5' : 'none'}" stroke="#A6DBFA" stroke-width="1.6"/></svg>`).join('');

  const month = today.slice(0, 7);
  const inMonth = s.workouts.filter((w) => w.day.startsWith(month));
  const mins = inMonth.reduce((a, w) => a + (Number(w.duration) || 0), 0);
  const coachN = inMonth.filter((w) => w.coach).length;
  const last = list[0];

  const progress = exerciseProgress(s.workouts);
  const progCards = progress.slice(0, 12).map((x) => {
    const p = x.points; const cur = p[p.length - 1]; const first = p.find((q) => q.weight) || p[0];
    const diff = (cur.weight || 0) - (first.weight || 0);
    return `<div class="pcard sp" data-key="pr-${esc(x.name)}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><b style="font-size:14px">${esc(x.name)}</b><span class="muted" style="font-size:12px;white-space:nowrap">${esc(shortDate(cur.day))}</span></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-top:4px">
        <div><div class="disp" style="font-size:24px;color:var(--deep)">${cur.weight ? `${esc(fmtKg(cur.weight))} <small style="font-size:13px">кг</small>` : '—'}</div>
        <div style="font-size:12px;margin-top:2px">${diff > 0 ? `<b class="up">+${esc(fmtKg(diff))} кг</b> <span class="muted">с ${esc(shortDate(first.day))}</span>` : diff < 0 ? `<b class="down">−${esc(fmtKg(-diff))} кг</b>` : `<span class="muted">${p.length} ${plural(p.length, ['раз', 'раза', 'раз'])}</span>`}</div></div>
        ${sparkline(p.map((q) => q.weight), { w: 110, h: 38 })}
      </div></div>`;
  }).join('');

  const byMonth = {};
  list.forEach((w) => { (byMonth[w.day.slice(0, 7)] ||= []).push(w); });
  const hist = Object.entries(byMonth).map(([ym, ws]) => {
    const d = parseISO(ym + '-01');
    return `<div class="hist-month"><div class="cap" style="margin:6px 0">${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${ws.length}</div>
      ${ws.map((w) => `<button class="hrow" data-action="workout-edit" data-id="${esc(w.id)}" data-key="w-${esc(w.id)}">
        <span class="hdate"><b>${parseISO(w.day).getDate()}</b><small>${WD[parseISO(w.day).getDay()]}</small></span>
        <span class="hbody"><span class="hmeta">${w.duration ? `<span class="chip">${esc(durText(w.duration))}</span>` : ''}${w.coach ? '<span class="chip" style="background:#DDF0EE;color:#1C5F59">с тренером</span>' : ''}${w.unsynced && sync.needsSql ? '<span class="chip" style="background:#FCEADF;color:#9A4214">ждёт базы</span>' : ''}</span>
        <span class="hex">${(w.exercises || []).map(exSummary).join('') || '<span class="muted">без упражнений</span>'}</span>${w.note ? `<span class="muted hnote">${esc(w.note)}</span>` : ''}</span>
      </button>`).join('')}</div>`;
  }).join('');

  return `<div class="fade" data-key="page-sport" style="display:flex;flex-direction:column;gap:20px">
    ${sync.needsSql ? sqlBanner() : ''}
    <section class="hero" aria-label="Серия">
      ${heroDeco()}
      <div class="hero-row">
        <div class="hero-text">
          <div><div class="cap" style="color:#A6DBFA">Серия</div><div class="disp" style="font-size:34px;margin-top:4px">${streak ? weeks(streak) + ' подряд' : 'Серия впереди'}</div>
          <div style="font-size:15px;margin-top:8px;color:#D6EBFA;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="display:inline-flex;gap:2px">${drops}</span>${esc(sub)}</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn white" data-action="workout-add">${icon('plus', 18, 2.2)}Тренировка</button></div>
        </div>
        ${waterOrb(Math.min(100, (thisWeek / WEEK_GOAL) * 100), `Тренировок на этой неделе: ${thisWeek} из ${WEEK_GOAL}`)}
        <div><div class="disp" style="font-size:34px">${thisWeek}/${WEEK_GOAL}</div><div style="font-size:13px;margin-top:4px;color:#CFE6F8">на этой неделе${best > 1 ? `<br>рекорд серии — ${weeks(best)}` : ''}</div></div>
      </div>
    </section>
    <div class="stat-row">
      <div class="card stat"><span class="cap">В этом месяце</span><b class="disp">${inMonth.length}</b><span class="muted">${plural(inMonth.length, ['тренировка', 'тренировки', 'тренировок'])}</span></div>
      <div class="card stat"><span class="cap">Время</span><b class="disp">${mins ? esc(durText(mins)) : '—'}</b><span class="muted">за месяц</span></div>
      <div class="card stat"><span class="cap">С тренером</span><b class="disp">${coachN}</b><span class="muted">из ${inMonth.length}</span></div>
      <div class="card stat"><span class="cap">Последняя</span><b class="disp" style="font-size:20px">${last ? esc(shortDate(last.day)) : '—'}</b><span class="muted">${last ? esc(durText(last.duration) || ((last.exercises || []).length + ' упр.')) : 'пока нет'}</span></div>
    </div>
    ${progress.length ? `<section class="card" style="display:flex;flex-direction:column;gap:12px"><h2 class="h2">Веса по упражнениям</h2><div class="grid-cards">${progCards}</div></section>` : ''}
    <section class="card" style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">Тренировки</h2><button class="link" data-action="workout-add">+ Тренировка</button></div>
      ${hist || '<div class="muted" style="padding:18px 0">Пока пусто. Нажми «Тренировка» — дата, упражнения, подходы и вес. Упражнения запомню и в следующий раз подставлю сама.</div>'}
    </section>
  </div>`;
}

export function sqlBanner() {
  return `<div class="card" style="border-color:#F0C9A8;background:#FFF6EE;display:flex;gap:10px;align-items:flex-start" data-key="sqlbanner">
    <span style="font-size:20px">🛠️</span><div style="font-size:14px;line-height:1.5"><b>Нужен один шаг в Supabase.</b> Новые разделы пока сохраняются только на этом устройстве. Запусти SQL «шаг 3» из инструкции — и всё уедет в облако само.</div></div>`;
}
