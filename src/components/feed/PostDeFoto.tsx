import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { DURACAO_FOTO_SEGUNDOS } from '@/constants/interesses';
import { cores } from '@/theme';
import type { Video } from '@/types';

export interface PostDeFotoProps {
  video: Video;
  ativo: boolean;
}

/** Post estático (foto) com barra de progresso de 5 segundos, em loop enquanto visível. */
export function PostDeFoto({ video, ativo }: PostDeFotoProps) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    if (ativo) {
      progresso.value = 0;
      progresso.value = withRepeat(
        withTiming(1, { duration: DURACAO_FOTO_SEGUNDOS * 1000, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(progresso);
      progresso.value = 0;
    }
    return () => cancelAnimation(progresso);
  }, [ativo, progresso]);

  const estiloBarra = useAnimatedStyle(() => ({ width: `${progresso.value * 100}%` }));

  return (
    <View style={estilos.container} testID={`foto-${video.id}`}>
      <Image
        source={{ uri: video.url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      <View style={estilos.trilha}>
        <Animated.View style={[estilos.barra, estiloBarra]} />
      </View>
    </View>
  );
}

const ABSOLUTO = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const estilos = StyleSheet.create({
  container: { ...ABSOLUTO, backgroundColor: cores.pretoPuro },
  trilha: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  barra: { height: 3, backgroundColor: cores.vermelho },
});
