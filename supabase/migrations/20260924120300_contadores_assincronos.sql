-- =====================================================================================
-- CONTADORES SEM LINHA QUENTE
--
-- Os triggers faziam `update videos set likes_count = likes_count + 1`. Num vídeo viral
-- isso serializa TODAS as curtidas na mesma linha: o Postgres tranca o registro e a fila
-- de espera cresce junto com o sucesso do vídeo. Pior era
-- `update profiles set curtidas_recebidas = ...`, que serializava as curtidas de todos os
-- vídeos do mesmo autor num único ponto.
--
-- Agora cada evento é um INSERT numa tabela append-only (sem lock nenhum: o Postgres só
-- anexa no fim do heap) e o pg_cron soma tudo de meio em meio minuto. Os contadores
-- ficam até 30 s atrasados — invisível, porque o app já atualiza a própria curtida de
-- forma otimista e nunca invalida o feed depois de curtir.
--
-- De quebra: as notificações de curtida param de gerar uma linha por curtida. Um vídeo
-- com 100 mil curtidas gerava 100 mil notificações; agora gera uma, com contador
-- ("@fulano e outras 99.999 pessoas curtiram seu vídeo").
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- FILA DE DELTAS
-- -------------------------------------------------------------------------------------

create table if not exists public.contador_pendente (
  id          bigserial primary key,
  alvo        text not null check (alvo in ('video', 'perfil', 'post')),
  entidade_id uuid not null,
  campo       text not null,
  delta       integer not null,
  criado_em   timestamptz not null default now()
);

alter table public.contador_pendente enable row level security;
revoke all on public.contador_pendente from anon, authenticated;

create or replace function public.empilhar_contador(
  p_alvo text, p_entidade uuid, p_campo text, p_delta integer
)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.contador_pendente (alvo, entidade_id, campo, delta)
  select p_alvo, p_entidade, p_campo, p_delta where p_entidade is not null;
$$;

/**
 * Soma a fila e aplica nos contadores. Roda pelo pg_cron; o advisory lock garante que duas
 * execuções não se atropelem.
 */
create or replace function public.consolidar_contadores(p_maximo integer default 50000)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  teto bigint;
  total integer := 0;
begin
  -- lock de transação: solta sozinho no commit, mesmo se algo estourar no meio
  if not pg_try_advisory_xact_lock(hashtext('consolidar_contadores')) then
    return 0;
  end if;

  select max(id) into teto from (
    select id from public.contador_pendente order by id limit p_maximo
  ) t;
  if teto is null then
    return 0;
  end if;

  drop table if exists lote_contadores;
  create temp table lote_contadores on commit drop as
  with retirados as (
    delete from public.contador_pendente where id <= teto
    returning alvo, entidade_id, campo, delta
  )
  select alvo, entidade_id, campo, sum(delta)::integer as delta
    from retirados group by alvo, entidade_id, campo;

  select count(*) into total from lote_contadores;

  update public.videos v
     set likes_count    = greatest(0, v.likes_count    + coalesce(x.likes, 0)),
         comments_count = greatest(0, v.comments_count + coalesce(x.comentarios, 0)),
         saves_count    = greatest(0, v.saves_count    + coalesce(x.salvos, 0)),
         shares_count   = greatest(0, v.shares_count   + coalesce(x.compartilhamentos, 0)),
         views_count    = greatest(0, v.views_count    + coalesce(x.visualizacoes, 0))
    from (
      select entidade_id,
             sum(delta) filter (where campo = 'likes_count')    as likes,
             sum(delta) filter (where campo = 'comments_count') as comentarios,
             sum(delta) filter (where campo = 'saves_count')    as salvos,
             sum(delta) filter (where campo = 'shares_count')   as compartilhamentos,
             sum(delta) filter (where campo = 'views_count')    as visualizacoes
        from lote_contadores where alvo = 'video' group by entidade_id
    ) x
   where v.id = x.entidade_id;

  update public.profiles p
     set curtidas_recebidas = greatest(0, p.curtidas_recebidas + coalesce(x.curtidas, 0)),
         seguidores_count   = greatest(0, p.seguidores_count   + coalesce(x.seguidores, 0)),
         seguindo_count     = greatest(0, p.seguindo_count     + coalesce(x.seguindo, 0)),
         videos_count       = greatest(0, p.videos_count       + coalesce(x.videos, 0))
    from (
      select entidade_id,
             sum(delta) filter (where campo = 'curtidas_recebidas') as curtidas,
             sum(delta) filter (where campo = 'seguidores_count')   as seguidores,
             sum(delta) filter (where campo = 'seguindo_count')     as seguindo,
             sum(delta) filter (where campo = 'videos_count')       as videos
        from lote_contadores where alvo = 'perfil' group by entidade_id
    ) x
   where p.id = x.entidade_id;

  update public.posts po
     set likes_count   = greatest(0, po.likes_count   + coalesce(x.curtidas, 0)),
         replies_count = greatest(0, po.replies_count + coalesce(x.respostas, 0))
    from (
      select entidade_id,
             sum(delta) filter (where campo = 'likes_count')   as curtidas,
             sum(delta) filter (where campo = 'replies_count') as respostas
        from lote_contadores where alvo = 'post' group by entidade_id
    ) x
   where po.id = x.entidade_id;

  drop table if exists lote_contadores;
  return total;
