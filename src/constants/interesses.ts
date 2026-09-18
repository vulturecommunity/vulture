/** Interesses escolhidos no onboarding e usados como categoria dos vídeos. */
export const INTERESSES = ['Jogos', 'Bastidores', 'Torcida', 'Memes', 'Análises'] as const;
export type Interesse = (typeof INTERESSES)[number];

export const ICONE_INTERESSE: Record<Interesse, string> = {
  Jogos: '⚽',
  Bastidores: '🎬',
  Torcida: '🔴',
  Memes: '😂',
  Análises: '📊',
};

/** Canais temáticos exibidos no topo do Explorar. */
export const CANAIS = ['Maracanã', 'Bastidores', 'Golaço', 'Torcida', 'Base', 'Resenha'] as const;
export type Canal = (typeof CANAIS)[number];

/** Reações temáticas usadas nas lives. */
export const REACOES = ['🔴', '⚫', '🦅', '🏆'] as const;
export type Reacao = (typeof REACOES)[number];

export const DURACAO_MAXIMA_VIDEO_SEGUNDOS = 60;
export const DURACAO_FOTO_SEGUNDOS = 5;
