import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PortaoDeAutenticacao } from '@/components/navegacao/PortaoDeAutenticacao';
import { SheetsGlobais } from '@/components/navegacao/SheetsGlobais';
import { TelaDeErro } from '@/components/navegacao/TelaDeErro';
import { useAbrirLivePelaNotificacao, useRegistrarPush } from '@/hooks/useNotificacoesPush';
import { configurarExibicaoDeNotificacoes } from '@/services/push';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { cores } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
configurarExibicaoDeNotificacoes();

/** Erros de renderização em qualquer rota caem aqui em vez de fechar o app. */
export { TelaDeErro as ErrorBoundary };

const temaEscuro = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: cores.vermelho,
    background: cores.fundo,
    card: cores.fundo,
    text: cores.texto,
    border: cores.borda,
    notification: cores.vermelhoVivo,
  },
};

export default function LayoutRaiz() {
  const restaurarSessao = useAuthStore((s) => s.restaurarSessao);
  const carregado = useAuthStore((s) => s.carregado);
  useRegistrarPush();
  useAbrirLivePelaNotificacao();

  useEffect(() => {
    restaurarSessao();
  }, [restaurarSessao]);

  useEffect(() => {
    if (carregado) SplashScreen.hideAsync().catch(() => {});
  }, [carregado]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: cores.fundo }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={temaEscuro}>
            <StatusBar style="light" />
            <PortaoDeAutenticacao>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: cores.fundo },
                  animation: 'slide_from_right',
                }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                <Stack.Screen
                  name="criar/camera"
                  options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                />
                <Stack.Screen name="criar/preview" />
                <Stack.Screen
                  name="live/iniciar"
                  options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
                />
                <Stack.Screen name="live/[id]" options={{ animation: 'slide_from_bottom' }} />
              </Stack>
              <SheetsGlobais />
            </PortaoDeAutenticacao>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
