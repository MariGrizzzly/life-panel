// Расчёты для спорта и бильярда: серии, история упражнений, проценты.
import { todayISO, addDays, parseISO, iso } from './util.js';

// ===== Спорт =====
export const weekStart = (day) => { const d = parseISO(day); const wd = (d.getDay() + 6) % 7; return addDays(day, -wd); };
export const WEEK_GOAL = 2;

export function weekCounts(workouts) {
  const m = {};
  workouts.forEach((w) => { const k = weekStart(w.day); m[k] = (m[k] || 0) + 1; });
  return m;
}

// Серия — сколько недель подряд было не меньше двух тренировок.
// Текущая неделя серию не рвёт, пока не закончилась.
export function sportStreak(workouts, today = todayISO()) {
  const m = weekCounts(workouts);
  const cur = weekStart(today);
  const thisWeek = m[cur] || 0;
  let n = thisWeek >= WEEK_GOAL ? 1 : 0;
  let wk = addDays(cur, -7);
  while ((m[wk] || 0) >= WEEK_GOAL) { n++; wk = addDays(wk, -7); }
  // лучшая серия за всё время
  const weeks = Object.keys(m).sort();
  let best = 0, run = 0, prev = null;
  weeks.forEach((w) => {
    if (m[w] >= WEEK_GOAL) { run = prev && addDays(prev, 7) === w ? run + 1 : 1; prev = w; best = Math.max(best, run); }
    else { run = 0; prev = null; }
  });
  return { streak: n, thisWeek, best: Math.max(best, n) };
}

const norm = (n) => String(n || '').trim().toLowerCase();

// Все упражнения, которые уже встречались: самые частые и свежие — первыми
export function exerciseNames(workouts) {
  const m = new Map();
  [...workouts].sort((a, b) => a.day.localeCompare(b.day)).forEach((w) => (w.exercises || []).forEach((e) => {
    if (!e.name) return;
    const k = norm(e.name);
    const x = m.get(k) || { name: e.name, n: 0, last: '' };
    x.n++; x.last = w.day; x.name = e.name; m.set(k, x);
  }));
  return [...m.values()].sort((a, b) => b.last.localeCompare(a.last) || b.n - a.n).map((x) => x.name);
}

// Последний раз, когда делала упражнение (до указанной тренировки)
export function lastExercise(workouts, name, { exceptId = null, beforeDay = null } = {}) {
  const k = norm(name);
  const list = workouts.filter((w) => w.id !== exceptId && (!beforeDay || w.day <= beforeDay)).sort((a, b) => b.day.localeCompare(a.day));
  for (const w of list) {
    const e = (w.exercises || []).find((x) => norm(x.name) === k);
    if (e) return { ...e, day: w.day };
  }
  return null;
}

// История веса по каждому упражнению — для графиков
export function exerciseProgress(workouts) {
  const m = new Map();
  [...workouts].sort((a, b) => a.day.localeCompare(b.day)).forEach((w) => (w.exercises || []).forEach((e) => {
    if (!e.name) return;
    const k = norm(e.name);
    const x = m.get(k) || { name: e.name, points: [] };
    x.name = e.name;
    x.points.push({ day: w.day, weight: Number(e.weight) || 0, sets: e.sets, reps: e.reps, delta: e.delta || null });
    m.set(k, x);
  }));
  return [...m.values()].sort((a, b) => b.points[b.points.length - 1].day.localeCompare(a.points[a.points.length - 1].day));
}

export const weightStep = (w) => (Number(w) >= 20 ? 2.5 : 1);
export const fmtKg = (w) => {
  const v = parseNum(w);
  if (v === null) return '';
  const n = Math.round(v * 100) / 100;
  return String(n).replace('.', ',');
};
export const parseNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

// ===== Бильярд =====
export const DEFAULT_DRILLS = [
  'Прямой в центр',
  'Прямой в угол',
  'Свояк в центр (слева)',
  'Свояк в центр (справа)',
  'Чужой в центр',
  'Свояк в центр из угла',
  'Свой в угол около борта'
];

