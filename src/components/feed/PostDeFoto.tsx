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

import { GEOMETRIA_BARRA } from './BarraDeProgresso';

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

  // marcador deslizando, igual ao vídeo: nada de faixa branca enchendo
  const estiloMarcador = useAnimatedStyle(() => ({
    left: `${progresso.value * 100}%`,
    transform: [{ translateX: -DIAMETRO_MARCADOR / 2 }],
  }));

  return (
    <View style={estilos.container} testID={`foto-${video.id}`}>
      <Image
        source={{ uri: video.url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
      <View style={estilos.faixa} pointerEvents="none">
        <View style={estilos.trilha} />
        <Animated.View style={[estilos.marcador, estiloMarcador]} />
      </View>
    </View>
  );
}

const ABSOLUTO = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const DIAMETRO_MARCADOR = 11;

const estilos = StyleSheet.create({
  container: { ...ABSOLUTO, backgroundColor: cores.pretoPuro },
  // mesma geometria da barra do vídeo: o progresso mora sempre na mesma altura
  faixa: {
    position: 'absolute',
    left: GEOMETRIA_BARRA.margemLateral,
    right: GEOMETRIA_BARRA.margemLateral,
    bottom: GEOMETRIA_BARRA.margemInferior,
    height: GEOMETRIA_BARRA.alturaToque,
    justifyContent: 'center',
  },
  trilha: {
    width: '100%',
    height: GEOMETRIA_BARRA.alturaLinha,
    borderRadius: GEOMETRIA_BARRA.alturaLinha / 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  marcador: {
    position: 'absolute',
    top: '50%',
    marginTop: -DIAMETRO_MARCADOR / 2,
    width: DIAMETRO_MARCADOR,
    height: DIAMETRO_MARCADOR,
    borderRadius: DIAMETRO_MARCADOR / 2,
    backgroundColor: cores.branco,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.45)',
  },
});
