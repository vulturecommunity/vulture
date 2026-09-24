import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { contemPalavraFiltrada, useAjustesStore } from '@/stores/ajustesStore';
import { useAuthStore } from '@/stores/authStore';
import { useHistoricoStore } from '@/stores/historicoStore';
import type { Comentario } from '@/types';

import { useAtualizarVideoNoCache } from './useFeed';

/** Esconde os comentários com palavras filtradas — menos os meus, que eu escrevi sabendo. */
function esconderFiltrados(
  comentarios: Comentario[],
  palavras: string[],
  meuId: string | null,
): Comentario[] {
  const indesejado = (c: Comentario) =>
    c.autorId !== meuId && contemPalavraFiltrada(c.texto, palavras);
  return comentarios
    .filter((c) => !indesejado(c))
    .map((c) =>
      c.respostas.some(indesejado)
        ? { ...c, respostas: c.respostas.filter((r) => !indesejado(r)) }
        : c,
    );
}

export function useComentarios(videoId: string | null) {
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const filtrar = useAjustesStore((s) => s.filtrarComentarios);
  const palavras = useAjustesStore((s) => s.palavrasFiltradas);

  const aplicarFiltro = useCallback(
    (comentarios: Comentario[]) =>
      filtrar && palavras.length > 0
        ? esconderFiltrados(comentarios, palavras, meuId)
        : comentarios,
    [filtrar, palavras, meuId],
  );

  return useQuery({
    queryKey: chaves.comentarios(videoId ?? ''),
    queryFn: () => dataService().listComments(videoId!),
    enabled: !!videoId,
    select: aplicarFiltro,
  });
}

export function useAdicionarComentario(videoId: string | null) {
  const queryClient = useQueryClient();
  const atualizarVideo = useAtualizarVideoNoCache();
  const registrarComentario = useHistoricoStore((s) => s.registrarComentario);

  return useMutation({
    mutationFn: ({ texto, paiId }: { texto: string; paiId?: string | null }) =>
      dataService().addComment(videoId!, texto, paiId ?? null),
    onSuccess: (novo) => {
      registrarComentario({ id: novo.id, videoId: videoId!, texto: novo.texto });
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
