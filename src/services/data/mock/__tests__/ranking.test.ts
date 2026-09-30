import AsyncStorage from '@react-native-async-storage/async-storage';

import { MatchServiceMock } from '@/services/partidas/MatchServiceMock';
import { PONTOS_DO_PALPITE, avaliarPalpite, chaveDoMes } from '@/utils/palpites';

import { ArmazenamentoMock } from '../banco';
import { MockDataService } from '../MockDataService';

let contador = 0;
function criarServico() {
  contador = 0;
  return new MockDataService({
    armazenamento: new ArmazenamentoMock('teste.ranking'),
    latenciaMs: 0,
    botsNaLive: false,
    gerarId: () => `id-${++contador}`,
  });
}

/** Um jogo já encerrado do calendário de demonstração, para ter o que pontuar. */
async function jogoEncerrado() {
  const partidas = await new MatchServiceMock().listarTemporada();
  const jogo = partidas.find((p) => p.status === 'encerrada' && p.placar);
  if (!jogo?.placar) throw new Error('o calendário de demonstração não tem jogo encerrado');
  return jogo as typeof jogo & { placar: { mandante: number; visitante: number } };
}

describe('Ranking de palpiteiros no MockDataService', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
    await servico.cadastrar({ email: 'ana@teste.com', senha: '123456', nome: 'Ana' });
  });

  it('lista os meses que já têm jogo apurado, do mais recente para o mais antigo', async () => {
    const periodos = await servico.periodosDoRanking();
    expect(periodos.length).toBeGreaterThan(0);
    expect(periodos.every((p) => /^\d{4}-\d{2}$/.test(p.periodo))).toBe(true);
    const chaves = periodos.map((p) => p.periodo);
    expect([...chaves].sort().reverse()).toEqual(chaves);
  });

  it('ordena por pontos e devolve as posições em sequência', async () => {
    const jogo = await jogoEncerrado();
    const { topo } = await servico.rankingDePalpites(chaveDoMes(new Date(jogo.dataHora)));
    expect(topo.length).toBeGreaterThan(0);
    expect(topo.map((p) => p.posicao)).toEqual(topo.map((_, i) => i + 1));
    for (let i = 1; i < topo.length; i++) {
      expect(topo[i - 1].pontos).toBeGreaterThanOrEqual(topo[i].pontos);
    }
  });

  it('quem crava o placar entra no ranking com os pontos da cravada', async () => {
    const jogo = await jogoEncerrado();
    // palpite igual ao resultado, registrado antes do apito
    await servico.salvarPalpite({
      partidaId: jogo.id,
      inicioDaPartida: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      golsMandante: jogo.placar.mandante,
      golsVisitante: jogo.placar.visitante,
    });

    const meus = await servico.listMeusPalpites([jogo.id]);
    expect(meus[0]).toMatchObject({ resultado: 'cravou', pontos: PONTOS_DO_PALPITE.cravou });

    const periodo = chaveDoMes(new Date(jogo.dataHora));
    const { topo, minhaFaixa } = await servico.rankingDePalpites(periodo);
    const eu = [...topo, ...minhaFaixa].find((p) => p.souEu);
    expect(eu).toBeDefined();
    expect(eu!.cravadas).toBeGreaterThanOrEqual(1);
    expect(eu!.pontos).toBeGreaterThanOrEqual(PONTOS_DO_PALPITE.cravou);
  });

  it('o pódio do jogo só lista quem pontuou, do maior para o menor', async () => {
    const jogo = await jogoEncerrado();
    const podio = await servico.podioDaPartida(jogo.id);
    expect(podio.every((p) => p.pontos > 0)).toBe(true);
    for (let i = 1; i < podio.length; i++) {
      expect(podio[i - 1].pontos).toBeGreaterThanOrEqual(podio[i].pontos);
    }
    // a pontuação exibida bate com a régua aplicada ao palpite mostrado
    for (const linha of podio) {
      const esperado =
        PONTOS_DO_PALPITE[
          avaliarPalpite(
            { golsMandante: linha.golsMandante, golsVisitante: linha.golsVisitante },
            jogo.placar,
          )
        ];
      expect(linha.pontos).toBe(esperado);
    }
  });

  it('jogo que ainda não terminou não tem pódio', async () => {
    const partidas = await new MatchServiceMock().listarTemporada();
    const futuro = partidas.find((p) => p.status === 'agendada');
    expect(await servico.podioDaPartida(futuro!.id)).toEqual([]);
  });

  describe('ligas', () => {
    it('cria a liga com código de 6 caracteres e já entra nela', async () => {
      const liga = await servico.criarLiga('Resenha do trabalho');
      expect(liga.codigo).toMatch(/^[A-Z0-9]{6}$/);
      expect(liga.membros).toBe(1);
      expect(liga.souDono).toBe(true);
      expect(await servico.minhasLigas(chaveDoMes(new Date()))).toHaveLength(1);
    });

    it('recusa nome curto e código que não existe', async () => {
      await expect(servico.criarLiga('ab')).rejects.toThrow('3 a 40');
      await expect(servico.entrarNaLiga('ZZZZZZ')).rejects.toThrow('código');
    });

    it('o ranking da liga só mostra os membros', async () => {
      const jogo = await jogoEncerrado();
      await servico.salvarPalpite({
        partidaId: jogo.id,
        inicioDaPartida: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        golsMandante: jogo.placar.mandante,
        golsVisitante: jogo.placar.visitante,
      });
      const liga = await servico.criarLiga('Só eu');
      const ranking = await servico.rankingDaLiga(liga.id, chaveDoMes(new Date(jogo.dataHora)));
      expect(ranking).toHaveLength(1);
      expect(ranking[0].souEu).toBe(true);
      expect(ranking[0].posicao).toBe(1);
    });

    it('sair da liga sem herdeiro apaga a liga', async () => {
      const liga = await servico.criarLiga('Some depois');
      await servico.sairDaLiga(liga.id);
      expect(await servico.minhasLigas(chaveDoMes(new Date()))).toEqual([]);
    });
  });
});
