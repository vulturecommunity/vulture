// Supabase Edge Function: worker da fila de push.
// Deploy: supabase functions deploy enviar-pushes
// Agendamento: supabase/cron-manutencao.sql (a cada minuto)
//
// A fila `public.push_pendente` é preenchida no Postgres por INSERT ... SELECT (ver a
// migration 20260924120600). Esta função só tira dela e entrega ao Expo Push Service.
//
// O que mudou em relação ao `notificar-live` antigo, que fazia tudo de uma vez dentro da
// requisição do usuário:
//   * lotes de 100 enviados EM PARALELO (6 de cada vez), não um atrás do outro;
//   * teto por execução, então o tempo de resposta é limitado — o que sobra fica na fila
//     para o minuto seguinte, em vez de estourar o tempo limite da função;
//   * quem falha volta para a fila com `tentativas + 1` em vez de sumir.
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** o Expo aceita até 100 mensagens por requisição */
const TAMANHO_DO_LOTE = 100;
/** lotes simultâneos: o suficiente para vazão sem derrubar o rate limit do Expo */
const LOTES_EM_PARALELO = 6;
/** teto por execução (6 000 pushes/min ≈ 360 mil/h) */
const MAXIMO_POR_EXECUCAO = TAMANHO_DO_LOTE * LOTES_EM_PARALELO * 10;

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinhaDaFila {
  id: number;
  token: string;
  titulo: string;
  corpo: string;
  dados: Record<string, unknown>;
  canal: string;
  ttl: number;
  /** foto exibida na notificação (perfil de quem entrou ao vivo, por exemplo) */
  imagem: string | null;
}

interface RespostaDoExpo {
  data?: { status: string; details?: { error?: string } }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: fila } = await admin
      .from('push_pendente')
      .select('id, token, titulo, corpo, dados, canal, ttl, imagem')
      .is('enviado_em', null)
      .lt('tentativas', 5)
      .order('criado_em')
      .limit(MAXIMO_POR_EXECUCAO);

    const linhas = (fila ?? []) as LinhaDaFila[];
    if (linhas.length === 0) return responder({ enviados: 0, fila: 0 });

    const lotes: LinhaDaFila[][] = [];
    for (let i = 0; i < linhas.length; i += TAMANHO_DO_LOTE) {
      lotes.push(linhas.slice(i, i + TAMANHO_DO_LOTE));
    }

    const entregues: number[] = [];
    const falharam: number[] = [];
    const tokensInvalidos: string[] = [];
    const chaveExpo = Deno.env.get('EXPO_ACCESS_TOKEN');

    for (let i = 0; i < lotes.length; i += LOTES_EM_PARALELO) {
      const rodada = lotes.slice(i, i + LOTES_EM_PARALELO);
      await Promise.all(
        rodada.map(async (lote) => {
          try {
            const resposta = await fetch(EXPO_PUSH_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(chaveExpo ? { Authorization: `Bearer ${chaveExpo}` } : {}),
              },
              body: JSON.stringify(
                lote.map((l) => ({
                  to: l.token,
                  title: l.titulo,
                  body: l.corpo,
                  data: l.dados,
                  sound: 'default',
                  priority: 'high',
                  channelId: l.canal,
                  ttl: Math.max(60, l.ttl),
                  // imagem na notificação: no Android o Expo entrega por richContent,
                  // e o sistema mostra como ícone grande ao lado do texto
                  ...(l.imagem ? { richContent: { image: l.imagem } } : {}),
                })),
              ),
            });
            const resultado = (await resposta.json().catch(() => ({}))) as RespostaDoExpo;
            const itens = resultado.data ?? [];
            lote.forEach((linha, indice) => {
              const item = itens[indice];
              if (item?.status === 'ok') {
                entregues.push(linha.id);
                return;
              }
              if (item?.details?.error === 'DeviceNotRegistered') {
                // aparelho sumiu: o push não tem para onde ir, some da fila junto com o token
                tokensInvalidos.push(linha.token);
                entregues.push(linha.id);
                return;
              }
              falharam.push(linha.id);
            });
          } catch {
            for (const linha of lote) falharam.push(linha.id);
          }
        }),
      );
    }

    if (entregues.length > 0) {
      await admin
        .from('push_pendente')
        .update({ enviado_em: new Date().toISOString() })
        .in('id', entregues);
    }
    if (falharam.length > 0) {
      // sem incremento atômico no PostgREST: a RPC soma +1 em todas de uma vez
      await admin.rpc('marcar_falha_de_push', { p_ids: falharam });
    }
    if (tokensInvalidos.length > 0) {
      await admin.from('push_tokens').delete().in('token', tokensInvalidos);
    }

    return responder({
      enviados: entregues.length,
      falhas: falharam.length,
      tokensRemovidos: tokensInvalidos.length,
      restaNaFila: linhas.length === MAXIMO_POR_EXECUCAO ? 'sim' : 'nao',
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
