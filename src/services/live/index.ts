import { carregarLiveKit, liveKitDisponivel } from './livekit-nativo';
import { configuracaoLiveKit } from './token';

export type ModoDeLive = 'livekit' | 'simulado';

/**
 * Decide como a live vai funcionar neste aparelho:
 *  - "livekit": development build com módulos nativos + chaves configuradas
 *  - "simulado": Expo Go ou sem chaves → câmera local como preview + chat funcional
 */
export function modoDeLive(): ModoDeLive {
  return liveKitDisponivel() && configuracaoLiveKit() && carregarLiveKit() ? 'livekit' : 'simulado';
}

export function motivoDoModoSimulado(): string {
  if (!liveKitDisponivel()) return 'Módulo nativo do LiveKit indisponível (Expo Go).';
  if (!configuracaoLiveKit()) return 'Chaves do LiveKit não configuradas no .env.';
  return 'Falha ao carregar o LiveKit.';
}

export { carregarLiveKit, liveKitDisponivel } from './livekit-nativo';
export { configuracaoLiveKit, obterCredenciaisLiveKit } from './token';
