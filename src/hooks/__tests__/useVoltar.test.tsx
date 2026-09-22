import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useFecharFluxo, useVoltar } from '../useVoltar';

describe('useVoltar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (router.canGoBack as jest.Mock).mockReturnValue(true);
  });

  it('volta normalmente quando existe tela anterior', async () => {
    const { result } = await renderHook(() => useVoltar('/mensagens'));
    result.current();
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('cai na rota padrão quando a tela foi aberta direto (sem pilha)', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    const { result } = await renderHook(() => useVoltar('/mensagens'));
    result.current();
    // sem esse desvio o expo-router avisa "GO_BACK was not handled by any navigator"
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/mensagens');
  });

  it('useFecharFluxo só desfaz a pilha quando ela existe', async () => {
    const { result } = await renderHook(() => useFecharFluxo('/(tabs)'));
    result.current();
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');

    jest.clearAllMocks();
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    const segundo = await renderHook(() => useFecharFluxo('/(tabs)'));
    segundo.result.current();
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });
});
