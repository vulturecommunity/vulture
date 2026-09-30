-- =====================================================================================
-- RETENÇÃO — tabelas que cresciam para sempre
--
-- Nada aqui apagava nada: notificações de 2024 continuariam no banco em 2030, rasantes
-- "expirados" sumiam da tela mas ocupavam linha e arquivo, e cada visitante criava uma
-- conta permanente em auth.users. Com volume, isso vira a maior parte do custo de banco.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- LIMPEZA PERIÓDICA (só linhas; arquivos do Storage ficam com a Edge Function limpar)
-- -------------------------------------------------------------------------------------

create or replace function public.limpar_dados_antigos()
returns table (notificacoes integer, rasantes integer, mensagens_live integer, pushes integer)
language plpgsql
security definer set search_path = public
as $$
declare
  n integer; r integer; m integer; p integer;
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

  return query select n, r, m, p;
end;
$$;

revoke execute on function public.limpar_dados_antigos() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- VISITANTES ABANDONADOS
--
-- Cada "entrar como visitante" cria uma conta de verdade em auth.users. Com milhões de
-- curiosos, a tabela enche de contas descartáveis que nunca mais serão usadas.
--
-- Esta função NÃO é agendada por padrão: apagar conta é irreversível, e a decisão de
-- quando fazer isso é do dono do app. Para ligar, descomente o cron em
-- supabase/cron-manutencao.sql depois de conferir o resultado de uma execução manual:
--   select * from public.visitantes_abandonados(90);   -- só lista
--   select public.limpar_visitantes(90);               -- apaga
-- -------------------------------------------------------------------------------------

create or replace function public.visitantes_abandonados(p_dias integer default 90)
returns table (id uuid, apelido text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.apelido, p.criado_em
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.anonimo
     and p.criado_em < now() - make_interval(days => p_dias)
     and coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => p_dias)
     and not exists (select 1 from public.videos    v where v.autor_id = p.id)
     and not exists (select 1 from public.posts     o where o.autor_id = p.id)
     and not exists (select 1 from public.palpites  a where a.usuario_id = p.id)
     and not exists (select 1 from public.follows   f where f.seguidor_id = p.id)
     and not exists (select 1 from public.rasantes  s where s.autor_id = p.id)
     and not exists (select 1 from public.messages  g where g.remetente_id = p.id);
$$;

create or replace function public.limpar_visitantes(p_dias integer default 90)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  total integer;
begin
  delete from auth.users u
   using public.visitantes_abandonados(p_dias) v
   where u.id = v.id;
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke execute on function public.visitantes_abandonados(integer) from public, anon, authenticated;
revoke execute on function public.limpar_visitantes(integer) from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- A apuração passa a avisar quem palpitou
-- -------------------------------------------------------------------------------------

create or replace function public.apurar_partida(p_partida_id text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  jogo record;
  periodos text[];
  per text;
  afetados integer := 0;
begin
  select id, gols_mandante, gols_visitante, status, peso, data_hora, temporada, apurada_em
    into jogo
    from public.partidas
   where id = p_partida_id
     for update;

  if not found then
    raise exception 'Partida % não existe.', p_partida_id;
  end if;
  if jogo.apurada_em is not null then
    return 0;
  end if;
  if jogo.status <> 'encerrada' or jogo.gols_mandante is null or jogo.gols_visitante is null then
    return 0;
  end if;

  update public.palpites pa
     set resultado = case
           when pa.gols_mandante = jogo.gols_mandante
            and pa.gols_visitante = jogo.gols_visitante                      then 'cravou'
           when (pa.gols_mandante - pa.gols_visitante)
              = (jogo.gols_mandante - jogo.gols_visitante)                   then 'saldo'
           when sign((pa.gols_mandante - pa.gols_visitante)::numeric)
              = sign((jogo.gols_mandante - jogo.gols_visitante)::numeric)    then 'vencedor'
           else 'errou'
         end,
         pontos = jogo.peso * case
           when pa.gols_mandante = jogo.gols_mandante
            and pa.gols_visitante = jogo.gols_visitante                      then 10
           when (pa.gols_mandante - pa.gols_visitante)
              = (jogo.gols_mandante - jogo.gols_visitante)                   then 5
           when sign((pa.gols_mandante - pa.gols_visitante)::numeric)
              = sign((jogo.gols_mandante - jogo.gols_visitante)::numeric)    then 3
           else 0
         end,
         desvio = abs(pa.gols_mandante - jogo.gols_mandante)
                + abs(pa.gols_visitante - jogo.gols_visitante)
   where pa.partida_id = p_partida_id
     and pa.pontos is null;

  get diagnostics afetados = row_count;

  periodos := array[
    public.periodo_mensal(jogo.data_hora),
    public.periodo_temporada(jogo.temporada)
  ];

  foreach per in array periodos loop
    insert into public.ranking_palpiteiros as rk
      (periodo, usuario_id, pontos, palpites, cravadas, saldos, vencedores, desvio,
       sequencia, melhor_seq)
    select
      per, pa.usuario_id, sum(pa.pontos), count(*),
      count(*) filter (where pa.resultado = 'cravou'),
      count(*) filter (where pa.resultado = 'saldo'),
      count(*) filter (where pa.resultado = 'vencedor'),
      sum(pa.desvio),
      case when sum(pa.pontos) > 0 then 1 else 0 end,
      case when sum(pa.pontos) > 0 then 1 else 0 end
      from public.palpites pa
      join public.profiles pr on pr.id = pa.usuario_id and not pr.anonimo
     where pa.partida_id = p_partida_id and pa.pontos is not null
     group by pa.usuario_id
    on conflict (periodo, usuario_id) do update
      set pontos     = rk.pontos     + excluded.pontos,
          palpites   = rk.palpites   + excluded.palpites,
          cravadas   = rk.cravadas   + excluded.cravadas,
          saldos     = rk.saldos     + excluded.saldos,
          vencedores = rk.vencedores + excluded.vencedores,
          desvio     = rk.desvio     + excluded.desvio,
          sequencia  = case when excluded.pontos > 0 then rk.sequencia + 1 else 0 end,
          melhor_seq = greatest(
            rk.melhor_seq,
            case when excluded.pontos > 0 then rk.sequencia + 1 else 0 end
          ),
          atualizado_em = now();

    with ordenado as (
      select usuario_id,
             row_number() over (
               order by pontos desc, cravadas desc, desvio asc, usuario_id
             ) as pos
        from public.ranking_palpiteiros
       where periodo = per
    )
    update public.ranking_palpiteiros r
       set posicao_ant = r.posicao,
           posicao     = o.pos
      from ordenado o
     where r.periodo = per and r.usuario_id = o.usuario_id;
  end loop;

  update public.partidas set apurada_em = now() where id = p_partida_id;
  delete from public.fila_apuracao where partida_id = p_partida_id;

  -- o número final também é o número oficial do "o que a torcida achou"
  perform public.recalcular_resumo_de_palpites(p_partida_id);
  -- e o push do momento de euforia
  perform public.avisar_resultado_dos_palpites(p_partida_id);

  return afetados;
end;
$$;

revoke execute on function public.apurar_partida(text) from public, anon, authenticated;
