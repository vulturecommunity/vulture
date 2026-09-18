import { StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { cores } from '@/theme';

export default function TelaFeed() {
  return (
    <View style={estilos.container}>
      <Texto variante="titulo">Feed</Texto>
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
