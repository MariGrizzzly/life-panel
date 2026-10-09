import { esc } from '../util.js';
import { SPHERES } from '../store.js';

export function title() { return ['Настройки и бэкап', 'Имя, проекты, привычки и сохранение данных']; }

export function render(s) {
  const last = s.lastBackup ? new Date(s.lastBackup).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'ещё не делался';
  return `<div class="fade" data-key="page-settings" style="display:flex;flex-direction:column;gap:20px">
  <div class="row2">
    <section class="card" style="flex:1 1 360px;display:flex;flex-direction:column;gap:12px">
      <h2 class="h2">Бэкап</h2>
      <div class="muted" style="font-size:14px;line-height:1.55">Пока панель хранит всё в этом браузере. Раз в неделю скачивай файл бэкапа — из него всё восстанавливается за секунду. Когда подключим сервер, бэкап будет делаться сам каждую ночь.</div>
      <div style="font-size:14px">Последний бэкап: <b>${esc(last)}</b></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="export">Скачать бэкап</button>
        <button class="btn ghost" data-action="copy-backup">Скопировать бэкап</button>
        <label class="btn ghost" style="cursor:pointer">Восстановить из файла<input type="file" accept="application/json,.json" data-change="import" class="sr"></label>
      </div>
    </section>
    <section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:12px">
      <h2 class="h2">Обо мне</h2>
      <form data-action="save-name" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1 1 180px"><label class="label" for="nm">Как к тебе обращаться</label><input id="nm" name="name" class="input" value="${esc(s.profile.name)}"></div>
        <button class="btn ghost" type="submit">Сохранить</button>
      </form>
    </section>
  </div>
  <div class="row2">
    <section class="card" style="flex:1 1 360px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">Проекты</h2><button class="btn small" data-action="add-project">+ Проект</button></div>
      ${s.projects.filter((p) => !p.archived).map((p) => `<div data-key="sp-${esc(p.id)}" style="display:flex;align-items:center;gap:10px;min-height:44px;border-top:1px solid var(--line-soft)"><span class="pdot" style="background:${esc(p.color)}"></span><span style="flex:1">${esc(p.name)}</span><span class="chip" style="background:${SPHERES[p.sphere].bg};color:${SPHERES[p.sphere].fg}">${SPHERES[p.sphere].label}</span><button class="btn ghost small" data-action="archive-project" data-id="${esc(p.id)}">В архив</button></div>`).join('')}
    </section>
    <section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:10px">
      <h2 class="h2">Привычки</h2>
      ${s.habits.map((h) => `<div data-key="sh-${esc(h.id)}" style="display:flex;align-items:center;gap:10px;min-height:44px;border-top:1px solid var(--line-soft)"><span style="flex:1">${esc(h.name)}</span><button class="btn ghost small" data-action="remove-habit" data-id="${esc(h.id)}">Убрать</button></div>`).join('')}
      <form data-action="add-habit" style="display:flex;gap:8px"><label for="nh" class="sr">Новая привычка</label><input id="nh" name="name" class="input" placeholder="Новая привычка" autocomplete="off"><button class="btn ghost" type="submit">Добавить</button></form>
    </section>
  </div>
  <section class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
    <div class="muted" style="font-size:14px">Начать с чистого листа: удалит все задачи, проекты и записи в этом браузере.</div>
    <button class="btn danger" data-action="reset-all">Удалить всё</button>
  </section>
</div>`;
}
