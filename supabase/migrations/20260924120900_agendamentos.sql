-- =====================================================================================
-- AGENDAMENTOS (pg_cron)
--
-- Tudo que este pacote tirou do caminho crítico precisa de alguém para executar depois.
-- É aqui. São todos jobs de SQL puro; o que precisa de HTTP (worker de push e limpeza de
-- arquivos no Storage) fica em supabase/cron-manutencao.sql, junto com a URL do projeto.
-- =====================================================================================

create extension if not exists pg_cron;

/** Agenda idempotente: reagendar não duplica. */
create or replace function public.agendar(p_nome text, p_quando text, p_sql text)
returns void
language plpgsql
as $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = p_nome;
  perform cron.schedule(p_nome, p_quando, p_sql);
end;
$$;

do $$
begin
  -- Contadores: quanto mais curto, menos o número fica atrasado. pg_cron 1.5+ aceita
  -- intervalo em segundos; se a versão for mais antiga, cai para de minuto em minuto.
  begin
    perform public.agendar('consolidar-contadores', '30 seconds',
                           'select public.consolidar_contadores();');
  exception when others then
    perform public.agendar('consolidar-contadores', '* * * * *',
                           'select public.consolidar_contadores();');
  end;
end $$;

-- Apuração dos palpites: pega a fila que o apito final encheu.
select public.agendar('processar-apuracoes', '* * * * *',
                      'select public.processar_apuracoes();');

-- "O que a torcida acha" dos jogos próximos.
select public.agendar('resumos-de-palpites', '* * * * *',
                      'select public.atualizar_resumos_de_palpites();');

-- Trending, hashtags em alta e ranking semanal de torcedores.
select public.agendar('atualizar-descoberta', '*/5 * * * *',
                      'select public.atualizar_descoberta();');

-- Lembrete de palpite para quem ainda não deu o seu.
select public.agendar('lembrar-palpites', '*/15 * * * *',
                      'select public.lembrar_palpites();');

-- Retenção: notificações, rasantes vencidos, chat de live antiga, fila de push entregue.
select public.agendar('limpar-dados-antigos', '17 4 * * *',
                      'select public.limpar_dados_antigos();');

-- Todo dia 1º: congela o pódio do mês que acabou como título permanente no perfil.
select public.agendar('fechar-mes', '30 5 1 * *',
                      'select public.fechar_mes_anterior();');

-- A limpeza de contas de visitante abandonadas NÃO é agendada: apagar conta é
-- irreversível. Para ligar, confira antes o que sairia e agende à mão:
--   select * from public.visitantes_abandonados(90);
--   select public.agendar('limpar-visitantes', '45 4 * * 0',
--                         'select public.limpar_visitantes(90);');

revoke execute on function public.agendar(text, text, text) from public, anon, authenticated;
