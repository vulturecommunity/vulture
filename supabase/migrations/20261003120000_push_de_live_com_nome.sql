-- =====================================================================================
-- PUSH DE LIVE PELO NOME — o apelido sai do título
--
-- O aviso de live chegava assim:
--
--     🔴 @maraca_vibes está ao vivo
--
-- Fora do app ninguém é reconhecido pelo @: o apelido é um endereço, não um nome. Numa
-- gaveta de notificações ao lado de WhatsApp e Instagram, "@maraca_vibes" é ruído — quem
-- lê quer saber que a Maraca entrou ao vivo. Mesma troca já feita no push de mensagem
-- direta (Edge Function notificar-mensagem).
--
--     🔴 Maraca está ao vivo
--
-- `profiles.nome` é `not null default ''`, ou seja: nunca nulo, mas frequentemente vazio
-- em conta recém-criada. Por isso a reserva é o apelido — e só depois 'alguém'. O
-- `nullif(btrim(...), '')` existe justamente porque `coalesce` sozinho não descarta
-- string vazia, e sem ele a notificação sairia "🔴  está ao vivo".
--
-- IMPORTANTE: este texto precisa sair IGUAL ao de `construirNotificacaoDeLive`
-- (src/services/push/index.ts). Quem segue recebe o push daqui; quem iniciou a live
-- recebe o local, montado no aparelho. Os dois textos divergirem é bug visível — já
-- aconteceu neste projeto quando o corpo mudou só no SQL.
-- =====================================================================================

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
  quem_transmite text;
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
  -- nome → apelido → 'alguém', igual ao cliente
  quem_transmite := coalesce(
    nullif(btrim(anfitriao.nome), ''),
    nullif(btrim(anfitriao.apelido), ''),
    'alguém'
  );

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
         '🔴 ' || quem_transmite || ' está ao vivo',
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
-- Autoteste: sai o nome e, com nome vazio, o apelido
-- -------------------------------------------------------------------------------------

do $$
declare
  anfitriao uuid;
  seguidor uuid;
  id_live uuid;
  apelido_do_anfitriao text;
begin
  select id into anfitriao from public.profiles order by criado_em limit 1;
  select id into seguidor from public.profiles where id <> anfitriao order by criado_em limit 1;
  if anfitriao is null or seguidor is null then
    raise notice 'autoteste do push de live com nome: pulado (precisa de 2 perfis)';
    return;
  end if;

  begin
    select apelido into apelido_do_anfitriao from public.profiles where id = anfitriao;

    insert into public.follows (seguidor_id, seguido_id) values (seguidor, anfitriao)
    on conflict do nothing;
    insert into public.push_tokens (token, usuario_id)
    values ('ExponentPushToken[autoteste-nome]', seguidor)
    on conflict (token) do update set usuario_id = excluded.usuario_id;

    perform set_config('request.jwt.claims',
      json_build_object('sub', anfitriao::text)::text, true);

    -- 1) com nome preenchido, o título usa o nome
    update public.profiles set nome = 'Maraca Vibes' where id = anfitriao;
    insert into public.live_streams (anfitriao_id, titulo, sala)
    values (anfitriao, 'Esquenta', 'autoteste-' || gen_random_uuid())
    returning id into id_live;
    perform public.notificar_live(id_live);

    if not exists (
      select 1 from public.push_pendente
       where dados->>'liveId' = id_live::text
         and titulo = '🔴 Maraca Vibes está ao vivo'
    ) then
      raise exception 'o push da live deveria usar o nome do anfitriao';
    end if;

    -- 2) com nome vazio, cai no apelido (e nunca em "🔴  está ao vivo")
    update public.profiles set nome = '   ' where id = anfitriao;
    insert into public.live_streams (anfitriao_id, titulo, sala)
    values (anfitriao, 'Esquenta', 'autoteste-' || gen_random_uuid())
    returning id into id_live;
    perform public.notificar_live(id_live);

    if not exists (
      select 1 from public.push_pendente
       where dados->>'liveId' = id_live::text
         and titulo = '🔴 ' || apelido_do_anfitriao || ' está ao vivo'
    ) then
      raise exception 'com nome vazio, o push da live deveria cair no apelido';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste do push de live com nome: OK (dados de teste desfeitos)';
  end;
end $$;
