// Дневник: запись дня, настроение, сон, энергия, вопросы, фото, архив.
import { esc, todayISO, addDays, longDate, parseISO, plural } from '../util.js';
import { icon } from '../ui/icons.js';
import { sync, diaryStreak, diaryHasEntry, projectOf } from '../store.js';
import { questionsOf } from '../texts.js';
import { photoURL } from '../photos.js';

export const MOODS = [
  { e: '😢', label: 'Плохо' }, { e: '😕', label: 'Так себе' }, { e: '😐', label: 'Нормально' },
  { e: '🙂', label: 'Хорошо' }, { e: '😄', label: 'Отлично' }
];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DROP = 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z';

export function title(s, ui) {
  const tab = ui.diaryTab || 'write';
  if (tab === 'archive') return ['Дневник', 'Все записи — найти, перечитать, перенести в Apple Дневник'];
  if (tab === 'photos') return ['Дневник', 'Фото дня — одна картинка, и через год получится целая лента'];
  return ['Дневник', 'Пиши как есть — всё сохраняется само'];
}

export const sleepText = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v); const h = Math.floor(n); const m = Math.round((n - h) * 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
};

export function render(s, ui) {
  const tab = ui.diaryTab || 'write';
  const tabs = [['write', 'Запись'], ['archive', 'Архив'], ['photos', 'Фото дня']].map(([id, label]) =>
    `<button class="${tab === id ? 'on' : ''}" data-action="diary-tab" data-id="${id}" role="tab" aria-selected="${tab === id}">${label}</button>`).join('');
  const banner = sync.needsSql ? `<div class="demo-note"><span style="flex:1 1 260px">Дневнику нужна таблица в базе. Выполни один раз SQL из чата в Supabase → SQL Editor — и записи начнут сохраняться в облако.</span></div>` : '';
  const body = tab === 'archive' ? archive(s, ui) : tab === 'photos' ? photos(s, ui) : write(s, ui);
  return `<div class="fade" data-key="page-diary" style="display:flex;flex-direction:column;gap:18px">
    ${banner}
    <div class="seg" role="tablist" aria-label="Разделы дневника" style="align-self:flex-start">${tabs}</div>
    ${body}
  </div>`;
}

// ===== Запись =====
function dayContext(s, day) {
  const out = [];
  s.tasks.filter((t) => t.status === 'done' && ((t.doneAt || '').slice(0, 10) === day || (!t.doneAt && t.date === day))).slice(0, 6)
    .forEach((t) => out.push(`${projectOf(t).id ? projectOf(t).name + ': ' : ''}${t.title}`));
  s.habits.forEach((h) => { if (s.habitLog[day] && s.habitLog[day][h.id]) out.push(h.name); });
  s.events.filter((e) => e.date === day).forEach((e) => out.push(`${e.time ? e.time + ' ' : ''}${e.title}`));
  return out;
}

