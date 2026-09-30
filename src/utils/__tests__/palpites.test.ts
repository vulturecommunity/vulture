import type { Partida } from '@/services/partidas/types';

import { formatarContagem, nomeDoMes } from '../formatadores';
import {
  PONTOS_DO_PALPITE,
  avaliarPalpite,
  desvioDoPalpite,
  palpiteAberto,
  pontosDoPalpite,
  partidaEmDestaque,
  resultadoDoFlamengo,
  resumirMes,
  resumirPalpites,
  rotuloDaPartida,
  validarPalpite,
} from '../palpites';
import { tamanhoDoPost, validarTextoDoPost } from '../posts';

const agora = new Date('2026-09-23T12:00:00.000Z');

function partida(parcial: Partial<Partida>): Partida {
  return {
    id: 'p',
    competicao: 'Brasileirão',
    mandante: 'Flamengo',
    visitante: 'Santos',
    dataHora: '2026-10-08T22:30:00.000Z',
    estadio: 'Maracanã',
    placar: null,
    status: 'agendada',
    ...parcial,
  };
}

describe('palpites', () => {
  it('cravou, acertou o saldo, acertou o vencedor ou errou', () => {
    const placar = { mandante: 3, visitante: 1 };
    expect(avaliarPalpite({ golsMandante: 3, golsVisitante: 1 }, placar)).toBe('cravou');
    // 2x0 tem o mesmo saldo (+2) que 3x1
    expect(avaliarPalpite({ golsMandante: 2, golsVisitante: 0 }, placar)).toBe('saldo');
    expect(avaliarPalpite({ golsMandante: 1, golsVisitante: 0 }, placar)).toBe('vencedor');
    expect(avaliarPalpite({ golsMandante: 0, golsVisitante: 2 }, placar)).toBe('errou');
  });

  it('empate acertado cai na faixa do saldo (todo empate tem saldo zero)', () => {
    // consequência da régua, e é intencional: empate é mais raro e mais difícil de prever,
    // então vale os 5 pontos do saldo em vez dos 3 do vencedor
    expect(
      avaliarPalpite({ golsMandante: 0, golsVisitante: 0 }, { mandante: 1, visitante: 1 }),
    ).toBe('saldo');
  });

  it('pontua conforme a régua e multiplica pelo peso do jogo', () => {
    expect(PONTOS_DO_PALPITE).toEqual({ cravou: 10, saldo: 5, vencedor: 3, errou: 0 });
    const placar = { mandante: 3, visitante: 1 };
    const cravado = { golsMandante: 3, golsVisitante: 1, pontos: null };
    expect(pontosDoPalpite(cravado, placar)).toBe(10);
    expect(pontosDoPalpite(cravado, placar, 2)).toBe(20);
    // quando o servidor já apurou, o número dele manda (só ele conhece o peso real)
    expect(pontosDoPalpite({ ...cravado, pontos: 20 }, placar)).toBe(20);
  });

  it('desvio de gols é o desempate contínuo do ranking', () => {
    const placar = { mandante: 3, visitante: 1 };
    // os dois acertaram só o vencedor; quem chegou mais perto tem desvio menor
    expect(desvioDoPalpite({ golsMandante: 2, golsVisitante: 1 }, placar)).toBe(1);
    expect(desvioDoPalpite({ golsMandante: 1, golsVisitante: 0 }, placar)).toBe(3);
    expect(desvioDoPalpite({ golsMandante: 3, golsVisitante: 1 }, placar)).toBe(0);
  });

  it('fecha no apito inicial', () => {
    expect(palpiteAberto(partida({}), agora)).toBe(true);
    expect(palpiteAberto(partida({ dataHora: '2026-09-23T11:00:00.000Z' }), agora)).toBe(false);
    expect(palpiteAberto(partida({ status: 'ao_vivo' }), agora)).toBe(false);
  });

  it('valida gols e horário', () => {
    const base = { inicioDaPartida: '2026-10-08T22:30:00.000Z', golsMandante: 1, golsVisitante: 0 };
    expect(() => validarPalpite(base, agora)).not.toThrow();
    expect(() => validarPalpite({ ...base, golsMandante: -1 }, agora)).toThrow('0 a 20');
    expect(() => validarPalpite({ ...base, golsVisitante: 1.5 }, agora)).toThrow('0 a 20');
    expect(() =>
      validarPalpite({ ...base, inicioDaPartida: '2026-09-23T11:59:00.000Z' }, agora),
    ).toThrow('a bola já rolou');
  });

  it('resume o que a torcida aposta', () => {
    const resumo = resumirPalpites([
      { golsMandante: 2, golsVisitante: 1 },
      { golsMandante: 2, golsVisitante: 1 },
      { golsMandante: 1, golsVisitante: 1 },
      { golsMandante: 0, golsVisitante: 1 },
    ]);
    expect(resumo).toEqual({
      total: 4,
      vitoriaMandante: 2,
      empate: 1,
      vitoriaVisitante: 1,
      placarPopular: { golsMandante: 2, golsVisitante: 1, votos: 2 },
    });
    expect(resumirPalpites([]).placarPopular).toBeNull();
  });
});

