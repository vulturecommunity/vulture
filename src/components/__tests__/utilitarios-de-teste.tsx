import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { definirDataService } from '@/services/data';
import { ArmazenamentoMock } from '@/services/data/mock/banco';
import { MockDataService } from '@/services/data/mock/MockDataService';
import type { Video } from '@/types';

/** Cria um MockDataService isolado e sem latência para testes de componente. */
export function criarServicoDeTeste(chave = `teste.${Math.random().toString(36).slice(2)}`) {
  const servico = new MockDataService({
    armazenamento: new ArmazenamentoMock(chave),
    latenciaMs: 0,
    botsNaLive: false,
  });
  definirDataService(servico);
  return servico;
}

/**
 * `gcTime: 0` também nas mutations, e não só nas queries.
 *
 * Uma mutation concluída fica no cache pelo gcTime (5 min por padrão) e agenda um timer
 * para se limpar. Esse timer segura o event loop do Node: o teste termina, mas o Jest fica
 * esperando o processo esvaziar — é a origem do "a worker process has failed to exit
 * gracefully" que a suíte mostrava, e de um arquivo com mutation travar por minutos.
 */
export function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

/** Renderiza com QueryClientProvider (os testes não precisam de navegação real). */
export async function renderizar(
  ui: ReactElement,
  opcoes?: RenderOptions & { queryClient?: QueryClient },
) {
  const queryClient = opcoes?.queryClient ?? criarQueryClient();
  function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const resultado = await render(ui, { wrapper: Envoltorio, ...opcoes });
  return { queryClient, ...resultado };
}

export function videoDeTeste(parcial: Partial<Video> = {}): Video {
  return {
    id: 'v-teste',
    autorId: 'u-nacao',
    autor: { id: 'u-nacao', apelido: 'nacao_rubro', nome: 'Nação Rubro-Negra', avatarUrl: null },
    tipo: 'video',
    url: 'https://exemplo.com/video.mp4',
    thumbnailUrl: null,
    legenda: 'Que festa no #Maracanã hoje!',
    hashtags: ['Maracanã'],
    categoria: 'Torcida',
    audio: 'Som original',
    duracao: 10,
    largura: 1080,
    altura: 1920,
    curtidas: 1200,
    comentarios: 34,
    salvos: 10,
    compartilhamentos: 5,
    visualizacoes: 15000,
    criadoEm: new Date().toISOString(),
    curtido: false,
    salvo: false,
    ...parcial,
  };
}
