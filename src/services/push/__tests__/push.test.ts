import * as Notifications from 'expo-notifications';

import {
  construirNotificacaoDeLive,
  destinoDaNotificacao,
  exibirNotificacaoDeLiveLocal,
  liveIdDaNotificacao,
  obterTokenPush,
} from '../index';

const live = {
  id: 'l-1',
  titulo: 'Esquenta pro clássico',
  anfitriao: { id: 'u-1', apelido: 'maraca_vibes', nome: 'Maraca', avatarUrl: null },
};

describe('notificações de live', () => {
  it('monta título, corpo e dados no mesmo formato do servidor', () => {
    const n = construirNotificacaoDeLive(live);
    expect(n.title).toBe('🔴 @maraca_vibes está ao vivo');
    // igual ao que a RPC notificar_live enfileira: o corpo é o assunto da live, sem
    // "Toque para assistir" — toda notificação é tocável
    expect(n.body).toBe('Esquenta pro clássico');
    expect(n.body).not.toMatch(/Toque para assistir/);
    expect(n.data).toEqual({ tipo: 'live', liveId: 'l-1', url: 'vulture://live/l-1' });
  });

  it('live sem título cai no mesmo texto de reserva do servidor', () => {
    const n = construirNotificacaoDeLive({ ...live, titulo: '   ' });
    expect(n.body).toBe('Transmitindo agora para a nação');
  });

  it('reconhece o id da live nos dados de uma notificação', () => {
    expect(liveIdDaNotificacao({ tipo: 'live', liveId: 'l-9', url: 'x' })).toBe('l-9');
    expect(liveIdDaNotificacao({ tipo: 'curtida', videoId: 'v' })).toBeNull();
    expect(liveIdDaNotificacao(null)).toBeNull();
    expect(liveIdDaNotificacao('texto')).toBeNull();
  });

  it('descobre o destino do toque: live ou conversa', () => {
    expect(destinoDaNotificacao({ tipo: 'live', liveId: 'l-1', url: 'x' })).toEqual({
      tipo: 'live',
      liveId: 'l-1',
    });
    expect(destinoDaNotificacao({ tipo: 'mensagem', conversaId: 'c-9', url: 'x' })).toEqual({
      tipo: 'mensagem',
      conversaId: 'c-9',
    });
    expect(destinoDaNotificacao({ tipo: 'mensagem' })).toBeNull();
    expect(destinoDaNotificacao(undefined)).toBeNull();
  });

  it('obtém o token de push com permissão concedida', async () => {
    const token = await obterTokenPush();
    expect(token).toEqual({ token: 'ExponentPushToken[teste]', plataforma: 'ios' });
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'projeto-teste',
    });
  });

  it('não pede token quando a permissão foi negada', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    });
    expect(await obterTokenPush()).toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('exibe a notificação local com os dados da live', async () => {
    await exibirNotificacaoDeLiveLocal(live);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '🔴 @maraca_vibes está ao vivo',
          data: { tipo: 'live', liveId: 'l-1', url: 'vulture://live/l-1' },
        }),
      }),
    );
  });
});
