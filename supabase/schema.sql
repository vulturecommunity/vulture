-- =====================================================================================
-- VULTURE — schema do Supabase (Postgres + Auth + Storage + Realtime)
-- Script único e idempotente: pode ser executado várias vezes no SQL Editor sem quebrar.
-- =====================================================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------------------
-- TABELAS
-- -------------------------------------------------------------------------------------

create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  apelido            text not null unique check (apelido ~ '^[a-z0-9._]{3,20}$'),
  nome               text not null default '',
  avatar_url         text,
  bio                text not null default '' check (char_length(bio) <= 160),
  interesses         text[] not null default '{}',
  seguidores_count   integer not null default 0,
  seguindo_count     integer not null default 0,
  curtidas_recebidas integer not null default 0,
  videos_count       integer not null default 0,
  criado_em          timestamptz not null default now(),
  -- e-mail copiado de auth.users para rastreio no painel; nunca exposto ao app (ver PRIVILÉGIOS)
  email              text
);
alter table public.profiles add column if not exists email text;

create table if not exists public.videos (
  id             uuid primary key default gen_random_uuid(),
  autor_id       uuid not null references public.profiles (id) on delete cascade,
  tipo           text not null default 'video' check (tipo in ('video', 'foto')),
  url            text not null,
  thumbnail_url  text,
  legenda        text not null default '' check (char_length(legenda) <= 300),
  hashtags       text[] not null default '{}',
  hashtags_norm  text[] not null default '{}',
  categoria      text not null default 'Torcida',
  audio          text,
  duracao        integer not null default 0,
  largura        integer,
  altura         integer,
  likes_count    integer not null default 0,
  comments_count integer not null default 0,
  saves_count    integer not null default 0,
  shares_count   integer not null default 0,
  views_count    integer not null default 0,
  criado_em      timestamptz not null default now()
);

create table if not exists public.likes (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  video_id   uuid not null references public.videos (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, video_id)
);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.videos (id) on delete cascade,
  autor_id    uuid not null references public.profiles (id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 300),
  pai_id      uuid references public.comments (id) on delete cascade,
  likes_count integer not null default 0,
  criado_em   timestamptz not null default now()
);

