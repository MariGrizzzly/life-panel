import { esc, todayISO, plural, greeting, longDate } from '../util.js';
import { icon, water, WAVE_PATH, WAVE_PATH_SOFT } from '../ui/icons.js';
import { projectOf, SPHERES, EVENT_CATS, habitStreak, NO_PROJECT } from '../store.js';
import { taskRow } from './shared.js';

export function title(s) { return [greeting(s.profile.name), longDate(todayISO())]; }

export function render(s, ui) {
  const today = todayISO();
  const todayTasks = s.tasks.filter((t) => t.date === today);
  const done = todayTasks.filter((t) => t.status === 'done').length;
  const total = todayTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const events = s.events.filter((e) => e.date === today).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  const overdue = s.tasks.filter((t) => t.date && t.date < today && t.status !== 'done').length;

  // Фильтр: сфера или конкретный проект
  const filtered = todayTasks.filter((t) => {
    const p = projectOf(t);
    if (ui.todayPr !== 'all') return (t.projectId || 'none') === ui.todayPr;
    return ui.todaySphere === 'all' || p.sphere === ui.todaySphere;
  });
  const groups = [];
  [...s.projects, NO_PROJECT].forEach((p) => {
    const items = filtered.filter((t) => (t.projectId || null) === p.id);
    if (items.length) groups.push({ p, items });
  });

  const nextEvent = events.find((e) => e.time && e.time >= new Date().toTimeString().slice(0, 5));
  const summary = total
    ? `Сегодня ${total} ${plural(total, ['задача', 'задачи', 'задач'])}${events.length ? ` и ${events.length} ${plural(events.length, ['событие', 'события', 'событий'])}` : ''}.${nextEvent ? ` Дальше — «${esc(nextEvent.title)}» в ${esc(nextEvent.time)}.` : ''}${overdue ? ` Просрочено: ${overdue}.` : ''}`
    : 'На сегодня задач пока нет — можно добавить или спокойно отдохнуть.';

  const wDoneN = s.tasks.filter((t) => t.date === today && t.status === 'done' && projectOf(t).sphere === 'work').length;
  const wDoingN = s.tasks.filter((t) => t.status === 'doing' && projectOf(t).sphere === 'work').length;

  const sphereSeg = [['all', 'Все'], ['personal', 'Личное'], ['work', 'Работа']].map(([id, label]) =>
    `<button class="${ui.todayPr === 'all' && ui.todaySphere === id ? 'on' : ''}" data-action="today-sphere" data-id="${id}">${label}</button>`).join('');
  const prOptions = (sphere) => s.projects.filter((p) => p.sphere === sphere && !p.archived).map((p) => `<option value="${esc(p.id)}"${ui.todayPr === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');

  const habitsHtml = s.habits.map((h) => {
    const on = !!(s.habitLog[today] && s.habitLog[today][h.id]);
    const st = habitStreak(h.id);
    return `<button class="habit${on ? ' on' : ''}" data-action="habit" data-id="${esc(h.id)}" aria-pressed="${on}" data-key="h-${esc(h.id)}">${water(on ? 100 : 0, { key: h.id })}<span class="lbl">${esc(h.name)}</span><span class="st">${on ? `готово · серия ${st + 1}` : st ? `серия ${st} ${plural(st, ['день', 'дня', 'дней'])}` : 'сегодня ещё нет'}</span></button>`;
  }).join('');

  return `
<div class="fade" data-key="page-today" style="display:flex;flex-direction:column;gap:20px">
  ${s.hasDemo ? `<div class="demo-note"><span style="flex:1 1 260px">Сейчас здесь демо-данные, чтобы было видно, как всё работает. Когда начнёшь пользоваться по-настоящему — удали их одной кнопкой.</span><button class="btn small ghost" data-action="clear-demo">Удалить демо-данные</button></div>` : ''}

  <section class="hero" aria-label="Обзор дня">
    <div aria-hidden="true" data-skip-morph>
      <div class="ray" style="left:8%;width:70px;transform:rotate(18deg)"></div>
      <div class="ray" style="left:26%;width:40px;transform:rotate(12deg);animation-delay:2.2s"></div>
      <div class="ray" style="left:48%;width:90px;transform:rotate(20deg);animation-delay:4s"></div>
      <div class="ray" style="left:70%;width:50px;transform:rotate(14deg);animation-delay:1.2s"></div>
      <div class="caustic" style="width:260px;height:120px;left:10%;top:-40px"></div>
      <div class="caustic" style="width:200px;height:100px;left:55%;top:-30px;animation-delay:3s"></div>
      <span class="bub" style="width:10px;height:10px;left:12%;bottom:10px"></span>
      <span class="bub" style="width:6px;height:6px;left:18%;bottom:4px;animation-delay:1.4s;animation-duration:6s"></span>
      <span class="bub" style="width:8px;height:8px;left:37%;bottom:8px;animation-delay:2.6s"></span>
      <span class="bub" style="width:12px;height:12px;left:58%;bottom:6px;animation-delay:3.4s;animation-duration:6.5s"></span>
      <span class="bub" style="width:7px;height:7px;left:66%;bottom:4px;animation-delay:1.9s"></span>
    </div>
    <div class="hero-row">
      <div class="hero-text">
        <div style="font-size:18px;line-height:1.5;max-width:560px">${summary}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn white" data-action="add-task">${icon('plus', 18, 2.2)}Задача</button>
          <button class="btn glass" data-action="add-event">${icon('calendar', 18)}Событие</button>
          <a class="btn glass" href="#diary">${icon('diary', 18)}Дневник</a>
        </div>
        <form class="quick" data-action="quick-inbox" style="display:flex;gap:8px;flex-wrap:wrap">
          <label for="qc" class="sr">Мысль или идея во входящие</label>
          <input id="qc" name="text" class="input" style="flex:1 1 280px;width:auto" placeholder="Мысль, идея, ссылка — во входящие" autocomplete="off">
          <button class="btn glass" type="submit">Во входящие</button>
        </form>
      </div>
      <div class="orbwrap" style="flex:none;display:flex;align-items:center;gap:18px">
        <div class="orb" role="img" aria-label="Выполнено ${pct}% задач на сегодня">
          <div class="water" style="height:${pct}%">
            <svg class="wave2" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-12px;width:200%;height:13px" aria-hidden="true"><path d="${WAVE_PATH_SOFT}" fill="#A6DBFA" fill-opacity="0.75"></path></svg>
            <svg class="wave" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-9px;width:200%;height:10px" aria-hidden="true"><path d="${WAVE_PATH}" fill="#6BC0F5"></path></svg>
            <div style="position:absolute;inset:0;overflow:hidden" data-skip-morph>
              <span class="bub" style="width:6px;height:6px;left:30%;bottom:4px;animation-duration:3.6s"></span>
              <span class="bub" style="width:4px;height:4px;left:52%;bottom:2px;animation-delay:1.2s;animation-duration:3s"></span>
              <span class="bub" style="width:5px;height:5px;left:68%;bottom:6px;animation-delay:2.1s;animation-duration:4s"></span>
            </div>
          </div>
          <div class="orb-glint"></div>
        </div>
        <div><div class="disp" style="font-size:34px">${pct}%</div><div style="font-size:13px;margin-top:4px;color:#CFE6F8">сделано ${done} из ${total}</div></div>
      </div>
    </div>
  </section>

  <div class="row2">
    <section class="card" style="flex:2 1 560px;display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <h2 class="h2" style="font-size:18px">Задачи на сегодня</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <div class="seg" role="group" aria-label="Сфера">${sphereSeg}</div>
          <label for="tpf" class="sr">Показать проект</label>
          <select id="tpf" class="select" style="width:auto;min-height:42px" data-change="today-project" data-value="${esc(ui.todayPr)}">
            <option value="all"${ui.todayPr === 'all' ? ' selected' : ''}>Все проекты</option>
            <optgroup label="Работа">${prOptions('work')}</optgroup>
            <optgroup label="Личное">${prOptions('personal')}<option value="none"${ui.todayPr === 'none' ? ' selected' : ''}>Без проекта</option></optgroup>
          </select>
        </div>
      </div>
      ${groups.length ? `<div class="grid-cards">${groups.map(({ p, items }) => {
        const dn = items.filter((t) => t.status === 'done').length;
        const sp = SPHERES[p.sphere];
        return `<div class="pcard lift" data-key="pc-${esc(p.id || 'none')}">
          <div style="display:flex;align-items:center;gap:8px"><span class="pdot" style="background:${esc(p.color)}"></span><span style="flex:1;font-size:15px;font-weight:600">${esc(p.name)}</span><span class="chip" style="background:${sp.bg};color:${sp.fg}">${sp.label}</span></div>
          <div style="display:flex;align-items:center;gap:8px;margin:6px 0 2px"><div class="track" style="flex:1;height:5px"><div class="liquid" style="width:${Math.round((dn / items.length) * 100)}%"></div></div><span class="muted" style="font-size:12px;font-weight:600">${dn}/${items.length}</span></div>
          ${items.map((t) => taskRow(t, { meta: t.time })).join('')}
        </div>`;
      }).join('')}</div>` : `<div class="empty">${total ? 'В этом фильтре на сегодня задач нет' : 'Задач на сегодня нет. Добавь первую — кнопка «Задача» выше.'}</div>`}
    </section>

    <div style="flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:20px">
      <section class="card" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">Сегодня в календаре</h2><button class="link" data-action="add-event">+ Событие</button></div>
        ${events.length ? events.map((e) => { const c = EVENT_CATS[e.cat] || EVENT_CATS.personal; return `<div class="event" data-key="ev-${esc(e.id)}"><div class="t">${esc(e.time || '—')}</div><div class="b" style="background:${c.bg}"><div style="font-size:14px;font-weight:500">${esc(e.title)}</div><div style="font-size:12px;font-weight:600;color:${c.fg}">${c.label}</div></div></div>`; }).join('') : '<div class="muted" style="font-size:14px">Событий нет</div>'}
      </section>
      <section class="dayclose">
        <div aria-hidden="true" data-skip-morph><span class="bub" style="width:7px;height:7px;left:85%;bottom:10px;animation-delay:.5s"></span><span class="bub" style="width:5px;height:5px;left:92%;bottom:6px;animation-delay:2.5s"></span></div>
        <div style="position:relative;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h2 class="h2" style="color:#FFFFFF">Закрыть день</h2></div>
        <button data-action="go" data-to="tasks" data-view="report"><span style="flex:1"><span style="font-size:14px;font-weight:600">Отчёт по работе</span><small>${wDoneN} ${plural(wDoneN, ['задача готова', 'задачи готовы', 'задач готово'])}, ${wDoingN} в работе</small></span><span aria-hidden="true">→</span></button>
        <button data-action="go" data-to="diary"><span style="flex:1"><span style="font-size:14px;font-weight:600">Дневник и настроение</span><small>появится на следующем шаге</small></span><span aria-hidden="true">→</span></button>
      </section>
    </div>
  </div>

  <section class="card" style="display:flex;flex-direction:column;gap:10px">
    <h2 class="h2">Привычки</h2>
    ${s.habits.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${habitsHtml}</div>` : '<div class="muted">Привычек пока нет — добавь в настройках.</div>'}
  </section>
</div>`;
}
