import AsyncStorage from '@react-native-async-storage/async-storage';

import { ArmazenamentoMock } from '../banco';
import { MockDataService } from '../MockDataService';

/**
 * Exclusão de conta — exigência de Apple, Google e da LGPD (art. 18, VI).
 *
 * O que estes testes protegem não é a implementação, é a PROMESSA: depois de excluir, nada
 * que identifique a pessoa pode continuar no banco. Uma coleção nova que alguém esqueça de
 * limpar falha aqui, e não numa reclamação de titular meses depois.
 */

let contador = 0;
function criarServico() {
  contador = 0;
  return new MockDataService({
    armazenamento: new ArmazenamentoMock('teste.exclusao'),
    latenciaMs: 0,
    botsNaLive: false,
    gerarId: () => `id-${++contador}`,
  });
}

describe('excluir a própria conta', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
  });

  it('apaga o perfil e encerra a sessão', async () => {
    const sessao = await servico.cadastrar({
      email: 'sai@teste.com',
      senha: 'senha123',
      apelido: 'quemsai',
      nome: 'Quem Sai',
    });

    await servico.excluirMinhaConta();

    expect(await servico.sessaoAtual()).toBeNull();
    await expect(servico.getProfile(sessao.usuario.id)).rejects.toThrow();
  });

  it('leva junto o conteúdo publicado', async () => {
    await servico.cadastrar({
      email: 'autor@teste.com',
      senha: 'senha123',
      apelido: 'autor',
      nome: 'Autor',
    });

    await servico.publicarPost({ texto: 'resenha que precisa sumir', midias: [] });
    const antes = await servico.listPosts({});
    expect(antes.itens.some((p) => p.texto === 'resenha que precisa sumir')).toBe(true);

    await servico.excluirMinhaConta();

    // entra outra conta para poder olhar o feed depois da exclusão
    await servico.cadastrar({
      email: 'outro@teste.com',
      senha: 'senha123',
      apelido: 'outro',
      nome: 'Outro',
    });
    const depois = await servico.listPosts({});
    expect(depois.itens.some((p) => p.texto === 'resenha que precisa sumir')).toBe(false);
  });

  it('libera o apelido para quem vier depois', async () => {
    await servico.cadastrar({
      email: 'primeiro@teste.com',
      senha: 'senha123',
      apelido: 'disputado',
      nome: 'Primeiro',
    });
    await servico.excluirMinhaConta();

    // o apelido volta a ficar livre: é o que a tela de exclusão promete
    const segundo = await servico.cadastrar({
      email: 'segundo@teste.com',
      senha: 'senha123',
      apelido: 'disputado',
      nome: 'Segundo',
    });
    expect(segundo.usuario.apelido).toBe('disputado');
  });

  it('o e-mail não consegue mais entrar', async () => {
    await servico.cadastrar({
      email: 'volta@teste.com',
      senha: 'senha123',
      apelido: 'voltante',
      nome: 'Voltante',
    });
    await servico.excluirMinhaConta();

    await expect(servico.entrar('volta@teste.com', 'senha123')).rejects.toThrow();
  });
});
