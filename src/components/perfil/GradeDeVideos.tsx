import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import type { OrigemDaLista } from '@/hooks/useListasDeVideos';
import { cores, espacos, raios } from '@/theme';
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
  const espaco = 3;
  const lado = (width - espacos.lg * 2 - espaco * (colunas - 1)) / colunas;

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
          style={[estilos.celula, { width: lado, height: lado * 1.45 }]}
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
              <Icone
                nome={video.tipo === 'foto' ? 'foto' : 'video'}
                tamanho={24}
                cor={cores.textoTerciario}
              />
            </View>
          )}
          <View style={estilos.rodape}>
            <Icone nome="olho" tamanho={11} cor={cores.branco} />
            <Texto variante="legenda">{formatarContador(video.visualizacoes)}</Texto>
          </View>
          {video.tipo === 'foto' ? (
            <View style={estilos.etiquetaFoto}>
              <Icone nome="foto" tamanho={11} cor={cores.branco} />
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, paddingHorizontal: espacos.lg },
  celula: {
    backgroundColor: cores.fundoCartao,
    overflow: 'hidden',
    borderRadius: raios.sm + 2,
  },
  semMiniatura: { alignItems: 'center', justifyContent: 'center' },
  rodape: {
    position: 'absolute',
    left: espacos.xs + 2,
    bottom: espacos.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: cores.vidro,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: raios.sm,
  },
  etiquetaFoto: {
    position: 'absolute',
    right: espacos.xs + 2,
    top: espacos.xs + 2,
    backgroundColor: cores.vidro,
    padding: 4,
    borderRadius: raios.sm,
  },
});
