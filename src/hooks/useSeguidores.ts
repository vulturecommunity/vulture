import { useQuery } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';

/** Quem começou a me seguir, do mais recente para o mais antigo. */
export function useNovosSeguidores() {
  const logado = useAuthStore((s) => !!s.sessao);
  return useQuery({
    queryKey: chaves.novosSeguidores,
    queryFn: () => dataService().listNovosSeguidores(),
    enabled: logado,
  });
}

/** Torcedores sugeridos para seguir (tela "Encontrar torcedores"). */
export function useSugestoesDeTorcedores() {
  const logado = useAuthStore((s) => !!s.sessao);
  return useQuery({
    queryKey: chaves.sugestoes,
    queryFn: () => dataService().sugerirTorcedores(),
    enabled: logado,
  });
}
