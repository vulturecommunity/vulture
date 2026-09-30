// Supabase Edge Function: apaga os arquivos dos rasantes vencidos.
// Deploy: supabase functions deploy limpar-arquivos
// Agendamento: supabase/cron-manutencao.sql (uma vez por dia, antes da limpeza em SQL)
//
// Um rasante some da tela em 24 h, mas o vídeo e a miniatura continuavam no Storage para
// sempre. Isso não aparece em lugar nenhum do app — aparece na fatura, e cresce todo dia.
//
// O SQL sozinho não resolve: `delete from rasantes` tira a linha, mas o arquivo no bucket
// continua lá. Por isso a ordem aqui é arquivo primeiro, linha depois.
import { createClient } from 'npm:@supabase/supabase-js@2';

/** margem depois do vencimento, para não brigar com quem ainda está assistindo */
const DIAS_DE_CARENCIA = 1;
const MAXIMO_POR_EXECUCAO = 500;

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

    const limite = new Date(Date.now() - DIAS_DE_CARENCIA * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from('rasantes')
      .select('id, autor_id')
      .lt('expira_em', limite)
      .limit(MAXIMO_POR_EXECUCAO);
    if (error) throw new Error(error.message);

    const vencidos = (data ?? []) as { id: string; autor_id: string }[];
    if (vencidos.length === 0) return responder({ apagados: 0 });

    const videos = vencidos.map((r) => `${r.autor_id}/rasantes/${r.id}.mp4`);
    const miniaturas = vencidos.map((r) => `${r.autor_id}/rasantes/${r.id}.jpg`);
    await Promise.all([
      admin.storage.from('videos').remove(videos),
      admin.storage.from('thumbnails').remove(miniaturas),
    ]);

    // só depois que os arquivos saíram: se algo falhar acima, a linha fica e tentamos amanhã
    await admin
      .from('rasantes')
      .delete()
      .in(
        'id',
        vencidos.map((r) => r.id),
      );

    return responder({ apagados: vencidos.length, resta: vencidos.length === MAXIMO_POR_EXECUCAO });
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
