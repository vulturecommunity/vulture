// Supabase Edge Function: avisa os seguidores quando alguém entra ao vivo.
// Deploy: supabase functions deploy notificar-live
//
// O app chama POST /functions/v1/notificar-live com { liveId } logo após criar a live,
// enviando o JWT do usuário. A função:
//   1. confirma que quem chamou é o anfitrião da live e que ela está ativa;
//   2. grava uma notificação (tipo "live") para cada seguidor;
//   3. envia push pelo Expo Push Service para os aparelhos dos seguidores;
//   4. apaga tokens que o Expo reportar como inválidos (DeviceNotRegistered).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** o Expo aceita até 100 mensagens por requisição */
const TAMANHO_DO_LOTE = 100;

interface MensagemPush {
  to: string;
  title: string;
  body: string;
  data: { tipo: 'live'; liveId: string; url: string };
  sound: 'default';
  priority: 'high';
  channelId: 'lives';
  ttl: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const chaveAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // quem está chamando (JWT do app)
    const autorizacao = req.headers.get('Authorization') ?? '';
    const comoUsuario = createClient(supabaseUrl, chaveAnon, {
      global: { headers: { Authorization: autorizacao } },
    });
    const { data: dadosUsuario } = await comoUsuario.auth.getUser();
    const usuario = dadosUsuario.user;
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);

    const corpo = (await req.json().catch(() => ({}))) as { liveId?: string };
    if (!corpo.liveId) return responder({ error: 'liveId é obrigatório' }, 400);

    // daqui em diante com privilégios de serviço (lê seguidores e tokens de outros usuários)
    const admin = createClient(supabaseUrl, chaveServico);

    const { data: live } = await admin
      .from('live_streams')
      .select(
        'id, titulo, ativa, anfitriao_id, anfitriao:profiles!live_streams_anfitriao_id_fkey(apelido)',
      )
      .eq('id', corpo.liveId)
      .maybeSingle();
    if (!live) return responder({ error: 'Live não encontrada' }, 404);
    if (live.anfitriao_id !== usuario.id)
      return responder({ error: 'Só o anfitrião pode avisar' }, 403);
    if (!live.ativa) return responder({ enviados: 0, motivo: 'live encerrada' });

    const anfitriao = live.anfitriao as unknown as { apelido: string } | null;
    const apelido = anfitriao?.apelido ?? 'alguém';

    // evita disparo duplicado (o app pode chamar mais de uma vez em caso de retentativa)
    const { count: jaAvisados } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('live_id', live.id)
      .eq('tipo', 'live');
    if ((jaAvisados ?? 0) > 0) return responder({ enviados: 0, motivo: 'já notificado' });

    const { data: seguidores } = await admin
      .from('follows')
      .select('seguidor_id')
      .eq('seguido_id', usuario.id);
    const idsSeguidores = (seguidores ?? []).map((s) => s.seguidor_id as string);
    if (idsSeguidores.length === 0) return responder({ enviados: 0, motivo: 'sem seguidores' });

    // 2. notificação em tela para cada seguidor
    const titulo = live.titulo as string;
    await admin.from('notifications').insert(
      idsSeguidores.map((paraId) => ({
        para_id: paraId,
        tipo: 'live',
        de_id: usuario.id,
        live_id: live.id,
        texto: `está ao vivo: ${titulo}`,
      })),
    );

    // 3. push para os aparelhos dos seguidores
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .in('usuario_id', idsSeguidores);
    const listaTokens = (tokens ?? []).map((t) => t.token as string);
    if (listaTokens.length === 0)
      return responder({ enviados: 0, notificados: idsSeguidores.length });

    const mensagens: MensagemPush[] = listaTokens.map((to) => ({
      to,
      title: `🔴 @${apelido} está ao vivo`,
      body: titulo ? `${titulo} · Toque para assistir` : 'Toque para assistir agora',
      data: { tipo: 'live', liveId: live.id as string, url: `vulture://live/${live.id}` },
      sound: 'default',
      priority: 'high',
      channelId: 'lives',
      // uma live é efêmera: não vale entregar o aviso horas depois
      ttl: 60 * 60,
    }));

    let enviados = 0;
    const tokensInvalidos: string[] = [];
    for (let i = 0; i < mensagens.length; i += TAMANHO_DO_LOTE) {
      const lote = mensagens.slice(i, i + TAMANHO_DO_LOTE);
      const resposta = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(Deno.env.get('EXPO_ACCESS_TOKEN')
            ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
            : {}),
        },
        body: JSON.stringify(lote),
      });
      const resultado = (await resposta.json().catch(() => ({}))) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      (resultado.data ?? []).forEach((r, indice) => {
        if (r.status === 'ok') enviados += 1;
        else if (r.details?.error === 'DeviceNotRegistered') tokensInvalidos.push(lote[indice].to);
      });
    }

    // 4. limpeza de tokens mortos
    if (tokensInvalidos.length > 0) {
      await admin.from('push_tokens').delete().in('token', tokensInvalidos);
    }

    return responder({
      enviados,
      notificados: idsSeguidores.length,
      removidos: tokensInvalidos.length,
    });
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
