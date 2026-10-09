// Тексты, которые Марина может менять сама в Настройках → «Мои тексты».
import { greeting as timeGreeting } from './util.js';

export const DEFAULT_GREETINGS = [
  '{приветствие}, {имя}',
  'Привет, {имя}! Плывём дальше',
  '{имя}, сегодня штиль или шторм?',
  'С возвращением, {имя}',
  'Глубокий вдох, {имя}. Начинаем',
  '{приветствие}! Вода тёплая, {имя}',
  '{имя}, держим курс'
];

export const DEFAULT_QUESTIONS = [
  'Чем занималась сегодня?',
  'Что было хорошего?',
  'Что разозлило или расстроило?',
  'Что смешного случилось?',
  'Чем горжусь?',
  'Чему научилась?',
  'За что благодарна?',
  'С кем общалась?',
  'Что сделаю иначе завтра?',
  'Что хочется запомнить?'
];

export const greetingsOf = (s) => {
  const g = s.profile.prefs && Array.isArray(s.profile.prefs.greetings) ? s.profile.prefs.greetings.filter(Boolean) : [];
  return g.length ? g : DEFAULT_GREETINGS;
};
export const questionsOf = (s) => {
  const q = s.profile.prefs && Array.isArray(s.profile.prefs.questions) ? s.profile.prefs.questions.filter(Boolean) : [];
  return q.length ? q : DEFAULT_QUESTIONS;
};

// Фраза выбирается при открытии панели и не прыгает, пока ты в ней
let pickIndex = null;
export function greetingLine(s) {
  const list = greetingsOf(s);
  if (pickIndex === null || pickIndex >= list.length) pickIndex = Math.floor(Math.random() * list.length);
  const name = (s.profile.name || '').trim();
  let line = list[pickIndex].replace(/\{приветствие\}/g, timeGreeting(''));
  line = name ? line.replace(/\{имя\}/g, name) : line.replace(/,?\s*\{имя\}[,!]?\s*/g, ' ').replace(/\s+([!?.,])/g, '$1').trim();
  return line.charAt(0).toUpperCase() + line.slice(1);
}
export function resetGreeting() { pickIndex = null; }
