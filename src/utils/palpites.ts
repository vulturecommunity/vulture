import type { Partida } from '@/services/partidas/types';
import type { Palpite, ResumoDePalpites } from '@/types';

import { ErroDeAplicacao } from './erros';
import { abreviarTime } from './formatadores';

export const GOLS_MAXIMOS_NO_PALPITE = 20;

/** Mesma regra nos dois drivers (o Supabase ainda confere de novo na RLS). */
export function validarPalpite(
  novo: { inicioDaPartida: string; golsMandante: number; golsVisitante: number },
  agora: Date = new Date(),
): void {
  const valido = (g: number) => Number.isInteger(g) && g >= 0 && g <= GOLS_MAXIMOS_NO_PALPITE;
  if (!valido(novo.golsMandante) || !valido(novo.golsVisitante)) {
    throw new ErroDeAplicacao(
      `O placar vai de 0 a ${GOLS_MAXIMOS_NO_PALPITE} gols.`,
      'palpite_invalido',
    );
  }
  const inicio = new Date(novo.inicioDaPartida).getTime();
  if (Number.isNaN(inicio) || inicio <= agora.getTime()) {
    throw new ErroDeAplicacao('Palpites encerrados: a bola já rolou.', 'palpite_encerrado');
  }
}

export function resumirPalpites(
  votos: Pick<Palpite, 'golsMandante' | 'golsVisitante'>[],
): ResumoDePalpites {
  const placares = new Map<
    string,
    { golsMandante: number; golsVisitante: number; votos: number }
  >();
  const resumo: ResumoDePalpites = {
    total: votos.length,
    vitoriaMandante: 0,
    empate: 0,
    vitoriaVisitante: 0,
    placarPopular: null,
  };
  for (const v of votos) {
    if (v.golsMandante > v.golsVisitante) resumo.vitoriaMandante += 1;
    else if (v.golsMandante === v.golsVisitante) resumo.empate += 1;
    else resumo.vitoriaVisitante += 1;
    const chave = `${v.golsMandante}x${v.golsVisitante}`;
    const atual = placares.get(chave) ?? { ...v, votos: 0 };
    atual.votos += 1;
    placares.set(chave, atual);
  }
  for (const p of placares.values()) {
    if (!resumo.placarPopular || p.votos > resumo.placarPopular.votos) {
      resumo.placarPopular = {
        golsMandante: p.golsMandante,
        golsVisitante: p.golsVisitante,
        votos: p.votos,
      };
    }
  }
  return resumo;
}

/** Aberto até a bola rolar. */
export function palpiteAberto(partida: Partida, agora: Date = new Date()): boolean {
  return partida.status === 'agendada' && new Date(partida.dataHora).getTime() > agora.getTime();
}

export type ResultadoDoPalpite = 'cravou' | 'vencedor' | 'errou';

/** Cravou = placar exato (3 pts); vencedor = acertou quem ganhou ou o empate (1 pt). */
export function avaliarPalpite(
  palpite: Pick<Palpite, 'golsMandante' | 'golsVisitante'>,
  placar: { mandante: number; visitante: number },
): ResultadoDoPalpite {
  if (palpite.golsMandante === placar.mandante && palpite.golsVisitante === placar.visitante) {
    return 'cravou';
  }
  const sinal = (a: number, b: number) => Math.sign(a - b);
  return sinal(palpite.golsMandante, palpite.golsVisitante) ===
    sinal(placar.mandante, placar.visitante)
    ? 'vencedor'
    : 'errou';
}

export const PONTOS_DO_PALPITE: Record<ResultadoDoPalpite, number> = {
  cravou: 3,
  vencedor: 1,
  errou: 0,
};

const eFlamengo = (time: string) => /flamengo/i.test(time);

/** Resultado do ponto de vista rubro-negro (null se o jogo não terminou ou não é do Flamengo). */
export function resultadoDoFlamengo(partida: Partida): 'V' | 'E' | 'D' | null {
  if (partida.status !== 'encerrada' || !partida.placar) return null;
  const casa = eFlamengo(partida.mandante);
  if (!casa && !eFlamengo(partida.visitante)) return null;
  const pro = casa ? partida.placar.mandante : partida.placar.visitante;
  const contra = casa ? partida.placar.visitante : partida.placar.mandante;
  if (pro > contra) return 'V';
  return pro === contra ? 'E' : 'D';
}

export interface ResumoDoMes {
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
}

export function resumirMes(partidas: Partida[]): ResumoDoMes {
  const resumo: ResumoDoMes = {
    jogos: partidas.length,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    golsPro: 0,
    golsContra: 0,
  };
  for (const p of partidas) {
    const resultado = resultadoDoFlamengo(p);
    if (!resultado || !p.placar) continue;
    const casa = eFlamengo(p.mandante);
    resumo.golsPro += casa ? p.placar.mandante : p.placar.visitante;
    resumo.golsContra += casa ? p.placar.visitante : p.placar.mandante;
    if (resultado === 'V') resumo.vitorias += 1;
    else if (resultado === 'E') resumo.empates += 1;
    else resumo.derrotas += 1;
  }
  return resumo;
}

export function siglasDa(partida: Partida): { mandante: string; visitante: string } {
  return (
    partida.siglas ?? {
      mandante: abreviarTime(partida.mandante),
      visitante: abreviarTime(partida.visitante),
    }
  );
}

/** "SAN x FLA", usado para marcar posts com o jogo. */
export function rotuloDaPartida(partida: Partida): string {
  const { mandante, visitante } = siglasDa(partida);
  return `${mandante} x ${visitante}`;
}

/** Chave "2026-10" do mês local da partida. */
export function chaveDoMes(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Jogo que vale destacar agora: o que está rolando; senão o que acabou há pouco
 * (a resenha pós-jogo); senão o próximo.
 */
export function partidaEmDestaque(partidas: Partida[], agora: Date = new Date()): Partida | null {
  const aoVivo = partidas.find((p) => p.status === 'ao_vivo');
  if (aoVivo) return aoVivo;
  // ~2 h de jogo + 6 h de resenha depois do apito
  const janela = 8 * 60 * 60 * 1000;
  const recente = [...partidas]
    .reverse()
    .find(
      (p) => p.status === 'encerrada' && agora.getTime() - new Date(p.dataHora).getTime() < janela,
    );
  if (recente) return recente;
  return proximaPartida(partidas, agora);
}

export function proximaPartida(partidas: Partida[], agora: Date = new Date()): Partida | null {
  return (
    partidas.find(
      (p) =>
        p.status === 'ao_vivo' ||
        (p.status === 'agendada' && new Date(p.dataHora).getTime() > agora.getTime()),
    ) ?? null
  );
}
