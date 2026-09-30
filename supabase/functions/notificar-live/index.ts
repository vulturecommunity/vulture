// Supabase Edge Function: avisa os seguidores quando alguém entra ao vivo.
// Deploy: supabase functions deploy notificar-live
//
// O TRABALHO SAIU DAQUI. O app atual chama direto a RPC `notificar_live`, que faz o
// fan-out inteiro em dois INSERT ... SELECT dentro do Postgres e enfileira os pushes em
// `push_pendente` (a entrega fica com a função `enviar-pushes`).
//
// Por que a função continua existindo: builds antigos do app, já instalados em celular,
// ainda chamam este endpoint. Aqui ele virou um invólucro fino da mesma RPC — quem está
// com o APK velho continua avisando os seguidores, e pelo caminho novo.
//
// A versão anterior inseria uma notificação por seguidor e disparava os pushes em lotes
// sequenciais de 100 dentro desta requisição: com 200 mil seguidores eram 2 mil chamadas
// HTTP em série e um timeout garantido.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const corpo = (await req.json().catch(() => ({}))) as { liveId?: string };
    if (!corpo.liveId) return responder({ error: 'liveId é obrigatório' }, 400);

    // com o JWT de quem chamou: a RPC confere sozinha que é o anfitrião
    const comoUsuario = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const { data, error } = await comoUsuario.rpc('notificar_live', { p_live_id: corpo.liveId });
    if (error) return responder({ error: error.message }, statusDoErro(error.message));

    const linha = (data ?? [])[0] as { notificados?: number; pushes?: number } | undefined;
    return responder({
      notificados: linha?.notificados ?? 0,
      enfileirados: linha?.pushes ?? 0,
    });
  } catch (erro) {
    return responder({ error: erro instanceof Error ? erro.message : 'erro' }, 500);
  }
});

function statusDoErro(mensagem: string): number {
  if (/autenticado/i.test(mensagem)) return 401;
  if (/anfitrião/i.test(mensagem)) return 403;
  return 400;
}

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors, 'Content-Type': 'application/json' },
  });
}
