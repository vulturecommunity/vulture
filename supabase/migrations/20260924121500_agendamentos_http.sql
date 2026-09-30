-- =====================================================================================
-- Agenda as Edge Functions de manutenção (pg_cron + pg_net).
-- Aplicado pela migration de mesmo nome.
-- duplicar o agendamento.
--
--   supabase functions deploy enviar-pushes
--   supabase functions deploy limpar-arquivos
--   supabase functions deploy placar --no-verify-jwt
--
-- Os jobs de SQL puro (apuração do ranking, contadores, matviews, retenção, fechamento do
-- mês) já são criados pela migration 20260924120900_agendamentos.sql — estes aqui são só
-- os que precisam sair para a internet.
--
-- A chave usada abaixo é a anon (pública, a mesma que já vai dentro do app); quem tem
-- privilégio de verdade é a service role, que só existe dentro da função.
-- =====================================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Worker da fila de push. Cada execução entrega até 6 000 avisos; o que sobrar fica na
-- fila para o minuto seguinte, então um fan-out de milhões escoa sozinho sem timeout.
select public.agendar(
  'enviar-pushes',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://mlajeudfsjymgaxjofya.supabase.co/functions/v1/enviar-pushes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYWpldWRmc2p5bWdheGpvZnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzIzNDAsImV4cCI6MjEwNjM0ODM0MH0.5pyZz-AlrKzIH8SvnWJjK9NYg8ueauBj9uBIlYSZGto'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Arquivos de rasantes vencidos. Roda antes da limpeza em SQL (04:17), porque o SQL só
-- apaga a linha e é o arquivo no Storage que custa dinheiro.
select public.agendar(
  'limpar-arquivos',
  '5 4 * * *',
  $$
  select net.http_post(
    url := 'https://mlajeudfsjymgaxjofya.supabase.co/functions/v1/limpar-arquivos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYWpldWRmc2p5bWdheGpvZnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzIzNDAsImV4cCI6MjEwNjM0ODM0MH0.5pyZz-AlrKzIH8SvnWJjK9NYg8ueauBj9uBIlYSZGto'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para conferir:
--   select jobname, schedule, active from cron.job order by jobname;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select count(*) from public.push_pendente where enviado_em is null;  -- fila parada?
