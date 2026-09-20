import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';

import { Icone, type NomeDeIcone } from './Icone';
import { Texto } from './Texto';

export interface TituloDeSecaoProps {
  titulo: string;
  subtitulo?: string;
  icone?: NomeDeIcone;
  direita?: ReactNode;
  semMargem?: boolean;
}

/** Título de seção com barra vermelha à esquerda, ícone opcional e legenda. */
export function TituloDeSecao({
  titulo,
  subtitulo,
  icone,
  direita,
  semMargem,
}: TituloDeSecaoProps) {
  return (
    <View style={[estilos.linha, !semMargem && estilos.margem]}>
      <View style={estilos.barra} />
      {icone ? <Icone nome={icone} tamanho={18} cor={cores.vermelhoVivo} /> : null}
      <View style={estilos.textos}>
        <Texto variante="destaque">{titulo}</Texto>
        {subtitulo ? (
          <Texto variante="legenda" cor={cores.textoSecundario}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      {direita}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  margem: { paddingHorizontal: espacos.lg },
  barra: { width: 3, height: 18, borderRadius: 2, backgroundColor: cores.vermelho },
  textos: { flex: 1 },
});
