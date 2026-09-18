import { useQuery } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import type { Video } from '@/types';

export type OrigemDaLista = 'usuario' | 'curtidos' | 'salvos' | 'trending' | 'video';

/** Listas simples de vídeos (perfil, curtidos, salvos, em alta ou um único vídeo). */
export function useListaDeVideos(origem: OrigemDaLista, id: string | undefined) {
  return useQuery<Video[]>({
    queryKey:
      origem === 'usuario'
        ? chaves.videosDoUsuario(id ?? '')
        : origem === 'curtidos'
          ? chaves.videosCurtidos(id ?? '')
          : origem === 'salvos'
            ? chaves.videosSalvos
            : origem === 'trending'
              ? chaves.trending
              : chaves.video(id ?? ''),
    queryFn: async () => {
      switch (origem) {
        case 'usuario':
          return dataService().listVideosDoUsuario(id!);
        case 'curtidos':
          return dataService().listVideosCurtidos(id!);
        case 'salvos':
          return dataService().listVideosSalvos();
        case 'trending':
          return dataService().listTrending();
        default:
          return [await dataService().getVideo(id!)];
      }
    },
    enabled: origem === 'salvos' || origem === 'trending' || !!id,
  });
}
