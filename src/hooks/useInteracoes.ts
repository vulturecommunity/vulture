import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Share } from 'react-native';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import type { Video } from '@/types';

import { useAtualizarVideoNoCache } from './useFeed';

/** Curtir/descurtir com atualização otimista em todas as listas. */
export function useCurtir() {
  const atualizar = useAtualizarVideoNoCache();
  const queryClient = useQueryClient();

  const mutacao = useMutation({
    mutationFn: async ({ video }: { video: Video }) => {
      if (video.curtido) await dataService().unlike(video.id);
      else await dataService().like(video.id);
    },
    onMutate: async ({ video }) => {
      const desfazer = atualizar(video.id, (v) => ({
        ...v,
        curtido: !video.curtido,
        curtidas: Math.max(0, v.curtidas + (video.curtido ? -1 : 1)),
      }));
      return { desfazer };
    },
    onError: (_erro, _vars, contexto) => contexto?.desfazer(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['videos-curtidos'] });
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
    },
  });

  const alternar = useCallback(
    (video: Video) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      mutacao.mutate({ video });
    },
    [mutacao],
  );

  /** Só curte (usado no duplo toque). */
  const curtir = useCallback(
    (video: Video) => {
      if (video.curtido) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      mutacao.mutate({ video });
    },
    [mutacao],
  );

  return { alternar, curtir, ocupado: mutacao.isPending };
}

/** Salvar/remover dos salvos com atualização otimista. */
export function useSalvar() {
  const atualizar = useAtualizarVideoNoCache();
  const queryClient = useQueryClient();

  const mutacao = useMutation({
    mutationFn: async ({ video }: { video: Video }) => {
      if (video.salvo) await dataService().removerSalvo(video.id);
      else await dataService().salvar(video.id);
    },
    onMutate: async ({ video }) => ({
      desfazer: atualizar(video.id, (v) => ({
        ...v,
        salvo: !video.salvo,
        salvos: Math.max(0, v.salvos + (video.salvo ? -1 : 1)),
      })),
    }),
    onError: (_erro, _vars, contexto) => contexto?.desfazer(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaves.videosSalvos }),
  });

  const alternar = useCallback(
    (video: Video) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      mutacao.mutate({ video });
    },
    [mutacao],
  );

  return { alternar, ocupado: mutacao.isPending };
}

/** Compartilhar via a folha nativa do sistema. */
export function useCompartilhar() {
  const atualizar = useAtualizarVideoNoCache();

  return useCallback(
    async (video: Video) => {
      try {
        const resultado = await Share.share({
          message: `${video.legenda}\n\nVeja no Vulture: vulture://video/${video.id}`,
          url: video.url,
          title: `Vídeo de @${video.autor.apelido} no Vulture`,
        });
        if (resultado.action === Share.sharedAction) {
          atualizar(video.id, (v) => ({ ...v, compartilhamentos: v.compartilhamentos + 1 }));
          dataService()
            .registrarCompartilhamento(video.id)
            .catch(() => {});
        }
      } catch {
        // usuário cancelou ou plataforma sem suporte
      }
    },
    [atualizar],
  );
}

/** Seguir/deixar de seguir com invalidação do perfil e do feed "Seguindo". */
export function useSeguir() {
  const queryClient = useQueryClient();

  const mutacao = useMutation({
    mutationFn: async ({ usuarioId, seguindo }: { usuarioId: string; seguindo: boolean }) => {
      if (seguindo) await dataService().unfollow(usuarioId);
      else await dataService().follow(usuarioId);
    },
    onSuccess: (_dados, { usuarioId }) => {
      queryClient.invalidateQueries({ queryKey: chaves.perfil(usuarioId) });
      queryClient.invalidateQueries({ queryKey: chaves.perfil('eu') });
      queryClient.invalidateQueries({ queryKey: ['feed', 'seguindo'] });
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
    },
  });

  const alternar = useCallback(
    (usuarioId: string, seguindo: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return mutacao.mutateAsync({ usuarioId, seguindo });
    },
    [mutacao],
  );

  return { alternar, ocupado: mutacao.isPending };
}

export function useVideo(id: string | undefined) {
  return useQuery({
    queryKey: chaves.video(id ?? ''),
    queryFn: () => dataService().getVideo(id!),
    enabled: !!id,
  });
}
