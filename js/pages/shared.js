import { esc, shortDate, todayISO } from '../util.js';
import { icon } from '../ui/icons.js';

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
