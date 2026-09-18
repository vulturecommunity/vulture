import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { cores } from '@/theme';

/** Botão central "+" da barra de abas: abre a câmera como modal. */
export function BotaoGravar() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gravar"
      testID="botao-gravar"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        router.push('/criar/camera');
      }}
      style={estilos.area}>
      <View style={estilos.fundoEsquerdo} />
      <View style={estilos.fundoDireito} />
      <View style={estilos.botao}>
        <Ionicons name="add" size={26} color={cores.preto} />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  botao: {
    width: 46,
    height: 32,
    borderRadius: 10,
    backgroundColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundoEsquerdo: {
    position: 'absolute',
    width: 46,
    height: 32,
    borderRadius: 10,
    backgroundColor: cores.vermelho,
    transform: [{ translateX: -3 }],
  },
  fundoDireito: {
    position: 'absolute',
    width: 46,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#3AA0FF',
    transform: [{ translateX: 3 }],
  },
});
