import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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
 * Player de um item do feed. Só é montado para o item ativo e seus vizinhos,
 * para limitar o número de players nativos simultâneos.
 * Inclui a barra de progresso arrastável e o ícone de "pausado".
 */
export function PlayerDeVideo({ video, tocando, pausado, mudo }: PlayerDeVideoProps) {
  const player = useVideoPlayer({ uri: video.url }, (p) => {
    p.loop = true;
    p.muted = mudo;
    p.timeUpdateEventInterval = 0.25;
  });
  const [arrastando, setArrastando] = useState(false);

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  // O player é um objeto nativo compartilhado: mutá-lo aqui é o uso esperado do expo-video.
  // Ao virar o item ativo, recomeça do início.
  useEffect(() => {
    if (tocando) {
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = 0;
    }
  }, [tocando, player]);

  // Toca só quando visível, não pausado pelo usuário e sem arrasto na barra.
  useEffect(() => {
    if (tocando && !pausado && !arrastando) player.play();
    else player.pause();
  }, [tocando, pausado, arrastando, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = mudo;
  }, [mudo, player]);

  const duracao = player.duration > 0 ? player.duration : video.duracao;

  const buscar = useCallback(
    (fracao: number) => {
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = fracao * duracao;
    },
    [player, duracao],
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
          blurRadius={2}
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
          posicao={currentTime}
          duracao={duracao}
          aoBuscar={buscar}
          aoComecarArrasto={comecarArrasto}
          aoTerminarArrasto={terminarArrasto}
        />
      ) : null}
    </View>
  );
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
