-- =====================================================================================
-- Agenda a Edge Function "atualizar-calendario" a cada 3 minutos (pg_cron + pg_net).
-- Rode UMA vez no SQL Editor, depois de fazer o deploy da função. Pode rodar de novo sem
-- duplicar o agendamento.
--
-- A função decide sozinha quando gastar consulta na Highlightly (a cada 3 h sem jogo,
-- a cada ~3 min com jogo rolando) e nunca passa de 95 por dia.
-- A chave usada abaixo é a anon (pública, a mesma que já vai dentro do app).
-- =====================================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'atualizar-calendario';

select cron.schedule(
  'atualizar-calendario',
  '*/3 * * * *',
  $$
  select net.http_post(
    url := 'https://vcajpsizbjcblyufuclh.supabase.co/functions/v1/atualizar-calendario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjYWpwc2l6YmpjYmx5dWZ1Y2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MzgxMzMsImV4cCI6MjEwNTUxNDEzM30.AwiOMda5MAmm5A04toYsfy06P3HwZRyOBBm_sGGUgPc'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para conferir: select * from cron.job_run_details order by start_time desc limit 5;
--                select * from public.calendario_estado;
