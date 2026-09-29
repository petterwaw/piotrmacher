-- =====================================================================
-- Replace Vercel Cron (needs the Pro plan) with Supabase pg_cron + pg_net:
-- every 5 minutes the database calls GET {app_base_url}/api/internal/tick.
--
-- One-time setup BEFORE running this file (SQL editor, not committed):
--   select vault.create_secret('https://<your-domain>', 'app_base_url');
--   select vault.create_secret('<same value as CRON_SECRET on Vercel>', 'cron_secret');
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule() with an existing job name updates that job in place.
select cron.schedule(
  'app-tick',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url') || '/api/internal/tick',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Useful checks:
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, left(content::text, 300) from net._http_response order by created desc limit 10;
