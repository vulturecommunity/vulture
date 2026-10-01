import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

import {
  EVENTOS,
  _resetarTelemetria,
  esquecerUsuario,
  identificar,
  iniciarTelemetria,
  registrar,
  registrarErro,
} from '../index';

const PostHogMock = PostHog as unknown as jest.Mock;

/** A última instância que o código criou — é nela que os eventos caem. */
function clienteCriado() {
  return PostHogMock.mock.results.at(-1)?.value as {
    capture: jest.Mock;
    identify: jest.Mock;
    reset: jest.Mock;
  };
}

describe('telemetria', () => {
  const ambienteOriginal = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    _resetarTelemetria();
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  });

  afterAll(() => {
    process.env = ambienteOriginal;
  });

  describe('sem chave configurada', () => {
    it('não liga nada e não quebra ao ser usada', () => {
      iniciarTelemetria();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(PostHogMock).not.toHaveBeenCalled();

      // o ponto do teste: chamar sem configuração não pode lançar
      expect(() => {
        registrar(EVENTOS.PALPITE_CRAVADO, { partida: 'x' });
        identificar('u-1', 'zico');
        registrarErro(new Error('qualquer'));
        esquecerUsuario();
      }).not.toThrow();
    });
  });

  describe('com as chaves configuradas', () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.sentry.io/2';
      process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_teste';
      iniciarTelemetria();
    });

    it('não envia dado pessoal ao Sentry', () => {
      const opcoes = (Sentry.init as jest.Mock).mock.calls[0][0];
      // e-mail e IP de torcedor num painel de terceiro é incidente de LGPD
      expect(opcoes.sendDefaultPii).toBe(false);
    });

    it('amostra os rastros em vez de enviar todos', () => {
      const opcoes = (Sentry.init as jest.Mock).mock.calls[0][0];
      // o plano gratuito é o limite que aperta primeiro
      expect(opcoes.tracesSampleRate).toBeGreaterThan(0);
      expect(opcoes.tracesSampleRate).toBeLessThanOrEqual(0.2);
    });

    it('manda o evento de produto com as propriedades', () => {
      registrar(EVENTOS.PUSH_REGISTRADO, { plataforma: 'android' });
      expect(clienteCriado().capture).toHaveBeenCalledWith('push_registrado', {
        plataforma: 'android',
      });
    });

    it('identifica por uuid e apelido, nunca por e-mail', () => {
      identificar('u-7', 'zico');
      expect(clienteCriado().identify).toHaveBeenCalledWith('u-7', { apelido: 'zico' });
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'u-7' });

      const enviado = JSON.stringify((Sentry.setUser as jest.Mock).mock.calls);
      expect(enviado).not.toMatch(/@/);
    });

    it('esquece o usuário no logout, para não misturar duas pessoas no aparelho', () => {
      identificar('u-7', 'zico');
      esquecerUsuario();
      expect(clienteCriado().reset).toHaveBeenCalled();
      expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
    });

    it('iniciar duas vezes não cria dois clientes', () => {
      iniciarTelemetria();
      expect(PostHogMock).toHaveBeenCalledTimes(1);
      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });

    it('falha interna da telemetria não derruba o app', () => {
      clienteCriado().capture.mockImplementationOnce(() => {
        throw new Error('rede caiu');
      });
      expect(() => registrar(EVENTOS.LOGIN, { metodo: 'email' })).not.toThrow();
    });
  });
});