export function drillNames(sessions, extra = []) {
  const seen = new Map();
  [...DEFAULT_DRILLS, ...extra].forEach((n) => seen.set(norm(n), n));
  sessions.forEach((b) => (b.drills || []).forEach((d) => { if (d.name && !seen.has(norm(d.name))) seen.set(norm(d.name), d.name); }));
  return [...seen.values()];
}

export function sessionPct(b) {
  let h = 0, a = 0;
  (b.drills || []).forEach((d) => { const x = Number(d.attempts) || 0; if (x > 0) { a += x; h += Number(d.hits) || 0; } });
  return a ? h / a : null;
}
export const drillPct = (d) => (Number(d.attempts) > 0 ? (Number(d.hits) || 0) / Number(d.attempts) : null);
export const pctText = (p) => (p === null || p === undefined ? '—' : `${Math.round(p * 100)}%`);

export function drillStats(sessions) {
  const m = new Map();
  [...sessions].sort((a, b) => a.day.localeCompare(b.day)).forEach((b) => (b.drills || []).forEach((d) => {
    const p = drillPct(d); if (p === null) return;
    const k = norm(d.name);
    const x = m.get(k) || { name: d.name, points: [], hits: 0, attempts: 0 };
    x.points.push({ day: b.day, pct: p }); x.hits += Number(d.hits) || 0; x.attempts += Number(d.attempts) || 0;
    m.set(k, x);
  }));
  return [...m.values()].map((x) => ({ ...x, total: x.attempts ? x.hits / x.attempts : null, last: x.points[x.points.length - 1].pct, best: Math.max(...x.points.map((p) => p.pct)) }));
}

// ===== Мини-графики (SVG) =====
export function sparkline(values, { w = 120, h = 34, color = '#2E8FD6', fill = true, min = null, max = null, dots = false } = {}) {
  const v = values.filter((x) => x !== null && x !== undefined);
  if (v.length < 2) return '';
  const lo = min ?? Math.min(...v), hi = max ?? Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 4) + 2, h - 3 - ((x - lo) / span) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const gid = 'sg' + Math.random().toString(36).slice(2, 8);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="display:block;overflow:visible">
    ${fill ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${gid})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots ? pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.6"/>`).join('') : `<circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="3" fill="${color}"/>`}
  </svg>`;
}

// Большой график: линия в SVG тянется по ширине, подписи и точки — обычный HTML, чтобы не искажались
export function lineChart(points, { h = 220, color = '#2E8FD6', fmt = (v) => v, min = null, max = null, label = (p) => p.day } = {}) {
  if (points.length < 2) return '';
  const vals = points.map((p) => p.v);
  const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals);
  const span = hi - lo || 1;
  const X = (i) => (i / (points.length - 1)) * 100;
  const Y = (v) => (1 - (v - lo) / span) * 100;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(2)} ${Y(p.v).toFixed(2)}`).join(' ');
  const gid = 'lg' + Math.random().toString(36).slice(2, 8);
  const every = Math.max(1, Math.ceil(points.length / 6));
  const grid = [1, 0.5, 0].map((k) => `<div class="lc-grid" style="top:${(1 - k) * 100}%"><span>${fmt(lo + span * k)}</span></div>`).join('');
  const dots = points.map((p, i) => `<span class="lc-dot" style="left:${X(i)}%;top:${Y(p.v)}%;--c:${color}" title="${label(p)}: ${fmt(p.v)}"></span>`).join('');
  const xl = points.map((p, i) => (i % every === 0 || i === points.length - 1) && !(i !== points.length - 1 && points.length - 1 - i < every)
    ? `<span class="lc-x${i === 0 ? ' first' : i === points.length - 1 ? ' last' : ''}" style="left:${X(i)}%">${label(p)}</span>` : '').join('');
  return `<div class="lc" style="height:${h}px" role="img" aria-label="График: ${points.map((p) => `${label(p)} ${fmt(p.v)}`).join(', ')}">
    <div class="lc-plot">${grid}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        <path d="${d} L100 100 L0 100 Z" fill="url(#${gid})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>
      ${dots}
    </div>
    <div class="lc-xs">${xl}</div>
  </div>`;
}
export { iso };
