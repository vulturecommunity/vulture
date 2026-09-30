// Supabase Edge Function: página de abertura dos links compartilhados.
// Deploy: supabase functions deploy abrir --no-verify-jwt
//
// O PROBLEMA QUE ISTO RESOLVE
//
// O app compartilhava links `vulture://video/<id>`. No WhatsApp e no Gmail isso é texto
// morto: não vira link clicável, não mostra prévia, e para quem não tem o app instalado
// não leva a lugar nenhum. Era por isso que o compartilhamento parecia amador.
//
// Aqui cada conteúdo ganha uma URL https de verdade, que:
//   1. devolve HTML com Open Graph — WhatsApp, Telegram, Gmail, X e iMessage passam a
//      mostrar um CARD com miniatura, título e descrição, que é o que faz o link do
//      TikTok/Kwai parecer profissional;
//   2. tenta abrir o app pelo deep link assim que carrega, para quem já tem o Vulture;
//   3. mostra uma página de convite decente para quem ainda não tem.
//
// Sem verificação de JWT: é um link público, aberto por quem recebeu a mensagem.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORES = {
  fundo: '#0A0A0B',
  cartao: '#141416',
  borda: '#27272B',
  vermelho: '#C8102E',
  texto: '#F5F5F6',
  secundario: '#A6A8AE',
};

