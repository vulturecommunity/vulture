-- =====================================================================================
-- "O QUE A TORCIDA ACHA": cobrir também os jogos distantes
--
-- A primeira versão só recalculava o resumo dos jogos a menos de 48 h. Só que a torcida
-- palpita semanas antes — e para esses jogos a tela mostrava zero, não o número real.
--
-- Duas velocidades, porque o custo é diferente:
--   * janela quente (48 h): de minuto em minuto. É onde os palpites entram aos milhares e
--     onde alguém repara em 60 s de atraso.
--   * janela fria (até 45 dias): de 10 em 10 minutos. Jogo distante recebe palpite a conta-
--     gotas; ninguém percebe a diferença e o banco faz 1/10 do trabalho.
-- =====================================================================================

create or replace function public.atualizar_resumos_de_palpites(
  p_ate interval default '48 hours'
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  alvo record;
  feitos integer := 0;
begin
  for alvo in
    select id from public.partidas
     where (data_hora between now() - interval '6 hours' and now() + p_ate)
        or status = 'ao_vivo'
  loop
    perform public.recalcular_resumo_de_palpites(alvo.id);
    feitos := feitos + 1;
  end loop;
  return feitos;
end;
$$;

revoke execute on function public.atualizar_resumos_de_palpites(interval)
  from public, anon, authenticated;

select public.agendar('resumos-de-palpites', '* * * * *',
                      $$select public.atualizar_resumos_de_palpites('48 hours');$$);
select public.agendar('resumos-de-palpites-frios', '*/10 * * * *',
                      $$select public.atualizar_resumos_de_palpites('45 days');$$);

-- carga imediata da janela fria, para nenhum jogo já agendado ficar sem linha
select public.atualizar_resumos_de_palpites('45 days');
