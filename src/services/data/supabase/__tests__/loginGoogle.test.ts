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
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/services/data/supabase/cliente';
import { SupabaseDataService } from '@/services/data/supabase/SupabaseDataService';

jest.mock('expo-linking');
jest.mock('expo-web-browser');
jest.mock('@/services/data/supabase/cliente');
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare', expoConfig: { scheme: 'vulture' } },
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
}));

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
      setSession: jest.fn(),
    },
  };
}

const constantes = Constants as unknown as {
  executionEnvironment: string;
  expoConfig: { scheme?: string | string[] } | null;
};

beforeEach(() => {
  jest.clearAllMocks();
  criarUrl.mockReturnValue(RETORNO);
  cliente.mockReturnValue(clienteFalso());
  constantes.executionEnvironment = ExecutionEnvironment.Bare;
  constantes.expoConfig = { scheme: 'vulture' };
});

/**
 * O Supabase compara o endereço de retorno caractere a caractere com a lista de Redirect
 * URLs. `vulture:///login-google` e `vulture://login-google/` são rejeitados — então a
 * forma exata não pode depender de onde o app está rodando.
 */
/**
 * `preferEphemeralSession` parecia a correção óbvia para o diálogo do iOS que mostra o
 * domínio cru do projeto Supabase — e chegou a ficar ligada aqui por uma versão. Foi
 * revertida porque, em teste real, sessão efêmera derrubou o retorno via esquema
 * customizado: o mesmo túnel do Expo Go, com o mesmo endereço já liberado no Supabase,
 * funcionava sem a opção e parou de voltar para o app com ela — mudando só essa opção
 * entre duas tentativas consecutivas. Este teste existe para a opção não voltar por
 * engano numa futura limpeza de código.
 */
it('NÃO pede sessão efêmera — ela quebrou o retorno do login em teste real', async () => {
  abrirNavegador.mockResolvedValue({ type: 'dismiss' });
  await new SupabaseDataService().entrarComGoogle().catch(() => {});

  const opcoes = abrirNavegador.mock.calls[0]?.[2];
  expect(opcoes?.preferEphemeralSession).not.toBe(true);
});

describe('endereço de retorno', () => {
  async function enderecoUsado(): Promise<string> {
    const falso = clienteFalso();
    cliente.mockReturnValue(falso);
    abrirNavegador.mockResolvedValue({ type: 'dismiss' });
    await new SupabaseDataService().entrarComGoogle().catch(() => {});
    return falso.auth.signInWithOAuth.mock.calls[0][0].options.redirectTo;
  }

  it('em build, é o esquema do app sem barra sobrando', async () => {
    await expect(enderecoUsado()).resolves.toBe('vulture://login-google');
  });

  it('em build, não usa o createURL — ele varia com o hostUri', async () => {
    criarUrl.mockReturnValue('vulture://10.0.0.42:8081login-google');
    await expect(enderecoUsado()).resolves.toBe('vulture://login-google');
  });

  it('respeita o esquema declarado no app.json, mesmo em lista', async () => {
    constantes.expoConfig = { scheme: ['outroapp', 'vulture'] };
    await expect(enderecoUsado()).resolves.toBe('outroapp://login-google');
  });

  it('no Expo Go, usa o createURL — só ele conhece o endereço do Metro', async () => {
    constantes.executionEnvironment = ExecutionEnvironment.StoreClient;
    criarUrl.mockReturnValue('exp://10.0.0.42:8081/--/login-google');
    await expect(enderecoUsado()).resolves.toBe('exp://10.0.0.42:8081/--/login-google');
  });
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

/**
 * O supabase-js devolve o resultado em dois lugares diferentes conforme o `flowType`:
 * `?code=…` no PKCE (o que o cliente pede) e `#access_token=…` no implícito (o padrão
 * da biblioteca). Ler só a query fazia o login morrer dizendo "o Google não devolveu o
 * código", que mandava procurar no Google um problema que era nosso.
 */
describe('onde o retorno traz a sessão', () => {
  it('fluxo PKCE: troca o código da query pela sessão', async () => {
    const falso = clienteFalso();
    falso.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
      error: null,
    });
    cliente.mockReturnValue(falso);
    abrirNavegador.mockResolvedValue({ type: 'success', url: `${RETORNO}?code=abc123` });

    await new SupabaseDataService().entrarComGoogle().catch(() => {});

    expect(falso.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(falso.auth.setSession).not.toHaveBeenCalled();
  });

  it('fluxo implícito: usa os tokens do fragmento, sem reclamar de código', async () => {
    const falso = clienteFalso();
    falso.auth.setSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.c' } },
      error: null,
    });
    cliente.mockReturnValue(falso);
    abrirNavegador.mockResolvedValue({
      type: 'success',
      url: `${RETORNO}#access_token=tok123&refresh_token=ref456&token_type=bearer`,
    });

    await new SupabaseDataService().entrarComGoogle().catch(() => {});

    expect(falso.auth.setSession).toHaveBeenCalledWith({
      access_token: 'tok123',
      refresh_token: 'ref456',
    });
  });

  it('erro escondido no fragmento também é lido', async () => {
    abrirNavegador.mockResolvedValue({
      type: 'success',
      url: `${RETORNO}#error=access_denied&error_description=${encodeURIComponent('negado')}`,
    });

    await expect(new SupabaseDataService().entrarComGoogle()).rejects.toThrow(/negado/);
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
