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
