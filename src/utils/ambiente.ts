/** Leitura centralizada das variáveis de ambiente públicas do Expo. */
export type DriverDeDados = 'mock' | 'supabase';

export function driverDeDados(): DriverDeDados {
  return process.env.EXPO_PUBLIC_DATA_DRIVER === 'supabase' ? 'supabase' : 'mock';
}

/** Chave pública da API do GIPHY; sem ela o botão de GIF não aparece. */
export function chaveDoGiphy(): string | null {
  return process.env.EXPO_PUBLIC_GIPHY_KEY?.trim() || null;
}

export type DriverDePartidas = 'real' | 'mock';

/**
 * Fonte das partidas: "real" (tabela public.partidas do Supabase, alimentada pela
 * Highlightly) por padrão; "mock" usa o JSON local (testes e demonstração sem rede).
 */
export function driverDePartidas(): DriverDePartidas {
  return process.env.EXPO_PUBLIC_MATCH_DRIVER === 'mock' ? 'mock' : 'real';
}

/** DSN do Sentry; sem ela o app não reporta erro nenhum e segue funcionando. */
export function dsnDoSentry(): string | null {
  return process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || null;
}

/** Chave e host do PostHog; sem a chave nenhum evento de produto é enviado. */
export function configuracaoDoPostHog(): { chave: string; host: string } | null {
  const chave = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
  if (!chave) return null;
  return {
    chave,
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
  };
}
