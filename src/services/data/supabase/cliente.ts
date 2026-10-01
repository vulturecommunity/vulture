import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { ErroDeAplicacao } from '@/utils/erros';

// O Hermes (motor JS do React Native) pode não ter structuredClone, usado pelo supabase-js.
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;
}

let cliente: SupabaseClient | null = null;

export function configuracaoSupabase(): { url: string; chave: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const chave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !chave || url.includes('SEU-PROJETO')) return null;
  return { url, chave };
}

/** Cliente Supabase único (lazy). Lança erro claro se as chaves não estiverem no .env. */
export function supabase(): SupabaseClient {
  if (cliente) return cliente;
  const cfg = configuracaoSupabase();
  if (!cfg) {
    throw new ErroDeAplicacao(
      'Supabase não configurado: preencha EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no .env (veja SETUP_SUPABASE.md).',
      'supabase_nao_configurado',
    );
  }
  cliente = createClient(cfg.url, cfg.chave, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // O padrão do supabase-js é 'implicit', que devolve o token de acesso dentro do
      // fragmento da URL de retorno. Em app nativo isso é ruim por dois motivos: o token
      // passa por um lugar que vaza fácil (histórico do navegador, log de deep link), e
      // o fragmento nem sempre sobrevive ao caminho até o app. O PKCE devolve só um
      // código de uso único, que trocamos pela sessão numa chamada nossa.
      flowType: 'pkce',
    },
  });

  // Mantém o token renovando apenas com o app em primeiro plano.
  AppState.addEventListener('change', (estado) => {
    if (!cliente) return;
    if (estado === 'active') cliente.auth.startAutoRefresh();
    else cliente.auth.stopAutoRefresh();
  });

  return cliente;
}
