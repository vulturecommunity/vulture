import { PREFERENCIAS_PADRAO, contemPalavraFiltrada, useAjustesStore } from '../ajustesStore';
import { useHistoricoStore } from '../historicoStore';

beforeEach(() => {
  useAjustesStore.getState().restaurarPadroes();
  useHistoricoStore.setState({ donoId: null });
  useHistoricoStore.getState().limparTudo();
});

describe('ajustesStore', () => {
  it('guarda cada preferência pelo nome', () => {
    const { definir } = useAjustesStore.getState();
    definir('contaPrivada', true);
    definir('comentariosDe', 'seguidores');
    definir('curtidosVisiveisPara', 'seguidores');
    expect(useAjustesStore.getState().contaPrivada).toBe(true);
    expect(useAjustesStore.getState().comentariosDe).toBe('seguidores');
    expect(useAjustesStore.getState().curtidosVisiveisPara).toBe('seguidores');
  });

  it('normaliza e não repete palavras filtradas', () => {
    const { adicionarPalavra, removerPalavra } = useAjustesStore.getState();
    adicionarPalavra('  Vexame ');
    adicionarPalavra('vexame');
    adicionarPalavra('   ');
    expect(useAjustesStore.getState().palavrasFiltradas).toEqual(['vexame']);
    removerPalavra('vexame');
    expect(useAjustesStore.getState().palavrasFiltradas).toEqual([]);
  });

  it('volta ao padrão', () => {
    useAjustesStore.getState().definir('economizarDados', true);
    useAjustesStore.getState().restaurarPadroes();
    expect(useAjustesStore.getState().economizarDados).toBe(PREFERENCIAS_PADRAO.economizarDados);
  });
});

describe('contemPalavraFiltrada', () => {
  it('acha a palavra em qualquer caixa e ignora lista vazia', () => {
    expect(contemPalavraFiltrada('Que VEXAME de jogo', ['vexame'])).toBe(true);
    expect(contemPalavraFiltrada('jogo bonito', ['vexame'])).toBe(false);
    expect(contemPalavraFiltrada('qualquer coisa', [])).toBe(false);
  });
});

describe('historicoStore', () => {
  it('põe o vídeo revisto no topo sem duplicar', () => {
    const { registrarAssistido } = useHistoricoStore.getState();
    const base = { legenda: 'Golaço', apelido: 'nacao10', thumbnailUrl: null };
    registrarAssistido({ videoId: 'v-1', ...base });
    registrarAssistido({ videoId: 'v-2', ...base });
    registrarAssistido({ videoId: 'v-1', ...base });
    const assistidos = useHistoricoStore.getState().assistidos;
    expect(assistidos).toHaveLength(2);
    expect(assistidos[0].videoId).toBe('v-1');
  });

  it('descarta busca curta e reaproveita a repetida', () => {
    const { registrarPesquisa } = useHistoricoStore.getState();
    registrarPesquisa('f');
    registrarPesquisa('flamengo');
    registrarPesquisa('maracanã');
    registrarPesquisa('Flamengo');
    const pesquisas = useHistoricoStore.getState().pesquisas;
    expect(pesquisas.map((p) => p.termo)).toEqual(['Flamengo', 'maracanã']);
  });

  it('apaga só a coleção pedida', () => {
    const historico = useHistoricoStore.getState();
    historico.registrarPesquisa('flamengo');
    historico.registrarEvento('senha', 'Senha alterada');
    historico.limpar('pesquisas');
    expect(useHistoricoStore.getState().pesquisas).toEqual([]);
    expect(useHistoricoStore.getState().conta).toHaveLength(1);
  });

  it('descarta o histórico quando outra conta entra no aparelho', () => {
    const historico = useHistoricoStore.getState();
    historico.definirDono('u-1');
    historico.registrarPesquisa('flamengo');
    useHistoricoStore.getState().definirDono('u-1');
    expect(useHistoricoStore.getState().pesquisas).toHaveLength(1);
    useHistoricoStore.getState().definirDono('u-2');
    expect(useHistoricoStore.getState().pesquisas).toEqual([]);
    expect(useHistoricoStore.getState().donoId).toBe('u-2');
  });
});
