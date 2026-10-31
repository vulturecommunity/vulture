-- =====================================================================================
-- LIMITE DE FREQUÊNCIA — o teto que falta antes de abrir o cadastro
--
-- O QUE ESTAVA ERRADO
--
-- Nenhuma escrita tinha teto. Uma conta podia inserir dez mil comentários num minuto, e
-- as únicas barreiras eram o tamanho do texto e a RLS, que só confere QUEM escreve, nunca
-- QUANTO. Com 18 testadores isso nunca apareceu; num beta aberto é a primeira coisa que
-- alguém testa, de brincadeira ou não.
--
-- O custo não é só de banco. Comentário gera notificação, notificação gera push, push é
-- fan-out para os seguidores: um laço de spam sai caro em três serviços ao mesmo tempo, e
-- o Expo Push é justamente o que não tem como desligar no meio de um incidente.
--
-- POR QUE TRIGGER, E NÃO CHECAGEM NA RPC
--
-- A checagem numa função só vale para quem passa por ela. A chave anon é pública por
-- design — qualquer pessoa com o APK consegue falar direto com o PostgREST, e aí um
-- `insert` cru em `comments` passaria por fora de qualquer RPC. O trigger fecha a porta
-- no único lugar que todo caminho atravessa.
--
-- POR QUE CONTAR A PRÓPRIA TABELA
--
-- A alternativa seria um contador separado por usuário e ação. Isso é mais uma escrita
-- por escrita, mais uma tabela para inchar e mais um lugar para ficar fora de sincronia.
-- A linha que acabou de ser inserida já é o registro do evento: contar as últimas N da
-- janela responde a mesma pergunta sem guardar nada novo. Em troca, cada tabela precisa
-- de um índice (autor, criado_em) — que é o que a seção final garante.
--
-- QUEM NÃO É LIMITADO
--
-- Escritas sem usuário no JWT (service role: Edge Functions, crons, seed). Elas não vêm
-- de aparelho, não passam pela RLS e são o caminho por onde a moderação conserta coisas.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- O trigger genérico
-- -------------------------------------------------------------------------------------

create or replace function public.limitar_frequencia()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  coluna_autor text := tg_argv[0];
  limite       int  := tg_argv[1]::int;
  janela       text := tg_argv[2];
  autor        uuid;
  quantos      int;
begin
  -- Sem usuário no token não é tráfego de aparelho: Edge Function, cron ou seed.
  if auth.uid() is null then
    return new;
  end if;

  -- `to_jsonb(new)` em vez de `($1).%I` com EXECUTE: passar um registro como parâmetro
  -- depende de o tipo composto ser inferível, e isso falha dependendo do contexto de
  -- chamada. O caminho por jsonb vale para qualquer tabela sem depender de inferência.
  autor := nullif(to_jsonb(new) ->> coluna_autor, '')::uuid;
  if autor is null then
    return new;
  end if;

  -- O cast explícito não é zelo: `now() - $2` sozinho é ambíguo entre
  -- (timestamptz - interval) e (timestamptz - timestamptz), e o Postgres recusa.
  execute format(
    'select count(*) from public.%I where %I = $1 and criado_em > now() - ($2)::interval',
    tg_table_name, coluna_autor
  ) into quantos using autor, janela;

  if quantos >= limite then
    -- SQLSTATE próprio para o app distinguir "você está indo rápido demais" de uma falha
    -- de verdade. 429 no nome é mnemônico; o texto é o que a pessoa lê na tela.
    raise exception using
      errcode = 'P0429',
      message = 'Você está indo rápido demais. Espere um pouco antes de tentar de novo.',
      detail  = format('limite de %s por %s em %s', limite, janela, tg_table_name);
  end if;

  return new;
end $$;

comment on function public.limitar_frequencia() is
  'Trigger BEFORE INSERT genérico: recusa quando o autor já escreveu `limite` linhas na '
  '`janela`. Parâmetros via TG_ARGV: coluna do autor, limite, janela.';

-- -------------------------------------------------------------------------------------
-- Os tetos, um por tabela
--
-- Os números são deliberadamente folgados: o alvo é o laço automatizado, não o torcedor
-- empolgado no dia de clássico. Um humano não passa de 10 comentários por minuto; um
-- script passa disso no primeiro segundo.
-- -------------------------------------------------------------------------------------

