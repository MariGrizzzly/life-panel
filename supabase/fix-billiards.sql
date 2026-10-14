-- ===== Исправление: бильярд попал не в тот аккаунт + шаг 4 =====
-- В проекте оказалось два аккаунта: твой и старый пустой. Статистика ушла в старый — переносим к тебе.
update billiards set user_id = '8155a58c-5f8b-4284-a4f9-8f7037d4522e' where user_id = '8e3f96ce-a162-492f-b55a-9ecccbfc98be';

-- Повторяющиеся задачи (шаг 4)
alter table tasks add column if not exists repeat jsonb;
alter table tasks add column if not exists series_id uuid;

-- Тренировка 10 октября (если за этот день ещё нет)
insert into workouts (user_id, day, exercises)
select '8155a58c-5f8b-4284-a4f9-8f7037d4522e', date '2026-10-10', '[{"name": "Жим ногами", "sets": [{"w": 20, "r": null, "d": []}], "note": "М: 20 кг + ~35 кг", "delta": null}, {"name": "Ягодичный мостик", "sets": [{"w": 5, "r": null, "d": []}, {"w": 15, "r": null, "d": []}, {"w": 15, "r": null, "d": []}], "note": "", "delta": null}, {"name": "Тяга румынская с гантелями", "sets": [{"w": 10, "r": null, "d": []}, {"w": 10, "r": null, "d": []}, {"w": 10, "r": null, "d": []}], "note": "", "delta": null}, {"name": "Разведение ног", "sets": [{"w": 40, "r": 15, "d": [{"w": 35, "r": 10}, {"w": 30, "r": null}]}], "note": "градациями: 40/35/30", "delta": null}, {"name": "Отжимания", "sets": [{"w": null, "r": "10-15", "d": []}, {"w": null, "r": "10-15", "d": []}, {"w": null, "r": "10-15", "d": []}], "note": "", "delta": null}, {"name": "Подъём на икры", "sets": [{"w": null, "r": 25, "d": []}, {"w": null, "r": 25, "d": []}, {"w": null, "r": 25, "d": []}, {"w": 10, "r": null, "d": []}], "note": "", "delta": null}]'::jsonb
where not exists (select 1 from workouts w where w.user_id = '8155a58c-5f8b-4284-a4f9-8f7037d4522e' and w.day = date '2026-10-10');

-- Проверка: должно показать 9 тренировок по бильярду
select count(*) as billiards_rows from billiards where user_id = '8155a58c-5f8b-4284-a4f9-8f7037d4522e';
