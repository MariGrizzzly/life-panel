
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
-- Аккаунт в проекте один, поэтому берём первого пользователя. Повторный запуск ничего не задвоит.
insert into billiards (user_id, day, drills)
select u.id, v.day::date, v.drills
from (select id from auth.users order by created_at limit 1) u,
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
