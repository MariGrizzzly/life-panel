import { esc } from '../util.js';
import { SPHERES, sync } from '../store.js';
import { greetingsOf, questionsOf } from '../texts.js';

export function title() { return ['Настройки', 'Аккаунт, проекты, привычки, твои тексты и бэкап']; }

const SYNC_TEXT = {
  ok: 'Всё сохранено в облаке',
  saving: 'Сохраняю…',
  offline: 'Нет связи — изменения сохранятся, когда интернет вернётся',
  auth: 'Нужно войти заново',
  error: 'Не удалось связаться с базой',
  idle: 'Подключаюсь…'
};
export const syncText = () => SYNC_TEXT[sync.status] || SYNC_TEXT.idle;

export function render(s, ui) {
  const last = s.lastBackup ? new Date(s.lastBackup).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'ещё не скачивался';
  const pending = sync.pending ? ` · в очереди: ${sync.pending}` : '';
  return `<div class="fade" data-key="page-settings" style="display:flex;flex-direction:column;gap:20px">
  <div class="row2">
    <section class="card" style="flex:1 1 360px;display:flex;flex-direction:column;gap:12px">
      <h2 class="h2">Аккаунт</h2>
      <div style="font-size:14px">Вход: <b>${esc(ui.email || '')}</b></div>
      <div style="font-size:14px;display:flex;align-items:center;gap:8px"><span class="pdot" style="width:8px;height:8px;background:${sync.status === 'ok' ? '#2E8A5C' : sync.status === 'saving' ? '#14629E' : '#C9932F'}"></span>${esc(syncText())}${esc(pending)}</div>
      ${sync.error ? `<div class="muted" style="font-size:13px">Последняя ошибка: ${esc(sync.error)}</div>` : ''}
      <form data-action="save-name" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1 1 180px"><label class="label" for="nm">Как к тебе обращаться</label><input id="nm" name="name" class="input" value="${esc(s.profile.name)}" autocomplete="given-name"></div>
        <button class="btn ghost" type="submit">Сохранить</button>
      </form>
      <form data-action="change-password" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1 1 180px"><label class="label" for="np2">Новый пароль</label><input id="np2" name="password" type="password" class="input" minlength="6" autocomplete="new-password"></div>
        <button class="btn ghost" type="submit">Сменить пароль</button>
      </form>
      <div><button class="btn ghost" data-action="sign-out">Выйти</button></div>
    </section>
    <section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:12px">
      <h2 class="h2">Бэкап</h2>
      <div class="muted" style="font-size:14px;line-height:1.55">Данные хранятся в твоей базе Supabase. Каждую ночь копия уходит в приватный репозиторий <b>life-panel-backup</b> на GitHub. Дополнительно можно скачать файл вручную.</div>
      <div style="font-size:14px">Файл вручную: <b>${esc(last)}</b></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-action="export">Скачать бэкап</button>
        <button class="btn ghost" data-action="copy-backup">Скопировать</button>
        <label class="btn ghost" style="cursor:pointer">Восстановить из файла<input type="file" accept="application/json,.json" data-change="import" class="sr"></label>
      </div>
    </section>
  </div>
  <div class="row2">
    <section class="card" style="flex:1 1 360px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;justify-content:space-between;align-items:center"><h2 class="h2">Проекты</h2><button class="btn small" data-action="add-project">+ Проект</button></div>
      ${s.projects.filter((p) => !p.archived).map((p) => `<div data-key="sp-${esc(p.id)}" style="display:flex;align-items:center;gap:10px;min-height:44px;border-top:1px solid var(--line-soft)"><span class="pdot" style="background:${esc(p.color)}"></span><span style="flex:1">${esc(p.name)}</span><span class="chip" style="background:${SPHERES[p.sphere].bg};color:${SPHERES[p.sphere].fg}">${SPHERES[p.sphere].label}</span><button class="btn ghost small" data-action="archive-project" data-id="${esc(p.id)}">В архив</button></div>`).join('') || '<div class="muted" style="font-size:14px">Проектов пока нет</div>'}
    </section>
    <section class="card" style="flex:1 1 300px;display:flex;flex-direction:column;gap:10px">
      <h2 class="h2">Привычки</h2>
      ${s.habits.map((h) => `<div data-key="sh-${esc(h.id)}" style="display:flex;align-items:center;gap:10px;min-height:44px;border-top:1px solid var(--line-soft)"><span style="flex:1">${esc(h.name)}</span><button class="btn ghost small" data-action="remove-habit" data-id="${esc(h.id)}">Убрать</button></div>`).join('')}
      <form data-action="add-habit" style="display:flex;gap:8px"><label for="nh" class="sr">Новая привычка</label><input id="nh" name="name" class="input" placeholder="Новая привычка" autocomplete="off"><button class="btn ghost" type="submit">Добавить</button></form>
    </section>
  </div>
  <section class="card" style="display:flex;flex-direction:column;gap:14px">
    <div><h2 class="h2">Мои тексты</h2><div class="muted" style="font-size:14px;margin-top:4px;line-height:1.5">Меняй как хочешь — по одной фразе на строку. Пустые строки не считаются.</div></div>
    <div class="row2">
      <form data-action="save-greetings" class="field" style="flex:1 1 340px;gap:8px">
        <label class="label" for="pr-greet">Приветствия наверху «Сегодня» — каждый раз случайное</label>
        <textarea id="pr-greet" name="lines" class="ta" rows="8" data-skip-morph>${esc(greetingsOf(s).join('\n'))}</textarea>
        <div class="muted" style="font-size:12px;line-height:1.5"><b>{имя}</b> — подставится имя, <b>{приветствие}</b> — «Доброе утро», «Добрый день» или «Добрый вечер» по времени.</div>
        <div><button class="btn ghost small" type="submit">Сохранить приветствия</button></div>
      </form>
      <form data-action="save-questions" class="field" style="flex:1 1 340px;gap:8px">
        <label class="label" for="pr-q">Вопросы для дневника</label>
        <textarea id="pr-q" name="lines" class="ta" rows="8" data-skip-morph>${esc(questionsOf(s).join('\n'))}</textarea>
        <div class="muted" style="font-size:12px;line-height:1.5">Они появляются в меню «Добавить вопрос» на странице дневника.</div>
        <div><button class="btn ghost small" type="submit">Сохранить вопросы</button></div>
      </form>
    </div>
  </section>
  <section class="card" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
    <div class="muted" style="font-size:14px">Начать с чистого листа: удалит задачи, проекты, события, дневник и отметки привычек.</div>
    <button class="btn danger" data-action="reset-all">Удалить всё</button>
  </section>
</div>`;
}
