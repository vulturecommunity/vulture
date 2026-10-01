-- =====================================================================================
-- TROCA DE DOMÍNIO DA MÍDIA — de pub-*.r2.dev para domínio próprio
--
-- POR QUE VIRA FUNÇÃO, E NÃO SQL SOLTO NA DOCUMENTAÇÃO
--
-- O SETUP_R2.md trazia o `update ... replace(...)` para copiar e colar, com um "idem para
-- rasantes, profiles.avatar_url e posts.midias (jsonb)" no fim. Esse "idem" é o problema:
-- quem seguir o passo a passo vai reescrever vídeo e esquecer avatar, ou acertar os dois
-- e não saber o que fazer com o jsonb dos anexos de post — e ficar com metade das imagens
-- apontando para um domínio e metade para o outro, sem erro nenhum aparecer.
--
-- A troca é também o momento mais perigoso do bucket: um prefixo errado no `replace`
-- quebra TODA a mídia de uma vez, e não existe desfazer sem backup.
--
-- Então: uma função, que cobre todas as colunas, roda numa transação só, exige a frase de
-- confirmação e devolve o relatório do que mudou.
--
-- OS ARQUIVOS NÃO SE MOVEM. É o mesmo bucket; muda só o endereço por onde ele é servido.
-- =====================================================================================

create or replace function public.trocar_dominio_de_midia(
  p_antigo      text,
  p_novo        text,
  p_confirmacao text default ''
)
returns table (tabela text, linhas bigint)
language plpgsql
security definer set search_path = public
as $$
declare
  n bigint;
begin
  if p_confirmacao <> 'TROCAR DOMINIO' then
    raise exception 'Envie a confirmação exata: TROCAR DOMINIO' using errcode = '22023';
  end if;

  p_antigo := rtrim(btrim(p_antigo), '/');
  p_novo   := rtrim(btrim(p_novo), '/');

  if p_antigo = '' or p_novo = '' then
    raise exception 'informe a base antiga e a nova' using errcode = '22023';
  end if;
  if p_antigo = p_novo then
    raise exception 'a base nova é igual à antiga' using errcode = '22023';
  end if;
  if p_novo !~ '^https://' then
    raise exception 'a base nova precisa começar com https://' using errcode = '22023';
  end if;

  -- A base nova precisa estar cadastrada ANTES: é ela que a RLS usa para aceitar a mídia.
  -- Sem esta trava, a troca deixaria todo o conteúdo apontando para um endereço que o
  -- próprio banco recusa, e as próximas publicações falhariam.
  if not exists (select 1 from public.origens_de_midia o where o.base = p_novo) then
    raise exception
      'cadastre a base nova primeiro: insert into public.origens_de_midia (base, descricao) values (%L, ''dominio proprio'');',
      p_novo
      using errcode = '23503';
  end if;

  update public.videos
     set url = replace(url, p_antigo, p_novo),
         thumbnail_url = replace(thumbnail_url, p_antigo, p_novo)
   where url like p_antigo || '%' or thumbnail_url like p_antigo || '%';
  get diagnostics n = row_count;
  tabela := 'videos'; linhas := n; return next;

  update public.rasantes
     set url = replace(url, p_antigo, p_novo),
         thumbnail_url = replace(thumbnail_url, p_antigo, p_novo)
   where url like p_antigo || '%' or thumbnail_url like p_antigo || '%';
  get diagnostics n = row_count;
  tabela := 'rasantes'; linhas := n; return next;

  update public.profiles
     set avatar_url = replace(avatar_url, p_antigo, p_novo)
   where avatar_url like p_antigo || '%';
  get diagnostics n = row_count;
  tabela := 'profiles.avatar_url'; linhas := n; return next;

  update public.live_streams
     set thumbnail_url = replace(thumbnail_url, p_antigo, p_novo)
   where thumbnail_url like p_antigo || '%';
  get diagnostics n = row_count;
  tabela := 'live_streams'; linhas := n; return next;

  -- Os anexos de post moram num array jsonb; é o caso que o "idem" da documentação
  -- escondia. Cada elemento é reescrito preservando os outros campos (largura, duração).
  update public.posts p
     set midias = coalesce((
       select jsonb_agg(
         case
           when jsonb_typeof(m) = 'object' then
             m
             || case when m->>'url' like p_antigo || '%'
                     then jsonb_build_object('url', replace(m->>'url', p_antigo, p_novo))
                     else '{}'::jsonb end
             || case when m->>'thumbnailUrl' like p_antigo || '%'
                     then jsonb_build_object(
                            'thumbnailUrl', replace(m->>'thumbnailUrl', p_antigo, p_novo))
                     else '{}'::jsonb end
           else m
         end
         order by i
       )
       from jsonb_array_elements(p.midias) with ordinality as t(m, i)
     ), '[]'::jsonb)
   where p.midias::text like '%' || p_antigo || '%';
  get diagnostics n = row_count;
  tabela := 'posts.midias'; linhas := n; return next;

  return;
