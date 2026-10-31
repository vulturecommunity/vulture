-- =====================================================================================
-- RANKING DO FEED — "Para você" deixa de ser ordem de chegada
--
-- O QUE ESTAVA ERRADO
--
-- `feed_ids` terminava em `order by v.criado_em desc` para as DUAS abas. Ou seja: a aba
-- "Para você" era a aba "Mais recente", só que com outro nome. Num app de vídeo vertical
-- isso tem três consequências, e as três doem mais quanto MENOS conteúdo existe:
--
--   1. Abrir o app duas vezes no mesmo dia mostra exatamente a mesma coisa. Não há motivo
--      para voltar à tarde se de manhã já passou pelos dez vídeos do dia.
--   2. Um vídeo bom publicado anteontem nunca mais reaparece. Com poucos criadores, jogar
--      fora o acervo bom é jogar fora quase tudo que existe.
--   3. Quem publica muito ocupa a tela inteira. Dois autores ativos bastam para sufocar
--      os outros, e quem foi sufocado para de publicar — o que piora o problema.
--
-- O QUE ENTRA
--
-- Um score por vídeo, materializado numa coluna e recalculado a cada 5 min pelo pg_cron,
-- com três fatores:
--
--   qualidade = ln(1 + curtidas*3 + comentarios*5 + compartilhamentos*8 + views*0,1)
--   frescor   = exp(-horas/24)        -- decaimento exponencial, ~37% do peso em 24h
--   rodizio   = 0,7 ^ (n-1)           -- n = posição do vídeo entre os do mesmo autor
--
--   score = (0,5 + qualidade) * frescor * rodizio
--
-- POR QUE O LOGARITMO
--
-- Sem ele, um vídeo com 1.000 curtidas vale mil vezes um com 1, e o feed vira um pódio
-- congelado dos mesmos cinco vídeos. O log comprime a cauda: 1.000 curtidas valem ~3x o
-- peso de 10, não 100x. Continua premiando o que é bom sem deixar nada mais aparecer.
--
-- POR QUE O `0,5 +`
--
-- É o piso de quem acabou de publicar e ainda não tem engajamento nenhum. Sem esse piso o
-- score de um vídeo novo seria zero vezes qualquer coisa — zero — e um criador novo nunca
-- sairia do fundo. O piso faz o frescor sozinho carregar o vídeo nas primeiras horas, que
-- é exatamente a janela em que ele precisa de uma chance para conseguir engajamento.
--
-- POR QUE "SEGUINDO" CONTINUA CRONOLÓGICA
--
-- Quem abre essa aba pediu uma coisa específica: o que as pessoas que eu sigo postaram.
-- Reordenar isso é desobedecer. A aba "Para você" é a que tem licença para escolher.
--
-- O QUE FICA PARA DEPOIS (Fase C do ROADMAP)
--
-- Filtragem colaborativa, embeddings e A/B. Isto aqui é o "ranking v1 sem ML" — serve
-- para ter o que comparar quando o v2 chegar, e para parar de perder gente enquanto isso.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- A coluna
-- -------------------------------------------------------------------------------------

alter table public.videos add column if not exists feed_score real not null default 0;

comment on column public.videos.feed_score is
  'Score global do vídeo para a aba "Para você", recalculado a cada 5 min por '
  '`recalcular_feed_scores()`. O ajuste por interesse do usuário é aplicado na consulta, '
  'não aqui — este número é igual para todo mundo.';

-- Índice da ordenação do feed. O parcial corta o acervo frio: vídeo velho tem score 0 e
-- nunca é lido por esse caminho, então não precisa ocupar o índice.
create index if not exists videos_feed_score_idx
  on public.videos (feed_score desc, criado_em desc)
  where feed_score > 0;

-- -------------------------------------------------------------------------------------
-- O recálculo
-- -------------------------------------------------------------------------------------

