import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';

export interface GrupoDeAjustesProps {
  titulo?: string;
  /** frase curta abaixo do cartão, explicando o que o grupo faz */
  rodape?: string;
  children: ReactNode;
}

/** Cartão de uma seção de configurações, com os separadores entre as linhas. */
export function GrupoDeAjustes({ titulo, rodape, children }: GrupoDeAjustesProps) {
  const linhas = Children.toArray(children).filter(Boolean);
  return (
    <View style={estilos.grupo}>
      {titulo ? (
        <Texto variante="rotulo" cor={cores.textoTerciario} style={estilos.titulo}>
          {titulo}
        </Texto>
      ) : null}
      <View style={estilos.cartao}>
        {linhas.map((linha, i) => (
          <View key={i}>
            {i > 0 ? <View style={estilos.separador} /> : null}
            {linha}
          </View>
        ))}
      </View>
      {rodape ? (
        <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.rodape}>
          {rodape}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espacos.sm },
  titulo: { paddingHorizontal: espacos.xs },
  cartao: {
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raios.md,
    overflow: 'hidden',
  },
  separador: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: cores.borda,
    marginLeft: espacos.md + 34 + espacos.md,
  },
  rodape: { paddingHorizontal: espacos.xs },
});
