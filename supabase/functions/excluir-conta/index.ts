// Supabase Edge Function: apaga a conta de quem pediu, com os arquivos dela.
// Deploy: supabase functions deploy excluir-conta
//
// POR QUE EXISTE
//
// Apple e Google exigem, desde 2022, que todo app com cadastro ofereça exclusão de conta
// DENTRO do app — não por e-mail, não por formulário na web. Sem isso a publicação é
// recusada na revisão. A LGPD (art. 18, VI) diz a mesma coisa por outro caminho.
//
// POR QUE NÃO É UM DELETE NO APP
//
// Apagar a própria linha em `profiles` deixaria a conta em `auth.users` viva: a pessoa
// continuaria conseguindo entrar, num app onde ela não existe mais. Só a service role
// apaga de `auth.users`, e essa chave nunca pode estar no aparelho.
//
// ORDEM: arquivos primeiro, banco depois — a mesma regra do `limpar-tudo`. Ao contrário,
// uma falha no meio apagaria as URLs e deixaria os arquivos órfãos no bucket, ocupando
// cota para sempre sem ninguém saber que estão lá.
import { AwsClient } from 'npm:aws4fetch@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Todo arquivo do R2 mora em `<pasta>/<usuario_id>/<arquivo>` — ver `midia-assinar`. */
const PASTAS = ['videos', 'thumbnails', 'avatars', 'posts'];
const POR_PAGINA = 1000;
const MAXIMO_DE_PAGINAS = 50;

/** A frase que o app manda junto; evita exclusão por requisição malformada ou repetida. */
const CONFIRMACAO = 'EXCLUIR MINHA CONTA';

function chavesDaPagina(xml: string): string[] {
  return [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map((m) => m[1]).filter(Boolean);
}

function proximaPagina(xml: string): string | null {
  const truncado = /<IsTruncated>(true|false)<\/IsTruncated>/.exec(xml)?.[1] === 'true';
  if (!truncado) return null;
  return /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] ?? null;
}

function escaparXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Lista e apaga tudo que está sob `<pasta>/<usuario>/`. Melhor esforço: erro não trava. */
async function apagarPasta(
  r2: AwsClient,
  base: string,
  bucket: string,
  prefixo: string,
): Promise<number> {
  let apagados = 0;
  let token: string | null = null;

  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
    const url = new URL(`${base}/${bucket}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefixo);
    url.searchParams.set('max-keys', String(POR_PAGINA));
    if (token) url.searchParams.set('continuation-token', token);

    const resposta = await r2.fetch(url.toString());
    if (!resposta.ok) break;
    const xml = await resposta.text();

    const chaves = chavesDaPagina(xml);
    if (chaves.length > 0) {
      const corpo =
        '<Delete>' +
        chaves.map((c) => `<Object><Key>${escaparXml(c)}</Key></Object>`).join('') +
        '<Quiet>true</Quiet></Delete>';
      const apagar = await r2.fetch(`${base}/${bucket}?delete=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: corpo,
      });
      if (apagar.ok) apagados += chaves.length;
    }

    token = proximaPagina(xml);
    if (!token) break;
  }

  return apagados;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const corpo = (await req.json().catch(() => ({}))) as { confirmacao?: string };
    if (corpo.confirmacao !== CONFIRMACAO) {
      return responder({ error: `Envie {"confirmacao":"${CONFIRMACAO}"} para executar.` }, 400);
    }

    // 1. quem está pedindo? só o JWT da própria pessoa serve
    const comoUsuario = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data } = await comoUsuario.auth.getUser();
    const usuario = data.user;
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 2. registra ANTES de apagar: depois do delete não há de quem registrar.
    //    Guarda só o id e a data — nada que identifique a pessoa (é o ponto da exclusão).
    await admin.from('exclusoes_de_conta').insert({ usuario_id: usuario.id }).select();

    // 3. arquivos no R2
    let arquivos = 0;
    const contaId = Deno.env.get('R2_ACCOUNT_ID');
    const chaveId = Deno.env.get('R2_ACCESS_KEY_ID');
    const segredo = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucket = Deno.env.get('R2_BUCKET');

    if (contaId && chaveId && segredo && bucket) {
      const r2 = new AwsClient({
        accessKeyId: chaveId,
        secretAccessKey: segredo,
        service: 's3',
        region: 'auto',
      });
      const base = `https://${contaId}.r2.cloudflarestorage.com`;
      for (const pasta of PASTAS) {
        arquivos += await apagarPasta(r2, base, bucket, `${pasta}/${usuario.id}/`);
      }
    }

    // 4. a conta. `profiles.id references auth.users on delete cascade`, então este
    //    delete derruba perfil, vídeos, posts, palpites, mensagens e o resto junto.
    const { error } = await admin.auth.admin.deleteUser(usuario.id);
    if (error) return responder({ error: error.message }, 500);

    return responder({ excluida: true, arquivos });
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
