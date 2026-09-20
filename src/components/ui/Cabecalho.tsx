import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';

import { Icone } from './Icone';
import { Texto } from './Texto';

export interface CabecalhoProps {
  titulo: string;
  subtitulo?: string;
  aoVoltar?: () => void;
  direita?: ReactNode;
  /** sobre vídeo/câmera: fundo transparente e texto com sombra */
  sobreposto?: boolean;
  rotuloVoltar?: string;
  testID?: string;
}

/** Cabeçalho padrão das telas internas: botão circular de voltar, título alinhado à esquerda e ação à direita. */
export function Cabecalho({
  titulo,
  subtitulo,
  aoVoltar,
  direita,
  sobreposto = false,
  rotuloVoltar = 'Voltar',
  testID,
}: CabecalhoProps) {
  return (
    <View style={[estilos.barra, sobreposto && estilos.sobreposto]} testID={testID}>
      {aoVoltar ? (
        <Pressable
          onPress={aoVoltar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={rotuloVoltar}
          style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}>
          <Icone nome="voltar" tamanho={20} cor={cores.texto} />
        </Pressable>
      ) : null}
      <View style={estilos.textos}>
        <Texto variante="destaque" numberOfLines={1} style={sobreposto && estilos.sombra}>
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      {direita ? <View style={estilos.direita}>{direita}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
    minHeight: 52,
  },
  sobreposto: { backgroundColor: cores.transparente },
  botao: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.vidroClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.7 },
  textos: { flex: 1 },
  direita: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  sombra: { textShadowColor: cores.sombra, textShadowRadius: 6 },
});
