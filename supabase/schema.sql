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
