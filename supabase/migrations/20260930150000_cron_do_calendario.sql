-- =====================================================================================
-- CALENDÁRIO DO FLAMENGO — agendamento agora versionado
--
-- O agendamento vivia só em supabase/cron-calendario.sql, um arquivo avulso que precisava
-- ser colado à mão no SQL Editor. Ao migrar para um projeto novo ele passou batido, e o
-- resultado foi a tabela public.partidas vazia: nenhum jogo na Arquibancada, nenhum
-- placar, nenhum palpite possível — sem erro em lugar nenhum, o que é o pior tipo de
-- falha.
--
-- Trazer para cá resolve a classe inteira do problema: `supabase db push` num banco novo
-- passa a deixar o calendário funcionando sozinho.
--
-- A função decide sozinha quando gastar consulta na Highlightly (a cada ~3 h sem jogo, a
-- cada ~3 min com jogo rolando) e nunca passa de 95 por dia, então rodar de 3 em 3 minutos
-- não consome a cota gratuita da API.
-- =====================================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select public.agendar(
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

-- -------------------------------------------------------------------------------------
-- Autoteste: o job existe e está ativo?
-- -------------------------------------------------------------------------------------

do $$
declare
  ativo boolean;
begin
  select j.active into ativo from cron.job j where j.jobname = 'atualizar-calendario';
  if ativo is null then
    raise exception 'o job atualizar-calendario nao foi criado';
  end if;
  if not ativo then
    raise exception 'o job atualizar-calendario existe mas esta inativo';
  end if;
  raise notice 'autoteste do cron do calendario: OK (job ativo)';
end $$;
