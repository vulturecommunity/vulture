import { StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';

import { Botao } from './Botao';
import { Icone, type NomeDeIcone } from './Icone';
import { Texto } from './Texto';

export interface EstadoVazioProps {
  icone?: NomeDeIcone;
  titulo: string;
  descricao?: string;
  acao?: { titulo: string; aoPressionar: () => void };
}

/** Estado vazio padrão para listas e telas sem conteúdo. */
export function EstadoVazio({ icone = 'filme', titulo, descricao, acao }: EstadoVazioProps) {
  return (
    <View style={estilos.container}>
      <View style={estilos.circulo}>
        <Icone nome={icone} tamanho={28} cor={cores.textoSecundario} />
      </View>
      <Texto variante="destaque" centralizado>
        {titulo}
      </Texto>
      {descricao ? (
        <Texto variante="corpo" cor={cores.textoSecundario} centralizado style={estilos.descricao}>
          {descricao}
        </Texto>
      ) : null}
      {acao ? (
        <Botao
          titulo={acao.titulo}
          onPress={acao.aoPressionar}
          variante="contorno"
          style={estilos.botao}
        />
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
  circulo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacos.xs,
  },
  descricao: { maxWidth: 300 },
  botao: { marginTop: espacos.xs },
});
