-- Расписание Telegram-бота. Перед запуском замени ТВОЙ_СЕКРЕТ (2 места) на то же слово, что в секрете BOT_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- если запускаешь повторно — убираем старые задания
select cron.unschedule(jobname) from cron.job where jobname in ('day-bot-start', 'day-bot-remind');

-- По будням в 17:10 по Москве (14:10 UTC): статусы и отчёт
select cron.schedule('day-bot-start', '10 14 * * 1-5', $$
  select net.http_post(
    url := 'https://aloyskiuetajsycmldhi.supabase.co/functions/v1/day-bot?cron=start',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'ТВОЙ_СЕКРЕТ'),
    body := '{}'::jsonb)
$$);

-- Напоминания каждые полчаса до 19:10, пока не нажмёшь «Отчиталась»
select cron.schedule('day-bot-remind', '10,40 14-16 * * 1-5', $$
  select net.http_post(
    url := 'https://aloyskiuetajsycmldhi.supabase.co/functions/v1/day-bot?cron=remind',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'ТВОЙ_СЕКРЕТ'),
    body := '{}'::jsonb)
$$);

select jobname, schedule from cron.job where jobname like 'day-bot%';
