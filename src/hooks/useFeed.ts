import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import type { Interesse } from '@/constants/interesses';
import { dataService } from '@/services/data';
import type { AbaDoFeed } from '@/services/data/types';
import { chaves } from '@/services/queryClient';
import type { Pagina, Video } from '@/types';

export interface OpcoesDoFeed {
  aba: AbaDoFeed;
  hashtag?: string;
  categoria?: Interesse;
  habilitado?: boolean;
}

/** Feed infinito (Para Você / Seguindo / por hashtag / por categoria). */
export function useFeed({ aba, hashtag, categoria, habilitado = true }: OpcoesDoFeed) {
  const extra = hashtag ? `#${hashtag}` : categoria ? `cat:${categoria}` : undefined;
  const chave = chaves.feed(aba, extra);

  const consulta = useInfiniteQuery({
    queryKey: chave,
    enabled: habilitado,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      dataService().listFeed({ aba, cursor: pageParam, limite: 10, hashtag, categoria }),
    getNextPageParam: (ultima: Pagina<Video>) => ultima.proximoCursor,
  });

  const videos = useMemo(() => consulta.data?.pages.flatMap((p) => p.itens) ?? [], [consulta.data]);

  return { ...consulta, videos, chave };
}

/**
 * Atualiza um vídeo em todas as listas em cache (feeds, perfil, salvos...) de forma otimista.
 * Retorna uma função para desfazer.
 */
export function useAtualizarVideoNoCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (videoId: string, alterar: (v: Video) => Video) => {
      const fotos: { chave: readonly unknown[]; dados: unknown }[] = [];

      // feeds infinitos
      queryClient
        .getQueriesData<InfiniteData<Pagina<Video>>>({ queryKey: ['feed'] })
        .forEach(([chave, dados]) => {
          if (!dados) return;
          fotos.push({ chave, dados });
          queryClient.setQueryData<InfiniteData<Pagina<Video>>>(chave, {
            ...dados,
            pages: dados.pages.map((p) => ({
              ...p,
              itens: p.itens.map((v) => (v.id === videoId ? alterar(v) : v)),
            })),
          });
        });

      // listas simples de vídeos
      for (const prefixo of ['videos-usuario', 'videos-curtidos', 'videos-salvos', 'trending']) {
        queryClient.getQueriesData<Video[]>({ queryKey: [prefixo] }).forEach(([chave, dados]) => {
          if (!Array.isArray(dados)) return;
          fotos.push({ chave, dados });
          queryClient.setQueryData<Video[]>(
            chave,
            dados.map((v) => (v.id === videoId ? alterar(v) : v)),
          );
        });
      }

      // vídeo individual
      const individual = queryClient.getQueryData<Video>(chaves.video(videoId));
      if (individual) {
        fotos.push({ chave: chaves.video(videoId), dados: individual });
        queryClient.setQueryData<Video>(chaves.video(videoId), alterar(individual));
      }

      return () => {
        for (const foto of fotos) queryClient.setQueryData(foto.chave, foto.dados);
      };
    },
    [queryClient],
  );
}
