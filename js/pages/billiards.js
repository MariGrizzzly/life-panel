// Бильярд: процент попаданий по тренировкам и по упражнениям
import { esc, todayISO, plural, shortDate, parseISO } from '../util.js';
import { icon } from '../ui/icons.js';
import { sync } from '../store.js';
import { sessionPct, drillPct, pctText, drillStats, sparkline, lineChart } from '../sport.js';
import { heroDeco, waterOrb } from './shared.js';
import { sqlBanner, WD } from './sport.js';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const tone = (p) => (p === null ? '' : p >= 0.75 ? 'good' : p >= 0.5 ? 'mid' : 'low');

export function title(s) {
  const n = s.billiards.length;
  return ['Бильярд', n ? `${n} ${plural(n, ['тренировка', 'тренировки', 'тренировок'])} — смотрим, как растёт точность` : 'Попадания, попытки и процент успеха по упражнениям'];
}

export function render(s, ui) {
  const list = [...s.billiards].sort((a, b) => b.day.localeCompare(a.day));
  const last = list[0];
  const lastPct = last ? sessionPct(last) : null;
  const recent = list.slice(0, 5).map(sessionPct).filter((p) => p !== null);
  const avg5 = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const all = list.map(sessionPct).filter((p) => p !== null);
  const best = all.length ? Math.max(...all) : null;
  const bestS = best !== null ? list.find((b) => sessionPct(b) === best) : null;
  const prev = list[1] ? sessionPct(list[1]) : null;
  const diff = lastPct !== null && prev !== null ? Math.round((lastPct - prev) * 100) : null;

  const chron = [...list].reverse().filter((b) => sessionPct(b) !== null);
  const chart = lineChart(chron.map((b) => ({ day: b.day, v: sessionPct(b) })), { min: 0, max: 1, fmt: (v) => `${Math.round(v * 100)}%`, label: (p) => shortDate(p.day) });

  const stats = drillStats(s.billiards).sort((a, b) => b.points.length - a.points.length);
  const drillCards = stats.map((x) => `<div class="pcard sp" data-key="dr-${esc(x.name)}">
      <b style="font-size:14px">${esc(x.name)}</b>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-top:4px">
        <div><div class="disp pctbig ${tone(x.total)}">${pctText(x.total)}</div>
        <div class="muted" style="font-size:12px;margin-top:2px">всего ${x.hits} из ${x.attempts} · лучший ${pctText(x.best)}</div></div>
        ${sparkline(x.points.map((p) => p.pct), { w: 100, h: 38, min: 0, max: 1 })}
      </div></div>`).join('');

  const byMonth = {};
  list.forEach((b) => { (byMonth[b.day.slice(0, 7)] ||= []).push(b); });
  const hist = Object.entries(byMonth).map(([ym, bs]) => {
    const d = parseISO(ym + '-01');
    return `<div><div class="cap" style="margin:6px 0">${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${bs.length}</div>
      ${bs.map((b) => { const p = sessionPct(b); return `<button class="hrow" data-action="billiard-edit" data-id="${esc(b.id)}" data-key="b-${esc(b.id)}">
        <span class="hdate"><b>${parseISO(b.day).getDate()}</b><small>${WD[parseISO(b.day).getDay()]}</small></span>
        <span class="hbody"><span class="hex">${(b.drills || []).map((x) => { const q = drillPct(x); return `<span class="exs">${esc(x.name)} <span class="muted">${x.hits}/${x.attempts}</span> <b class="${tone(q)}">${pctText(q)}</b></span>`; }).join('')}</span>${b.note ? `<span class="muted hnote">${esc(b.note)}</span>` : ''}</span>
        <span class="pctbig ${tone(p)}" style="align-self:center">${pctText(p)}</span>
      </button>`; }).join('')}</div>`;
  }).join('');

  return `<div class="fade" data-key="page-billiards" style="display:flex;flex-direction:column;gap:20px">
    ${sync.needsSql ? sqlBanner() : ''}
    <section class="hero" aria-label="Точность">
      ${heroDeco()}
      <div class="hero-row">
        <div class="hero-text">
          <div><div class="cap" style="color:#A6DBFA">Последняя тренировка${last ? ` · ${esc(shortDate(last.day))}` : ''}</div>
          <div class="disp" style="font-size:34px;margin-top:4px">${last ? `${pctText(lastPct)} попаданий` : 'Начнём считать шары'}</div>
          <div style="font-size:15px;margin-top:8px;color:#D6EBFA">${last ? [diff !== null ? (diff > 0 ? `+${diff}% к прошлой` : diff < 0 ? `${diff}% к прошлой` : 'как в прошлый раз') : '', avg5 !== null && recent.length > 1 ? `в среднем за ${recent.length} последних — ${pctText(avg5)}` : ''].filter(Boolean).join(' · ') : 'Записывай попадания и попытки по упражнениям — процент и графики посчитаются сами'}</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn white" data-action="billiard-add">${icon('plus', 18, 2.2)}Тренировка</button></div>
        </div>
        ${waterOrb(lastPct === null ? 0 : lastPct * 100, `Последняя тренировка: ${pctText(lastPct)}`)}
        <div><div class="disp" style="font-size:34px">${pctText(best)}</div><div style="font-size:13px;margin-top:4px;color:#CFE6F8">лучший результат${bestS ? `<br>${esc(shortDate(bestS.day))}` : ''}</div></div>
      </div>
    </section>
    ${chart ? `<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2 class="h2">Общий процент по тренировкам</h2>${chart}</section>` : ''}
    ${stats.length ? `<section class="card" style="display:flex;flex-direction:column;gap:12px"><h2 class="h2">Упражнения</h2><div class="grid-cards">${drillCards}</div></section>` : ''}
    <section class="card" style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">Тренировки</h2><button class="link" data-action="billiard-add">+ Тренировка</button></div>
      ${hist || '<div class="muted" style="padding:18px 0">Пока пусто. Нажми «Тренировка» и запиши, сколько забила из скольких.</div>'}
    </section>
  </div>`;
}
