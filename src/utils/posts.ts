import type { NovaMidia } from '@/services/data/types';
import { LIMITES_DE_MIDIA, TAMANHO_MAXIMO_POST, type MidiaDoPost } from '@/types';

import { ErroDeAplicacao } from './erros';

/** Conta caracteres como o Postgres (char_length): um emoji vale 1, não 2. */
export function tamanhoDoPost(texto: string): number {
  return [...texto.trim()].length;
}

const MB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

/** Um vídeo recém-escolhido cabe no post? (duração em segundos) */
export function validarVideoDoPost(duracao: number, tamanhoBytes: number): void {
  if (duracao > LIMITES_DE_MIDIA.videoSegundos + 0.5) {
    throw new ErroDeAplicacao(
      `Vídeos na resenha têm até ${LIMITES_DE_MIDIA.videoSegundos} segundos. Esse tem ${Math.round(duracao)} s.`,
      'video_longo',
    );
  }
  if (tamanhoBytes > LIMITES_DE_MIDIA.videoBytes) {
    throw new ErroDeAplicacao(
      `Vídeos na resenha têm até ${MB(LIMITES_DE_MIDIA.videoBytes)} MB. Esse tem ${MB(tamanhoBytes)} MB: grave um trecho menor.`,
      'video_pesado',
    );
  }
}

/** Até 4 imagens, OU 1 vídeo, OU 1 GIF (vídeo e GIF vão sozinhos). */
export function validarMidiasDoPost(midias: NovaMidia[]): void {
  const imagens = midias.filter((m) => m.tipo === 'imagem').length;
  if (imagens > LIMITES_DE_MIDIA.imagens) {
    throw new ErroDeAplicacao(
      `Dá para anexar até ${LIMITES_DE_MIDIA.imagens} imagens por post.`,
      'midias_demais',
    );
  }
  if (midias.length > 1 && imagens !== midias.length) {
    throw new ErroDeAplicacao('Vídeo e GIF vão sozinhos no post.', 'midias_misturadas');
  }
  for (const m of midias) {
    if (m.tipo === 'video') validarVideoDoPost(m.duracao, m.tamanhoBytes);
  }
}

/** Devolve o texto limpo ou lança o erro que a tela mostra. Sem texto só vale com mídia. */
export function validarTextoDoPost(texto: string, temMidia = false): string {
  const limpo = texto.trim();
  if (!limpo && !temMidia) {
    throw new ErroDeAplicacao('Escreva alguma coisa antes de publicar.', 'post_vazio');
  }
  if (tamanhoDoPost(limpo) > TAMANHO_MAXIMO_POST) {
    throw new ErroDeAplicacao(`Posts têm até ${TAMANHO_MAXIMO_POST} caracteres.`, 'post_longo');
  }
  return limpo;
}

/** Mídias vindas do banco (jsonb): descarta o que não tiver o formato esperado. */
export function normalizarMidias(bruto: unknown): MidiaDoPost[] {
  if (!Array.isArray(bruto)) return [];
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return bruto
    .filter(
      (m): m is Record<string, unknown> =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as { url?: unknown }).url === 'string' &&
        ['imagem', 'video', 'gif'].includes((m as { tipo?: string }).tipo ?? ''),
    )
    .map((m) => ({
      tipo: m.tipo as MidiaDoPost['tipo'],
      url: m.url as string,
      thumbnailUrl: typeof m.thumbnailUrl === 'string' ? m.thumbnailUrl : null,
      largura: numero(m.largura),
      altura: numero(m.altura),
      duracao: numero(m.duracao),
    }));
}
