import { Platform } from 'react-native';

import { appleDisponivel, carregarApple, credenciaisDaApple, redefinirCacheApple } from '../apple';

/**
 * O módulo nativo da Apple não existe no Android nem no Expo Go.
 *
 * Estes testes cobrem o que de fato dá para verificar sem um iPhone: que o app nunca
 * quebra onde o módulo não existe, que o botão não aparece onde não funcionaria, e que
 * desistir da folha de autorização não vira mensagem de erro. O caminho feliz
 * (`signInAsync` devolvendo um token de verdade) só existe em build de iOS assinada e
 * está no roteiro de teste manual, não aqui.
 */

const mockAssinar = jest.fn();
const mockDisponivel = jest.fn();

jest.mock(
  'expo-apple-authentication',
  () => ({
    isAvailableAsync: () => mockDisponivel(),
    signInAsync: (opcoes: unknown) => mockAssinar(opcoes),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  }),
  { virtual: true },
);

function fingirPlataforma(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  redefinirCacheApple();
}

describe('login com a Apple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDisponivel.mockResolvedValue(true);
  });

  afterEach(() => fingirPlataforma('ios'));

  it('no Android o módulo nem é carregado', async () => {
    fingirPlataforma('android');
    expect(carregarApple()).toBeNull();
    // o botão precisa sumir, e não aparecer e falhar quando tocado
    expect(await appleDisponivel()).toBe(false);
  });

  it('no iPhone pergunta ao sistema em vez de assumir', async () => {
    fingirPlataforma('ios');
    mockDisponivel.mockResolvedValue(false); // iOS antigo: módulo existe, recurso não
    expect(await appleDisponivel()).toBe(false);

    mockDisponivel.mockResolvedValue(true);
    redefinirCacheApple();
    expect(await appleDisponivel()).toBe(true);
  });

  it('um erro ao consultar a disponibilidade esconde o botão, não derruba a tela', async () => {
    fingirPlataforma('ios');
    mockDisponivel.mockRejectedValue(new Error('sem nativo'));
    await expect(appleDisponivel()).resolves.toBe(false);
  });

  it('pede nome e e-mail e devolve o token com o nome montado', async () => {
    fingirPlataforma('ios');
    mockAssinar.mockResolvedValue({
      identityToken: 'jwt-da-apple',
      fullName: { givenName: 'Ana', familyName: 'Souza' },
    });

    await expect(credenciaisDaApple()).resolves.toEqual({
      token: 'jwt-da-apple',
      nome: 'Ana Souza',
    });
    expect(mockAssinar).toHaveBeenCalledWith({ requestedScopes: [0, 1] });
  });

  it('aceita a autorização sem nome: da segunda vez em diante a Apple não manda', async () => {
    fingirPlataforma('ios');
    mockAssinar.mockResolvedValue({ identityToken: 'jwt-da-apple', fullName: null });
    await expect(credenciaisDaApple()).resolves.toEqual({ token: 'jwt-da-apple', nome: null });
  });

  it('desistir não é falha', async () => {
    fingirPlataforma('ios');
    mockAssinar.mockRejectedValue(Object.assign(new Error('cancelou'), {
      code: 'ERR_REQUEST_CANCELED',
    }));
    await expect(credenciaisDaApple()).rejects.toMatchObject({ codigo: 'login_cancelado' });
  });

  it('token ausente é erro explícito, não sessão silenciosamente vazia', async () => {
    fingirPlataforma('ios');
    mockAssinar.mockResolvedValue({ identityToken: null, fullName: null });
    await expect(credenciaisDaApple()).rejects.toMatchObject({ codigo: 'apple_sem_token' });
  });

  it('fora do iPhone nem chega a pedir credencial', async () => {
    fingirPlataforma('android');
    await expect(credenciaisDaApple()).rejects.toMatchObject({ codigo: 'apple_indisponivel' });
    expect(mockAssinar).not.toHaveBeenCalled();
  });
});
