import { icon, WAVE_PATH } from './icons.js';
import { esc } from '../util.js';

export const SECTIONS = [
  { id: 'today', label: 'Сегодня', group: 'daily' },
  { id: 'tasks', label: 'Задачи', group: 'daily' },
  { id: 'calendar', label: 'Календарь', group: 'daily', soon: true },
  { id: 'diary', label: 'Дневник', group: 'daily' },
  { id: 'goals', label: 'Цели и привычки', group: 'mine', soon: true },
  { id: 'sport', label: 'Спорт', group: 'mine', soon: true },
  { id: 'billiards', label: 'Бильярд', group: 'mine', soon: true },
  { id: 'english', label: 'Английский', group: 'mine', soon: true },
  { id: 'reading', label: 'Чтение', group: 'mine', soon: true },
  { id: 'blog', label: 'Блог', group: 'mine', soon: true },
  { id: 'review', label: 'Обзор недели', group: 'sum', soon: true },
  { id: 'settings', label: 'Настройки', group: 'sum' }
];

// Морская декорация меню: лучи, пузырьки, медуза. Рыбы запускаются из fish.js.
const SEA = `
<div class="sea" aria-hidden="true" data-skip-morph>
  <div class="caustic" style="width:240px;height:140px;left:-40px;top:-40px"></div>
  <div class="ray" style="left:4%;width:46px;height:75%;transform:rotate(14deg)"></div>
  <div class="ray" style="left:34%;width:28px;height:70%;transform:rotate(10deg);animation-delay:2.4s"></div>
  <div class="ray" style="left:58%;width:60px;height:80%;transform:rotate(18deg);animation-delay:4.6s"></div>
  <div class="ray" style="left:84%;width:34px;height:65%;transform:rotate(12deg);animation-delay:1.3s"></div>
  <span class="jelly" style="left:70%;top:86%;animation-delay:6s"><svg width="34" height="54" viewBox="0 0 34 54"><path d="M2 18 C 2 6 32 6 32 18 C 28 20 6 20 2 18 Z" fill="#F59BD0" fill-opacity="0.75"></path><path d="M8 19 C 6 30 12 38 8 50 M14 20 C 13 32 18 40 15 52 M20 20 C 22 32 16 42 20 52 M26 19 C 28 30 22 38 26 48" stroke="#F8B6DE" stroke-width="1.6" fill="none" stroke-opacity="0.7"></path></svg></span>
  <span class="bub bubtall" style="width:8px;height:8px;left:22%;bottom:-10px"></span>
  <span class="bub bubtall" style="width:5px;height:5px;left:48%;bottom:-10px;animation-delay:4s"></span>
  <span class="bub bubtall" style="width:6px;height:6px;left:76%;bottom:-10px;animation-delay:8s"></span>
  <span class="bub bubtall" style="width:4px;height:4px;left:90%;bottom:-10px;animation-delay:11s"></span>
</div>`;

export function sidebar({ section, name, badges, backupTitle, backupText, backupWarn }) {
  const btn = (s) => `<a class="nav-btn${s.id === section ? ' active' : ''}${s.soon ? ' soon' : ''}" href="#${s.id}" data-key="nav-${s.id}"${s.id === section ? ' aria-current="page"' : ''}>${icon(s.id === 'settings' ? 'settings' : s.id)}<span>${esc(s.label)}</span>${badges[s.id] ? `<span class="badge">${badges[s.id]}</span>` : ''}</a>`;
  const group = (g) => SECTIONS.filter((s) => s.group === g).map(btn).join('');
  return `
<nav class="sidebar" aria-label="Разделы" data-key="sidebar">
  ${SEA}
  <div class="side-inner">
    <div class="brand">
      <div class="brand-orb"><span class="water" style="height:58%;background:linear-gradient(180deg,#4AA3E3,#14629E)"><svg class="wave" viewBox="0 0 240 20" preserveAspectRatio="none" style="position:absolute;left:0;top:-4px;width:200%;height:5px" aria-hidden="true"><path d="${WAVE_PATH}" fill="#4AA3E3"></path></svg></span></div>
      <div><div class="brand-name">${esc(name || 'Моя панель')}</div><div class="brand-sub">личная панель</div></div>
    </div>
    ${group('daily')}
    <div class="nav-sec">Мои разделы</div>
    ${group('mine')}
    <div class="nav-sec">Итоги</div>
    ${group('sum')}
    <a class="backup" href="#settings" style="color:inherit;text-decoration:none"><span class="dot${backupWarn ? ' warn' : ''}"></span><span><b style="font-weight:600">${esc(backupTitle)}</b><br><span style="color:#A9CBE8">${esc(backupText)}</span></span></a>
  </div>
</nav>`;
}

export function tabbar(section) {
  const a = (id, label, ic) => `<a href="#${id}" class="${section === id ? 'on' : ''}">${icon(ic, 22)}${label}</a>`;
  return `<nav class="tabbar" aria-label="Разделы" data-key="tabbar">
    ${a('today', 'Сегодня', 'today')}${a('tasks', 'Задачи', 'tasks')}
    <button class="plus" data-action="add-task" aria-label="Новая задача">${icon('plus', 24, 2.2)}</button>
    ${a('diary', 'Дневник', 'diary')}${a('settings', 'Ещё', 'menu')}
  </nav>`;
}
