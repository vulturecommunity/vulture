// Supabase Edge Function: fila de moderação para o painel.
// Deploy: supabase functions deploy moderacao --no-verify-jwt
//
// Devolve as denúncias pendentes agrupadas por alvo (GET) e aplica a decisão (POST).
// A página que desenha isso é painel/moderacao.html, aberta direto do disco — por isso
// o CORS precisa valer também para origem `null`, que é a origem de um arquivo local.
//
// AUTENTICAÇÃO
//
// O mesmo PAINEL_TOKEN do painel de custos, pelo mesmo motivo: a anon key está embutida
// no APK, e a service role não pode chegar ao navegador. A diferença é que aqui o token
// não só lê — ele REMOVE conteúdo e BANE conta. Então:
//
//   * toda decisão fica registrada em `acoes_de_moderacao`, com data e ação;
//   * remover é o limite do estrago, e remover é reversível no sentido que importa
//     (o arquivo no R2 só é varrido pelo cron do dia seguinte).
//
// Se o token vazar, troque com:
//   npx supabase secrets set PAINEL_TOKEN=<novo>
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-painel-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ACOES = ['remover', 'banir', 'suspender', 'descartar'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const esperado = Deno.env.get('PAINEL_TOKEN');
    if (!esperado) return responder({ error: 'PAINEL_TOKEN não configurado.' }, 501);
    if ((req.headers.get('x-painel-token') ?? '') !== esperado) {
      return responder({ error: 'Token inválido.' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (req.method === 'GET') {
      const { data, error } = await admin.rpc('fila_de_moderacao', { p_limite: 100 });
      if (error) return responder({ error: error.message }, 500);

      const { count: decididos } = await admin
        .from('acoes_de_moderacao')
        .select('*', { count: 'exact', head: true })
        .gte('criado_em', new Date(Date.now() - 7 * 864e5).toISOString());

      return responder({ fila: data ?? [], decididosNaSemana: decididos ?? 0 });
    }

    if (req.method === 'POST') {
      const corpo = (await req.json().catch(() => ({}))) as {
        tipoAlvo?: string;
        alvoId?: string;
        acao?: string;
        motivo?: string;
        dias?: number;
      };
      if (!corpo.tipoAlvo || !corpo.alvoId) {
        return responder({ error: 'tipoAlvo e alvoId são obrigatórios.' }, 400);
      }
      if (!ACOES.includes(corpo.acao ?? '')) {
        return responder({ error: `ação deve ser uma de: ${ACOES.join(', ')}` }, 400);
      }

      const { data, error } = await admin.rpc('moderar', {
        p_tipo_alvo: corpo.tipoAlvo,
        p_alvo_id: corpo.alvoId,
        p_acao: corpo.acao,
        p_motivo: corpo.motivo ?? '',
        p_dias: corpo.dias ?? null,
      });
      if (error) return responder({ error: error.message }, 500);
      return responder(data ?? {});
    }

    return responder({ error: 'Método não suportado.' }, 405);
  } catch (erro) {
    return responder({ error: erro instanceof Error ? erro.message : 'erro' }, 500);
  }
});

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors, 'Content-Type': 'application/json' },
  });
}