interface Previa {
  titulo: string;
  descricao: string;
  imagem: string | null;
  deepLink: string;
  /** rótulo do botão principal */
  acao: string;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Texto pronto para ir DENTRO de um atributo de <meta>.
 *
 * Além de escapar, precisa colapsar quebra de linha: a legenda de um vídeo costuma ter
 * \n (ex.: "Teste\n#teste") e uma quebra literal dentro do atributo faz leitor de prévia
 * truncar o título ou ignorar a tag — o card do WhatsApp sai sem título.
 */
function textoDeMeta(valor: string, limite = 200): string {
  const limpo = valor.replace(/\s+/g, ' ').trim();
  const cortado = limpo.length > limite ? `${limpo.slice(0, limite - 1).trimEnd()}…` : limpo;
  return escapar(cortado);
}

function pagina(p: Previa, urlCanonica: string): string {
  // nas <meta> o texto vai colapsado numa linha; no corpo da página pode ter quebra
  const t = textoDeMeta(p.titulo);
  const d = textoDeMeta(p.descricao);
  const tituloVisivel = escapar(p.titulo);
  const descricaoVisivel = escapar(p.descricao);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} · Vulture</title>
<meta name="description" content="${d}">

<!-- Open Graph: é isto que o WhatsApp, o Gmail e o Telegram leem para montar o card -->
<meta property="og:site_name" content="Vulture">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${escapar(urlCanonica)}">
${p.imagem ? `<meta property="og:image" content="${escapar(p.imagem)}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1920">` : ''}
<meta name="twitter:card" content="${p.imagem ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${p.imagem ? `<meta name="twitter:image" content="${escapar(p.imagem)}">` : ''}

<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${CORES.fundo};color:${CORES.texto};min-height:100vh;
       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
       display:flex;align-items:center;justify-content:center;padding:24px}
  .cartao{width:100%;max-width:420px;background:${CORES.cartao};border:1px solid ${CORES.borda};
          border-radius:20px;overflow:hidden;border-top:3px solid ${CORES.vermelho}}
  .capa{width:100%;aspect-ratio:9/16;max-height:60vh;object-fit:cover;display:block;background:#000}
  .corpo{padding:20px;display:flex;flex-direction:column;gap:14px}
  .marca{font-size:12px;font-weight:800;letter-spacing:3px;color:${CORES.vermelho}}
  h1{font-size:20px;font-weight:800;line-height:1.3}
  p{font-size:14px;color:${CORES.secundario};line-height:1.5}
  .botao{display:block;text-align:center;padding:15px;border-radius:12px;
         background:${CORES.vermelho};color:#fff;font-weight:700;text-decoration:none;font-size:15px}
  .secundario{background:transparent;border:1px solid ${CORES.borda};color:${CORES.texto}}
  .aviso{font-size:11px;color:#6C6E75;text-align:center;line-height:1.5}
</style>
</head>
<body>
  <div class="cartao">
    ${p.imagem ? `<img class="capa" src="${escapar(p.imagem)}" alt="">` : ''}
    <div class="corpo">
      <div class="marca">VULTURE</div>
      <h1>${tituloVisivel}</h1>
      <p>${descricaoVisivel}</p>
      <a class="botao" id="abrir" href="${escapar(p.deepLink)}">${escapar(p.acao)}</a>
      <a class="botao secundario" href="https://expo.dev">Ainda não tenho o app</a>
      <p class="aviso">App não oficial feito por torcedores.<br>Sem vínculo com o clube.</p>
    </div>
  </div>
<script>
  // Tenta abrir o app assim que a página carrega. Quem não tem o Vulture instalado
  // simplesmente continua vendo o card — nenhum erro aparece na tela.
  setTimeout(function () { window.location.href = ${JSON.stringify(p.deepLink)}; }, 350);
</script>
</body>
</html>`;
}

function responderHtml(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // os robôs de prévia (WhatsApp/Gmail) batem várias vezes no mesmo link
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // .../functions/v1/abrir/<tipo>/<id>
    const partes = url.pathname.split('/').filter(Boolean);
    const i = partes.indexOf('abrir');
    const tipo = partes[i + 1] ?? '';
    const id = decodeURIComponent(partes[i + 2] ?? '');

    // A função recebe o caminho já reescrito por dentro (sem /functions/v1 e como http),
    // então og:url precisa ser remontada — um scraper que siga a URL errada toma 404 e
    // desiste da prévia.
    const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
    const urlCanonica = `${base}/functions/v1/abrir/${tipo}/${encodeURIComponent(id)}`;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let previa: Previa | null = null;

    if (tipo === 'v' && id) {
      const { data } = await admin
        .from('videos')
        .select('legenda, thumbnail_url, autor:profiles!videos_autor_id_fkey(apelido)')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const autor = (data.autor as unknown as { apelido: string } | null)?.apelido ?? 'torcedor';
        previa = {
          titulo: data.legenda?.trim() || `Vídeo de @${autor}`,
          descricao: `@${autor} postou na nação rubro-negra. Abra no Vulture para assistir.`,
          imagem: data.thumbnail_url,
          deepLink: `vulture://video/${id}`,
          acao: 'Assistir no Vulture',
        };
      }
    } else if (tipo === 'p' && id) {
      const { data } = await admin
        .from('posts')
        .select('texto, midias, autor:profiles!posts_autor_id_fkey(apelido)')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        const autor = (data.autor as unknown as { apelido: string } | null)?.apelido ?? 'torcedor';
        const midias = (data.midias ?? []) as { url?: string; thumbnailUrl?: string }[];
        previa = {
          titulo: data.texto?.trim() || `Resenha de @${autor}`,
          descricao: `@${autor} na Arquibancada do Vulture.`,
          imagem: midias[0]?.thumbnailUrl ?? midias[0]?.url ?? null,
          deepLink: `vulture://arquibancada/post/${id}`,
          acao: 'Ver a resenha',
        };
      }
    } else if (tipo === 'u' && id) {
      const { data } = await admin
        .from('profiles')
        .select('apelido, nome, bio, avatar_url')
        .eq('apelido', id.replace(/^@/, ''))
        .maybeSingle();
      if (data) {
        previa = {
          titulo: `@${data.apelido} no Vulture`,
          descricao: data.bio?.trim() || `${data.nome || data.apelido} está na nação rubro-negra.`,
          imagem: data.avatar_url,
          deepLink: `vulture://usuario/${data.apelido}`,
          acao: 'Ver o perfil',
        };
      }
    } else if (tipo === 'liga' && id) {
      const { data } = await admin
        .from('ligas')
        .select('nome, codigo')
        .eq('codigo', id.toUpperCase())
        .maybeSingle();
      if (data) {
        previa = {
          titulo: `Liga "${data.nome}" está te esperando`,
          descricao:
            `Entre com o código ${data.codigo} e dispute os palpites do Mengão ` +
            'com a galera. Cravar o placar vale 10 pontos.',
          imagem: null,
          deepLink: `vulture://arquibancada?aba=ranking&liga=${data.codigo}`,
          acao: `Entrar com o código ${data.codigo}`,
        };
      }
    }

    if (!previa) {
      previa = {
        titulo: 'Vulture · o app da nação',
        descricao:
          'Resenha, vídeos, lives e o ranking de palpites do Mengão. Feito por torcedores.',
        imagem: null,
        deepLink: 'vulture://',
        acao: 'Abrir o Vulture',
      };
    }

    return responderHtml(pagina(previa, urlCanonica));
  } catch {
    return responderHtml(
      pagina(
        {
          titulo: 'Vulture',
          descricao: 'O app da nação rubro-negra.',
          imagem: null,
          deepLink: 'vulture://',
          acao: 'Abrir o Vulture',
        },
        req.url,
      ),
      200,
    );
  }
});
