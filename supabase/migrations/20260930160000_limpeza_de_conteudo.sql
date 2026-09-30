-- =====================================================================================
-- LIMPEZA DE CONTEÚDO — zerar o app sem perder as contas
--
-- Para o piloto: apagar tudo que consome recurso (vídeo, foto, post, palpite, histórico)
-- mantendo quem já se cadastrou. Assim dá para recomeçar os testes do zero sem gastar
-- cota de armazenamento e sem fazer ninguém criar conta de novo.
--
-- O QUE FICA
--
--   auth.users + profiles ..... as contas. É o ponto da operação.
--   push_tokens ............... o aparelho continua registrado para receber push
--   administradores ........... quem recebe alerta de infraestrutura
--   origens_de_midia .......... configuração do R2 (apagar quebraria o upload)
--   plano_de_midia ............ limites do monitor de custo
--   partidas .................. calendário do Flamengo (vem da Highlightly, não é
--                               conteúdo de usuário; apagar só faria a Arquibancada
--                               ficar vazia até o próximo cron)
--   calendario_estado ......... controle da cota diária da API de jogos
--
-- O QUE SAI
--
--   Tudo que usuário produziu: vídeo, post, comentário, curtida, palpite, liga,
--   conversa, rasante, live, notificação, denúncia — e os agregados derivados disso
--   (ranking, títulos, resumo de palpites, filas).
--
-- OS ARQUIVOS NÃO SAEM DAQUI. Esta função mexe só no Postgres; o que ocupa espaço de
-- verdade são os objetos no R2, apagados pela Edge Function `limpar-tudo`, que chama
-- esta função depois. Rodar só o SQL deixaria arquivo órfão ocupando cota para sempre.
-- =====================================================================================

create or replace function public.limpar_conteudo(p_confirmacao text)
returns table (tabela text, apagadas bigint)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  n bigint;
begin
  -- Trava proposital: sem a frase exata, não roda. Uma função destrutiva que dispara
  -- por chamada acidental é questão de tempo.
  if p_confirmacao is distinct from 'APAGAR CONTEUDO' then
    raise exception
      'Confirmação inválida. Para executar, chame com: limpar_conteudo(''APAGAR CONTEUDO'')'
      using errcode = '22023';
  end if;

  create temp table _relatorio (tabela text, apagadas bigint) on commit drop;

  -- Ordem: dependentes primeiro. Vários teriam cascata, mas apagar explicitamente
  -- permite relatar quanto saiu de cada lugar.
  delete from public.post_likes;            get diagnostics n = row_count;
  insert into _relatorio values ('post_likes', n);
  delete from public.posts;                 get diagnostics n = row_count;
  insert into _relatorio values ('posts', n);

  delete from public.likes;                 get diagnostics n = row_count;
  insert into _relatorio values ('likes', n);
  delete from public.saves;                 get diagnostics n = row_count;
  insert into _relatorio values ('saves', n);
  delete from public.comments;              get diagnostics n = row_count;
  insert into _relatorio values ('comments', n);
  delete from public.videos;                get diagnostics n = row_count;
  insert into _relatorio values ('videos', n);

  delete from public.rasante_views;         get diagnostics n = row_count;
  insert into _relatorio values ('rasante_views', n);
  delete from public.rasantes;              get diagnostics n = row_count;
  insert into _relatorio values ('rasantes', n);

  delete from public.live_messages;         get diagnostics n = row_count;
  insert into _relatorio values ('live_messages', n);
  delete from public.live_streams;          get diagnostics n = row_count;
  insert into _relatorio values ('live_streams', n);

  delete from public.messages;              get diagnostics n = row_count;
  insert into _relatorio values ('messages', n);
  delete from public.conversations;         get diagnostics n = row_count;
  insert into _relatorio values ('conversations', n);

  delete from public.liga_membros;          get diagnostics n = row_count;
  insert into _relatorio values ('liga_membros', n);
  delete from public.ligas;                 get diagnostics n = row_count;
  insert into _relatorio values ('ligas', n);

  delete from public.titulos;               get diagnostics n = row_count;
  insert into _relatorio values ('titulos', n);
  delete from public.ranking_palpiteiros;   get diagnostics n = row_count;
  insert into _relatorio values ('ranking_palpiteiros', n);
  delete from public.fila_apuracao;         get diagnostics n = row_count;
  insert into _relatorio values ('fila_apuracao', n);
  delete from public.palpites;              get diagnostics n = row_count;
  insert into _relatorio values ('palpites', n);
  delete from public.palpites_resumo;       get diagnostics n = row_count;
  insert into _relatorio values ('palpites_resumo', n);

  delete from public.follows;               get diagnostics n = row_count;
  insert into _relatorio values ('follows', n);
  delete from public.blocks;                get diagnostics n = row_count;
  insert into _relatorio values ('blocks', n);
  delete from public.reports;               get diagnostics n = row_count;
  insert into _relatorio values ('reports', n);
  delete from public.notifications;         get diagnostics n = row_count;
  insert into _relatorio values ('notifications', n);

  delete from public.push_pendente;         get diagnostics n = row_count;
  insert into _relatorio values ('push_pendente', n);
  delete from public.contador_pendente;     get diagnostics n = row_count;
  insert into _relatorio values ('contador_pendente', n);
  delete from public.alertas_de_infra;      get diagnostics n = row_count;
  insert into _relatorio values ('alertas_de_infra', n);
  delete from public.uso_do_bucket;         get diagnostics n = row_count;
  insert into _relatorio values ('uso_do_bucket', n);

  -- A partida volta a aceitar palpite: sem isto, jogo já apurado continuaria marcado e
  -- o ranking nunca mais seria recalculado para ele.
  update public.partidas set apurada_em = null, lembrete_em = null
   where apurada_em is not null or lembrete_em is not null;

  -- Contadores denormalizados apontariam para conteúdo que não existe mais.
  update public.profiles
     set videos_count = 0, curtidas_recebidas = 0, seguidores_count = 0, seguindo_count = 0
   where videos_count <> 0 or curtidas_recebidas <> 0
      or seguidores_count <> 0 or seguindo_count <> 0;

  return query select r.tabela, r.apagadas from _relatorio r
                where r.apagadas > 0 order by r.apagadas desc, r.tabela;
