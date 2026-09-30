import { Directory, File, Paths } from 'expo-file-system';

const PASTA_RAIZ = 'vulture';

function extensaoDe(uri: string, padrao: string): string {
  const semQuery = uri.split('?')[0];
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(semQuery);
  return m ? m[1].toLowerCase() : padrao;
}

/**
 * Copia um arquivo local (file://) para a pasta permanente do app.
 * Retorna a URI do arquivo copiado.
 */
export async function salvarArquivoLocalmente(
  uriOrigem: string,
  subpasta: 'videos' | 'thumbnails' | 'avatars' | 'fotos' | 'rasantes' | 'posts',
  nomeBase: string,
  extensaoPadrao = 'mp4',
): Promise<string> {
  const pasta = new Directory(Paths.document, PASTA_RAIZ, subpasta);
  if (!pasta.exists) pasta.create({ intermediates: true, idempotent: true });
  const destino = new File(pasta, `${nomeBase}.${extensaoDe(uriOrigem, extensaoPadrao)}`);
  const origem = new File(uriOrigem);
  await origem.copy(destino, { overwrite: true });
  return destino.uri;
}

export function removerArquivoLocal(uri: string | null | undefined): void {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // arquivo já removido
  }
}

/**
 * Lados máximos depois da compressão no aparelho.
 *
 * Isto é a maior alavanca de custo do app: cada byte aqui é multiplicado por quantas vezes
 * o arquivo é baixado. Uma miniatura de 1,9 MB (frame 720p inteiro, que era o que saía
 * daqui) é baixada em todo card do feed e em toda grade de perfil.
 */
export const LADO_DA_MINIATURA = 540;
export const LADO_DA_FOTO = 1080;
export const LADO_DO_AVATAR = 512;

export interface ImagemComprimida {
  uri: string;
  largura: number;
  altura: number;
}

/**
 * Redimensiona (só para baixo) e recomprime em JPEG. Nunca amplia: imagem menor que o
 * limite só é recomprimida.
 */
export async function comprimirImagem(
  uri: string,
  lado: number,
  qualidade = 0.72,
  tamanhoOriginal?: { largura: number; altura: number },
): Promise<ImagemComprimida> {
  // prettier-ignore
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const contexto = ImageManipulator.manipulate(uri);
  const largura = tamanhoOriginal?.largura ?? 0;
  const altura = tamanhoOriginal?.altura ?? 0;
  // sem as medidas originais, encolhe pelo lado maior sem risco de ampliar
  if (largura === 0 || Math.max(largura, altura) > lado) {
    contexto.resize(largura >= altura ? { width: lado } : { height: lado });
  }
  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({ compress: qualidade, format: SaveFormat.JPEG });
  return { uri: salva.uri, largura: salva.width, altura: salva.height };
}

/**
 * Gera a miniatura (JPEG) de um vídeo local ou remoto, já redimensionada.
 *
 * O `getThumbnailAsync` devolve o frame no tamanho original do vídeo — num clipe 720p isso
 * dava quase 2 MB por miniatura. Encolher para 540 px corta ~30× sem diferença visível,
 * porque a miniatura só aparece como capa enquanto o vídeo carrega e na grade do perfil.
 */
export async function gerarThumbnail(uriVideo: string, tempoMs = 500): Promise<string | null> {
  try {
    // require tardio: o módulo é só nativo e não existe na web
    // prettier-ignore
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const VideoThumbnails = require('expo-video-thumbnails') as typeof import('expo-video-thumbnails');
    const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(uriVideo, {
      time: tempoMs,
      quality: 0.7,
    });
    try {
      const menor = await comprimirImagem(uri, LADO_DA_MINIATURA, 0.6, {
        largura: width,
        altura: height,
      });
      return menor.uri;
    } catch {
      // sem o manipulador, a miniatura grande ainda é melhor do que nenhuma
      return uri;
    }
  } catch {
    return null;
  }
}

export function tipoMimeDe(uri: string, tipo: 'video' | 'foto'): string {
  const ext = extensaoDe(uri, tipo === 'video' ? 'mp4' : 'jpg');
  if (tipo === 'video') return ext === 'mov' ? 'video/quicktime' : `video/${ext}`;
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
