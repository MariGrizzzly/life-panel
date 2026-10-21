-- ===== Шаг 5: отчётность — ссылки на чаты Битрикса, комментарии, отметка «отчиталась» =====
alter table projects add column if not exists bitrix_url text;
alter table tasks add column if not exists bitrix_url text;
alter table tasks add column if not exists comment text;
alter table tasks add column if not exists repeat jsonb;
alter table tasks add column if not exists series_id uuid;

create table if not exists daily_reports (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  status text not null default 'pending',
  reported_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table daily_reports enable row level security;
drop policy if exists own_rows on daily_reports;
create policy own_rows on daily_reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Память Telegram-бота (какая задача сейчас на экране, ждёт ли он комментарий).
-- Политик нет специально: читать и писать её может только сам бот на сервере.
create table if not exists bot_state (
  user_id uuid primary key references auth.users on delete cascade,
  chat_id bigint,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table bot_state enable row level security;