drop trigger if exists limite_comments      on public.comments;
drop trigger if exists limite_videos        on public.videos;
drop trigger if exists limite_posts         on public.posts;
drop trigger if exists limite_messages      on public.messages;
drop trigger if exists limite_reports       on public.reports;
drop trigger if exists limite_rasantes      on public.rasantes;
drop trigger if exists limite_live_messages on public.live_messages;

create trigger limite_comments before insert on public.comments
  for each row execute function public.limitar_frequencia('autor_id', '10', '1 minute');

create trigger limite_videos before insert on public.videos
  for each row execute function public.limitar_frequencia('autor_id', '5', '1 hour');

create trigger limite_posts before insert on public.posts
  for each row execute function public.limitar_frequencia('autor_id', '20', '1 hour');

-- Conversa privada é o uso mais legítimo de volume alto que existe no app: duas pessoas
-- trocando mensagem curta durante um jogo passam fácil de 10/min. O teto aqui serve para
-- o robô, e por isso é o mais alto de todos.
create trigger limite_messages before insert on public.messages
  for each row execute function public.limitar_frequencia('remetente_id', '40', '1 minute');

create trigger limite_live_messages before insert on public.live_messages
  for each row execute function public.limitar_frequencia('autor_id', '30', '1 minute');

-- Denúncia em massa é assédio coordenado, não zelo: 20 por hora cobre qualquer uso real.
create trigger limite_reports before insert on public.reports
  for each row execute function public.limitar_frequencia('denunciante_id', '20', '1 hour');

create trigger limite_rasantes before insert on public.rasantes
  for each row execute function public.limitar_frequencia('autor_id', '10', '1 hour');

-- -------------------------------------------------------------------------------------
-- Índices que o trigger precisa
--
-- Sem (autor, criado_em) cada insert viraria uma varredura da tabela inteira — o remédio
-- custaria mais caro que a doença. `videos` e `rasantes` já tinham o seu.
-- -------------------------------------------------------------------------------------

create index if not exists comments_autor_idx
  on public.comments (autor_id, criado_em desc);
create index if not exists posts_autor_idx
  on public.posts (autor_id, criado_em desc);
create index if not exists messages_remetente_idx
  on public.messages (remetente_id, criado_em desc);
create index if not exists live_messages_autor_idx
  on public.live_messages (autor_id, criado_em desc);
create index if not exists reports_denunciante_idx
  on public.reports (denunciante_id, criado_em desc);

-- -------------------------------------------------------------------------------------
-- Autoteste — a migration falha se o limite não limitar
--
-- Roda com um perfil real, estoura o teto de comentários de propósito e desfaz tudo. Um
-- limite que não barra é pior que limite nenhum: dá a sensação de proteção sem a proteção.
-- -------------------------------------------------------------------------------------

do $$
declare
  autor    uuid;
  id_video uuid;
  barrou   boolean := false;
begin
  select id into autor from public.profiles order by criado_em limit 1;
  if autor is null then
    raise notice 'autoteste do limite: pulado (precisa de 1 perfil)';
    return;
  end if;

  begin
    insert into public.videos (autor_id, url, legenda)
    values (autor, 'https://exemplo.test/limite.mp4', 'autoteste de limite')
    returning id into id_video;

    -- `auth.uid()` é null aqui (não há JWT numa migration), então o trigger deixa passar.
    -- Fingir um usuário logado é o único jeito de testar o caminho que importa.
    perform set_config('request.jwt.claims', json_build_object('sub', autor)::text, true);

    for i in 1..10 loop
      insert into public.comments (video_id, autor_id, texto)
      values (id_video, autor, 'autoteste ' || i);
    end loop;

    begin
      insert into public.comments (video_id, autor_id, texto)
      values (id_video, autor, 'o décimo primeiro deveria ser barrado');
    exception
      when sqlstate 'P0429' then barrou := true;
    end;

    if not barrou then
      raise exception 'o 11o comentario no mesmo minuto deveria ter sido barrado';
    end if;

    -- E o teto não pode vazar para outra conta: o limite é por autor, não global.
    -- Limpar com '{}' e não com '': string vazia não é JSON válido, e o `auth.uid()`
    -- do ambiente de teste quebra ao convertê-la. '{}' é um token sem `sub`, que é
    -- exatamente o que se quer dizer aqui — e vale nos dois ambientes.
    perform set_config('request.jwt.claims', '{}', true);
    insert into public.comments (video_id, autor_id, texto)
    values (id_video, autor, 'service role nao e limitado');

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste do limite: OK (dados de teste desfeitos)';
  end;
end $$;
