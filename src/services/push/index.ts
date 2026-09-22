import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Live, PlataformaPush, TokenPush } from '@/types';

/** Canal Android das lives: importância máxima para aparecer como banner com som e vibração. */
export const CANAL_LIVES = 'lives';

/** Conteúdo que o app espera dentro de `data` de uma notificação de live. */
export interface DadosDeNotificacaoDeLive {
  tipo: 'live';
  liveId: string;
  url: string;
}

/**
 * Monta título, corpo e dados da notificação "fulano está ao vivo".
 * É a mesma forma usada pelo servidor (Edge Function) e pelo envio local do modo demo,
 * então o toque cai sempre no mesmo tratamento (abrir a live).
 */
export function construirNotificacaoDeLive(live: Pick<Live, 'id' | 'titulo' | 'anfitriao'>): {
  title: string;
  body: string;
  data: DadosDeNotificacaoDeLive;
} {
  const apelido = live.anfitriao.apelido;
  return {
    title: `🔴 @${apelido} está ao vivo`,
    body: live.titulo ? `${live.titulo} · Toque para assistir` : 'Toque para assistir agora',
    data: { tipo: 'live', liveId: live.id, url: `vulture://live/${live.id}` },
  };
}

/** Extrai o id da live dos dados de uma notificação (ou null se não for de live). */
export function liveIdDaNotificacao(dados: unknown): string | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Partial<DadosDeNotificacaoDeLive>;
  return d.tipo === 'live' && typeof d.liveId === 'string' && d.liveId ? d.liveId : null;
}

/**
 * Push remoto só existe fora do Expo Go (no Android, o Expo Go não recebe push desde o SDK 53).
 * No Expo Go o app segue funcionando: só não registra token.
 */
export function pushRemotoDisponivel(): boolean {
  return (
    Platform.OS !== 'web' &&
    Device.isDevice &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  );
}

/** Como as notificações aparecem com o app aberto: banner + som (sem badge). */
export function configurarExibicaoDeNotificacoes(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Cria o canal "lives" no Android (sem efeito nas outras plataformas). */
export async function garantirCanalDeLives(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_LIVES, {
    name: 'Lives',
    description: 'Avisos quando alguém que você segue entra ao vivo',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#C8102E',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

/** Pede permissão (se ainda não decidida) e devolve se está concedida. */
export async function pedirPermissaoDeNotificacoes(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  const resposta = await Notifications.requestPermissionsAsync();
  return resposta.granted;
}

/**
 * Obtém o token de push do Expo para este aparelho, ou null quando não há como
 * (Expo Go, simulador, permissão negada ou projeto sem projectId).
 */
export async function obterTokenPush(): Promise<TokenPush | null> {
  if (!pushRemotoDisponivel()) return null;
  const projectId =
    Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? null;
  if (!projectId) return null;
  const permitido = await pedirPermissaoDeNotificacoes();
  if (!permitido) return null;
  await garantirCanalDeLives();
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, plataforma: Platform.OS as PlataformaPush };
}

/**
 * Exibe imediatamente, neste aparelho, a notificação de uma live.
 * Usado no modo demo (driver mock), em que não há servidor para enviar push.
 */
export async function exibirNotificacaoDeLiveLocal(
  live: Pick<Live, 'id' | 'titulo' | 'anfitriao'>,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const permitido = await pedirPermissaoDeNotificacoes();
  if (!permitido) return;
  await garantirCanalDeLives();
  const conteudo = construirNotificacaoDeLive(live);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: conteudo.title,
      body: conteudo.body,
      data: { ...conteudo.data },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#C8102E',
      vibrate: [0, 250, 150, 250],
    },
    // no Android o canal vai no gatilho; null = imediato
    trigger: Platform.OS === 'android' ? { channelId: CANAL_LIVES } : null,
  });
}
