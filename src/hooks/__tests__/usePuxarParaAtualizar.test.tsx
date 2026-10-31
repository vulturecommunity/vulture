import { act, renderHook } from '@testing-library/react-native';

import { usePuxarParaAtualizar } from '../usePuxarParaAtualizar';

describe('usePuxarParaAtualizar', () => {
  it('só gira entre o gesto e o fim das buscas disparadas por ele', async () => {
    let concluir: (() => void) | undefined;
    const refetch = jest.fn(() => new Promise<void>((resolve) => (concluir = resolve)));
    const { result } = await renderHook(() => usePuxarParaAtualizar(refetch));

    // buscas em segundo plano (refetchInterval, refetchOnMount) não acendem a roda
    expect(result.current.atualizando).toBe(false);

    await act(async () => {
      result.current.aoAtualizar();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(result.current.atualizando).toBe(true);

    await act(async () => {
      concluir?.();
    });
    expect(result.current.atualizando).toBe(false);
  });

  it('espera todas as buscas, mesmo quando uma falha', async () => {
    const ok = jest.fn(() => Promise.resolve());
    const falha = jest.fn(() => Promise.reject(new Error('sem rede')));
    const { result } = await renderHook(() => usePuxarParaAtualizar(ok, falha));

    await act(async () => {
      result.current.aoAtualizar();
    });

    expect(ok).toHaveBeenCalled();
    expect(falha).toHaveBeenCalled();
    expect(result.current.atualizando).toBe(false);
  });

  it('mantém a mesma função entre renders e usa sempre as buscas atuais', async () => {
    const primeira = jest.fn();
    const segunda = jest.fn();
    const { result, rerender } = await renderHook<
      ReturnType<typeof usePuxarParaAtualizar>,
      { fn: () => void }
    >(({ fn }) => usePuxarParaAtualizar(fn), { initialProps: { fn: primeira } });
    const antes = result.current.aoAtualizar;

    await act(async () => {
      rerender({ fn: segunda });
    });
    expect(result.current.aoAtualizar).toBe(antes);

    await act(async () => {
      result.current.aoAtualizar();
    });
    expect(primeira).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
  });
});
