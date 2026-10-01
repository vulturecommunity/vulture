-- =====================================================================================
-- MODERAÇÃO — as denúncias passam a ter para onde ir
--
-- O QUE ESTAVA ERRADO
--
-- `reports` existia desde o schema base e gravava denúncia direitinho. Ninguém lia. O
-- comentário na tabela dizia "moderação lê pelo painel (service role)" e esse painel
-- nunca foi escrito. Com 3 usuários isso é detalhe; num app de torcida, que recebe
-- transmissão pirata de jogo e briga de torcida, vira problema jurídico no dia em que
-- entrar gente.
--
-- O QUE ENTRA AQUI
--
--   1. `fila_de_moderacao()` — denúncias pendentes AGRUPADAS POR ALVO, não por denúncia.
--      Dez pessoas denunciando o mesmo vídeo é um caso para decidir, não dez.
--   2. `moderar()` — a decisão, com log de quem decidiu e por quê. Toda ação é reversível
--      menos a remoção do conteúdo, que é o ponto dela.
--   3. `banimentos` — conta suspensa continua existindo (o conteúdo some, a trilha fica).
--   4. Varredura automática de texto: marca para revisão em vez de bloquear.
--
-- POR QUE MARCAR E NÃO BLOQUEAR
--
-- Lista de palavras erra. Bloquear na publicação transforma cada falso positivo em um
-- torcedor convencido de que o app censura — caro num produto que depende de comunidade.
-- Marcar põe o caso na fila, onde uma pessoa decide em dois segundos.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Banimento
-- -------------------------------------------------------------------------------------

create table if not exists public.banimentos (
  usuario_id  uuid primary key references public.profiles (id) on delete cascade,
  motivo      text not null default '',
  -- null = permanente; data no futuro = suspensão temporária
  expira_em   timestamptz,
  decidido_por uuid references public.profiles (id) on delete set null,
  criado_em   timestamptz not null default now()
);

comment on table public.banimentos is
  'Conta suspensa. O perfil continua existindo para a trilha de moderação; o acesso é '
  'negado por `esta_banido()`, consultado nas políticas de escrita.';

create index if not exists banimentos_expira_idx on public.banimentos (expira_em)
  where expira_em is not null;

create or replace function public.esta_banido(p_usuario uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.banimentos b
     where b.usuario_id = p_usuario
       and (b.expira_em is null or b.expira_em > now())
  );
$$;

grant execute on function public.esta_banido(uuid) to authenticated;

-- -------------------------------------------------------------------------------------
-- Log de decisões — o que o moderador fez, quando, e por quê
-- -------------------------------------------------------------------------------------

create table if not exists public.acoes_de_moderacao (
  id          bigserial primary key,
  moderador_id uuid references public.profiles (id) on delete set null,
  acao        text not null check (acao in ('remover', 'banir', 'suspender', 'descartar')),
  tipo_alvo   text not null,
  alvo_id     text not null,
  autor_id    uuid,
  motivo      text not null default '',
  denuncias   integer not null default 0,
  criado_em   timestamptz not null default now()
);

comment on table public.acoes_de_moderacao is
  'Trilha de decisões. Existe para responder "por que isto foi removido?" meses depois, '
  'e para medir se a moderação está calibrada (muita remoção? muito descarte?).';

create index if not exists acoes_de_moderacao_data_idx on public.acoes_de_moderacao (criado_em desc);

-- -------------------------------------------------------------------------------------
-- Varredura de texto: termos que mandam o conteúdo para a fila
-- -------------------------------------------------------------------------------------

create table if not exists public.termos_vigiados (
  termo     text primary key,
  -- 'revisar' entra na fila; 'proibir' recusa a publicação na hora
  severidade text not null default 'revisar' check (severidade in ('revisar', 'proibir')),
  criado_em timestamptz not null default now()
);

comment on table public.termos_vigiados is
  'Lista de termos que disparam revisão. Deliberadamente curta e genérica aqui: a lista '
  'de verdade é operacional e muda com o que aparece, então vive em dados, não em código.';

-- Semente mínima. Ameaça e aliciamento entram como "proibir"; o resto é "revisar", porque
-- xingamento de rivalidade é o idioma normal de um app de torcida e bloquear mataria o
-- produto. A calibragem fina é trabalho de operação, com a fila na mão.
insert into public.termos_vigiados (termo, severidade) values
  ('vou te matar',      'proibir'),
  ('te encontrar e',    'revisar'),
  ('sabe onde você mora','proibir'),
  ('nudes',             'revisar'),
  ('pix pra mim',       'revisar'),
  ('link na bio',       'revisar')
