// Supabase Edge Function: mede quanto o bucket do R2 está ocupando.
// Deploy: supabase functions deploy monitorar-midia
// Agendamento: migration 20260930150100 (uma vez por dia, 04:20)
//
// POR QUE MEDIR POR LISTAGEM, E NÃO POR CONTABILIDADE PRÓPRIA
//
// Daria para somar cada arquivo na hora que assinamos o upload, mas esse número erra
// sempre: upload que falha no meio conta como enviado, arquivo apagado fora do app não
// desconta, e o erro só acumula. Listar o bucket devolve a verdade, e o custo é baixo —
// uma vez por dia, 1 operação Classe B a cada 1.000 objetos.
//
// O resultado vai para public.uso_do_bucket; quem compara com o plano e dispara alerta é
// a função SQL verificar_uso_de_midia(), que roda logo depois.
import { AwsClient } from 'npm:aws4fetch@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** o S3 devolve no máximo 1.000 chaves por página */
const POR_PAGINA = 1000;
/** teto de segurança: 100 mil objetos por execução, para não rodar sem fim */
const MAXIMO_DE_PAGINAS = 100;

interface Totais {
  objetos: number;
  bytes: number;
  novosNoMes: number;
}

function inicioDoMes(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

/** Extrai <Key>, <Size> e <LastModified> de cada <Contents> do XML do S3. */
function lerPagina(xml: string): { chave: string; bytes: number; modificado: Date }[] {
  const itens: { chave: string; bytes: number; modificado: Date }[] = [];
  const blocos = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const [, bloco] of blocos) {
    const chave = /<Key>([\s\S]*?)<\/Key>/.exec(bloco)?.[1] ?? '';
    const bytes = Number(/<Size>(\d+)<\/Size>/.exec(bloco)?.[1] ?? '0');
    const data = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(bloco)?.[1] ?? '';
    if (chave) itens.push({ chave, bytes, modificado: new Date(data) });
  }
  return itens;
}

function proximoToken(xml: string): string | null {
  const truncado = /<IsTruncated>(true|false)<\/IsTruncated>/.exec(xml)?.[1] === 'true';
  if (!truncado) return null;
  return /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null;
}

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

    const r2 = new AwsClient({
      accessKeyId: chaveId,
      secretAccessKey: segredo,
      service: 's3',
      region: 'auto',
    });

    const corte = inicioDoMes();
    const totais: Totais = { objetos: 0, bytes: 0, novosNoMes: 0 };
    const porPasta: Record<string, { objetos: number; bytes: number }> = {};

    let token: string | null = null;
    let paginas = 0;

    do {
      const url = new URL(`https://${contaId}.r2.cloudflarestorage.com/${bucket}`);
      url.searchParams.set('list-type', '2');
      url.searchParams.set('max-keys', String(POR_PAGINA));
      if (token) url.searchParams.set('continuation-token', token);

      const resposta = await r2.fetch(url.toString(), { method: 'GET' });
      if (!resposta.ok) {
        return responder(
          { error: `Falha ao listar o bucket (HTTP ${resposta.status}).` },
          502,
        );
      }
      const xml = await resposta.text();

      for (const item of lerPagina(xml)) {
        totais.objetos += 1;
        totais.bytes += item.bytes;
        if (item.modificado >= corte) totais.novosNoMes += 1;

        const pasta = item.chave.split('/')[0] || 'raiz';
        porPasta[pasta] ??= { objetos: 0, bytes: 0 };
        porPasta[pasta].objetos += 1;
        porPasta[pasta].bytes += item.bytes;
      }

      token = proximoToken(xml);
      paginas += 1;
    } while (token && paginas < MAXIMO_DE_PAGINAS);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    // banco e contas entram no mesmo snapshot: assim o painel tem as três curvas
    // alinhadas no tempo, em vez de medir cada coisa num momento diferente
    const { data: painel } = await admin.rpc('painel_de_uso');
    const metricas = (painel?.metricas ?? []) as { chave: string; usado: number }[];
    const bancoBytes = metricas.find((m) => m.chave === 'banco')?.usado ?? null;
    const contas = metricas.find((m) => m.chave === 'contas')?.usado ?? null;

    const { error } = await admin.from('uso_do_bucket').insert({
      objetos: totais.objetos,
      bytes: totais.bytes,
      novos_no_mes: totais.novosNoMes,
      por_pasta: porPasta,
      banco_bytes: bancoBytes,
      contas,
    });
    if (error) return responder({ error: error.message }, 500);

    return responder({
      objetos: totais.objetos,
      bytes: totais.bytes,
      novosNoMes: totais.novosNoMes,
      porPasta,
      // avisa se o teto de páginas foi atingido: o número estaria incompleto
      completo: !token,
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
