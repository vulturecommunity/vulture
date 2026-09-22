import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { dataService } from '@/services/data';
import { liveIdDaNotificacao, obterTokenPush } from '@/services/push';
import { lembrarTokenRegistrado } from '@/services/push/registro';
import { useAuthStore } from '@/stores/authStore';

/**
 * Registra o token de push deste aparelho para o usuário logado.
 * Roda uma vez por login; silencioso quando push não está disponível (Expo Go, web, sem permissão).
 */
export function useRegistrarPush(): void {
  const usuarioId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const registradoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!usuarioId || registradoPara.current === usuarioId) return;
    let cancelado = false;
    obterTokenPush()
      .then(async (token) => {
        if (!token || cancelado) return;
        await dataService().registrarTokenPush(token);
        lembrarTokenRegistrado(token.token);
        registradoPara.current = usuarioId;
      })
      .catch(() => {
        // sem push neste aparelho: o app segue normal
      });
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);
}

/**
 * Abre a live quando o usuário toca numa notificação — com o app aberto, em segundo plano
 * ou fechado (neste caso, a resposta fica guardada e é lida na inicialização).
 */
export function useAbrirLivePelaNotificacao(): void {
  const router = useRouter();
  const pronto = useAuthStore((s) => s.carregado && !!s.sessao);
  const ultimaTratada = useRef<string | null>(null);

  useEffect(() => {
    if (!pronto) return;

    const abrir = (resposta: Notifications.NotificationResponse | null) => {
      if (!resposta) return;
      const id = resposta.notification.request.identifier;
      if (ultimaTratada.current === id) return;
      const liveId = liveIdDaNotificacao(resposta.notification.request.content.data);
      if (!liveId) return;
      ultimaTratada.current = id;
      router.push({ pathname: '/live/[id]', params: { id: liveId } });
    };

    // app estava fechado: a notificação que o abriu
    Notifications.getLastNotificationResponseAsync()
      .then(abrir)
      .catch(() => {});
    // app aberto ou em segundo plano
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, [pronto, router]);
}
