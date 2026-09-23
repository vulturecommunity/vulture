import { driverDeDados, driverDePartidas } from '@/utils/ambiente';

import { MatchServiceMock } from './MatchServiceMock';
import { PartidasSupabase } from './PartidasSupabase';
import type { CalendarioService, MatchService } from './types';

let instancia: (MatchService & CalendarioService) | null = null;
let substitutoDoCalendario: CalendarioService | null = null;
let substitutoDoMatch: MatchService | null = null;

/**
 * Uma fonte só para a faixa do feed e para o calendário: a tabela public.partidas do
 * Supabase (cache da Highlightly). Só o modo demonstração (driver mock) usa o JSON local.
 */
function fonte(): MatchService & CalendarioService {
  if (!instancia) {
    const real = driverDePartidas() === 'real' && driverDeDados() === 'supabase';
    instancia = real ? new PartidasSupabase() : new MatchServiceMock();
  }
  return instancia;
}

export function matchService(): MatchService {
  return substitutoDoMatch ?? fonte();
}

export function calendarioService(): CalendarioService {
  return substitutoDoCalendario ?? fonte();
}

/** Troca as fontes (usado em testes). */
export function definirMatchService(servico: MatchService | null): void {
  substitutoDoMatch = servico;
}

export function definirCalendarioService(servico: CalendarioService | null): void {
  substitutoDoCalendario = servico;
}

export type { CalendarioService, MatchService, Partida } from './types';
