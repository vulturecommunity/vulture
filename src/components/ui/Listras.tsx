import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { cores } from '@/theme';

export interface ListrasProps {
  altura?: number;
  faixas?: number;
  style?: StyleProp<ViewStyle>;
}

/** Faixa decorativa da identidade: listras diagonais em dois tons de vermelho. */
export function Listras({ altura = 6, faixas = 16, style }: ListrasProps) {
  return (
    <View style={[estilos.faixa, { height: altura }, style]} pointerEvents="none">
      {Array.from({ length: faixas }, (_, i) => (
        <View
          key={i}
          style={[
            estilos.listra,
            { backgroundColor: i % 2 ? cores.vermelhoEscuro : cores.vermelho },
          ]}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { flexDirection: 'row', overflow: 'hidden', borderRadius: 2 },
  listra: { flex: 1, transform: [{ skewX: '-24deg' }, { scaleX: 1.4 }] },
});
