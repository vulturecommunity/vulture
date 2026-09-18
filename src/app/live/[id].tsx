import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { cores } from '@/theme';

export default function TelaId() {
  return (
    <View style={estilos.container}>
      <Texto variante="titulo">live/[id]</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundo,
  },
});
