import { haJogoAgora } from '@/hooks/usePlacarAoVivo';

import {
  clube,
  paraLinhaDePartida,
  traduzirFase,
  type PartidaHighlightly,
} from '../../../../supabase/functions/_shared/highlightly';
import { paraPartida } from '../PartidasSupabase';

/** Formato real de GET /matches (conferido contra a API em 2026-09-23). */
function jogo(
  parcial: Partial<PartidaHighlightly> & { descricao?: string; placar?: string | null },
) {
  const { descricao = 'Finished', placar = '2 - 1', ...resto } = parcial;
  return {
    id: 1270018717,
    date: '2026-09-20T21:30:00.000Z',
    round: 'Regular Season - 28',
    country: { code: 'BR' },
    league: { id: 61205, name: 'Serie A', season: 2026 },
    homeTeam: { id: 108861, name: 'Flamengo' },
    awayTeam: { id: 1, name: 'RB Bragantino' },
    state: { clock: 90, description: descricao, score: { current: placar, penalties: null } },
    ...resto,
  } as PartidaHighlightly;
}

describe('mapeamento da Highlightly', () => {
  it('jogo encerrado do Brasileirão com rodada, siglas e placar', () => {
    expect(paraLinhaDePartida(jogo({}))).toEqual({
      id: 'hl-1270018717',
      temporada: 2026,
      competicao: 'Brasileirão',
      fase: '28ª rodada',
      mandante: 'Flamengo',
      visitante: 'Bragantino',
      sigla_mandante: 'FLA',
      sigla_visitante: 'BRA',
      data_hora: '2026-09-20T21:30:00.000Z',
      estadio: null,
      gols_mandante: 2,
      gols_visitante: 1,
      status: 'encerrada',
      minuto: null,
      nota: null,
    });
  });

  it('"Serie A" italiana não vira Brasileirão', () => {
    expect(paraLinhaDePartida(jogo({ country: { code: 'IT' } }))!.competicao).toBe('Serie A');
  });

  it('ao vivo guarda o minuto; agendado não tem placar', () => {
    const rolando = paraLinhaDePartida(
      jogo({ descricao: 'Second half', placar: '1 - 0', state: undefined }),
    );
    // sem "state" o jogo é tratado como agendado
    expect(rolando!.status).toBe('agendada');
    const aoVivo = paraLinhaDePartida({
      ...jogo({}),
      state: { clock: 67, description: 'Second half', score: { current: '1 - 0' } },
    })!;
    expect(aoVivo).toMatchObject({ status: 'ao_vivo', minuto: 67, gols_mandante: 1 });
    const agendado = paraLinhaDePartida(jogo({ descricao: 'Not started', placar: null }))!;
    expect(agendado).toMatchObject({ status: 'agendada', gols_mandante: null, minuto: null });
  });

  it('pênaltis e prorrogação viram nota; adiado/abandonado sai do calendário', () => {
    const penaltis = paraLinhaDePartida({
      ...jogo({}),
      state: {
        description: 'Finished after penalties',
        score: { current: '0 - 0', penalties: '4 - 5' },
      },
    })!;
    expect(penaltis.nota).toBe('pênaltis 4–5');
    expect(paraLinhaDePartida(jogo({ descricao: 'Finished after extra time' }))!.nota).toBe(
      'prorrogação',
    );
    expect(paraLinhaDePartida(jogo({ descricao: 'Abandoned' }))).toBeNull();
    expect(paraLinhaDePartida(jogo({ descricao: 'Postponed' }))).toBeNull();
  });

  it('traduz fases e competições', () => {
    expect(traduzirFase('Semi-finals')).toBe('Semifinal');
    expect(traduzirFase('Quarter-finals')).toBe('Quartas');
    expect(traduzirFase('Round of 16')).toBe('Oitavas');
    expect(traduzirFase('Group Stage - 3')).toBe('Fase de grupos · 3ª rodada');
    expect(traduzirFase('Club Friendlies')).toBeNull();
    const liberta = paraLinhaDePartida(
      jogo({ league: { name: 'CONMEBOL Libertadores', season: 2026 }, country: { code: 'World' } }),
    )!;
    expect(liberta.competicao).toBe('Libertadores');
    const carioca = paraLinhaDePartida(jogo({ league: { name: 'Carioca - 1', season: 2026 } }))!;
    expect(carioca.competicao).toBe('Carioca');
  });

  it('corrige nomes e siglas dos clubes; desconhecido ganha sigla de 3 letras', () => {
    expect(clube('Vasco DA Gama')).toEqual({ nome: 'Vasco da Gama', sigla: 'VAS' });
    expect(clube('São Paulo FC')).toEqual({ nome: 'São Paulo', sigla: 'SAO' });
    expect(clube('Atletico-MG')).toEqual({ nome: 'Atlético-MG', sigla: 'CAM' });
    expect(clube('Estudiantes de La Plata')).toEqual({ nome: 'Estudiantes', sigla: 'EST' });
    expect(clube('Clube Novo EC')).toEqual({ nome: 'Clube Novo EC', sigla: 'CLU' });
  });

  it('linha do banco vira a Partida que as telas usam', () => {
    const linha = paraLinhaDePartida(jogo({}))!;
    expect(paraPartida({ ...linha, estadio: 'Maracanã' })).toMatchObject({
      id: 'hl-1270018717',
      siglas: { mandante: 'FLA', visitante: 'BRA' },
      placar: { mandante: 2, visitante: 1 },
      estadio: 'Maracanã',
      status: 'encerrada',
    });
  });
});

describe('quando ligar o placar ao vivo', () => {
  const agora = new Date('2026-10-08T22:20:00.000Z').getTime();
  const partida = (dataHora: string, status: 'agendada' | 'ao_vivo' | 'encerrada') => ({
    id: 'p',
    competicao: 'Brasileirão',
    mandante: 'Santos',
    visitante: 'Flamengo',
    dataHora,
    estadio: '',
    placar: null,
    status,
  });

  it('com jogo rolando ou começando em até 15 minutos', () => {
    expect(haJogoAgora([partida('2026-10-08T21:00:00.000Z', 'ao_vivo')], agora)).toBe(true);
    expect(haJogoAgora([partida('2026-10-08T22:30:00.000Z', 'agendada')], agora)).toBe(true);
    expect(haJogoAgora([partida('2026-10-09T22:30:00.000Z', 'agendada')], agora)).toBe(false);
    expect(haJogoAgora([partida('2026-10-08T20:00:00.000Z', 'encerrada'), null], agora)).toBe(
      false,
    );
  });
});
