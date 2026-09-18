/* eslint-disable @typescript-eslint/no-require-imports */
import { NativeModules } from 'react-native';

/**
 * Carregamento opcional do LiveKit.
 *
 * O LiveKit depende de módulos nativos (WebRTC) que NÃO existem no Expo Go.
 * Por isso nunca importamos `@livekit/react-native` estaticamente: verificamos em runtime
 * se os módulos nativos estão registrados e só então fazemos o `require`.
 * Sem eles, o app entra no "modo live simulada" e a demonstração nunca quebra.
 */
export type ModuloLiveKit = typeof import('@livekit/react-native') & {
  cliente: typeof import('livekit-client');
};

let cache: ModuloLiveKit | null | undefined;

/** true quando o app roda num development build com LiveKit + WebRTC compilados. */
export function liveKitDisponivel(): boolean {
  const modulos = NativeModules as Record<string, unknown>;
  return !!modulos.LivekitReactNativeModule && !!modulos.WebRTCModule;
}

/** Retorna o módulo LiveKit pronto (globals registrados) ou null no Expo Go. */
export function carregarLiveKit(): ModuloLiveKit | null {
  if (cache !== undefined) return cache;
  if (!liveKitDisponivel()) {
    cache = null;
    return null;
  }
  try {
    const rn = require('@livekit/react-native') as typeof import('@livekit/react-native');
    const cliente = require('livekit-client') as typeof import('livekit-client');
    rn.registerGlobals();
    cache = Object.assign({}, rn, { cliente });
  } catch {
    cache = null;
  }
  return cache;
}

/** Usado em testes para forçar um estado. */
export function redefinirCacheLiveKit(): void {
  cache = undefined;
}
