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
  subpasta: 'videos' | 'thumbnails' | 'avatars' | 'fotos',
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

/** Gera uma miniatura (JPEG) de um vídeo local ou remoto. */
export async function gerarThumbnail(uriVideo: string, tempoMs = 500): Promise<string | null> {
  try {
    // require tardio: o módulo é só nativo e não existe na web
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const VideoThumbnails = require('expo-video-thumbnails') as typeof import('expo-video-thumbnails');
    const { uri } = await VideoThumbnails.getThumbnailAsync(uriVideo, {
      time: tempoMs,
      quality: 0.7,
    });
    return uri;
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
