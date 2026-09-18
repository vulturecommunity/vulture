import { useRouter, useSegments } from 'expo-router';
import { useEffect, type ReactNode } from 'react';

import { Carregando } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

/**
 * Protege as rotas: sem sessão → (auth)/login; com sessão sem onboarding → (auth)/onboarding;
 * com tudo pronto e ainda nas telas de auth → (tabs).
 */
export function PortaoDeAutenticacao({ children }: { children: ReactNode }) {
  const sessao = useAuthStore((s) => s.sessao);
  const carregado = useAuthStore((s) => s.carregado);
  const segmentos = useSegments();
  const router = useRouter();

  const partes = segmentos as string[];
  const naAutenticacao = partes[0] === '(auth)';
  const noOnboarding = naAutenticacao && partes[1] === 'onboarding';

  useEffect(() => {
    if (!carregado) return;
    if (!sessao) {
      if (!naAutenticacao || noOnboarding) router.replace('/(auth)/login');
      return;
    }
    if (!sessao.onboardingConcluido) {
      if (!noOnboarding) router.replace('/(auth)/onboarding');
      return;
    }
    if (naAutenticacao) router.replace('/(tabs)');
  }, [carregado, sessao, naAutenticacao, noOnboarding, router]);

  if (!carregado) return <Carregando mensagem="Aquecendo o Vulture..." />;
  return <>{children}</>;
}
