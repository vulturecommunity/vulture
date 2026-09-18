import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';

import { Botao } from './Botao';
import { Texto } from './Texto';

export interface EstadoVazioProps {
  icone?: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descricao?: string;
  acao?: { titulo: string; aoPressionar: () => void };
}

/** Estado vazio padrão para listas e telas sem conteúdo. */
export function EstadoVazio({ icone = 'film-outline', titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <View style={estilos.container}>
      <Ionicons name={icone} size={48} color={cores.textoTerciario} />
      <Texto variante="destaque" centralizado>
        {titulo}
      </Texto>
      {descricao ? (
        <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
          {descricao}
        </Texto>
      ) : null}
      {acao ? (
        <Botao titulo={acao.titulo} onPress={acao.aoPressionar} variante="secundario" />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.md,
    padding: espacos.xl,
  },
});
