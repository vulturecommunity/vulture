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
    url := 'https://mlajeudfsjymgaxjofya.supabase.co/functions/v1/atualizar-calendario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYWpldWRmc2p5bWdheGpvZnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzIzNDAsImV4cCI6MjEwNjM0ODM0MH0.5pyZz-AlrKzIH8SvnWJjK9NYg8ueauBj9uBIlYSZGto'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para conferir: select * from cron.job_run_details order by start_time desc limit 5;
--                select * from public.calendario_estado;
