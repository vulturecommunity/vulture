import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { abrirCompartilhamento, compartilharVideo } from '@/utils/compartilhar';
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
      const compartilhou = await abrirCompartilhamento(
        compartilharVideo({
          id: video.id,
          legenda: video.legenda,
          apelido: video.autor.apelido,
        }),
      );
      if (compartilhou) {
        atualizar(video.id, (v) => ({ ...v, compartilhamentos: v.compartilhamentos + 1 }));
        dataService()
          .registrarCompartilhamento(video.id)
          .catch(() => {});
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
      // seguir muda quem aparece nos rasantes, nos contatos, nas sugestões e quem pode conversar
      queryClient.invalidateQueries({ queryKey: chaves.rasantes });
      queryClient.invalidateQueries({ queryKey: chaves.contatos });
      queryClient.invalidateQueries({ queryKey: chaves.sugestoes });
      queryClient.invalidateQueries({ queryKey: chaves.novosSeguidores });
      queryClient.invalidateQueries({ queryKey: chaves.permissaoDeConversa(usuarioId) });
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
