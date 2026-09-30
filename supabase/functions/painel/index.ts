// Supabase Edge Function: dados de uso para o painel de custos.
// Deploy: supabase functions deploy painel --no-verify-jwt
//
// Devolve o JSON que o painel externo consome: quanto de cada recurso já foi usado e
// quanto falta para o plano gratuito acabar.
//
// AUTENTICAÇÃO
//
// Um token próprio (PAINEL_TOKEN), não a anon key. Motivo: a anon key está embutida no
// app e no repositório — qualquer pessoa com o APK teria acesso à telemetria de
// infraestrutura do projeto. E não usa service role porque o painel roda no navegador,
// onde nenhuma chave poderosa deve chegar. Este token só lê números agregados de uso;
// se vazar, o estrago é alguém saber quantos megabytes o bucket tem.
//
// `--no-verify-jwt` porque quem chama é uma página, não um usuário logado no app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-painel-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const esperado = Deno.env.get('PAINEL_TOKEN');
    if (!esperado) {
      return responder({ error: 'PAINEL_TOKEN não configurado nesta função.' }, 501);
    }

    // aceita no cabeçalho (preferido) ou na querystring, para facilitar um teste rápido
    const url = new URL(req.url);
    const enviado = req.headers.get('x-painel-token') ?? url.searchParams.get('token') ?? '';
    if (enviado !== esperado) {
      return responder({ error: 'Token inválido.' }, 401);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data, error } = await admin.rpc('painel_de_uso');
    if (error) return responder({ error: error.message }, 500);

    return responder(data);
  } catch (erro) {
    return responder({ error: erro instanceof Error ? erro.message : 'erro' }, 500);
  }
});

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      ...cabecalhosCors,
      'Content-Type': 'application/json',
      // o número muda uma vez por dia; cache curto evita bater no banco a cada refresh
      'Cache-Control': 'public, max-age=60',
    },
  });
}
