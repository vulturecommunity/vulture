// Supabase Edge Function: placar ao vivo e calendário, servidos com cache de CDN.
// Deploy: supabase functions deploy placar --no-verify-jwt
//
// POR QUE ISTO EXISTE
//
// Antes, todo aparelho com o app aberto durante um jogo abria um canal Realtime na tabela
// `partidas`. Um websocket por torcedor, exatamente no minuto de pico: num Fla x Vasco com
// 200 mil pessoas online, são 200 mil conexões simultâneas — a conta mais cara do projeto,
// e o momento em que o app menos pode falhar.
//
// Placar não precisa de push do servidor: precisa estar atualizado. Esta função responde
// com `Cache-Control: s-maxage=20`, então a CDN serve a mesma resposta para todo mundo e
// o banco recebe ~3 requisições por minuto, independentemente de serem mil ou um milhão
// de torcedores. O app faz polling curto só enquanto a tela está em foco e há jogo.
//
// O Realtime continua onde é insubstituível: chat da live e mensagens diretas.
import { createClient } from 'npm:@supabase/supabase-js@2';

const COLUNAS =
  'id, competicao, fase, mandante, visitante, sigla_mandante, sigla_visitante, ' +
  'data_hora, estadio, gols_mandante, gols_visitante, status, minuto, nota, peso';

/** com jogo rolando o placar muda de minuto em minuto; 20 s é imperceptível e barato */
const SEGUNDOS_AO_VIVO = 20;
/** sem jogo, o calendário muda algumas vezes por semana */
const SEGUNDOS_PARADO = 300;

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const url = new URL(req.url);
    // ?temporada=1 devolve o calendário inteiro; sem parâmetro, só o que está em jogo
    const temporadaInteira = url.searchParams.get('temporada') === '1';

    const consulta = admin.from('partidas').select(COLUNAS).order('data_hora');
    const { data, error } = temporadaInteira
      ? await consulta
      : await consulta
          .gte('data_hora', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
          .lte('data_hora', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cabecalhosCors, 'Content-Type': 'application/json' },
      });
    }

    const partidas = data ?? [];
    const aoVivo = partidas.some((p) => (p as { status: string }).status === 'ao_vivo');
    const segundos = aoVivo ? SEGUNDOS_AO_VIVO : SEGUNDOS_PARADO;

    return new Response(JSON.stringify({ partidas, aoVivo }), {
      headers: {
        ...cabecalhosCors,
        'Content-Type': 'application/json',
        // s-maxage manda na CDN; stale-while-revalidate evita "buraco" na troca de versão
        'Cache-Control': `public, max-age=${segundos}, s-maxage=${segundos}, stale-while-revalidate=60`,
      },
    });
  } catch (erro) {
    return new Response(
      JSON.stringify({ error: erro instanceof Error ? erro.message : 'erro' }),
      { status: 500, headers: { ...cabecalhosCors, 'Content-Type': 'application/json' } },
    );
  }
});
