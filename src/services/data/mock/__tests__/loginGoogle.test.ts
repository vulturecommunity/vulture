import AsyncStorage from '@react-native-async-storage/async-storage';

import { ArmazenamentoMock } from '../banco';
import { MockDataService } from '../MockDataService';

function criarServico() {
  return new MockDataService({
    armazenamento: new ArmazenamentoMock('teste.google'),
    latenciaMs: 0,
    botsNaLive: false,
  });
}

describe('login com Google no modo demonstração', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('recusa com mensagem que explica o caminho, em vez de fingir que entrou', async () => {
    const servico = criarServico();
    // fingir sucesso aqui esconderia um erro de configuração do OAuth no modo real
    await expect(servico.entrarComGoogle()).rejects.toThrow(/backend real|visitante/i);
  });

  it('o código do erro permite a tela tratar o caso sem depender do texto', async () => {
    const servico = criarServico();
    await expect(servico.entrarComGoogle()).rejects.toMatchObject({
      codigo: 'google_indisponivel',
    });
  });

  it('não deixa sessão pela metade quando falha', async () => {
    const servico = criarServico();
    await servico.entrarComGoogle().catch(() => {});
    expect(await servico.sessaoAtual()).toBeNull();
  });
});
