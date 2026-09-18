import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { cores } from '@/theme';

export default function TelaIniciar() {
  return (
    <View style={estilos.container}>
      <Texto variante="titulo">live/iniciar</Texto>
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
