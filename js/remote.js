// Связь с Supabase: вход по почте и паролю, чтение и запись таблиц.
// Без внешних библиотек — обычные запросы к API Supabase.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SESSION_KEY = 'lifepanel:session';
let session = null;
const authListeners = new Set();

function readSession() {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function writeSession(s) {
  session = s;
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* хранилище недоступно */ }
  authListeners.forEach((fn) => fn(s));
}
function fromTokenResponse(r) {
  return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at || Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: r.user ? { id: r.user.id, email: r.user.email } : (session && session.user) };
}

export class RemoteError extends Error {
  constructor(message, status, offline = false) { super(message); this.status = status; this.offline = offline; }
}

const AUTH_ERRORS = {
  invalid_credentials: 'Неверная почта или пароль',
  email_not_confirmed: 'Почта ещё не подтверждена — открой письмо от Supabase и нажми ссылку',
  user_already_exists: 'Аккаунт с этой почтой уже есть — нажми «Войти»',
  weak_password: 'Пароль слишком простой — нужно минимум 6 символов',
  signup_disabled: 'Регистрация закрыта — войди в существующий аккаунт',
  over_email_send_rate_limit: 'Слишком много писем подряд — подожди минуту и попробуй снова',
  same_password: 'Новый пароль совпадает со старым'
};

async function call(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { apikey: SUPABASE_KEY, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth) {
    await ensureFresh();
    if (session) h.Authorization = 'Bearer ' + session.access_token;
  }
  let res;
  try {
    res = await fetch(SUPABASE_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) {
    throw new RemoteError('Нет связи с сервером', 0, true);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    if (res.status === 401 && auth && session) { writeSession(null); }
    const code = data && (data.error_code || data.code || data.error);
    const msg = (code && AUTH_ERRORS[code]) || (data && (data.msg || data.message || data.error_description)) || ('Ошибка сервера ' + res.status);
    throw new RemoteError(msg, res.status);
  }
  return data;
}

let refreshing = null;
async function ensureFresh() {
  if (!session) return;
  if (session.expires_at - 60 > Date.now() / 1000) return;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false });
        writeSession(fromTokenResponse(r));
      } catch (e) {
        if (!e.offline) writeSession(null);
        throw e;
      } finally { refreshing = null; }
    })();
  }
  return refreshing;
}

// ===== Вход =====
export const auth = {
  init() {
    session = readSession();
    // Ссылки из писем Supabase приходят с данными входа после «#»
    const h = location.hash.replace(/^#/, '');
    if (h.includes('access_token=') || h.includes('error_description=')) {
      const p = new URLSearchParams(h);
      history.replaceState(null, '', location.pathname + location.search + '#today');
      if (p.get('error_description')) return { linkError: p.get('error_description').replace(/\+/g, ' ') };
      writeSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: Number(p.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(p.get('expires_in') || 3600), user: null });
      return { linkType: p.get('type') || '' };
    }
    return {};
  },
  session: () => session,
  user: () => (session && session.user) || null,
  onChange(fn) { authListeners.add(fn); return () => authListeners.delete(fn); },
  async loadUser() {
    const u = await call('/auth/v1/user');
    writeSession({ ...session, user: { id: u.id, email: u.email } });
    return session.user;
  },
  async signIn(email, password) {
    const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
    writeSession(fromTokenResponse(r));
    return session.user;
  },
  async signUp(email, password) {
    const redirect = location.origin + location.pathname;
    const r = await call('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email, password }, auth: false });
    if (r && r.access_token) { writeSession(fromTokenResponse(r)); return { signedIn: true }; }
    return { signedIn: false };
  },
  async resetPassword(email) {
    const redirect = location.origin + location.pathname;
    await call('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email }, auth: false });
  },
  async setPassword(password) {
    await call('/auth/v1/user', { method: 'PUT', body: { password } });
  },
  async signOut() {
    try { await call('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* выходим локально в любом случае */ }
    writeSession(null);
  }
};

// ===== Таблицы =====
export const db = {
  select(table, query = 'select=*') { return call(`/rest/v1/${table}?${query}`); },
  upsert(table, rows, onConflict) {
    const q = onConflict ? `?on_conflict=${onConflict}` : '';
    return call(`/rest/v1/${table}${q}`, { method: 'POST', body: Array.isArray(rows) ? rows : [rows], headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  },
  remove(table, match) {
    const q = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    return call(`/rest/v1/${table}?${q}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
};