end;
$$;

revoke execute on function public.trocar_dominio_de_midia(text, text, text)
  from public, anon, authenticated;

comment on function public.trocar_dominio_de_midia(text, text, text) is
  'Reescreve a base pública da mídia em todas as colunas que guardam URL. '
  'Use scripts/trocar-dominio-midia.sh, que mostra o que vai mudar antes de executar.';

/** Quantas linhas ainda apontam para uma base — para conferir antes e depois. */
create or replace function public.midias_na_base(p_base text)
returns table (tabela text, linhas bigint)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  p_base := rtrim(btrim(p_base), '/');

  return query select 'videos'::text, count(*)
    from public.videos where url like p_base || '%' or thumbnail_url like p_base || '%';
  return query select 'rasantes'::text, count(*)
    from public.rasantes where url like p_base || '%' or thumbnail_url like p_base || '%';
  return query select 'profiles.avatar_url'::text, count(*)
    from public.profiles where avatar_url like p_base || '%';
  return query select 'live_streams'::text, count(*)
    from public.live_streams where thumbnail_url like p_base || '%';
  return query select 'posts.midias'::text, count(*)
    from public.posts where midias::text like '%' || p_base || '%';
end;
$$;

revoke execute on function public.midias_na_base(text) from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Autoteste: a troca pega TODAS as colunas, inclusive o jsonb dos anexos?
--
-- O jsonb é o ponto que a instrução manual escondia atrás de um "idem", então é o que
-- este teste verifica com mais cuidado — inclusive que os outros campos do anexo (largura,
-- duração) sobrevivem à reescrita.
-- -------------------------------------------------------------------------------------

do $$
declare
  autor uuid;
  antiga text := 'https://pub-autoteste.r2.dev';
  nova   text := 'https://midia.autoteste.test';
  sobraram bigint;
  anexo jsonb;
begin
  select id into autor from public.profiles order by criado_em limit 1;
  if autor is null then
    raise notice 'autoteste da troca de dominio: pulado (precisa de 1 perfil)';
    return;
  end if;

  begin
    insert into public.origens_de_midia (base, descricao)
    values (antiga, 'autoteste'), (nova, 'autoteste')
    on conflict (base) do nothing;

    insert into public.videos (autor_id, url, thumbnail_url, legenda)
    values (autor, antiga || '/videos/a.mp4', antiga || '/thumbnails/a.jpg', 'autoteste');

    update public.profiles set avatar_url = antiga || '/avatars/a.jpg' where id = autor;

    insert into public.posts (autor_id, texto, midias)
    values (autor, 'com anexo', jsonb_build_array(jsonb_build_object(
      'tipo', 'imagem',
      'url', antiga || '/posts/a.jpg',
      'thumbnailUrl', antiga || '/posts/a-thumb.jpg',
      'largura', 1080, 'altura', 1920, 'duracao', null
    )));

    perform public.trocar_dominio_de_midia(antiga, nova, 'TROCAR DOMINIO');

    select sum(linhas) into sobraram from public.midias_na_base(antiga);
    if sobraram > 0 then
      raise exception 'sobraram % linha(s) apontando para a base antiga', sobraram;
    end if;

    select p.midias->0 into anexo
      from public.posts p where p.texto = 'com anexo' limit 1;

    if anexo->>'url' <> nova || '/posts/a.jpg' then
      raise exception 'a url do anexo nao foi reescrita: %', anexo->>'url';
    end if;
    if anexo->>'thumbnailUrl' <> nova || '/posts/a-thumb.jpg' then
      raise exception 'a miniatura do anexo nao foi reescrita: %', anexo->>'thumbnailUrl';
    end if;
    -- os campos que não são URL precisam sobreviver intactos
    if (anexo->>'largura')::int <> 1080 or anexo->>'tipo' <> 'imagem' then
      raise exception 'a reescrita do jsonb perdeu campos do anexo: %', anexo::text;
    end if;

    -- sem a base cadastrada, precisa recusar
    begin
      perform public.trocar_dominio_de_midia(nova, 'https://nao-cadastrada.test', 'TROCAR DOMINIO');
      raise exception 'deveria ter recusado base nao cadastrada';
    exception
      when sqlstate '23503' then null;   -- esperado
    end;

    -- sem a frase, também recusa
    begin
      perform public.trocar_dominio_de_midia(nova, antiga, 'sim');
      raise exception 'deveria ter recusado confirmacao invalida';
    exception
      when sqlstate '22023' then null;   -- esperado
    end;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste da troca de dominio: OK (dados de teste desfeitos)';
  end;
end $$;
