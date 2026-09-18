import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PortaoDeAutenticacao } from '@/components/navegacao/PortaoDeAutenticacao';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { cores } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const temaEscuro = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: cores.vermelho,
    background: cores.fundo,
    card: cores.pretoPuro,
    text: cores.texto,
    border: cores.borda,
    notification: cores.vermelho,
  },
};

export default function LayoutRaiz() {
  const restaurarSessao = useAuthStore((s) => s.restaurarSessao);
  const carregado = useAuthStore((s) => s.carregado);

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
            </PortaoDeAutenticacao>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
