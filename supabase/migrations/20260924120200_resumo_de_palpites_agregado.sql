-- =====================================================================================
-- "O QUE A TORCIDA ACHA" — agregado pronto em vez de recontar a cada olhada
--
-- A função resumo_palpites() fazia quatro count(*) e um group by sobre TODOS os palpites
-- da partida, a cada abertura da tela. No pré-jogo isso é o pior cenário possível: meio
-- milhão de linhas para varrer e meio milhão de pessoas abrindo a tela ao mesmo tempo.
--
-- Agora o número mora pronto numa tabela, recalculado pelo pg_cron a cada minuto enquanto
-- o jogo está próximo. A leitura vira lookup de chave primária.
--
-- Por que cron e não trigger: um contador incremental por partida criaria uma linha quente
-- — todo palpite disputando o mesmo registro. O recálculo periódico deixa a escrita em
-- `palpites` completamente livre de lock, e 60 s de atraso num termômetro de opinião é
-- invisível para quem está olhando.
-- =====================================================================================

create table if not exists public.palpites_resumo (
  partida_id        text primary key references public.partidas (id) on delete cascade,
  total             integer not null default 0,
  vitoria_mandante  integer not null default 0,
  empate            integer not null default 0,
  vitoria_visitante integer not null default 0,
  gols_mandante     smallint,
  gols_visitante    smallint,
  votos_placar      integer not null default 0,
  atualizado_em     timestamptz not null default now()
);

/** Recalcula o resumo de uma partida. Uma varredura, com o índice palpites_partida_idx. */
create or replace function public.recalcular_resumo_de_palpites(p_partida_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  t record;
  popular record;
begin
  select count(*)                                                as total,
         count(*) filter (where gols_mandante > gols_visitante)  as vm,
         count(*) filter (where gols_mandante = gols_visitante)  as e,
         count(*) filter (where gols_mandante < gols_visitante)  as vv
    into t
    from public.palpites
   where partida_id = p_partida_id;

  select gols_mandante, gols_visitante, count(*) as votos
    into popular
    from public.palpites
   where partida_id = p_partida_id
   group by gols_mandante, gols_visitante
   order by votos desc, gols_mandante desc, gols_visitante asc
   limit 1;

  insert into public.palpites_resumo as r
    (partida_id, total, vitoria_mandante, empate, vitoria_visitante,
     gols_mandante, gols_visitante, votos_placar, atualizado_em)
  values (p_partida_id, t.total, t.vm, t.e, t.vv,
          popular.gols_mandante, popular.gols_visitante, coalesce(popular.votos, 0), now())
  on conflict (partida_id) do update
    set total = excluded.total,
        vitoria_mandante = excluded.vitoria_mandante,
        empate = excluded.empate,
        vitoria_visitante = excluded.vitoria_visitante,
        gols_mandante = excluded.gols_mandante,
        gols_visitante = excluded.gols_visitante,
        votos_placar = excluded.votos_placar,
        atualizado_em = now();
end;
$$;

/**
 * Atualiza os jogos que interessam: os que começam nas próximas 48 h (janela em que a
 * torcida está palpitando) e os que acabaram de encerrar (para o número final congelar
 * certo). Chamada pelo pg_cron a cada minuto — normalmente 1 a 3 partidas.
 */
create or replace function public.atualizar_resumos_de_palpites()
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
     where data_hora between now() - interval '6 hours' and now() + interval '48 hours'
        or status = 'ao_vivo'
  loop
    perform public.recalcular_resumo_de_palpites(alvo.id);
    feitos := feitos + 1;
  end loop;
  return feitos;
end;
$$;

-- -------------------------------------------------------------------------------------
-- A RPC que o app já usa, agora lendo o agregado (mesma assinatura, mesma resposta)
-- -------------------------------------------------------------------------------------

create or replace function public.resumo_palpites(p_partida_id text)
returns table (
  total bigint,
  vitoria_mandante bigint,
  empate bigint,
  vitoria_visitante bigint,
  gols_mandante smallint,
  gols_visitante smallint,
  votos_placar bigint
)
language sql
stable
security definer set search_path = public
as $$
  select r.total::bigint,
         r.vitoria_mandante::bigint,
         r.empate::bigint,
         r.vitoria_visitante::bigint,
         r.gols_mandante,
         r.gols_visitante,
         r.votos_placar::bigint
    from public.palpites_resumo r
   where r.partida_id = p_partida_id;
$$;

revoke execute on function public.resumo_palpites(text) from public;
grant execute on function public.resumo_palpites(text) to anon, authenticated;
revoke execute on function public.recalcular_resumo_de_palpites(text) from public, anon, authenticated;
revoke execute on function public.atualizar_resumos_de_palpites() from public, anon, authenticated;

alter table public.palpites_resumo enable row level security;
drop policy if exists "palpites_resumo leitura publica" on public.palpites_resumo;
create policy "palpites_resumo leitura publica" on public.palpites_resumo for select using (true);
revoke insert, update, delete on public.palpites_resumo from anon, authenticated;

-- primeira carga
select public.atualizar_resumos_de_palpites();
