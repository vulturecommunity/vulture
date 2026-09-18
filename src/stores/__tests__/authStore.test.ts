import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirDataService } from '@/services/data';
import { ArmazenamentoMock } from '@/services/data/mock/banco';
import { MockDataService } from '@/services/data/mock/MockDataService';

import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    definirDataService(
      new MockDataService({
        armazenamento: new ArmazenamentoMock('teste.auth'),
        latenciaMs: 0,
        botsNaLive: false,
      }),
    );
    useAuthStore.setState({ sessao: null, carregado: false, ocupado: false, erro: null });
  });

  afterAll(() => definirDataService(null));

  it('restaura sem sessão e marca como carregado', async () => {
    await useAuthStore.getState().restaurarSessao();
    expect(useAuthStore.getState().carregado).toBe(true);
    expect(useAuthStore.getState().sessao).toBeNull();
  });

  it('entra como visitante, atualiza usuário e sai', async () => {
    await useAuthStore.getState().entrarComoVisitante();
    expect(useAuthStore.getState().sessao?.visitante).toBe(true);
    const usuario = useAuthStore.getState().sessao!.usuario;
    useAuthStore.getState().atualizarUsuario({ ...usuario, nome: 'Novo' });
    expect(useAuthStore.getState().sessao?.usuario.nome).toBe('Novo');
    await useAuthStore.getState().sair();
    expect(useAuthStore.getState().sessao).toBeNull();
  });

  it('guarda a mensagem de erro em credenciais inválidas', async () => {
    await expect(useAuthStore.getState().entrar('x@x.com', '123456')).rejects.toThrow();
    expect(useAuthStore.getState().erro).toBe('E-mail ou senha incorretos.');
    useAuthStore.getState().limparErro();
    expect(useAuthStore.getState().erro).toBeNull();
  });

  it('cadastra e conclui o onboarding', async () => {
    await useAuthStore.getState().cadastrar({ email: 'ana@t.com', senha: '123456', nome: 'Ana' });
    expect(useAuthStore.getState().sessao?.onboardingConcluido).toBe(false);
    await useAuthStore.getState().concluirOnboarding({ apelido: 'ana_rn', interesses: ['Jogos'] });
    expect(useAuthStore.getState().sessao?.onboardingConcluido).toBe(true);
    expect(useAuthStore.getState().sessao?.usuario.apelido).toBe('ana_rn');
  });
});
