export interface Partida {
  id: string;
  competicao: string;
  mandante: string;
  visitante: string;
  /** ISO 8601 */
  dataHora: string;
  estadio: string;
  /** só preenchido quando a partida já aconteceu */
  placar: { mandante: number; visitante: number } | null;
  status: 'agendada' | 'ao_vivo' | 'encerrada';
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