create or replace function public.recalcular_feed_scores()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  afetados integer;
begin
  -- Dois recálculos simultâneos fariam o mesmo trabalho duas vezes e brigariam pelas
  -- mesmas linhas. O mesmo padrão de `atualizar_descoberta()`.
  if not pg_try_advisory_xact_lock(hashtext('recalcular_feed_scores')) then
    return 0;
  end if;

  with recente as (
    select
      v.id,
      v.autor_id,
      v.criado_em,
      ln(
        1 + greatest(
          0,
          v.likes_count * 3.0
          + v.comments_count * 5.0
          + v.shares_count * 8.0
          + v.views_count * 0.1
        )
      ) as qualidade,
      -- `greatest(0, ...)` protege contra data no futuro (relógio do cliente adiantado,
      -- importação com data errada): sem ele o expoente fica positivo e um único vídeo
      -- com data de amanhã dominaria o feed inteiro.
      exp(
        -greatest(0, extract(epoch from (now() - v.criado_em))) / 3600.0 / 24.0
      ) as frescor
      from public.videos v
     where v.criado_em > now() - interval '30 days'
  ),
  com_rodizio as (
    select
      r.id,
      (0.5 + r.qualidade)
        * r.frescor
        -- Rodízio de autor: o melhor vídeo de cada pessoa entra inteiro, o segundo com
        -- 70% do peso, o terceiro com 49%. Não esconde ninguém; só impede que uma conta
        -- sozinha ocupe a tela toda.
        * power(0.7, row_number() over (
            partition by r.autor_id
            order by (0.5 + r.qualidade) * r.frescor desc, r.criado_em desc
          ) - 1)
      as score
      from recente r
  )
  update public.videos v
     set feed_score = c.score
    from com_rodizio c
   where v.id = c.id
     -- `is distinct from` com margem: reescrever milhares de linhas para mudar a sétima
     -- casa decimal só gera bloat e trabalho de autovacuum.
     and abs(v.feed_score - c.score) > 0.0001;

  get diagnostics afetados = row_count;

  -- O acervo que saiu da janela volta a zero uma vez só, não a cada rodada.
  update public.videos
     set feed_score = 0
   where feed_score <> 0
     and criado_em <= now() - interval '30 days';

  return afetados;
end $$;

comment on function public.recalcular_feed_scores() is
  'Recalcula `videos.feed_score` para os últimos 30 dias. Idempotente e protegida por '
  'advisory lock; devolve quantas linhas mudaram.';

revoke execute on function public.recalcular_feed_scores() from public, anon, authenticated;

-- -------------------------------------------------------------------------------------
-- A nova `feed_ids`
--
-- Mesma assinatura de antes com uma diferença: `p_cursor` deixa de ser timestamptz e
-- passa a ser um texto opaco. Para "seguindo" ele continua sendo a data (o comportamento
-- não mudou); para "para-voce" é "score|data", porque a ordenação agora tem duas chaves e
-- paginar por uma só pularia ou repetiria vídeos.
-- -------------------------------------------------------------------------------------

drop function if exists public.feed_ids(text, timestamptz, integer, text, text);

create or replace function public.feed_ids(
  p_aba       text    default 'para-voce',
  p_cursor    text    default null,
  p_limite    integer default 10,
  p_categoria text    default null,
  p_hashtag   text    default null
)
returns table (id uuid, criado_em timestamptz, cursor text)
language sql
stable
security definer set search_path = public
as $$
  with eu as (
    select coalesce(p.interesses, '{}'::text[]) as interesses
      from public.profiles p
     where p.id = auth.uid()
  ),
  base as (
    select
      v.id,
      v.criado_em,
      -- Os dois ajustes que mudam de pessoa para pessoa vivem aqui, e não na coluna
      -- materializada, que é igual para todo mundo.
      (v.feed_score
        * case
            when exists (select 1 from eu where v.categoria = any(eu.interesses)) then 1.25
            else 1.0
          end
        -- Impulso de estreia: o vídeo que a própria pessoa acabou de publicar vai para o
        -- topo do feed DELA por duas horas. Não é favorecimento, é confirmação — quem
        -- publica abre o feed para ver se deu certo, e num ranking honesto o vídeo
        -- recém-nascido não tem engajamento e perde de qualquer vídeo estabelecido. Sem
        -- isto a conclusão natural é "o app perdeu meu vídeo", e não há segunda tentativa.
        * case
            when v.autor_id = auth.uid() and v.criado_em > now() - interval '2 hours'
              then 100.0
            else 1.0
          end)::real as score
      from public.videos v
     where (p_categoria is null or v.categoria = p_categoria)
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
  ),
  ordenado as (
    select
      b.id,
      b.criado_em,
      b.score,
      case
        when p_aba = 'seguindo' then b.criado_em::text
        else b.score::text || '|' || b.criado_em::text
      end as cursor
      from base b
  )
  select o.id, o.criado_em, o.cursor
    from ordenado o
   where p_cursor is null
      or (
        case
          when p_aba = 'seguindo' then o.criado_em < p_cursor::timestamptz
          else
            o.score < split_part(p_cursor, '|', 1)::real
            or (
              o.score = split_part(p_cursor, '|', 1)::real
              and o.criado_em < split_part(p_cursor, '|', 2)::timestamptz
            )
        end
      )
   order by
     case when p_aba = 'seguindo' then 0 else o.score end desc,
     o.criado_em desc
   limit least(greatest(p_limite, 1), 50);
