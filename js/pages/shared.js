import { esc, shortDate, todayISO } from '../util.js';
import { icon, WAVE_PATH, WAVE_PATH_SOFT } from '../ui/icons.js';

export function checkbox(t) {
  const done = t.status === 'done';
  return `<button class="ck${done ? ' done' : ''}" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="${done ? 'Вернуть' : 'Отметить'}: ${esc(t.title)}" aria-pressed="${done}"><span class="box"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></span></button>`;
}

export function dueChip(t) {
  if (!t.deadline || t.status === 'done') return '';
  const late = t.deadline < todayISO();
  return `<span class="chip" style="background:${late ? '#F6E2E0' : '#FCEADF'};color:${late ? '#9A2F22' : '#9A4214'}">до ${esc(shortDate(t.deadline))}</span>`;
}

export function tagChips(t) {
  return (t.tags || []).map((tg) => `<span class="chip">#${esc(tg)}</span>`).join('');
}

export function taskRow(t, { meta = '', wide = false } = {}) {
  const done = t.status === 'done';
  return `<div class="${wide ? 'lrow' : 'trow'}" data-key="t-${esc(t.id)}">
    ${checkbox(t)}
    <button class="task-title${done ? ' done-text' : ''}" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}${t.status === 'doing' && !done ? ' <span class="chip" style="background:#E4EEF7;color:#0D4471">в работе</span>' : ''}</button>
    ${meta ? `<span class="meta muted" style="font-size:12px;font-weight:600">${esc(meta)}</span>` : ''}
    ${wide ? dueChip(t) + tagChips(t) : ''}
  </div>`;
}

export function soonPage(sectionLabel, plan) {
  return `<div class="fade" data-key="page-soon-${esc(sectionLabel)}" style="display:flex;flex-direction:column;gap:20px">
    <section class="hero" style="padding:32px">
      <div class="hero-row"><div class="hero-text">
        <div class="disp" style="font-size:22px">${esc(sectionLabel)} — скоро</div>
        <div style="font-size:16px;line-height:1.6;color:#D6EBFA;max-width:640px">${esc(plan)}</div>
        <div><a class="btn white" href="#today">${icon('today', 18)}На «Сегодня»</a></div>
      </div></div>
    </section>
  </div>`;
}

// Лучи и пузырьки для синих шапок разделов
export function heroDeco() {
  return `<div aria-hidden="true" data-skip-morph>
      <div class="ray" style="left:10%;width:70px;transform:rotate(18deg)"></div>
      <div class="ray" style="left:40%;width:46px;transform:rotate(12deg);animation-delay:2.2s"></div>
      <div class="ray" style="left:66%;width:80px;transform:rotate(20deg);animation-delay:4s"></div>
      <div class="caustic" style="width:240px;height:110px;left:20%;top:-40px"></div>
      <span class="bub" style="width:9px;height:9px;left:14%;bottom:8px"></span>
      <span class="bub" style="width:6px;height:6px;left:33%;bottom:4px;animation-delay:1.6s;animation-duration:6s"></span>
      <span class="bub" style="width:11px;height:11px;left:61%;bottom:6px;animation-delay:3s;animation-duration:6.5s"></span>
    </div>`;
}

// Стеклянный шар с водой: уровень = pct (0..100)
export function waterOrb(pct, label) {
  return `<div class="orb" role="img" aria-label="${esc(label)}">
    <div class="water" style="height:${Math.max(0, Math.min(100, pct))}%">
      <svg class="wave2" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-12px;width:200%;height:13px" aria-hidden="true"><path d="${WAVE_PATH_SOFT}" fill="#A6DBFA" fill-opacity="0.75"></path></svg>
      <svg class="wave" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-9px;width:200%;height:10px" aria-hidden="true"><path d="${WAVE_PATH}" fill="#6BC0F5"></path></svg>
    </div>
    <div class="orb-glint"></div>
  </div>`;
}
