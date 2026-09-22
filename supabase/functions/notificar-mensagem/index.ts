// Supabase Edge Function: avisa quem recebe uma mensagem direta.
// Deploy: supabase functions deploy notificar-mensagem
//
// O app chama POST /functions/v1/notificar-mensagem com { mensagemId } logo após enviar,
// com o JWT do remetente. A função:
//   1. confirma que quem chamou é o remetente da mensagem;
//   2. descobre quem recebe (o outro participante da conversa);
//   3. envia push pelo Expo Push Service para os aparelhos dessa pessoa;
//   4. apaga tokens que o Expo reportar como inválidos (DeviceNotRegistered).
// Mensagens não geram linha em `notifications`: elas vivem na caixa de mensagens.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface MensagemPush {
  to: string;
  title: string;
  body: string;
  data: { tipo: 'mensagem'; conversaId: string; url: string };
  sound: 'default';
  priority: 'high';
  channelId: 'mensagens';
  ttl: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const chaveAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const autorizacao = req.headers.get('Authorization') ?? '';
    const comoUsuario = createClient(supabaseUrl, chaveAnon, {
      global: { headers: { Authorization: autorizacao } },
    });
    const { data: dadosUsuario } = await comoUsuario.auth.getUser();
    const usuario = dadosUsuario.user;
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);

    const corpo = (await req.json().catch(() => ({}))) as { mensagemId?: string };
    if (!corpo.mensagemId) return responder({ error: 'mensagemId é obrigatório' }, 400);

    const admin = createClient(supabaseUrl, chaveServico);

    const { data: mensagem } = await admin
      .from('messages')
      .select(
        'id, texto, remetente_id, conversa_id, conversa:conversations!messages_conversa_id_fkey(usuario_a, usuario_b)',
      )
      .eq('id', corpo.mensagemId)
      .maybeSingle();
    if (!mensagem) return responder({ error: 'Mensagem não encontrada' }, 404);
    if (mensagem.remetente_id !== usuario.id)
      return responder({ error: 'Só o remetente pode avisar' }, 403);

    const conversa = mensagem.conversa as unknown as {
      usuario_a: string;
      usuario_b: string;
    } | null;
    if (!conversa) return responder({ error: 'Conversa não encontrada' }, 404);
    const paraId = conversa.usuario_a === usuario.id ? conversa.usuario_b : conversa.usuario_a;

    const { data: remetente } = await admin
      .from('profiles')
      .select('apelido')
      .eq('id', usuario.id)
      .maybeSingle();
    const apelido = (remetente as { apelido: string } | null)?.apelido ?? 'alguém';

    const { data: tokens } = await admin
      .from('push_tokens')
      .select('token')
      .eq('usuario_id', paraId);
    const listaTokens = (tokens ?? []).map((t) => t.token as string);
    if (listaTokens.length === 0) return responder({ enviados: 0, motivo: 'sem aparelhos' });

    const texto = String(mensagem.texto ?? '');
    const previa = texto.length > 120 ? `${texto.slice(0, 117)}…` : texto;
    const mensagens: MensagemPush[] = listaTokens.map((to) => ({
      to,
      title: `@${apelido}`,
      body: previa,
      data: {
        tipo: 'mensagem',
        conversaId: mensagem.conversa_id as string,
        url: `vulture://mensagens/${mensagem.conversa_id}`,
      },
      sound: 'default',
      priority: 'high',
      channelId: 'mensagens',
      ttl: 24 * 60 * 60,
    }));

    const resposta = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(Deno.env.get('EXPO_ACCESS_TOKEN')
          ? { Authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
          : {}),
      },
      body: JSON.stringify(mensagens),
    });
    const resultado = (await resposta.json().catch(() => ({}))) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    let enviados = 0;
    const tokensInvalidos: string[] = [];
    (resultado.data ?? []).forEach((r, indice) => {
      if (r.status === 'ok') enviados += 1;
      else if (r.details?.error === 'DeviceNotRegistered')
        tokensInvalidos.push(mensagens[indice].to);
    });
    if (tokensInvalidos.length > 0) {
      await admin.from('push_tokens').delete().in('token', tokensInvalidos);
    }

    return responder({ enviados, removidos: tokensInvalidos.length });
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
