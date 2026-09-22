/** Leitura centralizada das variáveis de ambiente públicas do Expo. */
export type DriverDeDados = 'mock' | 'supabase';

export function driverDeDados(): DriverDeDados {
  return process.env.EXPO_PUBLIC_DATA_DRIVER === 'supabase' ? 'supabase' : 'mock';
}

export type DriverDePartidas = 'real' | 'mock';

/**
 * Fonte das partidas: "real" (TheSportsDB) por padrão; "mock" usa o JSON local
 * (útil em testes e para demonstrar o app sem rede).
 */
export function driverDePartidas(): DriverDePartidas {
  return process.env.EXPO_PUBLIC_MATCH_DRIVER === 'mock' ? 'mock' : 'real';
}
