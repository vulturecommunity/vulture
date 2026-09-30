-- =====================================================================================
-- MÍDIA NO CLOUDFLARE R2 — a RLS precisa reconhecer a nova origem
--
-- A regra que valida os anexos da resenha aceitava exatamente um endereço:
--
--   ^https://<projeto>.supabase.co/storage/v1/object/public/posts/<autor>/
--
-- Isso é o que impede alguém de colar no post a URL de um arquivo alheio (ou de um site
-- qualquer) em vez de enviar o próprio. A regra continua valendo — só passa a conhecer
-- mais de um endereço válido, porque a mídia nova vai para o R2, onde egress é zero.
--
-- As duas origens convivem: os arquivos já enviados continuam na Supabase e seguem sendo
-- servidos. Nada é migrado — num app de mídia, "o grande dia da migração" é justamente o
-- que não se deve fazer.
-- =====================================================================================

create table if not exists public.origens_de_midia (
  -- base pública do bucket, SEM barra no fim (ex.: https://midia.seuapp.com)
  base      text primary key check (base ~ '^https://[A-Za-z0-9._-]+(:[0-9]+)?(/[A-Za-z0-9._-]+)*$'),
  descricao text not null default '',
  criado_em timestamptz not null default now()
);

comment on table public.origens_de_midia is
  'Endereços públicos de onde a mídia do app pode vir. Precisa bater com '
  'EXPO_PUBLIC_MIDIA_URL no .env do app e com R2_PUBLIC_URL nas Edge Functions.';

alter table public.origens_de_midia enable row level security;
-- só as funções security definer leem; o app não precisa e não deve escrever
revoke all on public.origens_de_midia from anon, authenticated;

/**
 * O arquivo está na pasta "posts" do próprio autor, em alguma origem conhecida?
 *
 * Aceita o Storage da Supabase (formato antigo, embutido) e qualquer base cadastrada em
 * origens_de_midia (o R2). `starts_with` em vez de LIKE para não tratar caractere
 * nenhum da URL como curinga.
 */
create or replace function public.midia_na_pasta_do_autor(p_url text, p_autor uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce(p_url, '') ~
           ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/posts/'
            || p_autor::text || '/')
      or exists (
        select 1 from public.origens_de_midia o
         where starts_with(coalesce(p_url, ''), o.base || '/posts/' || p_autor::text || '/')
      );
$$;

-- Passa a ser STABLE (lê tabela) em vez de IMMUTABLE. É usada só na policy de INSERT de
-- posts, e policy aceita função stable — ao contrário de uma CHECK constraint de tabela.
create or replace function public.midias_do_post_validas(p_midias jsonb, p_autor uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case
    when jsonb_typeof(p_midias) is distinct from 'array' then false
    when jsonb_array_length(p_midias) > 4 then false
    when jsonb_array_length(p_midias) > 1
      and exists (select 1 from jsonb_array_elements(p_midias) m where m->>'tipo' <> 'imagem')
      then false
    else not exists (
      select 1
      from jsonb_array_elements(p_midias) m
      where not case m->>'tipo'
        when 'imagem' then public.midia_na_pasta_do_autor(m->>'url', p_autor)
        when 'video' then public.midia_na_pasta_do_autor(m->>'url', p_autor)
          and (m->>'thumbnailUrl' is null
               or public.midia_na_pasta_do_autor(m->>'thumbnailUrl', p_autor))
          and coalesce((m->>'duracao')::numeric, 0) <= 31
        when 'gif' then coalesce(m->>'url', '') ~ '^https://media[0-9]*\.giphy\.com/'
        else false
      end
    )
  end;
$$;

-- a policy referencia a função pelo nome, mas recriamos para não depender da ordem
drop policy if exists "posts inserir proprio" on public.posts;
create policy "posts inserir proprio" on public.posts for insert
  with check (auth.uid() = autor_id and public.midias_do_post_validas(midias, auth.uid()));

-- -------------------------------------------------------------------------------------
-- Autoteste: sem isto, um erro aqui só apareceria quando alguém tentasse postar uma foto
-- e levasse "violates row-level security" sem explicação.
-- -------------------------------------------------------------------------------------

do $$
declare
  autor uuid := '11111111-1111-1111-1111-111111111111';
  base  text := 'https://midia.autoteste.exemplo';
  supa  text := 'https://abc123.supabase.co/storage/v1/object/public/posts/'
                || '11111111-1111-1111-1111-111111111111/foto.jpg';
  nova  text := 'https://midia.autoteste.exemplo/posts/'
                || '11111111-1111-1111-1111-111111111111/foto.jpg';
  alheia text := 'https://midia.autoteste.exemplo/posts/'
                || '22222222-2222-2222-2222-222222222222/foto.jpg';
begin
  begin
    insert into public.origens_de_midia (base, descricao) values (base, 'autoteste');

    if not public.midias_do_post_validas(
         jsonb_build_array(jsonb_build_object('tipo', 'imagem', 'url', supa)), autor) then
      raise exception 'origem antiga (Supabase Storage) deixou de ser aceita';
    end if;

    if not public.midias_do_post_validas(
         jsonb_build_array(jsonb_build_object('tipo', 'imagem', 'url', nova)), autor) then
      raise exception 'origem nova (R2) nao foi aceita';
    end if;

    if public.midias_do_post_validas(
         jsonb_build_array(jsonb_build_object('tipo', 'imagem', 'url', alheia)), autor) then
      raise exception 'aceitou arquivo da pasta de OUTRO usuario no R2';
    end if;

    if public.midias_do_post_validas(
         jsonb_build_array(jsonb_build_object(
           'tipo', 'imagem', 'url', 'https://site-qualquer.com/posts/' || autor || '/x.jpg')),
         autor) then
      raise exception 'aceitou URL de origem nao cadastrada';
    end if;

    if not public.midias_do_post_validas(
         jsonb_build_array(jsonb_build_object(
           'tipo', 'gif', 'url', 'https://media1.giphy.com/media/x/giphy.gif')), autor) then
      raise exception 'GIF do GIPHY deixou de ser aceito';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste de origens de midia: OK (origem de teste desfeita)';
  end;
end $$;
