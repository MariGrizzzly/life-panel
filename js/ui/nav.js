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

// Морская декорация меню: лучи, пузырьки, рыбки. Рендерится один раз.
const SEA = `
<div class="sea" aria-hidden="true" data-skip-morph>
  <div class="caustic" style="width:240px;height:140px;left:-40px;top:-40px"></div>
  <div class="ray" style="left:4%;width:46px;height:75%;transform:rotate(14deg)"></div>
  <div class="ray" style="left:34%;width:28px;height:70%;transform:rotate(10deg);animation-delay:2.4s"></div>
  <div class="ray" style="left:58%;width:60px;height:80%;transform:rotate(18deg);animation-delay:4.6s"></div>
  <div class="ray" style="left:84%;width:34px;height:65%;transform:rotate(12deg);animation-delay:1.3s"></div>
  <span class="swimR" style="top:22%;animation-duration:26s;animation-delay:2s"><svg class="wiggle" width="40" height="24" viewBox="0 0 40 24"><path d="M7 12 L0 4 L1 20 Z" fill="#F07A1A"></path><path d="M18 4 L24 0 L27 5 Z" fill="#F07A1A"></path><ellipse cx="21" cy="12" rx="14" ry="8.5" fill="#F7871F"></ellipse><path d="M15 4.2 C 13 8 13 16 15 19.8" stroke="#FFFFFF" stroke-width="3" fill="none"></path><path d="M25 3.8 C 23.5 8 23.5 16 25 20.2" stroke="#FFFFFF" stroke-width="2.6" fill="none"></path><circle cx="31" cy="10" r="1.6" fill="#10202E"></circle></svg></span>
  <span class="swimL" style="top:48%;animation-duration:31s;animation-delay:9s"><svg class="wiggle" width="46" height="28" viewBox="0 0 46 28"><path d="M8 14 L0 4 L0 24 Z" fill="#F6D23A"></path><ellipse cx="24" cy="14" rx="17" ry="11" fill="#2F6FE0"></ellipse><path d="M12 9 C 20 4 32 5 38 12 C 30 10 22 12 16 18 Z" fill="#0E1E3A"></path><path d="M22 3 L30 0 L32 5 Z" fill="#2F6FE0"></path><circle cx="35" cy="11" r="1.8" fill="#0E1E3A"></circle></svg></span>
  <span class="swimR" style="top:62%;animation-duration:22s;animation-delay:14s"><svg width="64" height="26" viewBox="0 0 64 26"><g class="wiggle"><path d="M4 7 L0 4 L1 10 Z M8 7 a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0z" fill="#FFD43B"></path></g><g class="wiggle" style="animation-delay:.3s"><path d="M24 17 L20 14 L21 20 Z M28 17 a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0z" fill="#FFC81F"></path></g><g class="wiggle" style="animation-delay:.6s"><path d="M42 9 L38 6 L39 12 Z M46 9 a5 3 0 1 0 10 0 a5 3 0 1 0 -10 0z" fill="#FFE066"></path></g></svg></span>
  <span class="swimL" style="top:70%;animation-duration:38s;animation-delay:4s;opacity:.85"><svg class="wiggle" width="92" height="40" viewBox="0 0 92 40"><path d="M4 22 C 18 12 40 8 60 12 C 70 14 78 17 84 21 C 88 22 90 23 90 25 C 84 26 76 26 68 25 C 58 28 46 29 34 28 L 30 36 L 26 28 C 18 27 10 26 6 26 L 0 34 L 2 24 Z" fill="#8FB6D9"></path><path d="M40 12 C 44 4 50 2 54 2 C 50 6 48 9 48 12 Z" fill="#7CA4C8"></path><path d="M20 26 C 34 27 54 27 70 25" stroke="#D9E9F6" stroke-width="2" fill="none" stroke-opacity="0.7"></path><circle cx="76" cy="19" r="1.5" fill="#0E1E3A"></circle></svg></span>
  <span class="swimR" style="top:82%;animation-duration:44s;animation-delay:20s;opacity:.55"><svg class="wiggle" width="120" height="44" viewBox="0 0 120 44"><path d="M2 8 L18 24 L2 40 L10 24 Z" fill="#1E4466"></path><path d="M14 24 C 30 14 60 12 86 16 C 100 18 110 21 118 25 C 108 29 94 31 80 31 C 60 33 34 32 14 24 Z" fill="#244E73"></path><path d="M54 14 L62 0 L68 15 Z" fill="#1E4466"></path><path d="M70 30 L74 40 L80 31 Z" fill="#1E4466"></path><circle cx="104" cy="22" r="1.4" fill="#0A1A2A"></circle></svg></span>
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
