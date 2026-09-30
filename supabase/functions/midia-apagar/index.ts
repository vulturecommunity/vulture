// Supabase Edge Function: apaga arquivos do R2.
// Deploy: supabase functions deploy midia-apagar
//
// O upload vai direto do aparelho para o R2 com URL assinada, mas apagar não pode ser
// assim: uma URL de DELETE na mão do cliente é uma chave para destruir arquivo alheio se
// vazar. Aqui a exclusão é sempre feita pelo servidor, que confere o dono antes.
//
// Chamada pelo app depois de remover o registro no Postgres (melhor esforço: se falhar,
// sobra arquivo órfão no bucket, o que custa armazenamento e não integridade).
import { AwsClient } from 'npm:aws4fetch@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PASTAS = ['videos', 'thumbnails', 'avatars', 'posts'];
/** teto por chamada: apagar um post com 4 imagens + miniaturas cabe folgado */
const MAXIMO_POR_CHAMADA = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const contaId = Deno.env.get('R2_ACCOUNT_ID');
    const chaveId = Deno.env.get('R2_ACCESS_KEY_ID');
    const segredo = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucket = Deno.env.get('R2_BUCKET');
    if (!contaId || !chaveId || !segredo || !bucket) {
      return responder({ error: 'R2 não configurado nesta função.' }, 501);
    }

    const comoUsuario = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data } = await comoUsuario.auth.getUser();
    const usuario = data.user;
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);

    const corpo = (await req.json().catch(() => ({}))) as { chaves?: string[] };
    const pedidas = (corpo.chaves ?? []).slice(0, MAXIMO_POR_CHAMADA);

    // só apaga o que está na própria pasta do usuário, mesmo que peçam outra coisa
    const permitidas = pedidas.filter((chave) => {
      const [pasta, dono] = chave.split('/');
      return PASTAS.includes(pasta) && dono === usuario.id && !chave.includes('..');
    });
    if (permitidas.length === 0) return responder({ apagadas: 0 });

    const r2 = new AwsClient({
      accessKeyId: chaveId,
      secretAccessKey: segredo,
      service: 's3',
      region: 'auto',
    });

    const resultados = await Promise.all(
      permitidas.map(async (chave) => {
        const url = `https://${contaId}.r2.cloudflarestorage.com/${bucket}/${chave}`;
        const resposta = await r2.fetch(url, { method: 'DELETE' });
        // 204 apagou, 404 já não existia — os dois são sucesso para quem chamou
        return resposta.status === 204 || resposta.status === 404;
      }),
    );

    return responder({
      apagadas: resultados.filter(Boolean).length,
      ignoradas: pedidas.length - permitidas.length,
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
