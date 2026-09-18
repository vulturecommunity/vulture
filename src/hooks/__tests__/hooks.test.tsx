import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { definirDataService } from '@/services/data';
import { ArmazenamentoMock } from '@/services/data/mock/banco';
import { MockDataService } from '@/services/data/mock/MockDataService';

import { useValorAtrasado } from '../useExplorar';
import { useFeed } from '../useFeed';
import { useCurtir } from '../useInteracoes';
import { useChatDaLive } from '../useLive';

function envoltorio(queryClient: QueryClient) {
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('hooks', () => {
  let servico: MockDataService;
  let queryClient: QueryClient;

  beforeEach(async () => {
    servico = new MockDataService({
      armazenamento: new ArmazenamentoMock(`teste.hooks.${Math.random()}`),
      latenciaMs: 0,
      botsNaLive: false,
    });
    definirDataService(servico);
    await servico.entrarComoVisitante();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterAll(() => definirDataService(null));

  it('useValorAtrasado só atualiza depois do atraso', async () => {
    const { result, rerender } = await renderHook(
      ({ v }: { v: string }) => useValorAtrasado(v, 100),
      { initialProps: { v: 'a' } },
    );
    await rerender({ v: 'ab' });
    expect(result.current).toBe('a');
    await waitFor(() => expect(result.current).toBe('ab'));
  });

  it('useFeed carrega páginas e concatena os vídeos', async () => {
    const { result } = await renderHook(() => useFeed({ aba: 'paraVoce' }), {
      wrapper: envoltorio(queryClient),
    });
    await waitFor(() => expect(result.current.videos.length).toBe(10));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.videos.length).toBe(20));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('useCurtir atualiza o cache de forma otimista e persiste', async () => {
    const { result } = await renderHook(
      () => ({ feed: useFeed({ aba: 'paraVoce' }), curtir: useCurtir() }),
      { wrapper: envoltorio(queryClient) },
    );
    await waitFor(() => expect(result.current.feed.videos.length).toBe(10));
    const alvo = result.current.feed.videos[0];
    await act(async () => {
      result.current.curtir.alternar(alvo);
    });
    await waitFor(() => {
      const atualizado = result.current.feed.videos.find((v) => v.id === alvo.id)!;
      expect(atualizado.curtido).toBe(true);
      expect(atualizado.curtidas).toBe(alvo.curtidas + 1);
    });
    await waitFor(async () => expect((await servico.getVideo(alvo.id)).curtido).toBe(true));
  });

  it('useChatDaLive recebe histórico, envia mensagem e reação', async () => {
    const { result } = await renderHook(() => useChatDaLive('l-seed-1', 10, 'u-visitante'));
    await waitFor(() => expect(result.current.mensagens.length).toBeGreaterThan(0));
    const antes = result.current.mensagens.length;
    await act(async () => {
      await result.current.enviarMensagem('Salve!');
    });
    expect(result.current.mensagens.length).toBe(antes + 1);
    expect(result.current.mensagens[antes].texto).toBe('Salve!');
    await act(async () => {
      await result.current.enviarReacao('🏆');
    });
    expect(result.current.reacoes.length).toBe(1);
    expect(result.current.reacoes[0].emoji).toBe('🏆');
    expect(result.current.espectadores).toBe(10);
  });
});
