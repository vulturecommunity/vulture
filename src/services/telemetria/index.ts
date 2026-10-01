import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

import { configuracaoDoPostHog, dsnDoSentry } from '@/utils/ambiente';

import type { NomeDeEvento, PropriedadesDeEvento } from './eventos';

export { EVENTOS } from './eventos';
export type { NomeDeEvento, PropriedadesDeEvento } from './eventos';

/**
 * Telemetria: erro (Sentry) e evento de produto (PostHog).
 *
 * TRÊS REGRAS QUE VALEM MAIS QUE O CÓDIGO
 *
 * 1. **Sem chave, silêncio.** Nenhuma das duas é obrigatória. Sem elas o app funciona
 *    igual e nada é enviado — é assim que o modo de desenvolvimento e os testes rodam
 *    sem poluir o painel de produção com dado falso.
 *
 * 2. **Nunca enviar PII.** E-mail, nome real e telefone não saem daqui. O PostHog recebe
 *    o uuid do usuário, que é opaco e só faz sentido dentro do Supabase. Isto não é
 *    zelo decorativo: e-mail de torcedor num painel de terceiro é incidente de LGPD.
 *
 * 3. **Falha de telemetria nunca derruba o app.** Toda chamada daqui engole o próprio
 *    erro. Medir é acessório; o app é o produto.
 *
 * POR QUE O POSTHOG É CARREGADO PREGUIÇOSAMENTE
 *
 * O construtor dele abre AsyncStorage e agenda flush. Fazer isso no import atrasa o
 * primeiro quadro do app para quem nem configurou a chave.
 */

let posthog: PostHog | null = null;
let iniciado = false;

/** Liga o que estiver configurado. Chamar uma vez, no layout raiz. */
export function iniciarTelemetria(): void {
  if (iniciado) return;
  iniciado = true;

  const dsn = dsnDoSentry();
  if (dsn) {
    try {
      Sentry.init({
        dsn,
        // Amostragem de rastros: 10% é suficiente para ver lentidão sem gastar cota do
        // plano gratuito (5 mil erros/mês), que é o limite que aperta primeiro.
        tracesSampleRate: 0.1,
        // O Sentry anexa IP e identificadores por padrão. Num app de torcida isso é dado
        // pessoal sem contrapartida: o que interessa é o stack trace.
        sendDefaultPii: false,
        enableAutoSessionTracking: true,
      });
    } catch {
      // DSN malformada não pode impedir o app de abrir
    }
  }

  const ph = configuracaoDoPostHog();
  if (ph) {
    try {
      posthog = new PostHog(ph.chave, {
        host: ph.host,
        // Em lote: evita uma requisição por curtida numa rolagem de feed.
        flushAt: 20,
        flushInterval: 30_000,
      });
    } catch {
      posthog = null;
    }
  }
}

/**
 * Associa os eventos seguintes a um usuário.
 *
 * `apelido` entra porque é público dentro do app e torna o painel legível; e-mail não
 * entra nunca (ver regra 2).
 */
export function identificar(usuarioId: string, apelido?: string | null): void {
  try {
    posthog?.identify(usuarioId, apelido ? { apelido } : undefined);
    Sentry.setUser({ id: usuarioId });
  } catch {
    /* telemetria nunca derruba o app */
  }
}

/** Desassocia no logout, para não misturar duas pessoas no mesmo aparelho. */
export function esquecerUsuario(): void {
  try {
    posthog?.reset();
    Sentry.setUser(null);
  } catch {
    /* idem */
  }
}

/** Registra um evento de produto. Ignorado quando o PostHog não está configurado. */
export function registrar(evento: NomeDeEvento, propriedades?: PropriedadesDeEvento): void {
  try {
    posthog?.capture(evento, propriedades);
  } catch {
    /* idem */
  }
}

/**
 * Reporta um erro que foi tratado — aquele que o usuário viu como "algo deu errado" e
 * que, sem isto, ninguém jamais saberia que aconteceu.
 */
export function registrarErro(erro: unknown, contexto?: Record<string, unknown>): void {
  try {
    const e = erro instanceof Error ? erro : new Error(String(erro));
    Sentry.captureException(e, contexto ? { extra: contexto } : undefined);
  } catch {
    /* idem */
  }
}

/** Deixa uma migalha no rastro do próximo erro: o que o usuário fez antes de quebrar. */
export function rastro(mensagem: string, dados?: Record<string, unknown>): void {
  try {
    Sentry.addBreadcrumb({ message: mensagem, data: dados, level: 'info' });
  } catch {
    /* idem */
  }
}

/** Manda o que estiver na fila. Usado quando o app vai para segundo plano. */
export async function enviarPendentes(): Promise<void> {
  try {
    await posthog?.flush();
  } catch {
    /* idem */
  }
}

/** Só para os testes: devolve o estado interno ao ponto de partida. */
export function _resetarTelemetria(): void {
  posthog = null;
  iniciado = false;
}
