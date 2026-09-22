import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/**
 * "Voltar" seguro: quando existe tela anterior, volta; quando não existe
 * (a tela foi aberta direto por notificação ou link), cai numa rota conhecida.
 * Sem isso o expo-router avisa "GO_BACK was not handled by any navigator" e o
 * botão não faz nada.
 */
export function useVoltar(rotaPadrao: Href = '/(tabs)'): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(rotaPadrao);
  }, [router, rotaPadrao]);
}

/** Fecha um fluxo modal inteiro (câmera → preview) sem quebrar quando não há pilha. */
export function useFecharFluxo(rotaPadrao: Href = '/(tabs)'): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.dismissAll();
    router.replace(rotaPadrao);
  }, [router, rotaPadrao]);
}
