import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import type { NovoRasante } from '@/services/data/types';
import { gerarThumbnail } from '@/services/midia/arquivos';
import { chaves } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { GrupoDeRasantes, Rasante } from '@/types';

/** Fileira do topo: meus rasantes e os de quem eu sigo (ativos nas últimas 24 h). */
export function useRasantes() {
  const logado = useAuthStore((s) => !!s.sessao);
  return useQuery({
    queryKey: chaves.rasantes,
    queryFn: () => dataService().listRasantes(),
    enabled: logado,
    refetchInterval: 60 * 1000,
  });
}

export function useRasantesDoUsuario(usuarioId: string | undefined) {
  return useQuery({
    queryKey: chaves.rasantesDoUsuario(usuarioId ?? ''),
    queryFn: () => dataService().listRasantesDoUsuario(usuarioId!),
    enabled: !!usuarioId,
  });
}

export function usePublicarRasante() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      novo,
      aoProgredir,
    }: {
      novo: NovoRasante;
      aoProgredir?: (fracao: number, etapa: string) => void;
    }) => {
      const thumbnailUriLocal =
        novo.thumbnailUriLocal ?? (await gerarThumbnail(novo.uriLocal, 300));
      return dataService().publicarRasante({ ...novo, thumbnailUriLocal }, aoProgredir);
    },
    onSuccess: (rasante) => {
      queryClient.invalidateQueries({ queryKey: chaves.rasantes });
      queryClient.invalidateQueries({ queryKey: chaves.rasantesDoUsuario(rasante.autorId) });
    },
  });
}

/** Marca como visto e atualiza o anel na fileira sem esperar a rede. */
export function useMarcarRasanteVisto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService().marcarRasanteComoVisto(id),
    onMutate: (id) => {
      const marcar = (r: Rasante) => (r.id === id ? { ...r, visto: true } : r);
      queryClient.setQueryData<GrupoDeRasantes[]>(chaves.rasantes, (grupos) =>
        grupos?.map((g) => {
          const rasantes = g.rasantes.map(marcar);
          return { ...g, rasantes, todosVistos: rasantes.every((r) => r.visto) };
        }),
      );
      queryClient.setQueriesData<Rasante[]>({ queryKey: ['rasantes-usuario'] }, (lista) =>
        lista?.map(marcar),
      );
    },
  });
}

export function useExcluirRasante() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService().excluirRasante(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaves.rasantes });
      queryClient.invalidateQueries({ queryKey: ['rasantes-usuario'] });
    },
  });
}
