// Отчёт по рабочим задачам за день и раскладка по чатам Битрикса.
// Ту же логику повторяет Telegram-бот (supabase/functions/day-bot).
import { dayMonth, shortDate, doneDay } from './util.js';
import { projectOf, NO_PROJECT } from './store.js';

export function nextWorkday(day) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const line = (t, withProject) => `— ${t.title}${withProject ? ` (${projectOf(t).name})` : ''}${t.deadline && t.status !== 'done' ? `, до ${shortDate(t.deadline)}` : ''}${t.comment ? ` — ${t.comment}` : ''}`;

export function reportParts(s, day) {
  const work = s.tasks.filter((t) => projectOf(t).sphere === 'work');
  const done = work.filter((t) => t.status === 'done' && doneDay(t) === day);
  const doing = work.filter((t) => t.status === 'doing');
  const next = work.filter((t) => t.status !== 'done' && t.status !== 'doing' && t.date && t.date > day && t.date <= nextWorkday(day));
  return { done, doing, next };
}

export function reportText(s, day) {
  const { done, doing, next } = reportParts(s, day);
  const byProject = (list) => {
    const out = [];
    [...s.projects, NO_PROJECT].forEach((p) => {
      const items = list.filter((t) => (t.projectId || null) === p.id);
      if (items.length) out.push(p.name + '\n' + items.map((t) => line(t, false)).join('\n'));
    });
    return out.join('\n\n');
  };
  return `Отчёт за ${dayMonth(day)}\n\nСделано:\n${byProject(done) || '— пока ничего не отмечено'}\n\nВ работе:\n${doing.map((t) => line(t, true)).join('\n') || '—'}\n\nПлан на следующий день:\n${next.map((t) => line(t, true)).join('\n') || '—'}`;
}

// Куда отчитываться: ссылка задачи, иначе ссылка проекта. Без ссылки — отдельная группа.
export const chatUrlOf = (s, t) => (t.bitrixUrl || (s.projects.find((p) => p.id === t.projectId) || {}).bitrixUrl || '');

export function chatGroups(s, day) {
  const { done, doing, next } = reportParts(s, day);
  const map = new Map();
  const add = (t, kind) => {
    const url = chatUrlOf(s, t);
    const key = url || 'none:' + (t.projectId || 'none');
    if (!map.has(key)) map.set(key, { url, title: t.bitrixUrl ? t.title : projectOf(t).name, color: projectOf(t).color, done: [], doing: [], next: [] });
    map.get(key)[kind].push(t);
  };
  done.forEach((t) => add(t, 'done')); doing.forEach((t) => add(t, 'doing')); next.forEach((t) => add(t, 'next'));
  return [...map.values()].map((g) => ({
    ...g,
    text: [g.done.length ? `Сделано:\n${g.done.map((t) => line(t, false)).join('\n')}` : '', g.doing.length ? `В работе:\n${g.doing.map((t) => line(t, false)).join('\n')}` : '', g.next.length ? `Дальше:\n${g.next.map((t) => line(t, false)).join('\n')}` : ''].filter(Boolean).join('\n\n')
  })).sort((a, b) => (!a.url) - (!b.url));
}

// После 17:10 в будни бот присылает отчёт; до отметки «отчиталась» напоминаем
export const REPORT_TIME = '17:10';
export function reportDue(s, day, now = new Date()) {
  const wd = new Date(day + 'T12:00:00').getDay();
  if (wd === 0 || wd === 6) return { due: false, done: !!(s.reports[day] && s.reports[day].status === 'reported') };
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const done = !!(s.reports[day] && s.reports[day].status === 'reported');
  return { due: hm >= REPORT_TIME && !done, done, reportedAt: done ? s.reports[day].reportedAt : null, before: hm < REPORT_TIME };
}
