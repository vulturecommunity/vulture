-- =====================================================================================
-- AUTOTESTE DA APURAÇÃO
--
-- Roda a pontuação de ponta a ponta com dados de mentira e confere o resultado. Tudo
-- acontece dentro de um subbloco que é desfeito no fim (o `raise` cancela o subbloco sem
-- cancelar a migration), então o banco fica exatamente como estava.
--
-- Se qualquer conta estiver errada, a migration FALHA e nada é aplicado — que é o
-- comportamento desejado: ranking com conta errada é pior do que ranking nenhum.
-- =====================================================================================

do $$
declare
  torcedores uuid[];
  jogo text := 'autoteste-apuracao';
  linha record;
  esperado record;
  achou integer;
begin
  select array_agg(id) into torcedores from (
    select id from public.profiles order by criado_em limit 5
  ) t;

  if coalesce(array_length(torcedores, 1), 0) < 5 then
    raise notice 'autoteste do ranking: pulado (precisa de 5 perfis, há %)',
      coalesce(array_length(torcedores, 1), 0);
    return;
  end if;

  begin
    -- --------------------------------------------------------------- função pura: peso
    if public.peso_da_partida('Libertadores', 'Final', 'Flamengo', 'River Plate') <> 2 then
      raise exception 'peso: final deveria valer 2';
    end if;
    if public.peso_da_partida('Brasileirão', 'Rodada 12', 'Flamengo', 'Vasco da Gama') <> 2 then
      raise exception 'peso: clássico deveria valer 2';
    end if;
    if public.peso_da_partida('Brasileirão', 'Rodada 12', 'Flamengo', 'Cuiabá') <> 1 then
      raise exception 'peso: jogo comum deveria valer 1';
    end if;

    -- --------------------------------------------------------------- cenário
    -- Jogo agendado para o futuro: é assim que os palpites entram (o trigger copia o
    -- horário da partida, e a RLS/RPC só aceita antes da bola rolar).
    insert into public.partidas
      (id, temporada, competicao, fase, mandante, visitante,
       sigla_mandante, sigla_visitante, data_hora, status, peso)
    values (jogo, 2026, 'Autoteste', null, 'Flamengo', 'Cuiabá',
            'FLA', 'CUI', now() + interval '1 day', 'agendada', 1);

    -- placar real será 3 x 1
    insert into public.palpites (usuario_id, partida_id, partida_inicio, gols_mandante, gols_visitante)
    values
      (torcedores[1], jogo, now() + interval '1 day', 3, 1),  -- cravou      -> 10 pts, desvio 0
      (torcedores[2], jogo, now() + interval '1 day', 2, 0),  -- saldo (+2)  ->  5 pts, desvio 2
      (torcedores[3], jogo, now() + interval '1 day', 1, 0),  -- vencedor    ->  3 pts, desvio 3
      (torcedores[4], jogo, now() + interval '1 day', 2, 1),  -- vencedor    ->  3 pts, desvio 1
      (torcedores[5], jogo, now() + interval '1 day', 0, 2);  -- errou       ->  0 pts, desvio 4

    -- perfis anônimos não entram no ranking; para o teste, todos contam
    update public.profiles set anonimo = false where id = any (torcedores);

    -- apito final
    update public.partidas
       set status = 'encerrada', gols_mandante = 3, gols_visitante = 1
     where id = jogo;

    perform public.apurar_partida(jogo);

    -- --------------------------------------------------------------- pontos por palpite
    for esperado in
      select * from (values
        (torcedores[1], 'cravou'::text,   10, 0),
        (torcedores[2], 'saldo'::text,     5, 2),
        (torcedores[3], 'vencedor'::text,  3, 3),
        (torcedores[4], 'vencedor'::text,  3, 1),
        (torcedores[5], 'errou'::text,     0, 4)
      ) as e(usuario_id, resultado, pontos, desvio)
    loop
      select pa.resultado, pa.pontos, pa.desvio into linha
        from public.palpites pa
       where pa.partida_id = jogo and pa.usuario_id = esperado.usuario_id;
      if linha.resultado is distinct from esperado.resultado
         or linha.pontos is distinct from esperado.pontos::smallint
         or linha.desvio is distinct from esperado.desvio::smallint then
        raise exception 'apuração errada: esperava % %pts desvio %, veio % %pts desvio %',
          esperado.resultado, esperado.pontos, esperado.desvio,
          linha.resultado, linha.pontos, linha.desvio;
      end if;
    end loop;

    -- --------------------------------------------------------------- ordem do ranking
    -- 1º cravou (10) · 2º saldo (5) · 3º e 4º empatam em 3 pts e o DESVIO desempata:
    -- quem chutou 2x1 (desvio 1) passa na frente de quem chutou 1x0 (desvio 3).
    select r.posicao into achou from public.ranking_palpiteiros r
     where r.periodo = public.periodo_mensal(now() + interval '1 day')
       and r.usuario_id = torcedores[4];
    if achou is distinct from 3 then
      raise exception 'desempate por desvio falhou: 2x1 deveria ser 3º, veio %', achou;
    end if;
    select r.posicao into achou from public.ranking_palpiteiros r
     where r.periodo = public.periodo_mensal(now() + interval '1 day')
       and r.usuario_id = torcedores[3];
    if achou is distinct from 4 then
      raise exception 'desempate por desvio falhou: 1x0 deveria ser 4º, veio %', achou;
    end if;

    -- a temporada acumula em paralelo ao mês
    if not exists (
      select 1 from public.ranking_palpiteiros
       where periodo = 'T2026' and usuario_id = torcedores[1] and pontos >= 10
    ) then
      raise exception 'ranking da temporada não recebeu os pontos';
    end if;

    -- --------------------------------------------------------------- pódio do jogo
    select count(*) into achou from public.podio_da_partida(jogo, 10);
    if achou <> 4 then
      raise exception 'pódio do jogo deveria listar 4 pontuadores, listou %', achou;
    end if;

    -- --------------------------------------------------------------- não pontua duas vezes
    if public.apurar_partida(jogo) <> 0 then
      raise exception 'apuração repetida deveria ser ignorada';
    end if;

    -- --------------------------------------------------------------- resumo agregado
    perform public.recalcular_resumo_de_palpites(jogo);
    select total into achou from public.palpites_resumo where partida_id = jogo;
    if achou <> 5 then
      raise exception 'resumo de palpites deveria contar 5, contou %', achou;
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste do ranking: OK (dados de teste desfeitos)';
  end;
end $$;
