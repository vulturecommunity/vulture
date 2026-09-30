-- =====================================================================================
-- CORREÇÃO: "column reference is ambiguous" nas funções com RETURNS TABLE
--
-- Em plpgsql, cada coluna de um RETURNS TABLE também vira uma variável. Quando o corpo da
-- função usa esse mesmo nome sem qualificar — e a lista de colunas de um INSERT nunca pode
-- ser qualificada — o Postgres não sabe se o nome é a variável ou a coluna e recusa a
-- chamada em tempo de execução.
--
-- Era o caso de salvar_palpite (partida_id, gols_mandante, gols_visitante) e de
-- criar_liga/entrar_na_liga (nome, codigo). O sintoma só aparecia ao chamar: o `create
-- function` passa sem reclamar.
--
-- `#variable_conflict use_column` resolve o empate em favor da coluna, que é o que estas
-- funções querem em todos os pontos de conflito.
-- =====================================================================================

create or replace function public.salvar_palpite(
  p_partida_id text, p_gols_mandante integer, p_gols_visitante integer
)
returns table (
  partida_id text, gols_mandante smallint, gols_visitante smallint, atualizado_em timestamptz
)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  eu uuid := auth.uid();
  jogo record;
begin
  if eu is null then
    raise exception 'Você precisa entrar para palpitar.' using errcode = '28000';
  end if;
  if p_gols_mandante is null or p_gols_visitante is null
     or p_gols_mandante < 0 or p_gols_visitante < 0
     or p_gols_mandante > 20 or p_gols_visitante > 20 then
    raise exception 'O placar vai de 0 a 20 gols.' using errcode = '22023';
  end if;

  select p.id, p.data_hora, p.status into jogo
    from public.partidas p where p.id = p_partida_id;
  if not found then
    raise exception 'Jogo não encontrado no calendário.' using errcode = '23503';
  end if;
  if jogo.status <> 'agendada' or jogo.data_hora <= now() then
    raise exception 'Palpites encerrados: a bola já rolou.' using errcode = 'P0001';
  end if;

  insert into public.palpites as pa
    (usuario_id, partida_id, partida_inicio, gols_mandante, gols_visitante)
  values (eu, p_partida_id, jogo.data_hora, p_gols_mandante, p_gols_visitante)
  on conflict (usuario_id, partida_id) do update
    set gols_mandante = excluded.gols_mandante,
        gols_visitante = excluded.gols_visitante;

  return query
    select pa.partida_id, pa.gols_mandante, pa.gols_visitante, pa.atualizado_em
      from public.palpites pa
     where pa.usuario_id = eu and pa.partida_id = p_partida_id;
end;
$$;

revoke execute on function public.salvar_palpite(text, integer, integer) from public, anon;
grant execute on function public.salvar_palpite(text, integer, integer) to authenticated;

-- Mesmo problema, escondido um nível abaixo: a variável `codigo` colidia com a coluna
-- `ligas.codigo` na checagem de unicidade, então criar liga estourava sempre. A variável
-- passa a se chamar `sorteado`.
create or replace function public.gerar_codigo_de_liga()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tentativa integer := 0;
  sorteado text;
begin
  loop
    sorteado := '';
    for i in 1..6 loop
      sorteado := sorteado || substr(alfabeto, floor(random() * length(alfabeto) + 1)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.ligas l where l.codigo = sorteado);
    tentativa := tentativa + 1;
    if tentativa > 50 then
      raise exception 'Não consegui gerar um código de liga. Tente de novo.';
    end if;
  end loop;
  return sorteado;
end;
$$;

revoke execute on function public.gerar_codigo_de_liga() from public, anon, authenticated;

create or replace function public.criar_liga(p_nome text)
returns table (id uuid, nome text, codigo text, membros bigint, sou_dono boolean)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  eu uuid := auth.uid();
  nova uuid;
  limpo text := btrim(coalesce(p_nome, ''));
begin
  if eu is null then
    raise exception 'Você precisa entrar para criar uma liga.' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles p where p.id = eu and p.anonimo) then
    raise exception 'Visitante não pode criar liga. Crie uma conta para disputar.'
      using errcode = '42501';
  end if;
  if char_length(limpo) < 3 or char_length(limpo) > 40 then
    raise exception 'O nome da liga precisa ter de 3 a 40 caracteres.' using errcode = '22023';
  end if;
  if (select count(*) from public.ligas l where l.dono_id = eu) >= 10 then
    raise exception 'Você já criou 10 ligas.' using errcode = '22023';
  end if;

  insert into public.ligas (nome, codigo, dono_id)
  values (limpo, public.gerar_codigo_de_liga(), eu)
  returning ligas.id into nova;

  insert into public.liga_membros (liga_id, usuario_id) values (nova, eu);

  return query
    select l.id, l.nome, l.codigo, 1::bigint, true from public.ligas l where l.id = nova;
