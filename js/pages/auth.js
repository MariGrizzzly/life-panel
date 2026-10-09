// Экраны до входа: вход/регистрация, сброс пароля, первая настройка.
import { esc } from '../util.js';
import { WAVE_PATH, WAVE_PATH_SOFT } from '../ui/icons.js';

const SEA = `<div aria-hidden="true" data-skip-morph>
  <div class="ray" style="left:8%;width:90px;transform:rotate(16deg)"></div>
  <div class="ray" style="left:30%;width:50px;transform:rotate(11deg);animation-delay:2.2s"></div>
  <div class="ray" style="left:55%;width:120px;transform:rotate(19deg);animation-delay:4s"></div>
  <div class="ray" style="left:80%;width:60px;transform:rotate(13deg);animation-delay:1.2s"></div>
  <div class="caustic" style="width:360px;height:140px;left:10%;top:-40px"></div>
  <div class="caustic" style="width:300px;height:120px;left:58%;top:-30px;animation-delay:4s"></div>
  <span class="bub bubtall" style="width:12px;height:12px;left:8%;bottom:-20px"></span>
  <span class="bub bubtall" style="width:7px;height:7px;left:24%;bottom:-20px;animation-delay:3s"></span>
  <span class="bub bubtall" style="width:9px;height:9px;left:63%;bottom:-20px;animation-delay:6s"></span>
  <span class="bub bubtall" style="width:14px;height:14px;left:86%;bottom:-20px;animation-delay:9s"></span>
</div>`;

const ORB = `<div class="orb" style="width:84px;height:84px" aria-hidden="true"><div class="water" style="height:58%"><svg class="wave2" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-9px;width:200%;height:10px"><path d="${WAVE_PATH_SOFT}" fill="#A6DBFA" fill-opacity="0.75"></path></svg><svg class="wave" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-7px;width:200%;height:8px"><path d="${WAVE_PATH}" fill="#6BC0F5"></path></svg></div><div class="orb-glint" style="left:12px;top:10px;width:32px;height:18px"></div></div>`;

const shell = (inner) => `<div class="auth-screen" data-key="auth">${SEA}<div class="auth-card fade">${ORB}${inner}</div></div>`;

const msg = (ui) => ui.authMsg ? `<div class="auth-msg ${ui.authMsgKind || ''}" role="status">${esc(ui.authMsg)}</div>` : '';

export function login(ui) {
  const signup = ui.authTab === 'signup';
  if (ui.authTab === 'reset') {
    return shell(`<h1 class="disp" style="margin:0;font-size:22px">Сброс пароля</h1>
      <p class="auth-sub">Пришлю на почту ссылку. По ней откроется панель, и можно будет задать новый пароль.</p>
      ${msg(ui)}
      <form data-auth="reset" class="auth-form">
        <div class="field"><label class="label" for="a-email">Почта</label><input id="a-email" name="email" type="email" class="input" required autocomplete="email" value="${esc(ui.authEmail || '')}"></div>
        <button class="btn white" type="submit"${ui.authBusy ? ' disabled' : ''}>${ui.authBusy ? 'Отправляю…' : 'Прислать ссылку'}</button>
      </form>
      <button class="link auth-link" data-auth-tab="login">Вернуться ко входу</button>`);
  }
  return shell(`<h1 class="disp" style="margin:0;font-size:22px">Моя панель</h1>
    <div class="seg auth-seg" role="tablist"><button role="tab" aria-selected="${!signup}" class="${signup ? '' : 'on'}" data-auth-tab="login">Вход</button><button role="tab" aria-selected="${signup}" class="${signup ? 'on' : ''}" data-auth-tab="signup">Создать аккаунт</button></div>
    ${msg(ui)}
    <form data-auth="${signup ? 'signup' : 'login'}" class="auth-form">
      <div class="field"><label class="label" for="a-email">Почта</label><input id="a-email" name="email" type="email" class="input" required autocomplete="email" value="${esc(ui.authEmail || '')}"></div>
      <div class="field"><label class="label" for="a-pass">Пароль${signup ? ' — минимум 6 символов' : ''}</label><input id="a-pass" name="password" type="password" class="input" required minlength="6" autocomplete="${signup ? 'new-password' : 'current-password'}"></div>
      <button class="btn white" type="submit"${ui.authBusy ? ' disabled' : ''}>${ui.authBusy ? 'Подождите…' : signup ? 'Создать аккаунт' : 'Войти'}</button>
    </form>
    ${signup ? '' : '<button class="link auth-link" data-auth-tab="reset">Забыла пароль</button>'}`);
}

export function newPassword(ui) {
  return shell(`<h1 class="disp" style="margin:0;font-size:22px">Новый пароль</h1>
    <p class="auth-sub">Придумай новый пароль для входа.</p>
    ${msg(ui)}
    <form data-auth="new-password" class="auth-form">
      <div class="field"><label class="label" for="a-np">Новый пароль — минимум 6 символов</label><input id="a-np" name="password" type="password" class="input" required minlength="6" autocomplete="new-password"></div>
      <button class="btn white" type="submit"${ui.authBusy ? ' disabled' : ''}>Сохранить пароль</button>
    </form>`);
}

export function onboarding(ui, legacy) {
  const hasOld = legacy && legacy.realCount > 0;
  return shell(`<h1 class="disp" style="margin:0;font-size:22px">Добро пожаловать</h1>
    <p class="auth-sub">Аккаунт готов. Пара вопросов — и начинаем.</p>
    ${msg(ui)}
    <form data-auth="onboard" class="auth-form">
      <div class="field"><label class="label" for="o-name">Как к тебе обращаться</label><input id="o-name" name="name" class="input" required autocomplete="given-name" value="${esc(ui.onboardName || '')}"></div>
      ${legacy ? `<fieldset class="auth-choice"><legend class="label">С чего начать</legend>
        <label><input type="radio" name="start" value="clean" checked> С чистого листа</label>
        <label><input type="radio" name="start" value="legacy"> Перенести проекты и привычки из этого браузера${hasOld ? `, а также мои записи (${legacy.realCount})` : ''}</label>
      </fieldset>` : ''}
      <button class="btn white" type="submit">Начать</button>
    </form>`);
}

export function loading(text = 'Подключаюсь к базе…') {
  return shell(`<div style="font-size:16px">${esc(text)}</div>`);
}