create table if not exists public.follows (
  seguidor_id uuid not null references public.profiles (id) on delete cascade,
  seguido_id  uuid not null references public.profiles (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);

create table if not exists public.saves (
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  video_id   uuid not null references public.videos (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (usuario_id, video_id)
);

create table if not exists public.live_streams (
  id            uuid primary key default gen_random_uuid(),
  anfitriao_id  uuid not null references public.profiles (id) on delete cascade,
  titulo        text not null check (char_length(titulo) between 1 and 80),
  thumbnail_url text,
  sala          text not null unique,
  espectadores  integer not null default 0,
  ativa         boolean not null default true,
  iniciada_em   timestamptz not null default now(),
  encerrada_em  timestamptz
);

create table if not exists public.live_messages (
  id        uuid primary key default gen_random_uuid(),
  live_id   uuid not null references public.live_streams (id) on delete cascade,
  autor_id  uuid not null references public.profiles (id) on delete cascade,
  tipo      text not null default 'texto' check (tipo in ('texto', 'reacao', 'sistema')),
  texto     text not null check (char_length(texto) between 1 and 200),
  reacao    text,
  criado_em timestamptz not null default now()
);

create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null references public.profiles (id) on delete cascade,
  tipo_alvo      text not null check (tipo_alvo in ('video', 'usuario', 'comentario', 'live')),
  alvo_id        text not null,
  motivo         text not null,
  detalhes       text not null default '',
  status         text not null default 'pendente' check (status in ('pendente', 'analisada', 'descartada')),
  criado_em      timestamptz not null default now()
);

create table if not exists public.blocks (
  usuario_id   uuid not null references public.profiles (id) on delete cascade,
  bloqueado_id uuid not null references public.profiles (id) on delete cascade,
  criado_em    timestamptz not null default now(),
  primary key (usuario_id, bloqueado_id)
);

create table if not exists public.notifications (
  id        uuid primary key default gen_random_uuid(),
  para_id   uuid not null references public.profiles (id) on delete cascade,
  tipo      text not null check (tipo in ('curtida', 'comentario', 'seguiu', 'live', 'sistema')),
  de_id     uuid references public.profiles (id) on delete cascade,
  video_id  uuid references public.videos (id) on delete cascade,
  live_id   uuid references public.live_streams (id) on delete cascade,
  texto     text not null,
  lida      boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Bancos criados antes das notificações de live: adiciona a coluna e amplia o check
alter table public.notifications add column if not exists live_id uuid references public.live_streams (id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_tipo_check;
alter table public.notifications add constraint notifications_tipo_check
  check (tipo in ('curtida', 'comentario', 'seguiu', 'live', 'sistema'));

-- Tokens de push (Expo Push Service): um token = um aparelho; troca de dono se outro usuário logar nele
create table if not exists public.push_tokens (
  token         text primary key,
  usuario_id    uuid not null references public.profiles (id) on delete cascade,
  plataforma    text not null default 'android' check (plataforma in ('android', 'ios', 'web')),
  atualizado_em timestamptz not null default now()
);

-- -------------------------------------------------------------------------------------
-- ÍNDICES (ordenação e busca)
-- -------------------------------------------------------------------------------------

create index if not exists videos_criado_em_idx        on public.videos (criado_em desc);
create index if not exists videos_autor_idx            on public.videos (autor_id, criado_em desc);
create index if not exists videos_categoria_idx        on public.videos (categoria, criado_em desc);
create index if not exists videos_hashtags_norm_idx    on public.videos using gin (hashtags_norm);
create index if not exists videos_likes_idx            on public.videos (likes_count desc);
create index if not exists likes_video_idx             on public.likes (video_id);
create index if not exists likes_usuario_idx           on public.likes (usuario_id, criado_em desc);
create index if not exists saves_usuario_idx           on public.saves (usuario_id, criado_em desc);
create index if not exists comments_video_idx          on public.comments (video_id, criado_em);
create index if not exists comments_pai_idx            on public.comments (pai_id);
create index if not exists follows_seguido_idx         on public.follows (seguido_id);
create index if not exists live_streams_ativa_idx      on public.live_streams (ativa, espectadores desc);
create index if not exists live_messages_live_idx      on public.live_messages (live_id, criado_em desc);
create index if not exists notifications_para_idx      on public.notifications (para_id, criado_em desc);
create index if not exists push_tokens_usuario_idx     on public.push_tokens (usuario_id);
create index if not exists profiles_apelido_busca_idx  on public.profiles (lower(apelido));
create index if not exists profiles_nome_busca_idx     on public.profiles (lower(nome));

-- -------------------------------------------------------------------------------------
-- FUNÇÕES E TRIGGERS
-- -------------------------------------------------------------------------------------

-- Cria o perfil de um usuário do Auth se ele ainda não existir (apelido único derivado dos
-- metadados ou do e-mail). Usada pelo trigger de cadastro e pela RPC garantir_perfil().
create or replace function public.criar_perfil_se_faltar(uid uuid, email_usuario text, meta jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  apelido_base text;
  apelido_final text;
  tentativa integer := 0;
begin
  if exists (select 1 from public.profiles where id = uid) then
    update public.profiles set email = email_usuario
    where id = uid and email is distinct from email_usuario;
    return;
  end if;

  apelido_base := coalesce(meta ->> 'apelido', split_part(coalesce(email_usuario, 'torcedor'), '@', 1));
  apelido_base := lower(regexp_replace(apelido_base, '[^a-z0-9._]', '', 'g'));
  if char_length(apelido_base) < 3 then
    apelido_base := 'torcedor' || floor(random() * 9000 + 1000)::text;
  end if;
  apelido_final := left(apelido_base, 20);
  while exists (select 1 from public.profiles where apelido = apelido_final) loop
    tentativa := tentativa + 1;
    apelido_final := left(apelido_base, 16) || floor(random() * 9000 + 1000)::text;
    exit when tentativa > 20;
  end loop;

  insert into public.profiles (id, apelido, nome, email)
  values (uid, apelido_final, coalesce(meta ->> 'nome', apelido_final), email_usuario)
  on conflict (id) do nothing;
end;
$$;

-- Trigger: cria o perfil automaticamente quando um usuário se cadastra (inclusive anônimo/visitante)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.criar_perfil_se_faltar(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC chamada pelo app quando o perfil do usuário logado não é encontrado: recria e segue.
create or replace function public.garantir_perfil()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  u record;
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  perform public.criar_perfil_se_faltar(u.id, u.email, u.raw_user_meta_data);
end;
$$;
revoke execute on function public.garantir_perfil() from public, anon;
grant execute on function public.garantir_perfil() to authenticated;

-- Repara usuários existentes sem perfil
select public.criar_perfil_se_faltar(u.id, u.email, u.raw_user_meta_data)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Mantém profiles.email igual ao do Auth (troca de e-mail, visitante que vira conta)
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_updated();

-- Preenche o e-mail de perfis já existentes
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Contadores de curtidas (+ curtidas recebidas do autor) e notificação
create or replace function public.tg_likes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
begin
  if tg_op = 'INSERT' then
    update public.videos set likes_count = likes_count + 1 where id = new.video_id returning autor_id into autor;
    update public.profiles set curtidas_recebidas = curtidas_recebidas + 1 where id = autor;
    if autor is not null and autor <> new.usuario_id then
      insert into public.notifications (para_id, tipo, de_id, video_id, texto)
      values (autor, 'curtida', new.usuario_id, new.video_id, 'curtiu seu vídeo');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos set likes_count = greatest(0, likes_count - 1) where id = old.video_id returning autor_id into autor;
    update public.profiles set curtidas_recebidas = greatest(0, curtidas_recebidas - 1) where id = autor;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_contadores on public.likes;
create trigger likes_contadores
  after insert or delete on public.likes
  for each row execute function public.tg_likes();

-- Contador de comentários e notificação
create or replace function public.tg_comments()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  autor uuid;
begin
  if tg_op = 'INSERT' then
    update public.videos set comments_count = comments_count + 1 where id = new.video_id returning autor_id into autor;
    if autor is not null and autor <> new.autor_id then
      insert into public.notifications (para_id, tipo, de_id, video_id, texto)
      values (autor, 'comentario', new.autor_id, new.video_id, 'comentou: "' || left(new.texto, 60) || '"');
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos set comments_count = greatest(0, comments_count - 1) where id = old.video_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_contadores on public.comments;
create trigger comments_contadores
  after insert or delete on public.comments
  for each row execute function public.tg_comments();

-- Contadores de seguidores/seguindo e notificação
create or replace function public.tg_follows()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set seguidores_count = seguidores_count + 1 where id = new.seguido_id;
    update public.profiles set seguindo_count = seguindo_count + 1 where id = new.seguidor_id;
    insert into public.notifications (para_id, tipo, de_id, texto)
    values (new.seguido_id, 'seguiu', new.seguidor_id, 'começou a seguir você');
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set seguidores_count = greatest(0, seguidores_count - 1) where id = old.seguido_id;
    update public.profiles set seguindo_count = greatest(0, seguindo_count - 1) where id = old.seguidor_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_contadores on public.follows;
create trigger follows_contadores
  after insert or delete on public.follows
  for each row execute function public.tg_follows();

-- Contador de salvos
create or replace function public.tg_saves()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.videos set saves_count = saves_count + 1 where id = new.video_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos set saves_count = greatest(0, saves_count - 1) where id = old.video_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists saves_contadores on public.saves;
create trigger saves_contadores
  after insert or delete on public.saves
  for each row execute function public.tg_saves();

-- Contador de vídeos do perfil + normalização de hashtags
create or replace function public.tg_videos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.hashtags_norm := (select coalesce(array_agg(lower(h)), '{}') from unnest(new.hashtags) as h);
    update public.profiles set videos_count = videos_count + 1 where id = new.autor_id;
    return new;
  elsif tg_op = 'UPDATE' then
    new.hashtags_norm := (select coalesce(array_agg(lower(h)), '{}') from unnest(new.hashtags) as h);
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles set videos_count = greatest(0, videos_count - 1) where id = old.autor_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists videos_contadores on public.videos;
create trigger videos_contadores
  before insert or update or delete on public.videos
  for each row execute function public.tg_videos();

-- -------------------------------------------------------------------------------------
-- RPCs usadas pelo app
-- -------------------------------------------------------------------------------------

create or replace function public.incrementar_visualizacao(p_video_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.videos set views_count = views_count + 1 where id = p_video_id;
$$;

create or replace function public.incrementar_compartilhamento(p_video_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.videos set shares_count = shares_count + 1 where id = p_video_id;
$$;

create or replace function public.ajustar_espectadores(p_live_id uuid, p_delta integer)
returns void language sql security definer set search_path = public as $$
  update public.live_streams
     set espectadores = greatest(0, espectadores + p_delta)
   where id = p_live_id and ativa;
$$;

-- Registra o token deste aparelho para o usuário logado. Se o token já era de outra conta
-- (troca de usuário no mesmo celular), passa a ser do usuário atual.
create or replace function public.registrar_token_push(p_token text, p_plataforma text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  delete from public.push_tokens where token = p_token and usuario_id <> auth.uid();
  insert into public.push_tokens (token, usuario_id, plataforma, atualizado_em)
  values (p_token, auth.uid(), p_plataforma, now())
  on conflict (token) do update
    set usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, atualizado_em = now();
end;
$$;

create or replace function public.buscar_hashtags(p_termo text)
returns table (tag text, total bigint)
language sql stable security definer set search_path = public as $$
  select min(h) as tag, count(*) as total
    from public.videos v, unnest(v.hashtags) as h
   where lower(h) like '%' || lower(p_termo) || '%'
   group by lower(h)
   order by total desc
   limit 20;
$$;

create or replace function public.hashtags_em_alta(p_limite integer default 12)
returns table (tag text, total bigint)
language sql stable security definer set search_path = public as $$
  select min(h) as tag, count(*) as total
    from public.videos v, unnest(v.hashtags) as h
   where v.criado_em > now() - interval '30 days'
   group by lower(h)
   order by total desc
   limit p_limite;
$$;

create or replace function public.videos_em_alta(p_limite integer default 30)
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  select v.id
    from public.videos v
   where v.criado_em > now() - interval '7 days'
   order by (v.likes_count + v.views_count / 10.0) desc
   limit p_limite;
$$;

create or replace function public.ranking_semanal(p_limite integer default 10)
returns table (id uuid, apelido text, nome text, avatar_url text, curtidas bigint, videos bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.apelido, p.nome, p.avatar_url,
         coalesce(sum(v.likes_count), 0) as curtidas,
         count(v.id) as videos
    from public.videos v
    join public.profiles p on p.id = v.autor_id
   where v.criado_em > now() - interval '7 days'
   group by p.id
   order by curtidas desc
   limit p_limite;
$$;

-- -------------------------------------------------------------------------------------
-- RLS — ativado em TODAS as tabelas
-- -------------------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.videos        enable row level security;
alter table public.likes         enable row level security;
alter table public.comments      enable row level security;
alter table public.follows       enable row level security;
alter table public.saves         enable row level security;
alter table public.live_streams  enable row level security;
alter table public.live_messages enable row level security;
alter table public.reports       enable row level security;
alter table public.blocks        enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens   enable row level security;

-- profiles: leitura pública, escrita só do dono
drop policy if exists "profiles leitura publica" on public.profiles;
create policy "profiles leitura publica" on public.profiles for select using (true);
drop policy if exists "profiles atualizar proprio" on public.profiles;
create policy "profiles atualizar proprio" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles inserir proprio" on public.profiles;
create policy "profiles inserir proprio" on public.profiles for insert with check (auth.uid() = id);

-- Privilégios por coluna: o app (anon/authenticated) nunca lê nem escreve profiles.email.
-- RLS filtra linhas, não colunas — por isso o grant de tabela é trocado por grants por coluna.
revoke select, insert, update on public.profiles from anon, authenticated;
grant select (id, apelido, nome, avatar_url, bio, interesses, seguidores_count, seguindo_count,
              curtidas_recebidas, videos_count, criado_em)
  on public.profiles to anon, authenticated;
grant insert (id, apelido, nome, avatar_url, bio, interesses) on public.profiles to authenticated;
grant update (apelido, nome, avatar_url, bio, interesses) on public.profiles to authenticated;

-- videos: feed público, escrita só do autor
drop policy if exists "videos leitura publica" on public.videos;
create policy "videos leitura publica" on public.videos for select using (true);
drop policy if exists "videos inserir proprio" on public.videos;
create policy "videos inserir proprio" on public.videos for insert with check (auth.uid() = autor_id);
drop policy if exists "videos atualizar proprio" on public.videos;
create policy "videos atualizar proprio" on public.videos for update using (auth.uid() = autor_id);
drop policy if exists "videos excluir proprio" on public.videos;
create policy "videos excluir proprio" on public.videos for delete using (auth.uid() = autor_id);

-- likes / saves / follows: leitura pública (contadores), escrita só do próprio usuário
drop policy if exists "likes leitura" on public.likes;
create policy "likes leitura" on public.likes for select using (true);
drop policy if exists "likes inserir" on public.likes;
create policy "likes inserir" on public.likes for insert with check (auth.uid() = usuario_id);
drop policy if exists "likes excluir" on public.likes;
create policy "likes excluir" on public.likes for delete using (auth.uid() = usuario_id);

drop policy if exists "saves leitura propria" on public.saves;
create policy "saves leitura propria" on public.saves for select using (auth.uid() = usuario_id);
drop policy if exists "saves inserir" on public.saves;
create policy "saves inserir" on public.saves for insert with check (auth.uid() = usuario_id);
drop policy if exists "saves excluir" on public.saves;
create policy "saves excluir" on public.saves for delete using (auth.uid() = usuario_id);

drop policy if exists "follows leitura" on public.follows;
create policy "follows leitura" on public.follows for select using (true);
drop policy if exists "follows inserir" on public.follows;
create policy "follows inserir" on public.follows for insert with check (auth.uid() = seguidor_id);
drop policy if exists "follows excluir" on public.follows;
create policy "follows excluir" on public.follows for delete using (auth.uid() = seguidor_id);

-- comments: leitura pública, escrever/excluir só o autor
drop policy if exists "comments leitura" on public.comments;
create policy "comments leitura" on public.comments for select using (true);
drop policy if exists "comments inserir" on public.comments;
create policy "comments inserir" on public.comments for insert with check (auth.uid() = autor_id);
drop policy if exists "comments excluir" on public.comments;
create policy "comments excluir" on public.comments for delete using (auth.uid() = autor_id);

-- lives: leitura pública, só o anfitrião cria/atualiza
drop policy if exists "lives leitura" on public.live_streams;
create policy "lives leitura" on public.live_streams for select using (true);
drop policy if exists "lives inserir" on public.live_streams;
create policy "lives inserir" on public.live_streams for insert with check (auth.uid() = anfitriao_id);
drop policy if exists "lives atualizar" on public.live_streams;
create policy "lives atualizar" on public.live_streams for update using (auth.uid() = anfitriao_id);

drop policy if exists "live_messages leitura" on public.live_messages;
create policy "live_messages leitura" on public.live_messages for select using (true);
drop policy if exists "live_messages inserir" on public.live_messages;
create policy "live_messages inserir" on public.live_messages for insert with check (auth.uid() = autor_id);

-- reports: quem denuncia vê só as próprias; moderação lê pelo painel (service role)
drop policy if exists "reports inserir" on public.reports;
create policy "reports inserir" on public.reports for insert with check (auth.uid() = denunciante_id);
drop policy if exists "reports leitura propria" on public.reports;
create policy "reports leitura propria" on public.reports for select using (auth.uid() = denunciante_id);

-- blocks: só o próprio usuário
drop policy if exists "blocks leitura propria" on public.blocks;
create policy "blocks leitura propria" on public.blocks for select using (auth.uid() = usuario_id);
drop policy if exists "blocks inserir" on public.blocks;
create policy "blocks inserir" on public.blocks for insert with check (auth.uid() = usuario_id);
drop policy if exists "blocks excluir" on public.blocks;
create policy "blocks excluir" on public.blocks for delete using (auth.uid() = usuario_id);

-- push_tokens: cada usuário só vê/edita os tokens dos próprios aparelhos
drop policy if exists "push_tokens leitura propria" on public.push_tokens;
create policy "push_tokens leitura propria" on public.push_tokens for select using (auth.uid() = usuario_id);
drop policy if exists "push_tokens inserir" on public.push_tokens;
create policy "push_tokens inserir" on public.push_tokens for insert with check (auth.uid() = usuario_id);
drop policy if exists "push_tokens atualizar" on public.push_tokens;
create policy "push_tokens atualizar" on public.push_tokens for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
drop policy if exists "push_tokens excluir" on public.push_tokens;
create policy "push_tokens excluir" on public.push_tokens for delete using (auth.uid() = usuario_id);

-- notifications: só o destinatário lê/marca como lida (inserção é feita por triggers)
drop policy if exists "notifications leitura propria" on public.notifications;
create policy "notifications leitura propria" on public.notifications for select using (auth.uid() = para_id);
drop policy if exists "notifications atualizar propria" on public.notifications;
create policy "notifications atualizar propria" on public.notifications for update using (auth.uid() = para_id);

-- -------------------------------------------------------------------------------------
-- REALTIME (chat e contador da live)
-- -------------------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_messages'
  ) then
    alter publication supabase_realtime add table public.live_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_streams'
  ) then
    alter publication supabase_realtime add table public.live_streams;
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- STORAGE — buckets públicos para leitura; cada usuário escreve só na própria pasta
-- -------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('videos',     'videos',     true, 104857600, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('thumbnails', 'thumbnails', true, 5242880,   array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',    'avatars',    true, 5242880,   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage leitura publica" on storage.objects;
create policy "storage leitura publica" on storage.objects
  for select using (bucket_id in ('videos', 'thumbnails', 'avatars'));

drop policy if exists "storage upload na propria pasta" on storage.objects;
create policy "storage upload na propria pasta" on storage.objects
  for insert with check (
    bucket_id in ('videos', 'thumbnails', 'avatars')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage atualizar na propria pasta" on storage.objects;
create policy "storage atualizar na propria pasta" on storage.objects
  for update using (
    bucket_id in ('videos', 'thumbnails', 'avatars')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "storage excluir na propria pasta" on storage.objects;
create policy "storage excluir na propria pasta" on storage.objects
  for delete using (
    bucket_id in ('videos', 'thumbnails', 'avatars')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

