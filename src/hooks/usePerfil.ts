import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import type { AtualizacaoDePerfil } from '@/services/data/types';
import { chaves } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';

export function usePerfil(usuarioId: string | 'eu' | undefined) {
  return useQuery({
    queryKey: chaves.perfil(usuarioId ?? ''),
    queryFn: () => dataService().getProfile(usuarioId!),
    enabled: !!usuarioId,
  });
}

export function useAtualizarPerfil() {
  const queryClient = useQueryClient();
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);
  return useMutation({
    mutationFn: (dados: AtualizacaoDePerfil) => dataService().updateProfile(dados),
    onSuccess: (usuario) => {
      atualizarUsuario(usuario);
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['videos-usuario', usuario.id] });
    },
  });
}

export function useBloqueados() {
  return useQuery({ queryKey: chaves.bloqueados, queryFn: () => dataService().listBloqueados() });
}

export function useDesbloquear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => dataService().desbloquear(usuarioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.bloqueados });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
    },
  });
}
