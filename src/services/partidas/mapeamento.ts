import type { Partida } from './types';

/**
 * Tradução dos eventos da TheSportsDB para o nosso tipo Partida.
 * Sem nenhuma dependência de React Native de propósito: dá para rodar este
 * mapeamento contra a API real (node) na hora de conferir.
 */

/** Clube de Regatas do Flamengo na base da TheSportsDB. */
export const ID_FLAMENGO = '134287';
export const BASE = 'https://www.thesportsdb.com/api/v1/json/3';

/** Nomes das competições como o torcedor fala. */
const COMPETICOES: Record<string, string> = {
  'Brazilian Serie A': 'Brasileirão',
  'Brazilian Serie B': 'Série B',
  'Brazilian Campeonato Carioca': 'Carioca',
  'Copa Libertadores': 'Libertadores',
  'Copa Sudamericana': 'Sul-Americana',
  'Recopa Sudamericana': 'Recopa',
  'Copa do Brasil': 'Copa do Brasil',
  'FIFA Club World Cup': 'Mundial de Clubes',
  'Supercopa do Brasil': 'Supercopa',
};

/** Status que a API devolve quando a bola está rolando. */
const AO_VIVO = /^(1h|2h|ht|et|bt|live|p|in play)$/i;
const ENCERRADA = /^(ft|aet|pen|awd|wo|match finished)$/i;

export interface EventoDaApi {
  idEvent?: string;
  strEvent?: string;
  strLeague?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strTimestamp?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strVenue?: string | null;
  strStatus?: string | null;
  strPostponed?: string | null;
}

/** A API manda o horário em UTC sem o sufixo: "2026-09-20T21:30:00". */
function paraIso(evento: EventoDaApi): string | null {
  const bruto =
    evento.strTimestamp ??
    (evento.dateEvent ? `${evento.dateEvent}T${evento.strTime ?? '00:00:00'}` : null);
  if (!bruto) return null;
  const normalizado = bruto
    .trim()
    .replace(' ', 'T')
    .replace(/\+00:00$/, '');
  const comFuso = /[zZ]$/.test(normalizado) ? normalizado : `${normalizado}Z`;
  const data = new Date(comFuso);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

function numeroOuNulo(valor: string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function statusDe(evento: EventoDaApi, dataHora: string, agora: Date): Partida['status'] {
  const bruto = (evento.strStatus ?? '').trim();
  if (ENCERRADA.test(bruto)) return 'encerrada';
  if (AO_VIVO.test(bruto) || /^\d+$/.test(bruto)) return 'ao_vivo';
  // sem status confiável: decide pelo relógio (uma partida dura ~2h)
  const inicio = new Date(dataHora).getTime();
  if (Number.isNaN(inicio)) return 'agendada';
  const passados = agora.getTime() - inicio;
  if (passados < 0) return 'agendada';
  return passados < 2.5 * 60 * 60 * 1000 ? 'ao_vivo' : 'encerrada';
}

export function paraPartida(evento: EventoDaApi, agora: Date = new Date()): Partida | null {
  const dataHora = paraIso(evento);
  if (!dataHora || !evento.strHomeTeam || !evento.strAwayTeam) return null;
  const mandante = numeroOuNulo(evento.intHomeScore);
  const visitante = numeroOuNulo(evento.intAwayScore);
  const liga = (evento.strLeague ?? '').trim();
  return {
    id: evento.idEvent ?? `${evento.strHomeTeam}-${dataHora}`,
    competicao: COMPETICOES[liga] ?? liga,
    mandante: evento.strHomeTeam.trim(),
    visitante: evento.strAwayTeam.trim(),
    dataHora,
    estadio: (evento.strVenue ?? '').trim(),
    placar: mandante !== null && visitante !== null ? { mandante, visitante } : null,
    status: statusDe(evento, dataHora, agora),
  };
}

/** O que fica guardado no aparelho para sobreviver a uma queda de rede. */
export interface CacheDePartidas {
  proximo: Partida | null;
  ultimo: Partida | null;
  salvoEm: string;
}
