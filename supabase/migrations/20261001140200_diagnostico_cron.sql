-- =====================================================================================
-- DIAGNÓSTICO TEMPORÁRIO — por que o schema cron já pesa ~3 MB com 1 dia de uso
--
-- Função de uma vez só, para decidir se job_run_details precisa de limpeza periódica ou
-- se o peso é só catálogo da extensão. Revogada do público como as outras.
-- =====================================================================================

create or replace function public.diagnostico_cron()
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  qtd_execucoes bigint;
  mais_antiga timestamptz;
  mais_recente timestamptz;
  qtd_jobs integer;
  versao text;
begin
  select count(*), min(start_time), max(start_time) into qtd_execucoes, mais_antiga, mais_recente
    from cron.job_run_details;
  select count(*) into qtd_jobs from cron.job;
  select extversion into versao from pg_extension where extname = 'pg_cron';

  return jsonb_build_object(
    'versaoPgCron', versao,
    'jobsAgendados', qtd_jobs,
    'execucoesRegistradas', qtd_execucoes,
    'primeiraExecucao', mais_antiga,
    'ultimaExecucao', mais_recente,
    'tamanhoJobRunDetails', pg_size_pretty(pg_total_relation_size('cron.job_run_details'))
  );
end;
$$;

revoke execute on function public.diagnostico_cron() from public, anon, authenticated;