$$;

comment on function public.feed_ids(text, text, integer, text, text) is
  'Ordem e filtros do feed. "para-voce" ordena por `feed_score` (com ajuste de interesse); '
  '"seguindo" segue cronológica. `p_cursor` é opaco: use o `cursor` da última linha.';

-- O `drop` acima levou junto o grant da versão antiga (migration 20260924120500). Sem
-- recriá-lo o app perde a permissão de executar a função e o feed para de carregar para
-- todo mundo — uma falha que nenhum autoteste pega, porque migration roda como dono.
grant execute on function public.feed_ids(text, text, integer, text, text)
  to anon, authenticated;

-- -------------------------------------------------------------------------------------
-- Agendamento: mesmo ritmo da descoberta (trending, hashtags, ranking)
-- -------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform public.agendar('recalcular-feed-scores', '*/5 * * * *',
                           'select public.recalcular_feed_scores();');
  else
    raise notice 'pg_cron ausente: agende recalcular_feed_scores manualmente';
  end if;
end $$;

-- Primeira carga: sem isto o feed abriria com todo mundo em zero até o cron rodar.
select public.recalcular_feed_scores();

-- -------------------------------------------------------------------------------------
-- Autoteste — o ranking precisa ranquear, e a paginação não pode repetir vídeo
-- -------------------------------------------------------------------------------------

do $$
declare
  autor      uuid;
  campeao    uuid;
  esquecido  uuid;
  novato     uuid;
  score_campeao real;
  score_esquecido real;
  primeira   uuid[];
  segunda    uuid[];
  cursor_1   text;
begin
  select id into autor from public.profiles order by criado_em limit 1;
  if autor is null then
    raise notice 'autoteste do ranking: pulado (precisa de 1 perfil)';
    return;
  end if;

  begin
    -- Mesmo autor nos três para isolar o efeito do engajamento e da idade do rodízio.
    insert into public.videos (autor_id, url, legenda, likes_count, criado_em)
    values (autor, 'https://exemplo.test/campeao.mp4', 'autoteste campeao', 500, now())
    returning id into campeao;

    insert into public.videos (autor_id, url, legenda, likes_count, criado_em)
    values (autor, 'https://exemplo.test/esquecido.mp4', 'autoteste esquecido', 500,
            now() - interval '10 days')
    returning id into esquecido;

    insert into public.videos (autor_id, url, legenda, likes_count, criado_em)
    values (autor, 'https://exemplo.test/novato.mp4', 'autoteste novato', 0, now())
    returning id into novato;

    perform public.recalcular_feed_scores();

    select feed_score into score_campeao   from public.videos where id = campeao;
    select feed_score into score_esquecido from public.videos where id = esquecido;

    if score_campeao <= score_esquecido then
      raise exception 'vídeo novo com o mesmo engajamento deveria ganhar do de 10 dias (% vs %)',
        score_campeao, score_esquecido;
    end if;

    if (select feed_score from public.videos where id = novato) <= 0 then
      raise exception 'vídeo recém-publicado sem engajamento precisa de score > 0, senão criador novo nunca aparece';
    end if;

    -- Paginação: duas páginas de 1 não podem devolver o mesmo id.
    perform set_config('request.jwt.claims', json_build_object('sub', autor)::text, true);

    select array_agg(f.id), max(f.cursor) into primeira, cursor_1
      from public.feed_ids('para-voce', null, 1) f;

    select array_agg(f.id) into segunda
      from public.feed_ids('para-voce', cursor_1, 1) f;

    if primeira is null or segunda is null then
      raise exception 'as duas paginas do feed deveriam ter vindo preenchidas';
    end if;
    if primeira[1] = segunda[1] then
      raise exception 'a segunda pagina repetiu o video da primeira — cursor nao avancou';
    end if;

    -- Limpar com '{}' e não com '': string vazia não é JSON válido, e o `auth.uid()`
    -- do ambiente de teste quebra ao convertê-la. '{}' é um token sem `sub`, que é
    -- exatamente o que se quer dizer aqui — e vale nos dois ambientes.
    perform set_config('request.jwt.claims', '{}', true);
    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste do ranking: OK (dados de teste desfeitos)';
  end;
end $$;
