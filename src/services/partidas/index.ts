import { MatchServiceMock } from './MatchServiceMock';
import type { MatchService } from './types';

let instancia: MatchService | null = null;

/**
 * Fábrica do serviço de partidas.
 * TODO (ROADMAP): trocar MatchServiceMock por um adaptador de API real (ex.: API-Football)
 * implementando a mesma interface `MatchService` em `src/services/partidas/`.
 */
export function matchService(): MatchService {
  if (!instancia) instancia = new MatchServiceMock();
  return instancia;
}

export function definirMatchService(servico: MatchService | null): void {
  instancia = servico;
}

export type { MatchService, Partida } from './types';