end;
$$;

create or replace function public.entrar_na_liga(p_codigo text)
returns table (id uuid, nome text, codigo text, membros bigint, sou_dono boolean)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  eu uuid := auth.uid();
  liga record;
  quantos integer;
begin
  if eu is null then
    raise exception 'Você precisa entrar para participar de uma liga.' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles p where p.id = eu and p.anonimo) then
    raise exception 'Visitante não pode entrar em liga. Crie uma conta para disputar.'
      using errcode = '42501';
  end if;

  select l.id, l.nome, l.codigo, l.dono_id, l.max_membros into liga
    from public.ligas l where l.codigo = upper(btrim(coalesce(p_codigo, '')));
  if not found then
    raise exception 'Não existe liga com esse código.' using errcode = 'P0002';
  end if;

  select count(*) into quantos from public.liga_membros m where m.liga_id = liga.id;
  if quantos >= liga.max_membros
     and not exists (select 1 from public.liga_membros m
                      where m.liga_id = liga.id and m.usuario_id = eu) then
    raise exception 'Essa liga já está cheia (% membros).', liga.max_membros
      using errcode = '22023';
  end if;
  if (select count(*) from public.liga_membros m where m.usuario_id = eu) >= 20 then
    raise exception 'Você já está em 20 ligas.' using errcode = '22023';
  end if;

  insert into public.liga_membros (liga_id, usuario_id) values (liga.id, eu)
  on conflict (liga_id, usuario_id) do nothing;

  return query
    select liga.id, liga.nome, liga.codigo,
           (select count(*) from public.liga_membros m where m.liga_id = liga.id),
           liga.dono_id = eu;
end;
$$;

grant execute on function public.criar_liga(text) to authenticated;
grant execute on function public.entrar_na_liga(text) to authenticated;

-- -------------------------------------------------------------------------------------
-- Autoteste das funções corrigidas: chama cada uma e desfaz o que criou.
-- Se alguma voltar a ficar ambígua, esta migration falha em vez de o app quebrar em campo.
-- -------------------------------------------------------------------------------------

do $$
declare
  jogo text := 'autoteste-ambiguidade';
  eu uuid;
  linha record;
begin
  select id into eu from public.profiles order by criado_em limit 1;
  if eu is null then
    raise notice 'autoteste de ambiguidade: pulado (sem perfis)';
    return;
  end if;

  begin
    insert into public.partidas
      (id, temporada, competicao, mandante, visitante, sigla_mandante, sigla_visitante,
       data_hora, status)
    values (jogo, 2026, 'Autoteste', 'Flamengo', 'Cuiabá', 'FLA', 'CUI',
            now() + interval '2 days', 'agendada');

    -- salvar_palpite é security definer e usa auth.uid(); aqui simulamos a sessão
    perform set_config('request.jwt.claims', json_build_object('sub', eu::text)::text, true);

    select * into linha from public.salvar_palpite(jogo, 2, 1);
    if linha.gols_mandante <> 2 or linha.gols_visitante <> 1 then
      raise exception 'salvar_palpite devolveu % x %', linha.gols_mandante, linha.gols_visitante;
    end if;

    -- trocar o palpite antes do jogo deve sobrescrever, não duplicar
    perform public.salvar_palpite(jogo, 3, 0);
    if (select count(*) from public.palpites where partida_id = jogo) <> 1 then
      raise exception 'trocar o palpite duplicou a linha';
    end if;

    update public.profiles set anonimo = false where id = eu;
    select * into linha from public.criar_liga('Liga do autoteste');
    if linha.codigo !~ '^[A-Z0-9]{6}$' then
      raise exception 'criar_liga devolveu código inválido: %', linha.codigo;
    end if;
    if linha.membros <> 1 or not linha.sou_dono then
      raise exception 'criar_liga deveria começar com 1 membro e dono = eu';
    end if;

    -- entrar de novo na própria liga é idempotente
    select * into linha from public.entrar_na_liga(linha.codigo);
    if linha.membros <> 1 then
      raise exception 'entrar_na_liga duplicou o membro (% membros)', linha.membros;
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste de ambiguidade: OK (dados de teste desfeitos)';
  end;
end $$;
