import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { cores } from '@/theme';
import type { Video } from '@/types';

export interface PostDeFotoProps {
  video: Video;
}

/**
 * Post estático (foto): só a imagem. Sem barra de progresso — nada corre,
 * então uma barra ali só confundiria com carregamento.
 */
export function PostDeFoto({ video }: PostDeFotoProps) {
  return (
    <View style={estilos.container} testID={`foto-${video.id}`}>
      <Image
        source={{ uri: video.url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cores.pretoPuro,
  },
});