function write(s, ui) {
  const today = todayISO();
  const day = ui.diaryDay || today;
  const d = s.diary[day] || { text: '', mood: null, sleep: null, energy: null, answers: [], photo: null };
  const streak = diaryStreak();
  const dots = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((x) => `<span class="sdot${diaryHasEntry(s.diary[x]) ? ' on' : ''}${x === today ? ' now' : ''}" title="${esc(x)}"></span>`).join('');
  const moodBtns = MOODS.map((m, i) => { const on = d.mood === i + 1; return `<button class="mood${on ? ' on' : ''}" data-action="diary-mood" data-v="${i + 1}" aria-label="${m.label}" aria-pressed="${on}"><span>${m.e}</span></button>`; }).join('');
  const drops = [1, 2, 3, 4, 5].map((n) => `<button class="drop${d.energy >= n ? ' on' : ''}" data-action="diary-energy" data-v="${n}" aria-label="Энергия ${n} из 5" aria-pressed="${d.energy === n}"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}"></path></svg></button>`).join('');
  const used = new Set((d.answers || []).map((a) => a.q));
  const qOpts = questionsOf(s).filter((q) => !used.has(q));
  const ctx = dayContext(s, day);
  const photo = d.photo ? photoURL(d.photo) : null;

  return `<section class="card diary-card" data-key="dw-${esc(day)}">
    <div class="diary-head">
      <div style="display:flex;align-items:center;gap:6px">
        <button class="iconbtn" data-action="diary-day" data-to="${addDays(day, -1)}" aria-label="Предыдущий день" style="transform:rotate(90deg)">${icon('chevron', 18, 2)}</button>
        <div class="disp" style="font-size:20px;color:var(--deep)">${esc(longDate(day))}</div>
        ${day < today ? `<button class="iconbtn" data-action="diary-day" data-to="${addDays(day, 1)}" aria-label="Следующий день" style="transform:rotate(-90deg)">${icon('chevron', 18, 2)}</button><button class="qchip" data-action="diary-day" data-to="${today}">Сегодня</button>` : ''}
      </div>
      <div class="streak" title="Дни подряд с записью"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="${DROP}" fill="#6BC0F5"></path></svg><b>${streak ? `${streak} ${plural(streak, ['день', 'дня', 'дней'])} подряд` : 'Начни серию'}</b><span class="sdots" aria-hidden="true">${dots}</span></div>
    </div>

    <div class="diary-meta">
      <div class="field"><span class="label">Настроение</span><div class="moods">${moodBtns}</div><span class="mood-label">${d.mood ? MOODS[d.mood - 1].label : 'выбери смайл'}</span></div>
      <div class="field"><span class="label">Сон</span><div class="stepper"><button class="iconbtn" data-action="diary-sleep" data-step="-0.5" aria-label="Меньше сна">−</button><span class="sv">${sleepText(d.sleep)}</span><button class="iconbtn" data-action="diary-sleep" data-step="0.5" aria-label="Больше сна">+</button></div></div>
      <div class="field"><span class="label">Энергия</span><div class="drops">${drops}</div></div>
    </div>

    <div class="field">
      <label class="label" for="d-text">Как прошёл день?</label>
      <textarea id="d-text" class="ta diary-ta" data-diary="text" data-day="${esc(day)}" rows="6" placeholder="Пиши как есть, пара строк — уже хорошо">${esc(d.text || '')}</textarea>
    </div>

    ${(d.answers || []).map((a, i) => `<div class="qblock fade" data-key="ans-${esc(a.id || i)}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><label class="qlabel" for="ans-${esc(a.id || i)}">${esc(a.q)}</label><button class="iconbtn" data-action="diary-q-remove" data-i="${i}" aria-label="Убрать вопрос">${icon('close', 16, 2)}</button></div>
      <textarea id="ans-${esc(a.id || i)}" class="ta diary-ta small" data-diary="answer" data-i="${i}" data-day="${esc(day)}" rows="2" placeholder="Пара строк">${esc(a.a || '')}</textarea>
    </div>`).join('')}

    <div style="position:relative">
      <button class="btn ghost" data-action="diary-q-menu" aria-expanded="${!!ui.qMenu}">${icon('plus', 16, 2.2)}Добавить вопрос</button>
      ${ui.qMenu ? `<div class="menu fade" style="top:52px;left:0;width:340px;max-width:86vw;max-height:360px;overflow:auto" data-menu="q">
        ${qOpts.map((q) => `<button class="opt" data-action="diary-q-add" data-q="${esc(q)}">${esc(q)}</button>`).join('') || '<div class="muted" style="padding:8px 10px;font-size:14px">Все вопросы уже добавлены</div>'}
        <form data-action="diary-q-custom" style="display:flex;gap:6px;border-top:1px solid var(--line-soft);margin-top:6px;padding-top:8px">
          <label for="d-customq" class="sr">Свой вопрос</label><input id="d-customq" name="q" class="input" style="min-height:38px" placeholder="Свой вопрос…" autocomplete="off">
          <button class="btn small" type="submit">Добавить</button>
        </form>
      </div>` : ''}
    </div>

    ${ctx.length ? `<div class="field"><span class="label">Этот день в панели — нажми, чтобы добавить в запись</span><div class="chips">${ctx.map((c) => `<button class="qchip" data-action="diary-ctx" data-text="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>` : ''}

    <div class="diary-foot">
      <div class="photo-slot">
        ${d.photo ? `<div class="photo-frame">${photo ? `<img src="${esc(photo)}" alt="Фото дня">` : '<span class="muted" style="font-size:13px">Загружаю…</span>'}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap"><label class="btn ghost small" style="cursor:pointer">Заменить<input type="file" accept="image/*" class="sr" data-change="diary-photo" data-day="${esc(day)}"></label><button class="btn ghost small" data-action="diary-photo-remove">Убрать</button></div>`
        : `<label class="photo-add${ui.photoBusy ? ' busy' : ''}">${icon('today', 22)}<span>${ui.photoBusy ? 'Загружаю…' : 'Фото дня'}</span><input type="file" accept="image/*" class="sr" data-change="diary-photo" data-day="${esc(day)}"></label>`}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
        <span class="muted" style="font-size:13px">Сохраняется само, пока пишешь</span>
        <button class="btn ghost small" data-action="diary-copy" data-day="${esc(day)}">Скопировать для Apple Дневника</button>
      </div>
    </div>
  </section>`;
}

// Текст записи для вставки в Apple Дневник
export function entryText(s, day) {
  const d = s.diary[day]; if (!d) return '';
  const meta = [d.mood ? `Настроение: ${MOODS[d.mood - 1].e} ${MOODS[d.mood - 1].label}` : '', d.sleep !== null && d.sleep !== undefined && d.sleep !== '' ? `Сон: ${sleepText(d.sleep)}` : '', d.energy ? `Энергия: ${d.energy}/5` : ''].filter(Boolean).join(' · ');
  const parts = [longDate(day) + ' ' + parseISO(day).getFullYear()];
  if (meta) parts.push(meta);
  if ((d.text || '').trim()) parts.push(d.text.trim());
  (d.answers || []).filter((a) => (a.a || '').trim()).forEach((a) => parts.push(`${a.q}\n${a.a.trim()}`));
  return parts.join('\n\n');
}

// ===== Архив =====
function archive(s, ui) {
  const q = (ui.diaryQuery || '').trim().toLowerCase();
  const days = Object.keys(s.diary).filter((k) => diaryHasEntry(s.diary[k])).sort().reverse();
  const list = days.filter((k) => !q || entryText(s, k).toLowerCase().includes(q));
  return `<div class="row2">
    <section class="card" style="flex:2 1 460px;display:flex;flex-direction:column;gap:12px">
      <label for="d-search" class="sr">Поиск по дневнику</label>
      <input id="d-search" class="input" placeholder="Найти слово или дату в записях" value="${esc(ui.diaryQuery || '')}" data-input="diary-search" autocomplete="off">
      ${list.length ? list.map((k) => { const d = s.diary[k]; const prev = (d.text || (d.answers || []).map((a) => a.a).join(' ') || '').trim(); return `<div class="arch lift" data-key="ar-${esc(k)}">
        <span style="font-size:28px;line-height:1;width:32px;text-align:center">${d.mood ? MOODS[d.mood - 1].e : '·'}</span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:14px">${esc(longDate(k))}</b><span class="muted" style="font-size:12px">${[d.answers && d.answers.length ? `${d.answers.length} ${plural(d.answers.length, ['вопрос', 'вопроса', 'вопросов'])}` : '', d.photo ? 'фото' : ''].filter(Boolean).join(' · ')}</span></div>
          <div class="arch-text">${esc(prev.slice(0, 220)) || '<span class="muted">без текста</span>'}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button class="btn ghost small" data-action="diary-open" data-day="${esc(k)}">Открыть</button><button class="btn ghost small" data-action="diary-copy" data-day="${esc(k)}">Скопировать</button></div>
        </div>
      </div>`; }).join('') : `<div class="empty">${q ? 'Ничего не нашлось' : 'Записей пока нет. Первая — на вкладке «Запись».'}</div>`}
    </section>
    <section class="card" style="flex:1 1 280px;display:flex;flex-direction:column;gap:10px">
      <h2 class="h2">Перенос в Apple Дневник</h2>
      <div class="muted" style="font-size:14px;line-height:1.55">Нажми «Скопировать» у записи и вставь в новую запись Apple Дневника — дата, настроение, текст и ответы перенесутся одним блоком.</div>
      <div class="muted" style="font-size:14px;line-height:1.55">Следующим шагом сделаю быструю команду на айфоне, чтобы переносить сразу пачкой.</div>
    </section>
  </div>`;
}

// ===== Фото дня =====
function photos(s, ui) {
  const today = todayISO();
  const month = ui.photoMonth || today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const daysIn = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const prevM = new Date(y, m - 2, 1), nextM = new Date(y, m, 1);
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  let withPhoto = 0;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div></div>');
  for (let dn = 1; dn <= daysIn; dn++) {
    const key = `${month}-${String(dn).padStart(2, '0')}`;
    const d = s.diary[key];
    const isToday = key === today, future = key > today;
    if (d && d.photo) withPhoto++;
    const thumb = d && d.photo ? photoURL(d.photo, true) : null;
    cells.push(`<button class="pcell${isToday ? ' today' : ''}${d && d.photo ? ' has' : ''}" data-action="diary-open" data-day="${key}" ${future ? 'disabled' : ''} aria-label="${esc(longDate(key))}${d && d.photo ? ', есть фото' : ''}" data-key="pc-${key}">
      ${thumb ? `<img src="${esc(thumb)}" alt="">` : ''}<span class="pnum">${dn}</span>${isToday && !(d && d.photo) ? '<span class="pnote">сегодня</span>' : ''}</button>`);
  }
  const passed = month === today.slice(0, 7) ? Number(today.slice(8)) : month < today.slice(0, 7) ? daysIn : 0;
  return `<section class="card" style="display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:6px">
        <button class="iconbtn" data-action="photo-month" data-to="${ym(prevM)}" aria-label="Предыдущий месяц" style="transform:rotate(90deg)">${icon('chevron', 18, 2)}</button>
        <div class="disp" style="font-size:20px;color:var(--deep)">${MONTHS[m - 1]} ${y}</div>
        ${month < today.slice(0, 7) ? `<button class="iconbtn" data-action="photo-month" data-to="${ym(nextM)}" aria-label="Следующий месяц" style="transform:rotate(-90deg)">${icon('chevron', 18, 2)}</button>` : ''}
      </div>
      <span class="muted" style="font-size:13px">${passed ? `${withPhoto} из ${passed} ${plural(passed, ['дня', 'дней', 'дней'])} с фото` : ''}</span>
    </div>
    <div class="pgrid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((w) => `<div class="muted" style="font-size:12px;font-weight:600;text-align:center">${w}</div>`).join('')}${cells.join('')}</div>
    <div class="muted" style="font-size:13px">Нажми на день, чтобы открыть запись и добавить фото.</div>
  </section>`;
}
