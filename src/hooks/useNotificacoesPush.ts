import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { dataService } from '@/services/data';
import { destinoDaNotificacao, obterTokenPush } from '@/services/push';
import { lembrarTokenRegistrado } from '@/services/push/registro';
import { EVENTOS, registrar, registrarErro } from '@/services/telemetria';
import { useAuthStore } from '@/stores/authStore';

/**
 * Registra o token de push deste aparelho para o usuário logado.
 * Roda uma vez por login; silencioso quando push não está disponível (Expo Go, web, sem permissão).
 *
 * A telemetria aqui não é opcional: `push_tokens` vazia significa que ninguém pode ser
 * trazido de volta ao app, e sem medir não há como distinguir "a permissão foi negada"
 * de "o registro quebrou" — que pedem respostas opostas.
 */
export function useRegistrarPush(): void {
  const usuarioId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const registradoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!usuarioId || registradoPara.current === usuarioId) return;
    let cancelado = false;
    obterTokenPush()
      .then(async (token) => {
        if (cancelado) return;
        if (!token) {
          // sem token: permissão negada, Expo Go ou web
          registrar(EVENTOS.PUSH_RECUSADO);
          return;
        }
        await dataService().registrarTokenPush(token);
        lembrarTokenRegistrado(token.token);
        registradoPara.current = usuarioId;
        registrar(EVENTOS.PUSH_REGISTRADO, { plataforma: token.plataforma });
      })
      .catch((erro) => {
        // sem push neste aparelho: o app segue normal, mas isto precisa aparecer no painel
        registrarErro(erro, { onde: 'registrarTokenPush' });
      });
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);
}

/**
 * Abre a live (ou a conversa) quando o usuário toca numa notificação — com o app aberto,
 * em segundo plano ou fechado (neste caso, a resposta fica guardada e é lida na inicialização).
 */
export function useAbrirPelaNotificacao(): void {
  const router = useRouter();
  const pronto = useAuthStore((s) => s.carregado && !!s.sessao);
  const ultimaTratada = useRef<string | null>(null);

  useEffect(() => {
    if (!pronto) return;

    const abrir = (resposta: Notifications.NotificationResponse | null) => {
      if (!resposta) return;
      const id = resposta.notification.request.identifier;
      if (ultimaTratada.current === id) return;
      const destino = destinoDaNotificacao(resposta.notification.request.content.data);
      if (!destino) return;
      ultimaTratada.current = id;
      if (destino.tipo === 'live') {
        router.push({ pathname: '/live/[id]', params: { id: destino.liveId } });
      } else {
        router.push({ pathname: '/mensagens/[id]', params: { id: destino.conversaId } });
      }
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
