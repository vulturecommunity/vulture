export interface Partida {
  id: string;
  competicao: string;
  /** fase do mata-mata ("Semifinal", "Oitavas"); vazio em pontos corridos */
  fase?: string | null;
  mandante: string;
  visitante: string;
  /** siglas oficiais ("FLA", "SAN"), quando a fonte informa */
  siglas?: { mandante: string; visitante: string } | null;
  /** ISO 8601 */
  dataHora: string;
  estadio: string;
  /** só preenchido quando a partida já aconteceu */
  placar: { mandante: number; visitante: number } | null;
  status: 'agendada' | 'ao_vivo' | 'encerrada';
  /** minuto do jogo, só com a bola rolando */
  minuto?: number | null;
  /** "pênaltis 4–3" ou "prorrogação" quando o jogo não acabou nos 90 min */
  nota?: string | null;
}

/**
 * Contrato do serviço de partidas. Hoje é alimentado por JSON local (MatchServiceMock);
 * para plugar uma API real basta implementar esta interface (ver ROADMAP.md).
 */
export interface MatchService {
  proximoJogo(): Promise<Partida | null>;
  ultimoResultado(): Promise<Partida | null>;
  listarPartidas(): Promise<Partida[]>;
}

/** Temporada inteira do time (todas as competições), em ordem cronológica. */
export interface CalendarioService {
  listarTemporada(): Promise<Partida[]>;
  /** Recebe cada atualização de placar em tempo real; devolve a função para parar. */
  assinar?(aoMudar: (partida: Partida) => void): () => void;
}
