-- Схема базы для «Моей панели» (Supabase / Postgres).
-- Запускается один раз: Supabase → SQL Editor → вставить → Run.
-- Каждая строка принадлежит пользователю; правила RLS не дают видеть чужое.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  user_id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  sphere text not null check (sphere in ('work', 'personal')),
  color text not null default '#14629E',
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  title text not null,
  date date,
  time text not null default '',
  deadline date,
  tags text[] not null default '{}',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_date on tasks (user_id, date);

create table if not exists tags (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  primary key (user_id, name)
);

create table if not exists inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists habit_log (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  habit_id uuid not null references habits on delete cascade,
  day date not null,
  primary key (habit_id, day)
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  date date not null,
  time text not null default '',
  cat text not null default 'personal',
  created_at timestamptz not null default now()
);

-- Доступ: только свои строки
do $$
declare t text;
begin
  foreach t in array array['profiles','projects','tasks','tags','inbox','habits','habit_log','events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ===== Шаг 2: дневник, фото дня и «Мои тексты» =====
alter table profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

create table if not exists diary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  text text not null default '',
  mood int,
  sleep numeric,
  energy int,
  answers jsonb not null default '[]'::jsonb,
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
alter table diary enable row level security;
drop policy if exists own_rows on diary;
create policy own_rows on diary for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Приватная папка для фото: каждый видит только свою подпапку
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists "photos own" on storage.objects;
create policy "photos own" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Шаг 3: спорт и бильярд =====
create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  duration int,
  coach boolean not null default false,
  exercises jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table workouts enable row level security;
drop policy if exists own_rows on workouts;
create policy own_rows on workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists billiards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  drills jsonb not null default '[]'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table billiards enable row level security;
drop policy if exists own_rows on billiards;
create policy own_rows on billiards for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Перенос бильярдной статистики Марины из таблицы (февраль–март 2026).
-- Берём аккаунт, у которого есть профиль (твой). Повторный запуск ничего не задвоит.
insert into billiards (user_id, day, drills)
select u.id, v.day::date, v.drills
from (select user_id as id from profiles order by user_id limit 1) u,
(values
  ('2026-02-02', '[{"name": "Прямой в угол", "hits": 5, "attempts": 6}, {"name": "Свояк в центр (слева)", "hits": 2, "attempts": 9}, {"name": "Свояк в центр (справа)", "hits": 5, "attempts": 8}, {"name": "Чужой в центр", "hits": 5, "attempts": 8}, {"name": "Свояк в центр из угла", "hits": 5, "attempts": 22}]'::jsonb),
  ('2026-02-12', '[{"name": "Прямой в центр", "hits": 6, "attempts": 11}, {"name": "Свояк в центр (слева)", "hits": 7, "attempts": 12}, {"name": "Чужой в центр", "hits": 8, "attempts": 13}, {"name": "Свояк в центр из угла", "hits": 5, "attempts": 8}]'::jsonb),
  ('2026-02-17', '[{"name": "Прямой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр (слева)", "hits": 4, "attempts": 13}, {"name": "Свояк в центр (справа)", "hits": 5, "attempts": 10}, {"name": "Чужой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр из угла", "hits": 5, "attempts": 8}]'::jsonb),
  ('2026-02-25', '[{"name": "Прямой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр (слева)", "hits": 5, "attempts": 6}, {"name": "Свояк в центр (справа)", "hits": 6, "attempts": 14}, {"name": "Чужой в центр", "hits": 7, "attempts": 8}, {"name": "Свояк в центр из угла", "hits": 5, "attempts": 7}]'::jsonb),
  ('2026-02-27', '[{"name": "Прямой в центр", "hits": 7, "attempts": 7}, {"name": "Свояк в центр (слева)", "hits": 7, "attempts": 9}, {"name": "Свояк в центр (справа)", "hits": 8, "attempts": 17}, {"name": "Чужой в центр", "hits": 9, "attempts": 21}, {"name": "Свояк в центр из угла", "hits": 7, "attempts": 10}]'::jsonb),
  ('2026-03-02', '[{"name": "Прямой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр (слева)", "hits": 0, "attempts": 16}, {"name": "Свояк в центр (справа)", "hits": 10, "attempts": 20}, {"name": "Чужой в центр", "hits": 6, "attempts": 6}, {"name": "Свояк в центр из угла", "hits": 4, "attempts": 6}]'::jsonb),
  ('2026-03-04', '[{"name": "Прямой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр (слева)", "hits": 5, "attempts": 12}, {"name": "Свояк в центр (справа)", "hits": 5, "attempts": 5}]'::jsonb),
  ('2026-03-07', '[{"name": "Прямой в центр", "hits": 10, "attempts": 10}, {"name": "Свояк в центр (слева)", "hits": 5, "attempts": 5}, {"name": "Свояк в центр (справа)", "hits": 10, "attempts": 10}, {"name": "Чужой в центр", "hits": 5, "attempts": 6}, {"name": "Свояк в центр из угла", "hits": 5, "attempts": 10}, {"name": "Свой в угол около борта", "hits": 6, "attempts": 10}]'::jsonb),
  ('2026-03-09', '[{"name": "Прямой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр (слева)", "hits": 10, "attempts": 14}, {"name": "Свояк в центр (справа)", "hits": 10, "attempts": 21}, {"name": "Чужой в центр", "hits": 5, "attempts": 5}, {"name": "Свояк в центр из угла", "hits": 5, "attempts": 7}, {"name": "Свой в угол около борта", "hits": 5, "attempts": 8}]'::jsonb)
) as v(day, drills)
where not exists (select 1 from billiards b where b.user_id = u.id and b.day = v.day::date);


-- ===== Шаг 4: повторяющиеся задачи + тренировка с выходных =====
alter table tasks add column if not exists repeat jsonb;
alter table tasks add column if not exists series_id uuid;

-- Тренировка 10 октября (суббота). Если за этот день тренировка уже есть — ничего не добавится.
insert into workouts (user_id, day, exercises)
select u.id, date '2026-10-10', '[{"name": "Жим ногами", "sets": [{"w": 20, "r": null, "d": []}], "note": "М: 20 кг + ~35 кг", "delta": null}, {"name": "Ягодичный мостик", "sets": [{"w": 5, "r": null, "d": []}, {"w": 15, "r": null, "d": []}, {"w": 15, "r": null, "d": []}], "note": "", "delta": null}, {"name": "Тяга румынская с гантелями", "sets": [{"w": 10, "r": null, "d": []}, {"w": 10, "r": null, "d": []}, {"w": 10, "r": null, "d": []}], "note": "", "delta": null}, {"name": "Разведение ног", "sets": [{"w": 40, "r": 15, "d": [{"w": 35, "r": 10}, {"w": 30, "r": null}]}], "note": "градациями: 40/35/30", "delta": null}, {"name": "Отжимания", "sets": [{"w": null, "r": "10-15", "d": []}, {"w": null, "r": "10-15", "d": []}, {"w": null, "r": "10-15", "d": []}], "note": "", "delta": null}, {"name": "Подъём на икры", "sets": [{"w": null, "r": 25, "d": []}, {"w": null, "r": 25, "d": []}, {"w": null, "r": 25, "d": []}, {"w": 10, "r": null, "d": []}], "note": "", "delta": null}]'::jsonb
from (select user_id as id from profiles order by user_id limit 1) u
where not exists (select 1 from workouts w where w.user_id = u.id and w.day = date '2026-10-10');
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
