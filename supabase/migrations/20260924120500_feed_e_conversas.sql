-- =====================================================================================
-- FEED E CONVERSAS — tirar da URL o que é trabalho do banco
--
-- 1. O feed "Seguindo" buscava TODOS os ids de quem você segue e montava
--    `.in('autor_id', [...])`. Quem segue 5 mil perfis gerava uma URL de dezenas de KB —
--    e o PostgREST tem limite de tamanho de requisição. O filtro de bloqueados
--    (`.not('autor_id','in',...)`) tinha o mesmo problema e rodava em QUASE TODA listagem,
--    com uma ida extra ao banco cada vez.
--
--    Agora é um join dentro do Postgres. O app manda cursor e limite, recebe ids.
--
-- 2. listar_conversas() fazia um count(*) por conversa (até 200 subconsultas por abertura
--    da caixa de entrada). O número de não lidas passa a ser coluna, mantida por trigger.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- BLOQUEIO NOS DOIS SENTIDOS
-- -------------------------------------------------------------------------------------

-- a RLS de blocks só deixa cada um ver os próprios; esta função (security definer) enxerga
-- os dois lados, então quem te bloqueou também some do seu feed
create or replace function public.me_bloqueia(p_outro uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks b
     where (b.usuario_id = auth.uid() and b.bloqueado_id = p_outro)
        or (b.usuario_id = p_outro and b.bloqueado_id = auth.uid())
  );
$$;
grant execute on function public.me_bloqueia(uuid) to authenticated;

create index if not exists blocks_bloqueado_idx on public.blocks (bloqueado_id);

-- -------------------------------------------------------------------------------------
-- IDS DO FEED
-- -------------------------------------------------------------------------------------

/**
 * Ordem e filtros do feed resolvidos no banco. O app busca as linhas completas depois,
 * com `in (ids)` — mesmo padrão que listTrending já usava.
 */
create or replace function public.feed_ids(
  p_aba       text        default 'para-voce',
  p_cursor    timestamptz default null,
  p_limite    integer     default 10,
  p_categoria text        default null,
  p_hashtag   text        default null
)
returns table (id uuid, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select v.id, v.criado_em
    from public.videos v
   where (p_cursor is null or v.criado_em < p_cursor)
     and (p_categoria is null or v.categoria = p_categoria)
     and (p_hashtag is null or v.hashtags_norm @> array[lower(p_hashtag)])
     and (
       p_aba <> 'seguindo'
       or exists (
         select 1 from public.follows f
          where f.seguidor_id = auth.uid() and f.seguido_id = v.autor_id
       )
     )
     and not exists (
       select 1 from public.blocks b
        where (b.usuario_id = auth.uid() and b.bloqueado_id = v.autor_id)
           or (b.usuario_id = v.autor_id and b.bloqueado_id = auth.uid())
     )
   order by v.criado_em desc
   limit least(greatest(p_limite, 1), 50);
$$;

/** Mesmo desenho para a resenha da Arquibancada. */
create or replace function public.resenha_ids(
  p_cursor     timestamptz default null,
  p_limite     integer     default 10,
  p_hashtag    text        default null,
  p_partida_id text        default null
)
returns table (id uuid, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.criado_em
    from public.posts p
   where p.pai_id is null
     and (p_cursor is null or p.criado_em < p_cursor)
     and (p_hashtag is null or p.hashtags_norm @> array[lower(p_hashtag)])
     and (p_partida_id is null or p.partida_id = p_partida_id)
     and not exists (
       select 1 from public.blocks b
        where (b.usuario_id = auth.uid() and b.bloqueado_id = p.autor_id)
           or (b.usuario_id = p.autor_id and b.bloqueado_id = auth.uid())
     )
   order by p.criado_em desc
   limit least(greatest(p_limite, 1), 50);
$$;

grant execute on function public.feed_ids(text, timestamptz, integer, text, text)
  to anon, authenticated;
grant execute on function public.resenha_ids(timestamptz, integer, text, text)
  to anon, authenticated;

-- -------------------------------------------------------------------------------------
-- NÃO LIDAS POR CONVERSA
-- -------------------------------------------------------------------------------------

alter table public.conversations
  add column if not exists nao_lidas_a integer not null default 0,
  add column if not exists nao_lidas_b integer not null default 0;

create or replace function public.tg_messages()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.conversations c
     set ultima_mensagem     = left(new.texto, 200),
         ultima_remetente_id = new.remetente_id,
         atualizado_em       = new.criado_em,
         nao_lidas_a = c.nao_lidas_a + case when c.usuario_a <> new.remetente_id then 1 else 0 end,
         nao_lidas_b = c.nao_lidas_b + case when c.usuario_b <> new.remetente_id then 1 else 0 end
   where c.id = new.conversa_id;
  return new;
end;
$$;

/** Marca a conversa como lida e zera o contador numa tacada só. */
create or replace function public.marcar_conversa_como_lida(p_conversa_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  conversa record;
begin
  if eu is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  select id, usuario_a, usuario_b into conversa
    from public.conversations where id = p_conversa_id;
  if not found or eu not in (conversa.usuario_a, conversa.usuario_b) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;

  update public.messages
     set lida = true
   where conversa_id = p_conversa_id and lida = false and remetente_id <> eu;

  update public.conversations
     set nao_lidas_a = case when usuario_a = eu then 0 else nao_lidas_a end,
         nao_lidas_b = case when usuario_b = eu then 0 else nao_lidas_b end
   where id = p_conversa_id;
end;
$$;

grant execute on function public.marcar_conversa_como_lida(uuid) to authenticated;

-- carga inicial dos contadores a partir das mensagens existentes
update public.conversations c
   set nao_lidas_a = coalesce(x.para_a, 0),
       nao_lidas_b = coalesce(x.para_b, 0)
  from (
    select m.conversa_id,
           count(*) filter (where m.remetente_id = c2.usuario_b) as para_a,
           count(*) filter (where m.remetente_id = c2.usuario_a) as para_b
      from public.messages m
      join public.conversations c2 on c2.id = m.conversa_id
     where m.lida = false
     group by m.conversa_id
  ) x
 where c.id = x.conversa_id;

/** Caixa de entrada sem subconsulta por linha. */
create or replace function public.listar_conversas()
returns table (
  id uuid,
  outro_id uuid,
  ultima_mensagem text,
  ultima_remetente_id uuid,
  atualizado_em timestamptz,
  nao_lidas bigint
)
language sql
stable
security definer set search_path = public
as $$
  select c.id,
         case when c.usuario_a = auth.uid() then c.usuario_b else c.usuario_a end,
         c.ultima_mensagem,
         c.ultima_remetente_id,
         c.atualizado_em,
         (case when c.usuario_a = auth.uid() then c.nao_lidas_a else c.nao_lidas_b end)::bigint
    from public.conversations c
   where auth.uid() in (c.usuario_a, c.usuario_b)
     and not exists (
       select 1 from public.blocks bl
        where (bl.usuario_id = auth.uid() and bl.bloqueado_id in (c.usuario_a, c.usuario_b))
           or (bl.bloqueado_id = auth.uid() and bl.usuario_id in (c.usuario_a, c.usuario_b))
     )
   order by c.atualizado_em desc
   limit 200;
$$;