on conflict (termo) do nothing;

/** Minúsculas sem acento, sem depender da extensão unaccent (que o Free não traz). */
create or replace function public.unaccent_simples(p_texto text)
returns text
language sql
immutable
as $$
  select translate(
    coalesce(p_texto, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

/** Devolve a severidade mais alta encontrada no texto, ou null quando está limpo. */
create or replace function public.varrer_texto(p_texto text)
returns text
language sql
stable
security definer set search_path = public
as $$
  select case
           when bool_or(t.severidade = 'proibir') then 'proibir'
           when count(*) > 0 then 'revisar'
           else null
         end
    from public.termos_vigiados t
   where lower(public.unaccent_simples(p_texto))
         like '%' || lower(public.unaccent_simples(t.termo)) || '%';
$$;

-- -------------------------------------------------------------------------------------
-- A fila: um caso por ALVO, não por denúncia
-- -------------------------------------------------------------------------------------

create or replace function public.fila_de_moderacao(p_limite integer default 50)
returns table (
  tipo_alvo   text,
  alvo_id     text,
  denuncias   bigint,
  motivos     text[],
  primeira_em timestamptz,
  ultima_em   timestamptz,
  autor_id    uuid,
  autor       text,
  previa      text,
  autor_banido boolean
)
language sql
stable
security definer set search_path = public
as $$
  with casos as (
    select r.tipo_alvo,
           r.alvo_id,
           count(*)                   as denuncias,
           array_agg(distinct r.motivo) as motivos,
           min(r.criado_em)           as primeira_em,
           max(r.criado_em)           as ultima_em
      from public.reports r
     where r.status = 'pendente'
     group by r.tipo_alvo, r.alvo_id
  )
  select c.tipo_alvo,
         c.alvo_id,
         c.denuncias,
         c.motivos,
         c.primeira_em,
         c.ultima_em,
         dono.id,
         dono.apelido,
         previa.texto,
         public.esta_banido(dono.id)
    from casos c
    left join lateral (
      select case c.tipo_alvo
               when 'video'      then (select v.autor_id from public.videos v where v.id::text = c.alvo_id)
               when 'comentario' then (select m.autor_id from public.comments m where m.id::text = c.alvo_id)
               when 'live'       then (select l.anfitriao_id from public.live_streams l where l.id::text = c.alvo_id)
               when 'usuario'    then c.alvo_id::uuid
             end as id
    ) alvo on true
    left join public.profiles dono on dono.id = alvo.id
    left join lateral (
      select case c.tipo_alvo
               when 'video'      then (select v.legenda from public.videos v where v.id::text = c.alvo_id)
               when 'comentario' then (select m.texto from public.comments m where m.id::text = c.alvo_id)
               when 'live'       then (select l.titulo from public.live_streams l where l.id::text = c.alvo_id)
               when 'usuario'    then (select p.bio from public.profiles p where p.id::text = c.alvo_id)
             end as texto
    ) previa on true
   -- mais denunciado primeiro: é onde a atenção rende mais
   order by c.denuncias desc, c.ultima_em desc
   limit greatest(1, least(p_limite, 200));
$$;

-- -------------------------------------------------------------------------------------
-- A decisão
-- -------------------------------------------------------------------------------------

create or replace function public.moderar(
  p_tipo_alvo text,
  p_alvo_id   text,
  p_acao      text,
  p_motivo    text default '',
  p_dias      integer default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
  qtd   integer;
begin
  if p_acao not in ('remover', 'banir', 'suspender', 'descartar') then
    raise exception 'ação inválida: %', p_acao using errcode = '22023';
  end if;

  select case p_tipo_alvo
           when 'video'      then (select v.autor_id from public.videos v where v.id::text = p_alvo_id)
           when 'comentario' then (select m.autor_id from public.comments m where m.id::text = p_alvo_id)
           when 'live'       then (select l.anfitriao_id from public.live_streams l where l.id::text = p_alvo_id)
           when 'usuario'    then p_alvo_id::uuid
         end
    into autor;

  select count(*) into qtd
    from public.reports r
   where r.tipo_alvo = p_tipo_alvo and r.alvo_id = p_alvo_id and r.status = 'pendente';

  if p_acao = 'remover' then
    -- O arquivo no R2 continua lá: quem apaga é a Edge Function `limpar-arquivos`, no
    -- cron diário, que varre mídia sem linha correspondente. Aqui só o registro sai.
    if p_tipo_alvo = 'video'      then delete from public.videos       where id::text = p_alvo_id;
    elsif p_tipo_alvo = 'comentario' then delete from public.comments  where id::text = p_alvo_id;
    elsif p_tipo_alvo = 'live'    then update public.live_streams set ativa = false, encerrada_em = now()
                                     where id::text = p_alvo_id;
    end if;
  elsif p_acao in ('banir', 'suspender') and autor is not null then
    insert into public.banimentos (usuario_id, motivo, expira_em, decidido_por)
    values (autor, p_motivo,
            case when p_acao = 'suspender' then now() + make_interval(days => coalesce(p_dias, 7)) end,
            auth.uid())
    on conflict (usuario_id) do update
      set motivo = excluded.motivo,
          expira_em = excluded.expira_em,
          decidido_por = excluded.decidido_por,
          criado_em = now();
  end if;

  update public.reports
     set status = case when p_acao = 'descartar' then 'descartada' else 'analisada' end
   where tipo_alvo = p_tipo_alvo and alvo_id = p_alvo_id and status = 'pendente';

  insert into public.acoes_de_moderacao
    (moderador_id, acao, tipo_alvo, alvo_id, autor_id, motivo, denuncias)
  values (auth.uid(), p_acao, p_tipo_alvo, p_alvo_id, autor, p_motivo, qtd);

  return jsonb_build_object('acao', p_acao, 'denuncias_fechadas', qtd, 'autor', autor);
end;
$$;

-- Fila e decisão são operadas pelo painel com a service role; nenhum usuário do app
-- chama isto. Sem grant para authenticated.
revoke all on function public.fila_de_moderacao(integer) from anon, authenticated;
revoke all on function public.moderar(text, text, text, text, integer) from anon, authenticated;

alter table public.banimentos          enable row level security;
alter table public.acoes_de_moderacao  enable row level security;
alter table public.termos_vigiados     enable row level security;
revoke all on public.banimentos         from anon, authenticated;
revoke all on public.acoes_de_moderacao from anon, authenticated;
revoke all on public.termos_vigiados    from anon, authenticated;

-- `esta_banido` é security definer, então o app consegue perguntar por si mesmo sem ler
-- a tabela — é assim que a tela de publicar descobre que está suspensa.

-- -------------------------------------------------------------------------------------
-- Autoteste: a fila agrupa, a decisão fecha as denúncias e deixa rastro?
-- -------------------------------------------------------------------------------------

do $$
declare
  autor uuid;
  denunciante uuid;
  id_video uuid;
  casos integer;
  resultado jsonb;
begin
  select id into autor from public.profiles order by criado_em limit 1;
  select id into denunciante from public.profiles where id <> autor order by criado_em limit 1;
  if autor is null or denunciante is null then
    raise notice 'autoteste da moderacao: pulado (precisa de 2 perfis)';
    return;
  end if;

  begin
    insert into public.videos (autor_id, url, legenda)
    values (autor, 'https://exemplo.test/v.mp4', 'autoteste de moderacao')
    returning id into id_video;

    insert into public.reports (denunciante_id, tipo_alvo, alvo_id, motivo)
    values (denunciante, 'video', id_video::text, 'spam'),
           (autor,       'video', id_video::text, 'violencia');

    select count(*) into casos
      from public.fila_de_moderacao(50) f
     where f.alvo_id = id_video::text;
    if casos <> 1 then
      raise exception 'duas denuncias no mesmo video deveriam virar UM caso, viraram %', casos;
    end if;

    resultado := public.moderar('video', id_video::text, 'remover', 'autoteste');
    if (resultado->>'denuncias_fechadas')::int <> 2 then
      raise exception 'a decisao deveria fechar as 2 denuncias, fechou %', resultado->>'denuncias_fechadas';
    end if;

    if exists (select 1 from public.videos where id = id_video) then
      raise exception 'o video deveria ter sido removido';
    end if;

    if not exists (select 1 from public.acoes_de_moderacao where alvo_id = id_video::text) then
      raise exception 'a decisao deveria ter deixado rastro em acoes_de_moderacao';
    end if;

    if public.varrer_texto('vou te matar depois do jogo') <> 'proibir' then
      raise exception 'a varredura deveria barrar ameaca explicita';
    end if;
    if public.varrer_texto('que jogo bom ontem') is not null then
      raise exception 'a varredura nao pode marcar texto comum';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste da moderacao: OK (dados de teste desfeitos)';
  end;
end $$;
