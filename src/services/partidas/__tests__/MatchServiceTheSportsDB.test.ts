import AsyncStorage from '@react-native-async-storage/async-storage';

import { MatchServiceTheSportsDB } from '../MatchServiceTheSportsDB';
import { paraPartida } from '../mapeamento';

const agora = () => new Date('2026-09-22T12:00:00.000Z');

const jogoEncerrado = {
  idEvent: '2398464',
  strEvent: 'Flamengo vs Bragantino',
  strLeague: 'Brazilian Serie A',
  strHomeTeam: 'Flamengo',
  strAwayTeam: 'Bragantino',
  intHomeScore: '2',
  intAwayScore: '1',
  // a API manda UTC sem sufixo: 21:30Z é 18:30 em Brasília
  strTimestamp: '2026-09-20T21:30:00',
  dateEvent: '2026-09-20',
  strTime: '21:30:00',
  strVenue: 'Estádio do Maracanã',
  strStatus: 'FT',
};

const jogoFuturo = {
  idEvent: '2398500',
  strEvent: 'Santos vs Flamengo',
  strLeague: 'Copa Libertadores',
  strHomeTeam: 'Santos',
  strAwayTeam: 'Flamengo',
  intHomeScore: null,
  intAwayScore: null,
  strTimestamp: '2026-10-08T22:30:00',
  strVenue: 'Estádio Urbano Caldeira',
  strStatus: 'NS',
};

/** Responde eventslast/eventsnext com o que o teste pedir. */
function simularApi(ultimos: unknown[], proximos: unknown[]) {
  return jest.fn((url: string) => {
    const lista = url.includes('eventslast') ? { results: ultimos } : { events: proximos };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(lista) } as Response);
  });
}

describe('MatchServiceTheSportsDB', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('converte o horário UTC da API e traduz a competição', () => {
    const p = paraPartida(jogoEncerrado, agora())!;
    expect(p.competicao).toBe('Brasileirão');
    expect(p.mandante).toBe('Flamengo');
    expect(p.visitante).toBe('Bragantino');
    expect(p.placar).toEqual({ mandante: 2, visitante: 1 });
    expect(p.estadio).toBe('Estádio do Maracanã');
    expect(p.status).toBe('encerrada');
    // independente do fuso da máquina, o instante é o mesmo
    expect(new Date(p.dataHora).toISOString()).toBe('2026-09-20T21:30:00.000Z');
  });

  it('reconhece jogo em andamento pelo status da API', () => {
    const p = paraPartida(
      { ...jogoEncerrado, strStatus: '2H', intHomeScore: '1', intAwayScore: '0' },
      agora(),
    )!;
    expect(p.status).toBe('ao_vivo');
    expect(p.placar).toEqual({ mandante: 1, visitante: 0 });
  });

  it('sem status confiável, decide pelo relógio', () => {
    const comecouAgora = { ...jogoEncerrado, strStatus: '', strTimestamp: '2026-09-22T11:30:00' };
    expect(paraPartida(comecouAgora, agora())!.status).toBe('ao_vivo');
    const antigo = { ...jogoEncerrado, strStatus: '', strTimestamp: '2026-09-01T11:30:00' };
    expect(paraPartida(antigo, agora())!.status).toBe('encerrada');
    const futuro = { ...jogoEncerrado, strStatus: '', strTimestamp: '2026-12-01T11:30:00' };
    expect(paraPartida(futuro, agora())!.status).toBe('agendada');
  });

  it('descarta evento sem data ou sem times', () => {
    expect(paraPartida({ strHomeTeam: 'Flamengo' }, agora())).toBeNull();
    expect(paraPartida({ strTimestamp: '2026-09-20T21:30:00' }, agora())).toBeNull();
  });

  it('traz o último resultado e o próximo jogo numa ida só à rede', async () => {
    const fetchFalso = simularApi([jogoEncerrado], [jogoFuturo]);
    globalThis.fetch = fetchFalso as unknown as typeof fetch;
    const servico = new MatchServiceTheSportsDB('134287', agora);

    const [ultimo, proximo] = await Promise.all([servico.ultimoResultado(), servico.proximoJogo()]);
    expect(ultimo!.placar).toEqual({ mandante: 2, visitante: 1 });
    expect(proximo!.visitante).toBe('Flamengo');
    expect(proximo!.competicao).toBe('Libertadores');
    // chamadas simultâneas compartilham a mesma busca: 2 endpoints, não 4
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });

  it('jogo em andamento ocupa o lugar do "próximo"', async () => {
    const rolando = { ...jogoFuturo, strStatus: '1H', intHomeScore: '0', intAwayScore: '1' };
    globalThis.fetch = simularApi([jogoEncerrado], [rolando]) as unknown as typeof fetch;
    const servico = new MatchServiceTheSportsDB('134287', agora);
    const proximo = await servico.proximoJogo();
    expect(proximo!.status).toBe('ao_vivo');
    expect(proximo!.placar).toEqual({ mandante: 0, visitante: 1 });
  });

  it('sem rede, mostra a última informação real guardada no aparelho', async () => {
    globalThis.fetch = simularApi([jogoEncerrado], [jogoFuturo]) as unknown as typeof fetch;
    const online = new MatchServiceTheSportsDB('134287', agora);
    await online.listarPartidas();

    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('offline')),
    ) as unknown as typeof fetch;
    const offline = new MatchServiceTheSportsDB('134287', agora);
    const ultimo = await offline.ultimoResultado();
    expect(ultimo!.mandante).toBe('Flamengo');
    expect(ultimo!.placar).toEqual({ mandante: 2, visitante: 1 });
  });

  it('sem rede e sem cache, o erro sobe para a tela tratar', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('offline')),
    ) as unknown as typeof fetch;
    const servico = new MatchServiceTheSportsDB('134287', agora);
    await expect(servico.proximoJogo()).rejects.toThrow('offline');
  });
});
