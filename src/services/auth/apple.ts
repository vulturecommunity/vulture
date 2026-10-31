/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';

/**
 * Carregamento opcional do "Entrar com a Apple".
 *
 * POR QUE ELE PRECISA EXISTIR
 *
 * A App Store exige o login da Apple em qualquer app que ofereça login social de terceiro
 * (Guideline 4.8). O Vulture oferece Google. Sem isto a submissão para iOS é recusada na
 * revisão — não é preferência de produto, é condição de entrada.
 *
 * POR QUE ELE É OPCIONAL EM RUNTIME
 *
 * `expo-apple-authentication` só tem módulo nativo em build de iOS. No Android ele não
 * existe, e no Expo Go pode não estar compilado. Importar estaticamente derrubaria o app
 * nas duas situações — que são justamente as que o projeto usa no dia a dia. O mesmo
 * desenho de `services/live/livekit-nativo.ts`: pergunta antes, importa depois.
 *
 * Quem chama nunca deve assumir que o botão aparece: `appleDisponivel()` é a única
 * verdade, e ela só é `true` num iPhone com iOS 13+.
 */
export type ModuloApple = typeof import('expo-apple-authentication');

let cache: ModuloApple | null | undefined;

/** Carrega o módulo, ou null fora do iOS / sem o nativo compilado. */
export function carregarApple(): ModuloApple | null {
  if (cache !== undefined) return cache;
  if (Platform.OS !== 'ios') {
    cache = null;
    return null;
  }
  try {
    cache = require('expo-apple-authentication') as ModuloApple;
  } catch {
    cache = null;
  }
  return cache;
}

/**
 * true quando dá para mostrar o botão da Apple.
 *
 * `isAvailableAsync` é assíncrono porque a resposta depende da versão do iOS, não só da
 * presença do módulo: um iPhone com iOS 12 tem o módulo e não tem o recurso.
 */
export async function appleDisponivel(): Promise<boolean> {
  const modulo = carregarApple();
  if (!modulo) return false;
  try {
    return await modulo.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Pede as credenciais à Apple e devolve o `identityToken` (o JWT que o Supabase troca por
 * sessão) junto do nome, quando a pessoa concorda em informá-lo.
 *
 * O NOME SÓ VEM UMA VEZ, NA PRIMEIRA AUTORIZAÇÃO
 *
 * A Apple devolve `fullName` apenas no primeiro consentimento daquele Apple ID com aquele
 * app. Da segunda vez em diante vem null, para sempre, mesmo reinstalando. Quem não
 * guardar nessa primeira passagem não recupera depois — por isso o nome sobe junto com o
 * token, e não numa chamada posterior.
 */
export async function credenciaisDaApple(): Promise<{ token: string; nome: string | null }> {
  const modulo = carregarApple();
  if (!modulo) {
    throw new ErroApple('Entrar com a Apple só funciona em iPhone.', 'apple_indisponivel');
  }

  let credencial: Awaited<ReturnType<ModuloApple['signInAsync']>>;
  try {
    credencial = await modulo.signInAsync({
      requestedScopes: [
        modulo.AppleAuthenticationScope.FULL_NAME,
        modulo.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (erro) {
    // Desistir não é falha: a Apple sinaliza o cancelamento com este código, e tratá-lo
    // como erro encheria a tela de mensagem vermelha para quem só mudou de ideia.
    if ((erro as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      throw new ErroApple('Login com a Apple cancelado.', 'login_cancelado');
    }
    throw erro;
  }

  if (!credencial.identityToken) {
    throw new ErroApple('A Apple não devolveu o token de identidade.', 'apple_sem_token');
  }

  const partes = [credencial.fullName?.givenName, credencial.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return { token: credencial.identityToken, nome: partes || null };
}

/** Erro desta camada; o DataService converte para `ErroDeAplicacao`. */
export class ErroApple extends Error {
  constructor(
    mensagem: string,
    public readonly codigo: string,
  ) {
    super(mensagem);
    this.name = 'ErroApple';
  }
}

/** Usado em testes para forçar um estado. */
export function redefinirCacheApple(): void {
  cache = undefined;
}
