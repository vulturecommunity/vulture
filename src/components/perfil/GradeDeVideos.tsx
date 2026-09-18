import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Texto } from '@/components/ui';
import type { OrigemDaLista } from '@/hooks/useListasDeVideos';
import { cores, espacos } from '@/theme';
import type { Video } from '@/types';
import { formatarContador } from '@/utils/formatadores';

export interface GradeDeVideosProps {
  videos: Video[];
  origem: OrigemDaLista;
  usuarioId?: string;
  colunas?: number;
}

/** Grade de miniaturas (3 colunas). Toque abre o vídeo em tela cheia, continuando pela mesma lista. */
export function GradeDeVideos({ videos, origem, usuarioId, colunas = 3 }: GradeDeVideosProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const espaco = 2;
  const lado = (width - espaco * (colunas - 1)) / colunas;

  return (
    <View style={estilos.grade} testID={`grade-${origem}`}>
      {videos.map((video) => (
        <Pressable
          key={video.id}
          onPress={() =>
            router.push({
              pathname: '/video/[id]',
              params: { id: video.id, origem, usuarioId: usuarioId ?? '' },
            })
          }
          style={[estilos.celula, { width: lado, height: lado * 1.5 }]}
          accessibilityRole="imagebutton"
          accessibilityLabel={video.legenda || 'Vídeo'}
          testID={`celula-${video.id}`}>
          {video.thumbnailUrl ? (
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, estilos.semMiniatura]}>
              <Ionicons
                name={video.tipo === 'foto' ? 'image-outline' : 'videocam-outline'}
                size={28}
                color={cores.textoTerciario}
              />
            </View>
          )}
          <View style={estilos.rodape}>
            <Ionicons name="play" size={12} color={cores.branco} />
            <Texto variante="legenda">{formatarContador(video.visualizacoes)}</Texto>
          </View>
          {video.tipo === 'foto' ? (
            <View style={estilos.etiquetaFoto}>
              <Ionicons name="image" size={12} color={cores.branco} />
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  celula: { backgroundColor: cores.fundoCartao, overflow: 'hidden' },
  semMiniatura: { alignItems: 'center', justifyContent: 'center' },
  rodape: {
    position: 'absolute',
    left: espacos.xs,
    bottom: espacos.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  etiquetaFoto: { position: 'absolute', right: espacos.xs, top: espacos.xs },
});
