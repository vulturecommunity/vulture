// Supabase Edge Function: gera tokens de acesso do LiveKit.
// Deploy: supabase functions deploy livekit-token
// Segredos: supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... LIVEKIT_URL=wss://...
//
// O app chama POST /functions/v1/livekit-token com { room, identity, name, canPublish }
// e o cabeçalho Authorization: Bearer <JWT do usuário logado>.
import { AccessToken } from 'npm:livekit-server-sdk@2';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const url = Deno.env.get('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !url) {
      return responder({ error: 'LIVEKIT_API_KEY, LIVEKIT_API_SECRET e LIVEKIT_URL não configurados' }, 500);
    }

    // valida o usuário do Supabase que está pedindo o token
    const autorizacao = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: autorizacao } },
    });
    const { data: dadosUsuario } = await supabase.auth.getUser();
    const usuario = dadosUsuario.user;
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);

    const corpo = (await req.json()) as { room?: string; identity?: string; name?: string; canPublish?: boolean };
    if (!corpo.room) return responder({ error: 'room é obrigatório' }, 400);

    // só o anfitrião da live (dono da sala) pode publicar
    const { data: live } = await supabase
      .from('live_streams')
      .select('anfitriao_id')
      .eq('sala', corpo.room)
      .maybeSingle();
    const anfitriao = live?.anfitriao_id === usuario.id;
    const podePublicar = !!corpo.canPublish && anfitriao;

    const token = new AccessToken(apiKey, apiSecret, {
      identity: usuario.id,
      name: corpo.name ?? 'torcedor',
      ttl: '2h',
    });
    token.addGrant({
      room: corpo.room,
      roomJoin: true,
      canPublish: podePublicar,
      canSubscribe: true,
      canPublishData: true,
    });

    return responder({ token: await token.toJwt(), url });
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
