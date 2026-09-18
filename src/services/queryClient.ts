import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Chaves de cache centralizadas para invalidação consistente. */
export const chaves = {
  feed: (aba: string, extra?: string) => ['feed', aba, extra ?? ''] as const,
  video: (id: string) => ['video', id] as const,
  comentarios: (videoId: string) => ['comentarios', videoId] as const,
  perfil: (id: string) => ['perfil', id] as const,
  videosDoUsuario: (id: string) => ['videos-usuario', id] as const,
  videosCurtidos: (id: string) => ['videos-curtidos', id] as const,
  videosSalvos: ['videos-salvos'] as const,
  buscaUsuarios: (termo: string) => ['busca-usuarios', termo] as const,
  buscaHashtags: (termo: string) => ['busca-hashtags', termo] as const,
  trending: ['trending'] as const,
  hashtagsEmAlta: ['hashtags-em-alta'] as const,
  ranking: ['ranking-semanal'] as const,
  lives: ['lives'] as const,
  live: (id: string) => ['live', id] as const,
  notificacoes: ['notificacoes'] as const,
  bloqueados: ['bloqueados'] as const,
  partidas: ['partidas'] as const,
};
