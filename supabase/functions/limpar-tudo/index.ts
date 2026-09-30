// Supabase Edge Function: zera o conteúdo do app preservando as contas.
// Deploy: supabase functions deploy limpar-tudo
// Uso:    scripts/limpar-tudo.sh  (não chame direto — o script confirma antes)
//
// ORDEM IMPORTA
//
// Primeiro os arquivos no R2, depois as linhas no Postgres. Se fosse ao contrário e algo
// falhasse no meio, as URLs some do banco e os arquivos ficariam órfãos no bucket,
// ocupando cota para sempre sem ninguém saber que estão lá.
//
// SEGURANÇA
//
// Exige a service role key no Authorization. É a chave mais poderosa do projeto e vive
// só no painel do Supabase — nunca no app, nunca no repositório. Sem ela, 401.
import { AwsClient } from 'npm:aws4fetch@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POR_PAGINA = 1000;
/** o DeleteObjects do S3 aceita até 1.000 chaves por chamada */
const POR_LOTE = 1000;
const MAXIMO_DE_PAGINAS = 100;

function chavesDaPagina(xml: string): string[] {
  return [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)]
    .map((m) => m[1])
    .filter(Boolean);
}

function truncado(xml: string): string | null {
  const ehTruncado = /<IsTruncated>(true|false)<\/IsTruncated>/.exec(xml)?.[1] === 'true';
  if (!ehTruncado) return null;
  return /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null;
}

function escaparXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const enviado = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!enviado || enviado !== servico) {
      return responder({ error: 'Requer a service role key.' }, 401);
    }

    const corpo = (await req.json().catch(() => ({}))) as { confirmacao?: string };
    if (corpo.confirmacao !== 'APAGAR CONTEUDO') {
      return responder(
        { error: 'Envie {"confirmacao":"APAGAR CONTEUDO"} para executar.' },
        400,
      );
    }

    const contaId = Deno.env.get('R2_ACCOUNT_ID');
    const chaveId = Deno.env.get('R2_ACCESS_KEY_ID');
    const segredo = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucket = Deno.env.get('R2_BUCKET');

    // ---------------------------------------------------------------- 1. arquivos no R2
    let arquivosApagados = 0;
    if (contaId && chaveId && segredo && bucket) {
      const r2 = new AwsClient({
        accessKeyId: chaveId,
        secretAccessKey: segredo,
        service: 's3',
        region: 'auto',
      });

      let token: string | null = null;
      let paginas = 0;
      do {
        const url = new URL(`https://${contaId}.r2.cloudflarestorage.com/${bucket}`);
        url.searchParams.set('list-type', '2');
        url.searchParams.set('max-keys', String(POR_PAGINA));
        if (token) url.searchParams.set('continuation-token', token);

        const lista = await r2.fetch(url.toString(), { method: 'GET' });
        if (!lista.ok) {
          return responder({ error: `Falha ao listar o bucket (${lista.status}).` }, 502);
        }
        const xml = await lista.text();
        const chaves = chavesDaPagina(xml);

        for (let i = 0; i < chaves.length; i += POR_LOTE) {
          const lote = chaves.slice(i, i + POR_LOTE);
          const corpoXml =
            '<Delete>' +
            lote.map((k) => `<Object><Key>${escaparXml(k)}</Key></Object>`).join('') +
            '<Quiet>true</Quiet></Delete>';
          const apagar = await r2.fetch(
            `https://${contaId}.r2.cloudflarestorage.com/${bucket}?delete`,
            { method: 'POST', body: corpoXml, headers: { 'Content-Type': 'application/xml' } },
          );
          if (apagar.ok) arquivosApagados += lote.length;
        }

        token = truncado(xml);
        paginas += 1;
      } while (token && paginas < MAXIMO_DE_PAGINAS);
    }

    // ---------------------------------------------------------------- 2. linhas no banco
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, servico);
    const { data, error } = await admin.rpc('limpar_conteudo', {
      p_confirmacao: 'APAGAR CONTEUDO',
    });
    if (error) return responder({ error: error.message, arquivosApagados }, 500);

    const linhas = (data ?? []) as { tabela: string; apagadas: number }[];
    const { count: contas } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    return responder({
      arquivosApagados,
      tabelas: linhas,
      linhasApagadas: linhas.reduce((s, l) => s + Number(l.apagadas), 0),
      contasPreservadas: contas ?? 0,
    });
  } catch (erro) {
    return responder({ error: erro instanceof Error ? erro.message : 'erro' }, 500);
  }
});

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: { ...cabecalhosCors, 'Content-Type': 'application/json' },
  });
}
