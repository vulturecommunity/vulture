import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo } from 'react';

import { dataService } from '@/services/data';
import type { NovoPost, ProgressoDeUpload } from '@/services/data/types';
import { chaves } from '@/services/queryClient';
import type { Pagina, Post } from '@/types';
import { abrirCompartilhamento, compartilharPost } from '@/utils/compartilhar';

export type FiltroDaResenha =
  { tipo: 'hashtag'; tag: string } | { tipo: 'partida'; id: string; rotulo: string } | null;

function chaveDoFiltro(filtro: FiltroDaResenha): string {
  if (!filtro) return 'todos';
  return filtro.tipo === 'hashtag' ? `#${filtro.tag.toLowerCase()}` : `jogo:${filtro.id}`;
}

/** Resenha infinita, opcionalmente filtrada por hashtag ou por jogo. */
export function usePostsDaResenha(filtro: FiltroDaResenha) {
  const consulta = useInfiniteQuery({
    queryKey: chaves.posts(chaveDoFiltro(filtro)),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      dataService().listPosts({
        cursor: pageParam,
        limite: 15,
        hashtag: filtro?.tipo === 'hashtag' ? filtro.tag : undefined,
        partidaId: filtro?.tipo === 'partida' ? filtro.id : undefined,
      }),
    getNextPageParam: (ultima: Pagina<Post>) => ultima.proximoCursor,
  });
  const posts = useMemo(() => consulta.data?.pages.flatMap((p) => p.itens) ?? [], [consulta.data]);
  return { ...consulta, posts };
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: chaves.post(id ?? ''),
    queryFn: () => dataService().getPost(id!),
    enabled: !!id,
  });
}

export function useRespostas(postId: string | undefined) {
  return useQuery({
    queryKey: chaves.respostas(postId ?? ''),
    queryFn: () => dataService().listRespostas(postId!),
    enabled: !!postId,
  });
}

/**
 * Atualiza um post em todas as listas em cache (resenhas, thread, respostas).
 * Devolve uma função para desfazer (atualização otimista).
 */
export function useAtualizarPostNoCache() {
  const queryClient = useQueryClient();
  return useCallback(
    (postId: string, alterar: (p: Post) => Post) => {
      const fotos: { chave: readonly unknown[]; dados: unknown }[] = [];
      queryClient
        .getQueriesData<InfiniteData<Pagina<Post>>>({ queryKey: ['arquibancada', 'posts'] })
        .forEach(([chave, dados]) => {
          if (!dados) return;
          fotos.push({ chave, dados });
          queryClient.setQueryData<InfiniteData<Pagina<Post>>>(chave, {
            ...dados,
            pages: dados.pages.map((p) => ({
              ...p,
              itens: p.itens.map((post) => (post.id === postId ? alterar(post) : post)),
            })),
          });
        });
      queryClient
        .getQueriesData<Post[]>({ queryKey: ['arquibancada', 'respostas'] })
        .forEach(([chave, dados]) => {
          if (!Array.isArray(dados)) return;
          fotos.push({ chave, dados });
          queryClient.setQueryData<Post[]>(
            chave,
            dados.map((post) => (post.id === postId ? alterar(post) : post)),
          );
        });
      const individual = queryClient.getQueryData<Post>(chaves.post(postId));
      if (individual) {
        fotos.push({ chave: chaves.post(postId), dados: individual });
        queryClient.setQueryData<Post>(chaves.post(postId), alterar(individual));
      }
      return () => {
        for (const foto of fotos) queryClient.setQueryData(foto.chave, foto.dados);
      };
    },
    [queryClient],
  );
}

export function useCurtirPost() {
  const atualizar = useAtualizarPostNoCache();
  const mutacao = useMutation({
    mutationFn: async (post: Post) => {
      if (post.curtido) await dataService().descurtirPost(post.id);
      else await dataService().curtirPost(post.id);
    },
    onMutate: (post) => ({
      desfazer: atualizar(post.id, (p) => ({
        ...p,
        curtido: !post.curtido,
        curtidas: Math.max(0, p.curtidas + (post.curtido ? -1 : 1)),
      })),
    }),
    onError: (_erro, _post, contexto) => contexto?.desfazer(),
  });
  return useCallback(
    (post: Post) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      mutacao.mutate(post);
    },
    [mutacao],
  );
}

export function usePublicarPost() {
  const queryClient = useQueryClient();
  const atualizar = useAtualizarPostNoCache();
  return useMutation({
    mutationFn: ({ aoProgredir, ...novo }: NovoPost & { aoProgredir?: ProgressoDeUpload }) =>
      dataService().publicarPost(novo, aoProgredir),
    onSuccess: (post) => {
      if (post.paiId) {
        queryClient.setQueryData<Post[]>(chaves.respostas(post.paiId), (atual = []) => [
          ...atual,
          post,
        ]);
        atualizar(post.paiId, (p) => ({ ...p, respostas: p.respostas + 1 }));
      } else {
        queryClient.invalidateQueries({ queryKey: ['arquibancada', 'posts'] });
      }
    },
  });
}

export function useCompartilharPost() {
  return useCallback(async (post: Post) => {
    await abrirCompartilhamento(
      compartilharPost({ id: post.id, texto: post.texto, apelido: post.autor.apelido }),
    );
  }, []);
}
