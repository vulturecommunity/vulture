import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { cores } from '@/theme';
import type { Video } from '@/types';

export interface PlayerDeVideoProps {
  video: Video;
  /** toca quando true; pausado (pré-carregado) quando false */
  tocando: boolean;
  mudo: boolean;
}

/**
 * Player de um item do feed. Só é montado para o item ativo e seus vizinhos,
 * para limitar o número de players nativos simultâneos.
 */
export function PlayerDeVideo({ video, tocando, mudo }: PlayerDeVideoProps) {
  const player = useVideoPlayer({ uri: video.url }, (p) => {
    p.loop = true;
    p.muted = mudo;
    p.timeUpdateEventInterval = 0;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // O player é um objeto nativo compartilhado: mutá-lo aqui é o uso esperado do expo-video.
  useEffect(() => {
    if (tocando) {
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = 0;
      player.play();
    } else {
      player.pause();
    }
  }, [tocando, player]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    player.muted = mudo;
  }, [mudo, player]);

  const retrato = (video.altura ?? 0) > (video.largura ?? 0);
  const carregando = tocando && !isPlaying && status !== 'error';

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
    </View>
  );
}

const ABSOLUTO = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const estilos = StyleSheet.create({
  container: { ...ABSOLUTO, backgroundColor: cores.pretoPuro },
  centro: { ...ABSOLUTO, alignItems: 'center', justifyContent: 'center' },
});
