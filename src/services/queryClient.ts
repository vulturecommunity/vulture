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
  conversas: ['conversas'] as const,
  conversa: (id: string) => ['conversa', id] as const,
  mensagens: (conversaId: string) => ['mensagens', conversaId] as const,
  permissaoDeConversa: (usuarioId: string) => ['permissao-conversa', usuarioId] as const,
  contatos: ['contatos'] as const,
  preferenciasDeMensagens: ['preferencias-mensagens'] as const,
  novosSeguidores: ['novos-seguidores'] as const,
  sugestoes: ['sugestoes-torcedores'] as const,
  rasantes: ['rasantes'] as const,
  rasantesDoUsuario: (id: string) => ['rasantes-usuario', id] as const,
  bloqueados: ['bloqueados'] as const,
  partidas: ['partidas'] as const,
  calendario: ['calendario'] as const,
  posts: (filtro: string) => ['arquibancada', 'posts', filtro] as const,
  post: (id: string) => ['arquibancada', 'post', id] as const,
  respostas: (postId: string) => ['arquibancada', 'respostas', postId] as const,
  meusPalpites: ['palpites', 'meus'] as const,
  resumoDosPalpites: (partidaId: string) => ['palpites', 'resumo', partidaId] as const,
  periodosDoRanking: ['ranking-palpites', 'periodos'] as const,
  rankingDePalpites: (periodo: string) => ['ranking-palpites', 'top', periodo] as const,
  podioDaPartida: (partidaId: string) => ['ranking-palpites', 'podio', partidaId] as const,
  titulos: (usuarioId: string) => ['ranking-palpites', 'titulos', usuarioId] as const,
  minhasLigas: (periodo: string) => ['ligas', 'minhas', periodo] as const,
  rankingDaLiga: (ligaId: string, periodo: string) =>
    ['ligas', 'ranking', ligaId, periodo] as const,
};