describe('temporada do Flamengo', () => {
  const vitoriaFora = partida({
    mandante: 'Remo',
    visitante: 'Flamengo',
    status: 'encerrada',
    placar: { mandante: 0, visitante: 1 },
  });
  const empate = partida({ status: 'encerrada', placar: { mandante: 1, visitante: 1 } });
  const derrota = partida({ status: 'encerrada', placar: { mandante: 0, visitante: 3 } });

  it('resultado do ponto de vista rubro-negro, jogando em casa ou fora', () => {
    expect(resultadoDoFlamengo(vitoriaFora)).toBe('V');
    expect(resultadoDoFlamengo(empate)).toBe('E');
    expect(resultadoDoFlamengo(derrota)).toBe('D');
    expect(resultadoDoFlamengo(partida({}))).toBeNull();
  });

  it('resume o mês com V-E-D e saldo', () => {
    expect(resumirMes([vitoriaFora, empate, derrota, partida({})])).toEqual({
      jogos: 4,
      vitorias: 1,
      empates: 1,
      derrotas: 1,
      golsPro: 2,
      golsContra: 4,
    });
  });

  it('destaca o jogo ao vivo, depois o que acabou há pouco, depois o próximo', () => {
    const recente = partida({
      id: 'recente',
      status: 'encerrada',
      placar: { mandante: 2, visitante: 0 },
      dataHora: '2026-09-23T08:00:00.000Z',
    });
    const proximo = partida({ id: 'proximo' });
    expect(partidaEmDestaque([recente, proximo], agora)?.id).toBe('recente');
    expect(partidaEmDestaque([proximo], agora)?.id).toBe('proximo');
    const aoVivo = partida({ id: 'rolando', status: 'ao_vivo' });
    expect(partidaEmDestaque([recente, aoVivo, proximo], agora)?.id).toBe('rolando');
  });

  it('jogo com data futura não conta como "acabou há pouco"', () => {
    // estado impossível em produção, mas a subtração negativa passava na janela de 8 h e
    // roubava o destaque do próximo jogo de verdade
    const futuroEncerrado = partida({
      id: 'inconsistente',
      status: 'encerrada',
      placar: { mandante: 1, visitante: 0 },
      dataHora: '2026-12-01T22:00:00.000Z',
    });
    const proximo = partida({ id: 'proximo' });
    expect(partidaEmDestaque([futuroEncerrado, proximo], agora)?.id).toBe('proximo');
  });

  it('rótulo curto do jogo usa as siglas oficiais quando existem', () => {
    expect(rotuloDaPartida(partida({ siglas: { mandante: 'SAN', visitante: 'FLA' } }))).toBe(
      'SAN x FLA',
    );
    expect(rotuloDaPartida(partida({}))).toBe('FLA x SAN');
  });
});

describe('textos da arquibancada', () => {
  it('conta emoji como 1 caractere, como o banco', () => {
    expect(tamanhoDoPost('🔴⚫')).toBe(2);
    expect(tamanhoDoPost('  oi  ')).toBe(2);
  });

  it('recusa post vazio ou longo demais', () => {
    expect(validarTextoDoPost('  Vamos Flamengo  ')).toBe('Vamos Flamengo');
    expect(() => validarTextoDoPost('   ')).toThrow('Escreva alguma coisa');
    expect(() => validarTextoDoPost('a'.repeat(281))).toThrow('280');
    expect(validarTextoDoPost('🔴'.repeat(280))).toHaveLength(560);
  });

  it('contagem regressiva e nome do mês', () => {
    const hora = 60 * 60 * 1000;
    expect(formatarContagem(14 * 24 * hora + 3 * hora + 5 * 60_000)).toBe('14d 03h');
    expect(formatarContagem(3 * hora + 12 * 60_000)).toBe('3h 12min');
    expect(formatarContagem(12 * 60_000)).toBe('12 min');
    expect(formatarContagem(30_000)).toBe('já já');
    expect(nomeDoMes('2026-10')).toBe('Outubro 2026');
  });
});
