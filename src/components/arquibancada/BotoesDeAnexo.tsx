import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Icone } from '@/components/ui';
import { giphyDisponivel } from '@/services/gifs/giphy';
import { cores, espacos } from '@/theme';

export interface BotoesDeAnexoProps {
  podeAdicionar: boolean;
  podeGif: boolean;
  preparando: boolean;
  aoGaleria: () => void;
  aoGif: () => void;
}

/** Galeria (fotos e vídeo) e GIF. O GIF só aparece com a chave do GIPHY configurada. */
export function BotoesDeAnexo({
  podeAdicionar,
  podeGif,
  preparando,
  aoGaleria,
  aoGif,
}: BotoesDeAnexoProps) {
  return (
    <View style={estilos.linha}>
      {preparando ? (
        <ActivityIndicator color={cores.vermelho} style={estilos.botao} />
      ) : (
        <Pressable
          onPress={aoGaleria}
          disabled={!podeAdicionar}
          hitSlop={6}
          style={[estilos.botao, !podeAdicionar && estilos.inativo]}
          accessibilityRole="button"
          accessibilityLabel="Anexar foto ou vídeo"
          testID="anexar-galeria">
          <Icone nome="galeria" tamanho={21} cor={cores.vermelhoVivo} />
        </Pressable>
      )}
      {giphyDisponivel() ? (
        <Pressable
          onPress={aoGif}
          disabled={!podeGif}
          hitSlop={6}
          style={[estilos.botao, !podeGif && estilos.inativo]}
          accessibilityRole="button"
          accessibilityLabel="Anexar GIF"
          testID="anexar-gif">
          <Icone nome="gif" tamanho={24} cor={cores.vermelhoVivo} />
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  botao: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  inativo: { opacity: 0.35 },
});