end;
$$;

revoke execute on function public.empilhar_contador(text, uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function public.consolidar_contadores(integer)
  from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- NOTIFICAÇÕES AGRUPADAS
-- -------------------------------------------------------------------------------------

alter table public.notifications add column if not exists quantidade integer not null default 1;

-- Bancos que já tinham várias curtidas não lidas do mesmo vídeo/post: junta na mais
-- recente somando a quantidade, senão o índice único abaixo não pode ser criado.
with agrupadas as (
  select para_id, tipo, video_id, post_id,
         max(criado_em) as ultima,
         count(*)::integer as total
    from public.notifications
   where tipo = 'curtida' and lida = false
   group by para_id, tipo, video_id, post_id
  having count(*) > 1
),
sobreviventes as (
  select distinct on (n.para_id, n.video_id, n.post_id) n.id, a.total
    from public.notifications n
    join agrupadas a
      on a.para_id = n.para_id and a.tipo = n.tipo
     and a.video_id is not distinct from n.video_id
     and a.post_id is not distinct from n.post_id
   where n.lida = false
   order by n.para_id, n.video_id, n.post_id, n.criado_em desc
),
atualizadas as (
  update public.notifications n
     set quantidade = s.total
    from sobreviventes s where n.id = s.id
  returning n.id
)
delete from public.notifications d
 using agrupadas a
 where d.tipo = 'curtida' and d.lida = false
   and d.para_id = a.para_id
   and d.video_id is not distinct from a.video_id
   and d.post_id is not distinct from a.post_id
   and d.id not in (select id from sobreviventes);

-- Uma notificação de curtida por (dono, vídeo) enquanto não for lida. Idem para posts.
create unique index if not exists notifications_curtida_video_idx
  on public.notifications (para_id, video_id)
  where tipo = 'curtida' and video_id is not null and lida = false;
create unique index if not exists notifications_curtida_post_idx
  on public.notifications (para_id, post_id)
  where tipo = 'curtida' and post_id is not null and lida = false;

/** Texto pronto para a lista de notificações, com o "e outras N pessoas". */
create or replace function public.texto_agrupado(p_quantidade integer, p_acao text)
returns text language sql immutable as $$
  select case
    when p_quantidade <= 1 then p_acao
    else 'e outras ' || (p_quantidade - 1) || ' pessoas ' || p_acao
  end;
$$;

-- -------------------------------------------------------------------------------------
-- TRIGGERS REESCRITOS
-- -------------------------------------------------------------------------------------

create or replace function public.tg_likes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
begin
  if tg_op = 'INSERT' then
    select autor_id into autor from public.videos where id = new.video_id;
    perform public.empilhar_contador('video', new.video_id, 'likes_count', 1);
    perform public.empilhar_contador('perfil', autor, 'curtidas_recebidas', 1);
    if autor is not null and autor <> new.usuario_id then
      insert into public.notifications (para_id, tipo, de_id, video_id, texto, quantidade)
      values (autor, 'curtida', new.usuario_id, new.video_id, 'curtiu seu vídeo', 1)
      on conflict (para_id, video_id) where tipo = 'curtida' and video_id is not null and lida = false
      do update set quantidade = notifications.quantidade + 1,
                    de_id     = excluded.de_id,
                    criado_em = now(),
                    texto     = public.texto_agrupado(
                                  notifications.quantidade + 1, 'curtiram seu vídeo');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    select autor_id into autor from public.videos where id = old.video_id;
    perform public.empilhar_contador('video', old.video_id, 'likes_count', -1);
    perform public.empilhar_contador('perfil', autor, 'curtidas_recebidas', -1);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.tg_comments()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
begin
  if tg_op = 'INSERT' then
    select autor_id into autor from public.videos where id = new.video_id;
    perform public.empilhar_contador('video', new.video_id, 'comments_count', 1);
    if autor is not null and autor <> new.autor_id then
      insert into public.notifications (para_id, tipo, de_id, video_id, texto)
      values (autor, 'comentario', new.autor_id, new.video_id,
              'comentou: "' || left(new.texto, 60) || '"');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.empilhar_contador('video', old.video_id, 'comments_count', -1);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.tg_follows()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.empilhar_contador('perfil', new.seguido_id, 'seguidores_count', 1);
    perform public.empilhar_contador('perfil', new.seguidor_id, 'seguindo_count', 1);
    insert into public.notifications (para_id, tipo, de_id, texto)
    values (new.seguido_id, 'seguiu', new.seguidor_id, 'começou a seguir você');
    return new;
  elsif tg_op = 'DELETE' then
    perform public.empilhar_contador('perfil', old.seguido_id, 'seguidores_count', -1);
    perform public.empilhar_contador('perfil', old.seguidor_id, 'seguindo_count', -1);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.tg_saves()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.empilhar_contador('video', new.video_id, 'saves_count', 1);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.empilhar_contador('video', old.video_id, 'saves_count', -1);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.tg_videos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.hashtags_norm := (select coalesce(array_agg(lower(h)), '{}') from unnest(new.hashtags) as h);
    perform public.empilhar_contador('perfil', new.autor_id, 'videos_count', 1);
    return new;
  elsif tg_op = 'UPDATE' then
    new.hashtags_norm := (select coalesce(array_agg(lower(h)), '{}') from unnest(new.hashtags) as h);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.empilhar_contador('perfil', old.autor_id, 'videos_count', -1);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.tg_post_likes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
  raiz  uuid;
begin
  if tg_op = 'INSERT' then
    select autor_id, coalesce(pai_id, id) into autor, raiz from public.posts where id = new.post_id;
    perform public.empilhar_contador('post', new.post_id, 'likes_count', 1);
    if autor is not null and autor <> new.usuario_id then
      insert into public.notifications (para_id, tipo, de_id, post_id, texto, quantidade)
      values (autor, 'curtida', new.usuario_id, raiz, 'curtiu seu post na Arquibancada', 1)
      on conflict (para_id, post_id) where tipo = 'curtida' and post_id is not null and lida = false
      do update set quantidade = notifications.quantidade + 1,
                    de_id     = excluded.de_id,
                    criado_em = now(),
                    texto     = public.texto_agrupado(
                                  notifications.quantidade + 1,
                                  'curtiram seu post na Arquibancada');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.empilhar_contador('post', old.post_id, 'likes_count', -1);
    return old;
  end if;
  return null;
end;
$$;

create or replace function public.tg_posts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
begin
  if tg_op = 'INSERT' and new.pai_id is not null then
    select autor_id into autor from public.posts where id = new.pai_id;
    perform public.empilhar_contador('post', new.pai_id, 'replies_count', 1);
    if autor is not null and autor <> new.autor_id then
      insert into public.notifications (para_id, tipo, de_id, post_id, texto)
      values (autor, 'comentario', new.autor_id, new.pai_id,
              case when btrim(new.texto) = '' then 'respondeu seu post com uma mídia'
                   else 'respondeu seu post: "' || left(new.texto, 60) || '"' end);
    end if;
  elsif tg_op = 'DELETE' and old.pai_id is not null then
    perform public.empilhar_contador('post', old.pai_id, 'replies_count', -1);
  end if;
  return coalesce(new, old);
end;
$$;

-- -------------------------------------------------------------------------------------
-- VISUALIZAÇÕES E COMPARTILHAMENTOS EM LOTE
--
-- Era um UPDATE por vídeo assistido: com 100 mil usuários vendo 30 vídeos por dia dava
-- 3 milhões de escritas diárias, cada uma travando a linha do vídeo em alta. Agora o app
-- junta os ids e manda de uma vez.
-- -------------------------------------------------------------------------------------

create or replace function public.registrar_visualizacoes(p_ids uuid[])
returns void
language sql
security definer set search_path = public
as $$
  insert into public.contador_pendente (alvo, entidade_id, campo, delta)
  select 'video', id, 'views_count', 1
    from unnest(coalesce(p_ids, '{}'::uuid[])) as id
   limit 200;
$$;

create or replace function public.incrementar_visualizacao(p_video_id uuid)
returns void language sql security definer set search_path = public as $$
  select public.registrar_visualizacoes(array[p_video_id]);
$$;

create or replace function public.incrementar_compartilhamento(p_video_id uuid)
returns void language sql security definer set search_path = public as $$
  select public.empilhar_contador('video', p_video_id, 'shares_count', 1);
$$;

grant execute on function public.registrar_visualizacoes(uuid[]) to anon, authenticated;
grant execute on function public.incrementar_visualizacao(uuid) to anon, authenticated;
grant execute on function public.incrementar_compartilhamento(uuid) to anon, authenticated;
