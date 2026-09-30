-- =====================================================================================
-- DESCOBERTA — as telas que varriam a tabela inteira
--
-- Quatro consultas abriam a tabela de vídeos de ponta a ponta a cada request:
--
--   buscar_hashtags     unnest de TODOS os vídeos + like '%termo%'  (a cada tecla digitada)
--   hashtags_em_alta    unnest de 30 dias de vídeos                 (tela Explorar)
--   ranking_semanal     agregação de 7 dias + join                  (tela Explorar)
--   videos_em_alta      ordenação por expressão, sem índice         (tela Explorar)
--
--   buscarUsuarios      ilike '%termo%' em duas colunas             (índice btree não serve)
--
-- Todas viram leitura de matview refrescada pelo pg_cron. O trabalho passa a ser feito uma
-- vez a cada poucos minutos em vez de uma vez por pessoa que abre a tela.
-- =====================================================================================

create extension if not exists pg_trgm;

-- -------------------------------------------------------------------------------------
-- BUSCA DE PERFIL — trigram
--
-- `ilike '%termo%'` não usa índice btree: o '%' na frente impede. Com GIN trigram passa a
-- usar, e a busca deixa de varrer todos os perfis.
-- -------------------------------------------------------------------------------------

create index if not exists profiles_apelido_trgm_idx
  on public.profiles using gin (apelido gin_trgm_ops);
create index if not exists profiles_nome_trgm_idx
  on public.profiles using gin (nome gin_trgm_ops);
-- sugestões de torcedores (order by seguidores_count desc)
create index if not exists profiles_seguidores_idx
  on public.profiles (seguidores_count desc);

-- -------------------------------------------------------------------------------------
-- HASHTAGS
-- -------------------------------------------------------------------------------------

drop materialized view if exists public.mv_hashtags cascade;
create materialized view public.mv_hashtags as
with usos as (
  select lower(h) as tag_norm, h as tag, v.criado_em
    from public.videos v, unnest(v.hashtags) as h
   where v.criado_em > now() - interval '180 days'
  union all
  select lower(h) as tag_norm, h as tag, p.criado_em
    from public.posts p, unnest(p.hashtags) as h
   where p.criado_em > now() - interval '180 days'
)
select tag_norm,
       min(tag)                                                            as tag,
       count(*)::bigint                                                    as total,
       count(*) filter (where criado_em > now() - interval '30 days')::bigint as total_30d,
       max(criado_em)                                                      as ultimo_uso
  from usos
 group by tag_norm;

create unique index if not exists mv_hashtags_pk on public.mv_hashtags (tag_norm);
create index if not exists mv_hashtags_trgm_idx on public.mv_hashtags using gin (tag_norm gin_trgm_ops);
create index if not exists mv_hashtags_alta_idx on public.mv_hashtags (total_30d desc);

create or replace function public.buscar_hashtags(p_termo text)
returns table (tag text, total bigint)
language sql stable security definer set search_path = public as $$
  select tag, total from public.mv_hashtags
   where tag_norm like '%' || lower(p_termo) || '%'
   order by total_30d desc, total desc
   limit 20;
$$;

create or replace function public.hashtags_em_alta(p_limite integer default 12)
returns table (tag text, total bigint)
language sql stable security definer set search_path = public as $$
  select tag, total_30d from public.mv_hashtags
   where total_30d > 0
   order by total_30d desc
   limit least(greatest(p_limite, 1), 50);
$$;

-- -------------------------------------------------------------------------------------
-- VÍDEOS EM ALTA
-- -------------------------------------------------------------------------------------

drop materialized view if exists public.mv_videos_em_alta cascade;
create materialized view public.mv_videos_em_alta as
select v.id,
       (v.likes_count * 3 + v.comments_count * 5 + v.shares_count * 8 + v.views_count * 0.1)
         / power(2, extract(epoch from (now() - v.criado_em)) / 86400.0) as score
  from public.videos v
 where v.criado_em > now() - interval '7 days'
 order by score desc
 limit 300;

create unique index if not exists mv_videos_em_alta_pk on public.mv_videos_em_alta (id);
create index if not exists mv_videos_em_alta_score_idx on public.mv_videos_em_alta (score desc);

create or replace function public.videos_em_alta(p_limite integer default 30)
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select id from public.mv_videos_em_alta order by score desc limit least(greatest(p_limite, 1), 100);
$$;

-- -------------------------------------------------------------------------------------
-- RANKING SEMANAL DE TORCEDORES
-- -------------------------------------------------------------------------------------

drop materialized view if exists public.mv_ranking_semanal cascade;
create materialized view public.mv_ranking_semanal as
select p.id, p.apelido, p.nome, p.avatar_url,
       coalesce(sum(v.likes_count), 0)::bigint as curtidas,
       count(v.id)::bigint                      as videos
  from public.videos v
  join public.profiles p on p.id = v.autor_id
 where v.criado_em > now() - interval '7 days'
 group by p.id, p.apelido, p.nome, p.avatar_url
 order by curtidas desc
 limit 100;

create unique index if not exists mv_ranking_semanal_pk on public.mv_ranking_semanal (id);

create or replace function public.ranking_semanal(p_limite integer default 10)
returns table (id uuid, apelido text, nome text, avatar_url text, curtidas bigint, videos bigint)
language sql stable security definer set search_path = public as $$
  select id, apelido, nome, avatar_url, curtidas, videos
    from public.mv_ranking_semanal
   order by curtidas desc
   limit least(greatest(p_limite, 1), 50);
$$;

-- -------------------------------------------------------------------------------------
-- REFRESH
-- -------------------------------------------------------------------------------------

/**
 * CONCURRENTLY não bloqueia quem está lendo — por isso cada matview tem índice único.
 * Na primeira execução (matview ainda não populada) o CONCURRENTLY não é permitido, daí o
 * fallback para o refresh normal.
 */
create or replace function public.atualizar_descoberta()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  nome text;
begin
  if not pg_try_advisory_xact_lock(hashtext('atualizar_descoberta')) then
    return;
  end if;
  foreach nome in array array['mv_hashtags', 'mv_videos_em_alta', 'mv_ranking_semanal'] loop
    begin
      execute format('refresh materialized view concurrently public.%I', nome);
    exception when others then
      execute format('refresh materialized view public.%I', nome);
    end;
  end loop;
end;
$$;

revoke execute on function public.atualizar_descoberta() from public, anon, authenticated;

-- As matviews não são lidas direto pelo app (só pelas RPCs security definer)
revoke all on public.mv_hashtags from anon, authenticated;
revoke all on public.mv_videos_em_alta from anon, authenticated;
revoke all on public.mv_ranking_semanal from anon, authenticated;

grant execute on function public.buscar_hashtags(text) to anon, authenticated;
grant execute on function public.hashtags_em_alta(integer) to anon, authenticated;
grant execute on function public.videos_em_alta(integer) to anon, authenticated;
grant execute on function public.ranking_semanal(integer) to anon, authenticated;

-- primeira carga
select public.atualizar_descoberta();
