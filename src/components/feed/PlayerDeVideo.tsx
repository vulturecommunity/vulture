import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { Icone } from '@/components/ui';
import { cores } from '@/theme';
import type { Video } from '@/types';

import { BarraDeProgresso } from './BarraDeProgresso';

export interface PlayerDeVideoProps {
  video: Video;
  /** item visível e feed em foco; false = pré-carregado e pausado */
  tocando: boolean;
  /** o usuário pausou com um toque */
  pausado: boolean;
  mudo: boolean;
}

/**
 * Executa uma operação no player nativo ignorando falhas.
 * Na reciclagem da lista o player pode já ter sido liberado quando um efeito roda;
 * em produção um erro não tratado aqui derrubaria o app inteiro.
 */
function seguro(acao: () => void): void {
  try {
    acao();
  } catch {
    // player liberado ou em estado inválido: nada a fazer
  }
}

/**
 * Player de um item do feed. Só é montado para o item ativo e o próximo,
 * para limitar o número de players nativos simultâneos.
 * Inclui a barra de progresso arrastável e o ícone de "pausado".
 */
export function PlayerDeVideo({ video, tocando, pausado, mudo }: PlayerDeVideoProps) {
  const player = useVideoPlayer({ uri: video.url }, (p) => {
    p.loop = true;
    p.muted = mudo;
    // sem eventos de tempo até o item ficar ativo (economiza CPU nos pré-carregados)
    p.timeUpdateEventInterval = 0;
  });
  const [arrastando, setArrastando] = useState(false);
  // posição atual em segundos: shared value para a barra animar sem re-renderizar o item
  const posicao = useSharedValue(0);

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!arrastando) posicao.set(currentTime);
  });

  // O player é um objeto nativo compartilhado: mutá-lo aqui é o uso esperado do expo-video.
  // Ao virar o item ativo, recomeça do início e liga os eventos de tempo.
  useEffect(() => {
    seguro(() => {
      player.timeUpdateEventInterval = tocando ? 0.25 : 0;
      if (tocando) {
        player.currentTime = 0;
        posicao.set(0);
      }
    });
  }, [tocando, player, posicao]);

  // Toca só quando visível, não pausado pelo usuário e sem arrasto na barra.
  useEffect(() => {
    seguro(() => {
      if (tocando && !pausado && !arrastando) player.play();
      else player.pause();
    });
  }, [tocando, pausado, arrastando, player]);

  useEffect(() => {
    seguro(() => {
      player.muted = mudo;
    });
  }, [mudo, player]);

  const duracao = duracaoDe(player, video);

  const buscar = useCallback(
    (fracao: number) => {
      seguro(() => {
        player.currentTime = fracao * duracao;
      });
      posicao.set(fracao * duracao);
    },
    [player, duracao, posicao],
  );
  const comecarArrasto = useCallback(() => setArrastando(true), []);
  const terminarArrasto = useCallback(() => setArrastando(false), []);

  const retrato = (video.altura ?? 0) > (video.largura ?? 0);
  const carregando = tocando && !pausado && !arrastando && !isPlaying && status !== 'error';

  return (
    <View style={estilos.container} testID={`player-${video.id}`}>
      {video.thumbnailUrl ? (
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit={retrato ? 'cover' : 'contain'}
          cachePolicy="memory-disk"
        />
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={retrato ? 'cover' : 'contain'}
        nativeControls={false}
        allowsPictureInPicture={false}
        fullscreenOptions={{ enable: false }}
      />
      {carregando ? (
        <View style={estilos.centro} pointerEvents="none">
          <ActivityIndicator color={cores.branco} />
        </View>
      ) : null}
      {pausado && tocando ? (
        <View style={estilos.centro} pointerEvents="none" testID={`pausado-${video.id}`}>
          <View style={estilos.seloPausa}>
            <Icone nome="play" tamanho={34} cor={cores.branco} />
          </View>
        </View>
      ) : null}
      {tocando ? (
        <BarraDeProgresso
          posicao={posicao}
          duracao={duracao}
          aoBuscar={buscar}
          aoComecarArrasto={comecarArrasto}
          aoTerminarArrasto={terminarArrasto}
        />
      ) : null}
    </View>
  );
}

/** Duração conhecida pelo player nativo ou, enquanto não carrega, a informada pelo vídeo. */
function duracaoDe(player: VideoPlayer, video: Video): number {
  try {
    return player.duration > 0 ? player.duration : video.duracao;
  } catch {
    return video.duracao;
  }
}

const ABSOLUTO = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const estilos = StyleSheet.create({
  container: { ...ABSOLUTO, backgroundColor: cores.pretoPuro },
  centro: { ...ABSOLUTO, alignItems: 'center', justifyContent: 'center' },
  seloPausa: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6,
  },
});
