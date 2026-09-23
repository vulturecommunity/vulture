import { chaveDoGiphy } from '@/utils/ambiente';

/**
 * Busca de GIFs pelo GIPHY. Os arquivos ficam nos servidores deles: o post guarda só
 * a URL, então GIF não gasta nada do Storage nem do tráfego do Supabase.
 * Termos de uso do GIPHY: a tela de busca precisa mostrar "Powered by GIPHY".
 */
const BASE = 'https://api.giphy.com/v1/gifs';
const TEMPO_LIMITE_MS = 8000;

export interface Gif {
  id: string;
  /** versão com 200 px de altura (webp animado), usada no post */
  url: string;
  largura: number;
  altura: number;
  /** versão menor para a grade de busca */
  previa: string;
  titulo: string;
}

interface ImagemGiphy {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GifDaApi {
  id: string;
  title?: string;
  images?: { fixed_height?: ImagemGiphy; fixed_width_small?: ImagemGiphy };
}

export function giphyDisponivel(): boolean {
  return !!chaveDoGiphy();
}

function paraGif(g: GifDaApi): Gif | null {
  const principal = g.images?.fixed_height;
  const url = principal?.webp ?? principal?.url;
  const largura = Number(principal?.width);
  const altura = Number(principal?.height);
  if (!url || !largura || !altura) return null;
  const pequena = g.images?.fixed_width_small;
  return {
    id: g.id,
    url,
    largura,
    altura,
    previa: pequena?.webp ?? pequena?.url ?? url,
    titulo: g.title ?? '',
  };
}

/** Termo vazio traz os GIFs em alta. */
export async function buscarGifs(termo: string): Promise<Gif[]> {
  const chave = chaveDoGiphy();
  if (!chave) throw new Error('GIFs indisponíveis: falta configurar EXPO_PUBLIC_GIPHY_KEY.');
  const limpo = termo.trim();
  const parametros = new URLSearchParams({
    api_key: chave,
    limit: '24',
    rating: 'pg-13',
    bundle: 'messaging_non_clips',
  });
  if (limpo) {
    parametros.set('q', limpo);
    parametros.set('lang', 'pt');
  }
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${BASE}/${limpo ? 'search' : 'trending'}?${parametros}`, {
      signal: controle.signal,
    });
    if (!resposta.ok) throw new Error(`GIPHY respondeu ${resposta.status}`);
    const corpo = (await resposta.json()) as { data?: GifDaApi[] };
    return (corpo.data ?? []).map(paraGif).filter((g): g is Gif => g !== null);
  } finally {
    clearTimeout(relogio);
  }
}
