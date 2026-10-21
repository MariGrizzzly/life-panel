// Telegram-бот «Закрыть день» для панели.
// Живёт в Supabase Edge Functions. Секреты (Edge Functions → Secrets):
//   TELEGRAM_BOT_TOKEN — токен от @BotFather
//   BOT_SECRET         — любое слово из латинских букв и цифр (16+ символов): защищает бота
//   OWNER_USER_ID      — id твоего аккаунта в панели
//   PANEL_URL          — адрес панели (необязательно)
// Вызовы:
//   ?setup=BOT_SECRET          — один раз: подключить вебхук Telegram
//   ?cron=start|remind + заголовок x-cron-key: BOT_SECRET — по расписанию
//   POST от Telegram (заголовок X-Telegram-Bot-Api-Secret-Token: BOT_SECRET)

const env = (k: string, d = '') => (globalThis as any).Deno?.env.get(k) ?? d;
const TG = () => `https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}`;
const SB = () => env('SUPABASE_URL');
const KEY = () => env('SUPABASE_SERVICE_ROLE_KEY') || env('SB_SECRET_KEY');
const OWNER = () => env('OWNER_USER_ID');
const SECRET = () => env('BOT_SECRET');
const PANEL = () => env('PANEL_URL', 'https://marigrizzzly.github.io/life-panel/');

