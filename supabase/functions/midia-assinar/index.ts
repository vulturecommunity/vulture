// Supabase Edge Function: devolve uma URL assinada para o app enviar um arquivo ao R2.
// Deploy: supabase functions deploy midia-assinar
//
// POR QUE ISTO EXISTE
//
// O Cloudflare R2 não cobra egress. Como a saída de mídia é ~85% do custo de um app de
// vídeo — e foi o que bloqueou o projeto com 27 GB servidos a partir de 65 MB de arquivos
// — tirar vídeo e imagem do Storage da Supabase é a mudança de maior impacto do roadmap.
//
// O R2 não tem o equivalente às policies de RLS do Storage da Supabase. A autorização
// passa a ser feita aqui: o app não conhece as chaves do R2, ele pede uma URL assinada e
// esta função só assina depois de conferir quem está pedindo, para onde e o quê.
//
// Segredos necessários (supabase secrets set):
//   R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET  R2_PUBLIC_URL
import { AwsClient } from 'npm:aws4fetch@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** As mesmas pastas dos buckets atuais: a migração não muda o formato do caminho. */
const PASTAS = ['videos', 'thumbnails', 'avatars', 'posts'] as const;
type Pasta = (typeof PASTAS)[number];

/** Mesmos limites dos buckets da Supabase, para o comportamento não mudar. */
const REGRAS: Record<Pasta, { tipos: string[]; bytes: number }> = {
  videos: { tipos: ['video/mp4', 'video/quicktime', 'video/webm'], bytes: 104857600 },
  thumbnails: { tipos: ['image/jpeg', 'image/png', 'image/webp'], bytes: 5242880 },
  avatars: { tipos: ['image/jpeg', 'image/png', 'image/webp'], bytes: 5242880 },
  posts: {
    tipos: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'],
    bytes: 15728640,
  },
};

/** A URL assinada vale o suficiente para um upload em rede ruim, e não mais que isso. */
const VALIDADE_SEGUNDOS = 900;

interface Corpo {
  pasta?: string;
  caminho?: string;
  tipoMime?: string;
  bytes?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabecalhosCors });
  try {
    const contaId = Deno.env.get('R2_ACCOUNT_ID');
    const chaveId = Deno.env.get('R2_ACCESS_KEY_ID');
    const segredo = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const bucket = Deno.env.get('R2_BUCKET');
    const basePublica = Deno.env.get('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (!contaId || !chaveId || !segredo || !bucket || !basePublica) {
      // sem R2 configurado o app volta sozinho para o Storage da Supabase
      return responder({ error: 'R2 não configurado nesta função.' }, 501);
    }

    // quem está pedindo (JWT do app)
    const comoUsuario = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data } = await comoUsuario.auth.getUser();
    const usuario = data.user;
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);

    const corpo = (await req.json().catch(() => ({}))) as Corpo;
    const pasta = corpo.pasta as Pasta | undefined;
    const caminho = corpo.caminho ?? '';
    const tipoMime = corpo.tipoMime ?? '';

    if (!pasta || !PASTAS.includes(pasta)) {
      return responder({ error: 'Pasta inválida.' }, 400);
    }
    const regra = REGRAS[pasta];
    if (!regra.tipos.includes(tipoMime)) {
      return responder({ error: `Tipo ${tipoMime} não permitido em ${pasta}.` }, 400);
    }
    if (typeof corpo.bytes === 'number' && corpo.bytes > regra.bytes) {
      return responder(
        { error: `Arquivo maior que o limite de ${Math.round(regra.bytes / 1048576)} MB.` },
        413,
      );
    }
    // É esta linha que substitui a policy "upload na própria pasta" do Storage: ninguém
    // escreve fora da própria pasta, e nada de ".." para escapar dela.
    if (!caminho.startsWith(`${usuario.id}/`) || caminho.includes('..')) {
      return responder({ error: 'Caminho fora da sua pasta.' }, 403);
    }
    if (!/^[A-Za-z0-9/_.-]{1,200}$/.test(caminho)) {
      return responder({ error: 'Caminho inválido.' }, 400);
    }

    const chave = `${pasta}/${caminho}`;
    const alvo = new URL(
      `https://${contaId}.r2.cloudflarestorage.com/${bucket}/${chave}`,
    );
    alvo.searchParams.set('X-Amz-Expires', String(VALIDADE_SEGUNDOS));

    const r2 = new AwsClient({
      accessKeyId: chaveId,
      secretAccessKey: segredo,
      service: 's3',
      region: 'auto',
    });
    // signQuery: a assinatura vai na querystring, então o app envia sem header de auth —
    // é o que permite usar o UploadTask do expo-file-system (com progresso real) direto
    // contra o R2, sem o arquivo passar por aqui.
    const assinada = await r2.sign(new Request(alvo.toString(), { method: 'PUT' }), {
      aws: { signQuery: true },
    });

    return responder({
      metodo: 'PUT',
      urlDeUpload: assinada.url,
      urlPublica: `${basePublica}/${chave}`,
      expiraEm: VALIDADE_SEGUNDOS,
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
