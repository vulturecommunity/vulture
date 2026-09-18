import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';

export function useNotificacoes() {
  const logado = useAuthStore((s) => !!s.sessao);
  return useQuery({
    queryKey: chaves.notificacoes,
    queryFn: () => dataService().listNotificacoes(),
    enabled: logado,
    refetchInterval: 20 * 1000,
  });
}

export function useNotificacoesNaoLidas(): number {
  const { data } = useNotificacoes();
  return data?.filter((n) => !n.lida).length ?? 0;
}

export function useMarcarNotificacoesComoLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataService().marcarNotificacoesComoLidas(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.notificacoes }),
  });
}