// ===== База =====
function sbHeaders(extra: Record<string, string> = {}) {
  const k = KEY();
  const h: Record<string, string> = { apikey: k, 'Content-Type': 'application/json', ...extra };
  if (k.startsWith('eyJ')) h.Authorization = `Bearer ${k}`;
  return h;
}
async function sel(table: string, query: string): Promise<any[]> {
  const r = await fetch(`${SB()}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`select ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function patch(table: string, query: string, body: any) {
  const r = await fetch(`${SB()}/rest/v1/${table}?${query}`, { method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`patch ${table}: ${r.status} ${await r.text()}`);
}
async function upsert(table: string, row: any, onConflict: string) {
  const r = await fetch(`${SB()}/rest/v1/${table}?on_conflict=${onConflict}`, { method: 'POST', headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify([row]) });
  if (!r.ok) throw new Error(`upsert ${table}: ${r.status} ${await r.text()}`);
}

// ===== Даты (по Москве) =====
const MSK = 'Europe/Moscow';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: MSK, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const hm = (d: Date) => new Intl.DateTimeFormat('ru-RU', { timeZone: MSK, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const addDays = (day: string, n: number) => { const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const isoWd = (day: string) => { const [y, m, d] = day.split('-').map(Number); return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1; };
const nextWorkday = (day: string) => { let d = addDays(day, 1); while (isoWd(d) > 5) d = addDays(d, 1); return d; };
const nextOcc = (days: number[], from: string) => { let d = from; for (let i = 0; i < 8; i++) { if (days.includes(isoWd(d))) return d; d = addDays(d, 1); } return from; };
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dayMonth = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
const doneDay = (t: any) => (t.done_at ? ymd(new Date(t.done_at)) : t.date);

// ===== Telegram =====
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function tg(method: string, body: any) {
  const r = await fetch(`${TG()}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok && !String(j.description || '').includes('message is not modified')) console.warn('tg', method, j);
  return j.result;
}
const send = (chat: number, text: string, kb?: any) => tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(kb ? { reply_markup: kb } : {}) });
const edit = (chat: number, mid: number, text: string, kb?: any) => tg('editMessageText', { chat_id: chat, message_id: mid, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(kb ? { reply_markup: kb } : {}) });

// ===== Состояние бота =====
async function getState(): Promise<{ chat_id: number | null; state: any }> {
  const r = await sel('bot_state', `user_id=eq.${OWNER()}&select=chat_id,state`);
  return r[0] || { chat_id: null, state: {} };
}
const saveState = (chat_id: number | null, state: any) => upsert('bot_state', { user_id: OWNER(), chat_id, state, updated_at: new Date().toISOString() }, 'user_id');

// ===== Данные панели =====
async function load() {
  const [projects, tasks, reports] = await Promise.all([
    sel('projects', `user_id=eq.${OWNER()}&select=*`),
    sel('tasks', `user_id=eq.${OWNER()}&select=*&order=created_at.asc`),
    sel('daily_reports', `user_id=eq.${OWNER()}&select=*&order=day.desc&limit=7`)
  ]);
  return { projects, tasks, reports };
}
const projOf = (d: any, t: any) => d.projects.find((p: any) => p.id === t.project_id) || { name: 'Без проекта', sphere: 'personal' };
const isWork = (d: any, t: any) => projOf(d, t).sphere === 'work';
// Что спрашиваем: рабочие задачи на сегодня и раньше, ещё не сделанные, плюс всё «в работе»
const askList = (d: any, day: string) => d.tasks.filter((t: any) => isWork(d, t) && t.status !== 'done' && (t.status === 'doing' || (t.date && t.date <= day)));

function parts(d: any, day: string) {
  const work = d.tasks.filter((t: any) => isWork(d, t));
  return {
    done: work.filter((t: any) => t.status === 'done' && doneDay(t) === day),
    doing: work.filter((t: any) => t.status === 'doing'),
    next: work.filter((t: any) => t.status !== 'done' && t.status !== 'doing' && !(Array.isArray(t.repeat) && t.repeat.length) && t.date && t.date > day && t.date <= nextWorkday(day))
  };
}
const line = (d: any, t: any, withProject: boolean) => `— ${t.title}${withProject ? ` (${projOf(d, t).name})` : ''}${t.comment ? ` — ${t.comment}` : ''}`;
function reportText(d: any, day: string) {
  const { done, doing, next } = parts(d, day);
  const byProject = (list: any[]) => {
    const groups = new Map<string, any[]>();
    list.forEach((t) => { const n = projOf(d, t).name; groups.set(n, [...(groups.get(n) || []), t]); });
    return [...groups].map(([n, ts]) => `${n}\n${ts.map((t) => line(d, t, false)).join('\n')}`).join('\n\n');
  };
  return `Отчёт за ${dayMonth(day)}\n\nСделано:\n${byProject(done) || '— пока ничего не отмечено'}\n\nВ работе:\n${doing.map((t: any) => line(d, t, true)).join('\n') || '—'}\n\nПлан на следующий день:\n${next.map((t: any) => line(d, t, true)).join('\n') || '—'}`;
}
function chatGroups(d: any, day: string) {
  const { done, doing, next } = parts(d, day);
  const map = new Map<string, any>();
  const add = (t: any, kind: string) => {
    const url = t.bitrix_url || projOf(d, t).bitrix_url || '';
    const key = url || 'none:' + (t.project_id || 'none');
    if (!map.has(key)) map.set(key, { url, title: t.bitrix_url ? t.title : projOf(d, t).name, done: [], doing: [], next: [] });
    map.get(key)[kind].push(t);
  };
  done.forEach((t: any) => add(t, 'done')); doing.forEach((t: any) => add(t, 'doing')); next.forEach((t: any) => add(t, 'next'));
  return [...map.values()].map((g) => ({ ...g, text: [g.done.length ? `Сделано:\n${g.done.map((t: any) => line(d, t, false)).join('\n')}` : '', g.doing.length ? `В работе:\n${g.doing.map((t: any) => line(d, t, false)).join('\n')}` : '', g.next.length ? `Дальше:\n${g.next.map((t: any) => line(d, t, false)).join('\n')}` : ''].filter(Boolean).join('\n\n') })).sort((a, b) => Number(!a.url) - Number(!b.url));
}

// ===== Изменение задач (та же логика, что в панели) =====
async function setStatus(d: any, t: any, kind: string, day: string) {
  const now = new Date().toISOString();
  if (kind === 'tom') { await patch('tasks', `id=eq.${t.id}`, { date: nextWorkday(day), updated_at: now }); return; }
  if (kind === 'doing') { await patch('tasks', `id=eq.${t.id}`, { status: 'doing', done_at: null, updated_at: now }); return; }
  // Готово. Повторяющаяся задача: выполненная копия в историю, сама — на следующий день повтора
  if (Array.isArray(t.repeat) && t.repeat.length) {
    const copy = { ...t, id: crypto.randomUUID(), repeat: null, series_id: t.id, status: 'done', done_at: now, date: day, created_at: now, updated_at: now };
    await upsert('tasks', copy, 'id');
    const after = t.date && t.date > day ? addDays(t.date, 1) : addDays(day, 1);
    await patch('tasks', `id=eq.${t.id}`, { date: nextOcc(t.repeat, after), status: 'todo', done_at: null, updated_at: now });
    return;
  }
  await patch('tasks', `id=eq.${t.id}`, { status: 'done', done_at: now, updated_at: now });
}

// ===== Экраны =====
function card(d: any, st: any) {
  const id = st.queue[st.idx];
  const t = d.tasks.find((x: any) => x.id === id);
  const total = st.queue.length;
  const statusNow = t.status === 'doing' ? 'сейчас: в работе' : t.date && t.date < st.day ? 'перенесена с прошлых дней' : 'на сегодня';
  const text = `<b>${st.idx + 1}/${total} · ${esc(projOf(d, t).name)}</b>\n${esc(t.title)}\n<i>${statusNow}</i>${t.comment ? `\n💬 ${esc(t.comment)}` : ''}`;
  const kb = { inline_keyboard: [
    [{ text: '✅ Готово', callback_data: `s:done:${id}` }, { text: '🔄 В работе', callback_data: `s:doing:${id}` }],
    [{ text: '➡️ На завтра', callback_data: `s:tom:${id}` }, { text: '💬 Комментарий', callback_data: `c:${id}` }],
    [{ text: 'Пропустить', callback_data: `skip:${id}` }]
  ] };
  return { text, kb };
}

async function showNext(chat: number, d: any, st: any, fresh = false) {
  // пропускаем задачи, которые успели удалить
  while (st.idx < st.queue.length && !d.tasks.find((x: any) => x.id === st.queue[st.idx])) st.idx++;
  if (st.idx >= st.queue.length) {
    if (st.msgId && !fresh) await edit(chat, st.msgId, `✅ Статусы обновлены (${st.queue.length}).`);
    return finish(chat, st);
  }
  const { text, kb } = card(d, st);
  if (st.msgId && !fresh) await edit(chat, st.msgId, text, kb);
  else { const m = await send(chat, text, kb); st.msgId = m && m.message_id; }
  await saveState(chat, st);
}

async function finish(chat: number, st: any) {
  const d = await load();
  st.phase = 'chats'; st.msgId = null; st.awaiting = null; st.lastPing = Date.now();
  await send(chat, `📋 <b>Отчёт за день</b> — нажми на текст, чтобы скопировать:\n<pre>${esc(reportText(d, st.day))}</pre>`);
  const groups = chatGroups(d, st.day);
  for (const g of groups) {
    if (!g.text) continue;
    const head = g.url ? `💬 <b>${esc(g.title)}</b>` : `💬 <b>${esc(g.title)}</b> <i>(ссылки на чат нет — можно добавить в настройках проекта)</i>`;
    await send(chat, `${head}\n<pre>${esc(g.text)}</pre>`, g.url ? { inline_keyboard: [[{ text: 'Открыть чат в Битриксе ↗', url: g.url }]] } : undefined);
  }
  await upsert('daily_reports', { user_id: OWNER(), day: st.day, status: 'pending', updated_at: new Date().toISOString() }, 'user_id,day');
  await send(chat, groups.length ? 'Как отправишь всё в чаты — нажми кнопку, и я отстану до завтра 🌊' : 'По рабочим задачам сегодня отправлять нечего. Отметить, что отчиталась?', { inline_keyboard: [[{ text: '✅ Отчиталась', callback_data: 'rep' }], [{ text: 'Открыть панель', url: PANEL() + '#tasks' }]] });
  await saveState(chat, st);
}

async function start(chat: number, manual = false) {
  const day = ymd(new Date());
  const d = await load();
  const rep = d.reports.find((r: any) => r.day === day);
  if (rep && rep.status === 'reported' && !manual) return;
  const queue = askList(d, day).map((t: any) => t.id);
  const st = { day, queue, idx: 0, phase: 'statuses', msgId: null, awaiting: null, lastPing: Date.now() };
  await send(chat, queue.length ? `Марина, закрываем день 🌊\nРабочих задач без итога: <b>${queue.length}</b>. Пройдёмся по ним — по кнопке на каждую.` : 'Марина, закрываем день 🌊\nВсе рабочие задачи уже с итогом — сразу к отчёту.');
  if (!queue.length) return finish(chat, st);
  return showNext(chat, d, st, true);
}

async function remind(chat: number) {
  const now = new Date();
  const day = ymd(now);
  const { state } = await getState();
  const d = await load();
  const rep = d.reports.find((r: any) => r.day === day);
  if (rep && rep.status === 'reported') return;
  const t = hm(now);
  if (t < '17:35' || t > '19:20') return;
  if (state.day !== day) return start(chat);
  if (state.lastPing && Date.now() - state.lastPing < 25 * 60 * 1000) return;
  state.lastPing = Date.now();
  const kb = state.phase === 'statuses'
    ? { inline_keyboard: [[{ text: '▶️ Продолжить статусы', callback_data: 'cont' }]] }
    : { inline_keyboard: [[{ text: '✅ Отчиталась', callback_data: 'rep' }], [{ text: '📋 Прислать отчёт ещё раз', callback_data: 'again' }]] };
  await send(chat, state.phase === 'statuses' ? '⏰ Марина, статусы задач ещё не обновлены.' : '⏰ Марина, отчёт по задачам ещё не отправлен в чаты Битрикса.', kb);
  await saveState(chat, state);
}

// ===== Входящие от Telegram =====
async function onUpdate(u: any) {
  const { chat_id, state } = await getState();
  const msg = u.message;
  const cb = u.callback_query;
  const from = msg ? msg.chat.id : cb ? cb.message.chat.id : null;
  if (!from) return;

  // Привязка: /start BOT_SECRET (по ссылке t.me/бот?start=...)
  if (msg && typeof msg.text === 'string' && msg.text.startsWith('/start')) {
    const code = msg.text.split(' ')[1] || '';
    if (code === SECRET()) { await saveState(from, chat_id === from ? state : {}); await send(from, 'Привет, Марина! Я буду приходить по будням в 17:10 закрывать день 🌊\n\nКоманды:\n/report — пройти статусы и отчёт прямо сейчас\n/help — что я умею'); }
    else if (from !== chat_id) await send(from, 'Это личный бот. Доступ закрыт.');
    return;
  }
  if (from !== chat_id) { if (cb) await tg('answerCallbackQuery', { callback_query_id: cb.id }); return; }   // чужим не отвечаем

  if (msg && typeof msg.text === 'string') {
    const text = msg.text.trim();
    if (text === '/report' || /^отч[её]т$/i.test(text)) return start(from, true);
    if (text === '/help') return send(from, 'Каждый будний день в 17:10 я показываю рабочие задачи по одной: отметь статус, при желании добавь комментарий. Потом пришлю готовый отчёт и тексты для чатов Битрикса со ссылками. Напоминаю каждые полчаса до 19:00, пока не нажмёшь «Отчиталась».\n\n/report — начать сейчас');
    if (state.awaiting) {
      const id = state.awaiting; state.awaiting = null;
      await patch('tasks', `id=eq.${id}`, { comment: text, updated_at: new Date().toISOString() });
      await send(from, '💬 Комментарий сохранён.');
      const d = await load();
      state.msgId = null;
      return showNext(from, d, state, true);
    }
    return send(from, 'Напиши /report, чтобы пройти статусы и получить отчёт.');
  }

  if (cb) {
    const data = String(cb.data || '');
    await tg('answerCallbackQuery', { callback_query_id: cb.id });
    if (data === 'rep') {
      const day = state.day || ymd(new Date());
      await upsert('daily_reports', { user_id: OWNER(), day, status: 'reported', reported_at: new Date().toISOString(), updated_at: new Date().toISOString() }, 'user_id,day');
      state.phase = 'done'; await saveState(from, state);
      await edit(from, cb.message.message_id, '✅ Отчиталась — отлично, Марина! До завтра 🌊');
      return;
    }
    if (data === 'again') return finish(from, state);
    if (data === 'cont') { const d = await load(); state.msgId = null; return showNext(from, d, state, true); }
    const [kind, a, b] = data.split(':');
    const id = kind === 's' ? b : a;
    if (!state.queue || state.queue[state.idx] !== id) { await send(from, 'Эта карточка уже неактуальна. /report — начать заново.'); return; }
    const d = await load();
    const t = d.tasks.find((x: any) => x.id === id);
    if (kind === 'c') { state.awaiting = id; await saveState(from, state); await send(from, `Напиши комментарий к «${esc(t ? t.title : 'задаче')}» одним сообщением:`, { force_reply: true, input_field_placeholder: 'Например: жду правки от клиента' }); return; }
    if (kind === 's' && t) await setStatus(d, t, a, state.day);
    state.msgId = cb.message.message_id;
    state.idx++;
    return showNext(from, await load(), state);
  }
}

// ===== Точка входа =====
export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  try {
    if (url.searchParams.has('setup')) {
      if (url.searchParams.get('setup') !== SECRET()) return new Response('forbidden', { status: 403 });
      const hook = `${SB()}/functions/v1/day-bot`;
      const r = await tg('setWebhook', { url: hook, secret_token: SECRET(), allowed_updates: ['message', 'callback_query'] });
      await tg('setMyCommands', { commands: [{ command: 'report', description: 'Статусы и отчёт сейчас' }, { command: 'help', description: 'Что умеет бот' }] });
      const me = await tg('getMe', {});
      const link = me ? `https://t.me/${me.username}?start=${SECRET()}` : '';
      return new Response(r ? `Готово! Вебхук подключён.\n\nТеперь открой эту ссылку на телефоне и нажми «Start»:\n${link}` : 'Не получилось подключить вебхук — проверь TELEGRAM_BOT_TOKEN.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const cron = url.searchParams.get('cron');
    if (cron) {
      if (req.headers.get('x-cron-key') !== SECRET()) return new Response('forbidden', { status: 403 });
      const { chat_id } = await getState();
      if (!chat_id) return new Response('no chat');
      const wd = isoWd(ymd(new Date()));
      if (wd <= 5) { if (cron === 'start') await start(chat_id); else await remind(chat_id); }
      return new Response('ok');
    }
    if (req.method === 'POST') {
      if (req.headers.get('x-telegram-bot-api-secret-token') !== SECRET()) return new Response('forbidden', { status: 403 });
      await onUpdate(await req.json());
      return new Response('ok');
    }
    return new Response('day-bot');
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 200 });   // Telegram не должен повторять запрос бесконечно
  }
}

if ((globalThis as any).Deno?.serve) (globalThis as any).Deno.serve(handle);
