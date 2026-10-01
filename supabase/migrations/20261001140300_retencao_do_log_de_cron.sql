-- =====================================================================================
-- RETENÇÃO DO LOG DE CRON — achado medindo "o que ocupa o banco" para o painel de custos
--
-- cron.job_run_details guarda uma linha por execução de CADA job agendado, para sempre —
-- o pg_cron não limpa sozinho. Este projeto tem 13 jobs, vários de minuto em minuto.
-- Medido direto no projeto: 7.979 linhas em menos de 1 dia de uso, 2,64 MB. Nesse ritmo,
-- um mês inteiro passaria de 70 MB só de log de cron — maior que qualquer tabela de
-- conteúdo do app, crescendo sozinho, sem relação nenhuma com usuário ou uso real.
--
-- É o mesmo problema que `limpar_dados_antigos()` já resolve para notificação, rasante e
-- fila de push — só que essa tabela é do pg_cron, não do schema `public`. Entra na mesma
-- função e no mesmo agendamento, em vez de virar uma rotina paralela.
-- =====================================================================================

-- `create or replace` não troca o tipo de retorno de uma função existente (SQLSTATE
-- 42P13); como a coluna nova muda o formato da tabela devolvida, a função precisa ser
-- recriada do zero
drop function if exists public.limpar_dados_antigos();

create function public.limpar_dados_antigos()
returns table (
  notificacoes integer,
  rasantes integer,
  mensagens_live integer,
  pushes integer,
  execucoes_de_cron integer
)
language plpgsql
security definer set search_path = public
as $$
declare
  n integer; r integer; m integer; p integer; c integer;
begin
  -- notificações lidas com mais de 30 dias e qualquer uma com mais de 90
  delete from public.notifications
   where (lida and criado_em < now() - interval '30 days')
      or criado_em < now() - interval '90 days';
  get diagnostics n = row_count;

  -- rasantes vencidos há mais de 7 dias (a Edge Function apaga os arquivos antes)
  delete from public.rasantes where expira_em < now() - interval '7 days';
  get diagnostics r = row_count;

  -- chat de lives encerradas há mais de 30 dias
  delete from public.live_messages lm
   using public.live_streams ls
   where ls.id = lm.live_id
     and not ls.ativa
     and coalesce(ls.encerrada_em, ls.iniciada_em) < now() - interval '30 days';
  get diagnostics m = row_count;

  -- fila de push já entregue
  delete from public.push_pendente
   where (enviado_em is not null and enviado_em < now() - interval '3 days')
      or (tentativas >= 5 and criado_em < now() - interval '1 day');
  get diagnostics p = row_count;

  -- histórico de execução de cron: 3 dias bastam para depurar um job com problema;
  -- manter mais que isso só acumula peso sem nenhum uso prático
  delete from cron.job_run_details where end_time < now() - interval '3 days';
  get diagnostics c = row_count;

  return query select n, r, m, p, c;
end;
$$;

revoke execute on function public.limpar_dados_antigos() from public, anon, authenticated;

-- a função já estava agendada; só o corpo mudou, não precisa reagendar

-- -------------------------------------------------------------------------------------
-- Autoteste: confirma que a função ainda roda e que o parâmetro novo não quebrou nada
-- -------------------------------------------------------------------------------------

do $$
declare resultado record;
begin
  select * into resultado from public.limpar_dados_antigos();
  if resultado.execucoes_de_cron is null then
    raise exception 'limpar_dados_antigos() nao devolveu a contagem de execucoes de cron';
  end if;
  raise notice 'autoteste da retencao do log de cron: OK (% execucoes antigas removidas)',
    resultado.execucoes_de_cron;
end $$;

-- -------------------------------------------------------------------------------------
-- Limpeza imediata: por que esperar o próximo disparo do cron de manutenção para colher
-- o espaço que já sabemos que está sobrando
-- -------------------------------------------------------------------------------------

select public.limpar_dados_antigos();

-- -------------------------------------------------------------------------------------
-- Diagnóstico de uma vez: já respondeu, não precisa mais existir
-- -------------------------------------------------------------------------------------

drop function if exists public.diagnostico_cron();
