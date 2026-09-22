import { useMutation, useQueryClient } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import { gerarThumbnail } from '@/services/midia/arquivos';
import { useAuthStore } from '@/stores/authStore';
import { useCriacaoStore } from '@/stores/criacaoStore';
import type { Video } from '@/types';
import { extrairHashtags } from '@/utils/hashtags';

/** Publica a mídia capturada usando o DataService ativo, com progresso real. */
export function usePublicar() {
  const queryClient = useQueryClient();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  return useMutation<Video, Error, { salvarNaGaleria: boolean }>({
    mutationFn: async ({ salvarNaGaleria }) => {
      const { midia, legenda, categoria, definirProgresso, definirPublicando, definirErro } =
        useCriacaoStore.getState();
      if (!midia) throw new Error('Nenhuma mídia para publicar.');
      definirErro(null);
      definirPublicando(true);
      definirProgresso(0.01, 'Preparando');
      try {
        if (salvarNaGaleria && midia.origem === 'camera') {
          try {
            // require tardio: o módulo é só nativo e não existe na web
            // prettier-ignore
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const MediaLibrary = require('expo-media-library') as typeof import('expo-media-library');
            const permissao = await MediaLibrary.requestPermissionsAsync(true);
            if (permissao.granted) await MediaLibrary.saveToLibraryAsync(midia.uri);
          } catch {
            // salvar na galeria é opcional: segue a publicação
          }
        }
        const thumbnailUriLocal =
          midia.tipo === 'video' ? await gerarThumbnail(midia.uri, 300) : null;
        const video = await dataService().uploadVideo(
          {
            uriLocal: midia.uri,
            tipo: midia.tipo,
            legenda,
            hashtags: extrairHashtags(legenda),
            categoria,
            duracao: midia.duracao,
            largura: midia.largura,
            altura: midia.altura,
            thumbnailUriLocal,
          },
          (fracao, etapa) => definirProgresso(fracao, etapa),
        );
        return video;
      } catch (erro) {
        definirErro(erro instanceof Error ? erro.message : 'Falha ao publicar.');
        throw erro;
      } finally {
        definirPublicando(false);
      }
    },
    onSuccess: async (video) => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (meuId) {
        queryClient.invalidateQueries({ queryKey: ['videos-usuario', meuId] });
        queryClient.invalidateQueries({ queryKey: ['perfil'] });
        try {
          const perfil = await dataService().getProfile('eu');
          atualizarUsuario(perfil);
        } catch {
          // o perfil será recarregado na próxima abertura
        }
      }
      queryClient.setQueryData(['video', video.id], video);
    },
  });
}
