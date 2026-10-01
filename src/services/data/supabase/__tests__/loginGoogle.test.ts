/**
 * O que acontece quando o login com Google NÃO dá certo.
 *
 * Existe um modo de falha que parece desistência da pessoa mas não é: se o endereço de
 * retorno (`vulture://login-google`) não estiver na lista de Redirect URLs do Supabase,
 * ele manda o navegador para a Site URL depois do consentimento e o app nunca é chamado
 * de volta. A pessoa fez tudo certo, fecha a aba, e o Expo reporta `dismiss` — o mesmo
 * que reportaria se ela tivesse desistido.
 *
 * Isso aconteceu de verdade neste projeto e a mensagem dizia "Login com Google cancelado",
 * que mandava procurar o problema no lugar errado. Estes testes prendem a diferença.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/services/data/supabase/cliente';
import { SupabaseDataService } from '@/services/data/supabase/SupabaseDataService';

jest.mock('expo-linking');
jest.mock('expo-web-browser');
jest.mock('@/services/data/supabase/cliente');

const RETORNO = 'vulture://login-google';
const URL_DO_GOOGLE = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x';

const abrirNavegador = WebBrowser.openAuthSessionAsync as jest.Mock;
const criarUrl = Linking.createURL as jest.Mock;
const cliente = supabase as jest.Mock;

/** Só o que `entrarComGoogle` toca: a chamada de OAuth e a leitura da sessão. */
function clienteFalso(sessao: { user: { id: string; email: string } } | null = null) {
  return {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: URL_DO_GOOGLE }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: sessao } }),
      exchangeCodeForSession: jest.fn(),
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  criarUrl.mockReturnValue(RETORNO);
  cliente.mockReturnValue(clienteFalso());
});

describe('login com Google que não volta para o app', () => {
  it('nomeia o endereço que falta liberar, em vez de culpar o usuário', async () => {
    abrirNavegador.mockResolvedValue({ type: 'dismiss' });
    const servico = new SupabaseDataService();

    await expect(servico.entrarComGoogle()).rejects.toMatchObject({
      codigo: 'login_nao_retornou',
    });

    // a mensagem precisa carregar o endereço exato e onde cadastrá-lo: sem isso, quem lê
    // não tem como agir
    await expect(servico.entrarComGoogle()).rejects.toThrow(
      new RegExp(`${RETORNO}[\\s\\S]*Redirect URLs`),
    );
  });

  it('não acusa falha se a sessão chegou por fora do navegador', async () => {
    // o deep link pode ser consumido pelo supabase-js antes de chegarmos aqui; nesse caso
    // o navegador "só fechou", mas a pessoa já está dentro
    abrirNavegador.mockResolvedValue({ type: 'dismiss' });
    const servico = new SupabaseDataService();
    const jaEntrou = { usuarioId: 'u1', visitante: false, email: 'a@b.c' };
    jest.spyOn(servico, 'sessaoAtual').mockResolvedValue(jaEntrou as never);

    await expect(servico.entrarComGoogle()).resolves.toBe(jaEntrou);
  });
});

describe('login com Google que volta com erro', () => {
  it('recusa na tela de consentimento é cancelamento de verdade', async () => {
    abrirNavegador.mockResolvedValue({
      type: 'success',
      url: `${RETORNO}?error=access_denied`,
    });
    const servico = new SupabaseDataService();

    await expect(servico.entrarComGoogle()).rejects.toMatchObject({
      codigo: 'login_cancelado',
    });
  });

  it('erro do Google chega inteiro, sem virar "cancelado"', async () => {
    abrirNavegador.mockResolvedValue({
      type: 'success',
      url: `${RETORNO}?error=server_error&error_description=${encodeURIComponent(
        'Unable to exchange external code',
      )}`,
    });
    const servico = new SupabaseDataService();

    await expect(servico.entrarComGoogle()).rejects.toThrow(/Unable to exchange external code/);
  });
});
