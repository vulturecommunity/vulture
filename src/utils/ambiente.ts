/** Leitura centralizada das variáveis de ambiente públicas do Expo. */
export type DriverDeDados = 'mock' | 'supabase';

export function driverDeDados(): DriverDeDados {
  return process.env.EXPO_PUBLIC_DATA_DRIVER === 'supabase' ? 'supabase' : 'mock';
}