end;
$$;

revoke execute on function public.limpar_conteudo(text) from public, anon, authenticated;

comment on function public.limpar_conteudo(text) is
  'Apaga conteúdo de usuário preservando contas e configuração. Não mexe nos arquivos '
  'do R2 — use a Edge Function limpar-tudo, que faz as duas coisas na ordem certa.';

-- -------------------------------------------------------------------------------------
-- Autoteste: cria conteúdo falso, limpa, e confere que a CONTA sobreviveu.
-- Tudo desfeito no fim — nenhum dado real é tocado.
-- -------------------------------------------------------------------------------------

do $$
declare
  dono uuid;
  perfis_antes bigint;
  perfis_depois bigint;
  videos_depois bigint;
begin
  select id into dono from public.profiles order by criado_em limit 1;
  if dono is null then
    raise notice 'autoteste da limpeza: pulado (sem perfis)';
    return;
  end if;
  select count(*) into perfis_antes from public.profiles;

  begin
    -- recusa sem a frase exata
    begin
      perform public.limpar_conteudo('sim');
      raise exception 'deveria ter recusado confirmacao invalida';
    exception
      when sqlstate '22023' then null;   -- esperado
    end;

    insert into public.videos (autor_id, url, legenda)
    values (dono, 'https://exemplo.test/v.mp4', 'video de autoteste');

    perform public.limpar_conteudo('APAGAR CONTEUDO');

    select count(*) into videos_depois from public.videos;
    if videos_depois <> 0 then
      raise exception 'conteudo deveria ter sido apagado, sobraram % videos', videos_depois;
    end if;

    select count(*) into perfis_depois from public.profiles;
    if perfis_depois <> perfis_antes then
      raise exception 'as CONTAS foram afetadas: % antes, % depois', perfis_antes, perfis_depois;
    end if;

    if not exists (select 1 from public.origens_de_midia) then
      raise exception 'a configuracao do R2 foi apagada por engano';
    end if;
    if (select count(*) from public.partidas) = 0 then
      raise exception 'o calendario de jogos foi apagado por engano';
    end if;

    raise exception using errcode = '40001', message = 'AUTOTESTE_OK';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'AUTOTESTE_OK' then raise; end if;
      raise notice 'autoteste da limpeza: OK (contas preservadas, dados de teste desfeitos)';
  end;
end $$;
