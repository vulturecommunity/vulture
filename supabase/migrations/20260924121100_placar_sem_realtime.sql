-- =====================================================================================
-- PLACAR AO VIVO: SAI O WEBSOCKET, ENTRA O CACHE DE CDN
--
-- A tabela `partidas` estava publicada no Realtime, e o app abria um canal para CADA
-- aparelho com o app aberto durante um jogo. Um websocket por torcedor, no minuto de maior
-- audiência: num clássico com 200 mil pessoas online são 200 mil conexões simultâneas —
-- a linha mais cara da fatura e justamente o momento em que o app não pode cair.
--
-- Placar não precisa ser empurrado pelo servidor, precisa estar atualizado. A Edge Function
-- `placar` responde com Cache-Control de 20 s, então a CDN atende todo mundo e o banco
-- recebe ~3 requisições por minuto, com mil ou com um milhão de torcedores.
--
-- O Realtime continua ligado onde é insubstituível: chat da live e mensagens diretas.
-- =====================================================================================

do $$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'partidas'
  ) then
    alter publication supabase_realtime drop table public.partidas;
  end if;
end $$;

-- -------------------------------------------------------------------------------------
-- Apoio ao worker da fila de push
-- -------------------------------------------------------------------------------------

/** Soma +1 nas tentativas de vários pushes de uma vez (o PostgREST não faz incremento). */
create or replace function public.marcar_falha_de_push(p_ids bigint[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  total integer;
begin
  update public.push_pendente
     set tentativas = tentativas + 1
   where id = any (p_ids) and enviado_em is null;
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke execute on function public.marcar_falha_de_push(bigint[]) from public, anon, authenticated;
