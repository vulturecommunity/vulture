import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import type { Comentario } from '@/types';

import { useAtualizarVideoNoCache } from './useFeed';

export function useComentarios(videoId: string | null) {
  return useQuery({
    queryKey: chaves.comentarios(videoId ?? ''),
    queryFn: () => dataService().listComments(videoId!),
    enabled: !!videoId,
  });
}

export function useAdicionarComentario(videoId: string | null) {
  const queryClient = useQueryClient();
  const atualizarVideo = useAtualizarVideoNoCache();

  return useMutation({
    mutationFn: ({ texto, paiId }: { texto: string; paiId?: string | null }) =>
      dataService().addComment(videoId!, texto, paiId ?? null),
    onSuccess: (novo) => {
      queryClient.setQueryData<Comentario[]>(chaves.comentarios(videoId!), (atual = []) => {
        if (novo.paiId) {
          return atual.map((c) =>
            c.id === novo.paiId ? { ...c, respostas: [...c.respostas, novo] } : c,
          );
        }
        return [novo, ...atual];
      });
      atualizarVideo(videoId!, (v) => ({ ...v, comentarios: v.comentarios + 1 }));
    },
  });
}

export function useExcluirComentario(videoId: string | null) {
  const queryClient = useQueryClient();
  const atualizarVideo = useAtualizarVideoNoCache();

  return useMutation({
    mutationFn: (comentarioId: string) => dataService().excluirComentario(comentarioId),
    onSuccess: (_r, comentarioId) => {
      let removidos = 0;
      queryClient.setQueryData<Comentario[]>(chaves.comentarios(videoId!), (atual = []) =>
        atual
          .filter((c) => {
            if (c.id === comentarioId) {
              removidos += 1 + c.respostas.length;
              return false;
            }
            return true;
          })
          .map((c) => {
            const respostas = c.respostas.filter((r) => {
              if (r.id === comentarioId) {
                removidos += 1;
                return false;
              }
              return true;
            });
            return respostas.length === c.respostas.length ? c : { ...c, respostas };
          }),
      );
      atualizarVideo(videoId!, (v) => ({
        ...v,
        comentarios: Math.max(0, v.comentarios - removidos),
      }));
    },
  });
}
