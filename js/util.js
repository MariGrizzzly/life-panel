// Мелкие помощники: даты, экранирование, склонения.

export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

// Даты храним как 'YYYY-MM-DD' по местному времени.
export const iso = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const todayISO = () => iso(new Date());
export const addDays = (isoStr, n) => { const [y, m, d] = isoStr.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export const longDate = (s) => { const d = parseISO(s); const w = WEEKDAYS[d.getDay()]; return `${w[0].toUpperCase() + w.slice(1)}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
export const dayMonth = (s) => { const d = parseISO(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
export const shortDate = (s) => { const d = parseISO(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };

export const plural = (n, f) => {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  if (a === 1 && b !== 11) return f[0];
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return f[1];
  return f[2];
};

export const greeting = (name) => {
  const h = new Date().getHours();
  const g = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  return name ? `${g}, ${name}` : g;
};

// Когда задача: просрочена / сегодня / завтра / на неделе / позже / без даты
export const whenOf = (t, today = todayISO()) => {
  if (!t.date) return 'nodate';
  if (t.date < today) return t.status === 'done' ? 'past' : 'overdue';
  if (t.date === today) return 'today';
  if (t.date === addDays(today, 1)) return 'tomorrow';
  if (t.date <= addDays(today, 7)) return 'week';
  return 'later';
};
export const WHEN_LABEL = { overdue: 'Просрочено', today: 'Сегодня', tomorrow: 'Завтра', week: 'На этой неделе', later: 'Позже', nodate: 'Без даты', past: 'Прошедшие' };
export const WHEN_ORDER = ['overdue', 'today', 'tomorrow', 'week', 'later', 'nodate', 'past'];
