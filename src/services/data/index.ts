import { driverDeDados } from '@/utils/ambiente';

import { MockDataService } from './mock/MockDataService';
import { SupabaseDataService } from './supabase/SupabaseDataService';
import type { DataService } from './types';

let instancia: DataService | null = null;

/**
 * Fábrica da camada de dados. O driver é escolhido por EXPO_PUBLIC_DATA_DRIVER:
 *  - "mock" (padrão): tudo local, sem cadastro em nada — modo demonstração
 *  - "supabase": backend real (precisa das chaves no .env)
 */
export function dataService(): DataService {
  if (!instancia) {
    instancia = driverDeDados() === 'supabase' ? new SupabaseDataService() : new MockDataService();
  }
  return instancia;
}

/** Permite trocar a instância (usado em testes). */
export function definirDataService(servico: DataService | null): void {
  instancia = servico;
}

export type { DataService } from './types';
