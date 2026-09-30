-- =====================================================================================
-- PUSH COM IMAGEM — a notificação de live passa a ter rosto
--
-- O aviso de live chegava assim:
--
--     🔴 @apelido está ao vivo
--     Título da live · Toque para assistir
--
-- Texto puro, sem imagem, e com "Toque para assistir" ocupando espaço para dizer o óbvio
-- (toda notificação é tocável). Ao lado de um aviso do YouTube — que mostra a foto do
-- canal e a miniatura do vídeo — parece um SMS.
--
-- Agora o push carrega a foto de quem está transmitindo. No Android o Expo entrega isso
-- via `richContent.image`, que o sistema mostra como ícone grande ao lado do texto.
--
-- A estrutura do texto segue a lógica de quem recebe: quem está ao vivo (o gancho, porque
-- é a pessoa que a gente segue) no título, e o assunto da transmissão no corpo — que é a
-- informação que decide se vale abrir agora.
-- =====================================================================================

alter table public.push_pendente add column if not exists imagem text;

comment on column public.push_pendente.imagem is
  'URL de imagem exibida na notificação (richContent.image do Expo Push). '
  'Foto de quem transmite, miniatura do jogo, etc.';

-- -------------------------------------------------------------------------------------
-- enfileirar_push passa a aceitar imagem (parâmetro opcional no fim: chamadas antigas
-- continuam válidas sem alteração)
-- -------------------------------------------------------------------------------------

create or replace function public.enfileirar_push(
  p_usuarios uuid[],
  p_titulo   text,
  p_corpo    text,
  p_dados    jsonb default '{}'::jsonb,
  p_canal    text default 'default',
  p_ttl      integer default 3600,
  p_imagem   text default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  total integer;
begin
  insert into public.push_pendente (token, titulo, corpo, dados, canal, ttl, imagem)
  select t.token, p_titulo, p_corpo, p_dados, p_canal, p_ttl, p_imagem
    from public.push_tokens t
   where t.usuario_id = any (p_usuarios);
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke execute on function public.enfileirar_push(uuid[], text, text, jsonb, text, integer, text)
  from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- notificar_live: foto do anfitrião + texto reescrito
-- -------------------------------------------------------------------------------------

create or replace function public.notificar_live(p_live_id uuid)
returns table (notificados integer, pushes integer)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  eu uuid := auth.uid();
  live record;
  anfitriao record;
  titulo_da_live text;
  qtd_notificados integer := 0;
  qtd_pushes integer := 0;
begin
  if eu is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select l.id, l.titulo, l.ativa, l.anfitriao_id into live
    from public.live_streams l where l.id = p_live_id;
  if not found then
    raise exception 'Live não encontrada.' using errcode = 'P0002';
  end if;
  if live.anfitriao_id <> eu then
    raise exception 'Só o anfitrião pode avisar.' using errcode = '42501';
  end if;
  if not live.ativa then
    return query select 0, 0;
    return;
  end if;
  if exists (
    select 1 from public.notifications where live_id = live.id and tipo = 'live' limit 1
  ) then
    return query select 0, 0;
    return;
  end if;

  select p.apelido, p.nome, p.avatar_url into anfitriao
    from public.profiles p where p.id = eu;

  titulo_da_live := nullif(btrim(live.titulo), '');

  insert into public.notifications (para_id, tipo, de_id, live_id, texto)
  select f.seguidor_id, 'live', eu, live.id,
         coalesce('está ao vivo: ' || titulo_da_live, 'entrou ao vivo agora')
    from public.follows f
   where f.seguido_id = eu
     and not exists (
       select 1 from public.blocks b
        where (b.usuario_id = f.seguidor_id and b.bloqueado_id = eu)
           or (b.usuario_id = eu and b.bloqueado_id = f.seguidor_id)
     );
  get diagnostics qtd_notificados = row_count;

  insert into public.push_pendente (token, titulo, corpo, dados, canal, ttl, imagem)
  select t.token,
         -- título: quem está ao vivo. É o gancho, porque é alguém que a pessoa segue.
         '🔴 @' || coalesce(anfitriao.apelido, 'alguém') || ' está ao vivo',
         -- corpo: o assunto da transmissão, que é o que decide se vale abrir agora
         coalesce(titulo_da_live, 'Transmitindo agora para a nação'),
         jsonb_build_object('tipo', 'live', 'liveId', live.id::text,
                            'url', 'vulture://live/' || live.id::text),
         'lives',
         3600,                                  -- live é efêmera: não entregar horas depois
         anfitriao.avatar_url
    from public.follows f
    join public.push_tokens t on t.usuario_id = f.seguidor_id
   where f.seguido_id = eu
     and not exists (
       select 1 from public.blocks b
        where (b.usuario_id = f.seguidor_id and b.bloqueado_id = eu)
           or (b.usuario_id = eu and b.bloqueado_id = f.seguidor_id)
     );
  get diagnostics qtd_pushes = row_count;

  return query select qtd_notificados, qtd_pushes;
end;
$$;

grant execute on function public.notificar_live(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- Autoteste: a foto do anfitrião chega até a fila?
-- -------------------------------------------------------------------------------------

do $$
declare
  anfitriao uuid;
  seguidor uuid;
  id_live uuid;
  com_imagem integer;
begin
  select id into anfitriao from public.profiles order by criado_em limit 1;
  select id into seguidor from public.profiles where id <> anfitriao order by criado_em limit 1;
  if anfitriao is null or seguidor is null then
    raise notice 'autoteste do push com imagem: pulado (precisa de 2 perfis)';
    return;
  end if;

  begin
    update public.profiles set avatar_url = 'https://exemplo.test/foto.jpg' where id = anfitriao;

    insert into public.follows (seguidor_id, seguido_id) values (seguidor, anfitriao)
    on conflict do nothing;
    insert into public.push_tokens (token, usuario_id)
    values ('ExponentPushToken[autoteste-imagem]', seguidor)
    on conflict (token) do update set usuario_id = excluded.usuario_id;

    insert into public.live_streams (anfitriao_id, titulo, sala)
    values (anfitriao, 'Esquenta pro clássico', 'autoteste-' || gen_random_uuid())
    returning id into id_live;

    perform set_config('request.jwt.claims',
      json_build_object('sub', anfitriao::text)::text, true);
    perform public.notificar_live(id_live);

    select count(*) into com_imagem
      from public.push_pendente
     where dados->>'liveId' = id_live::text and imagem = 'https://exemplo.test/foto.jpg';
    if com_imagem < 1 then
      raise exception 'o push da live saiu sem a foto do anfitriao';
    end if;

    if not exists (
      select 1 from public.push_pendente
       where dados->>'liveId' = id_live::text and corpo = 'Esquenta pro clássico'
    ) then
      raise exception 'o corpo do push deveria ser o titulo da live';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste do push com imagem: OK (dados de teste desfeitos)';
  end;
end $$;
