import { driverDePartidas } from '@/utils/ambiente';

import { MatchServiceMock } from './MatchServiceMock';
import { MatchServiceTheSportsDB } from './MatchServiceTheSportsDB';
import type { MatchService } from './types';

let instancia: MatchService | null = null;

/**
 * Fábrica do serviço de partidas. Por padrão traz os jogos reais do Flamengo
 * (TheSportsDB); EXPO_PUBLIC_MATCH_DRIVER=mock volta ao JSON local.
 */
export function matchService(): MatchService {
  if (!instancia) {
    instancia =
      driverDePartidas() === 'mock' ? new MatchServiceMock() : new MatchServiceTheSportsDB();
  }
  return instancia;
}

export function definirMatchService(servico: MatchService | null): void {
  instancia = servico;
}

export type { MatchService, Partida } from './types';
