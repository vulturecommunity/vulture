import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import type { NovaMidia } from '@/services/data/types';
import { cores, espacos, raios } from '@/theme';
import { formatarDuracao } from '@/utils/formatadores';

export interface PreviaDeAnexosProps {
  anexos: NovaMidia[];
  aoRemover: (indice: number) => void;
  /** menor na caixa de resposta */
  compacta?: boolean;
}

/** Miniaturas do que vai junto com o post, cada uma com o "x" para tirar. */
export function PreviaDeAnexos({ anexos, aoRemover, compacta = false }: PreviaDeAnexosProps) {
  if (anexos.length === 0) return null;
  const lado = compacta ? 64 : 96;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.lista}
      testID="previa-anexos">
      {anexos.map((anexo, i) => (
        <View
          key={anexo.tipo === 'gif' ? anexo.url : anexo.uriLocal}
          style={[estilos.item, { width: lado, height: lado }]}>
          {anexo.tipo === 'video' ? (
            <View style={estilos.video}>
              <Icone nome="play" tamanho={22} cor={cores.branco} />
              <Texto variante="legenda" cor={cores.branco}>
                {formatarDuracao(anexo.duracao)}
              </Texto>
            </View>
          ) : (
            <Image
              source={{ uri: anexo.tipo === 'gif' ? anexo.url : anexo.uriLocal }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          {anexo.tipo === 'gif' ? (
            <View style={estilos.selo}>
              <Texto variante="legenda" cor={cores.branco}>
                GIF
              </Texto>
            </View>
          ) : null}
          <Pressable
            onPress={() => aoRemover(i)}
            hitSlop={8}
            style={estilos.remover}
            accessibilityRole="button"
            accessibilityLabel="Remover anexo"
            testID={`remover-anexo-${i}`}>
            <Icone nome="fechar" tamanho={14} cor={cores.branco} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espacos.sm, paddingVertical: espacos.xs },
  item: {
    borderRadius: raios.md,
    overflow: 'hidden',
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  video: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: cores.pretoPuro,
  },
  selo: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 4,
    borderRadius: 3,
    backgroundColor: cores.overlayEscuro,
  },
  remover: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: cores.overlayEscuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
