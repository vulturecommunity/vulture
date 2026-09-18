import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Texto } from '@/components/ui';
import { cores, espacos } from '@/theme';
import { formatarContador } from '@/utils/formatadores';

export interface BotaoCurtirProps {
  curtido: boolean;
  total: number;
  aoPressionar: () => void;
  tamanho?: number;
}

/** Coração das ações laterais, com "pulo" animado ao curtir. */
export function BotaoCurtir({ curtido, total, aoPressionar, tamanho = 34 }: BotaoCurtirProps) {
  const escala = useSharedValue(1);

  useEffect(() => {
    if (curtido) escala.value = withSequence(withSpring(1.35, { damping: 6 }), withSpring(1));
  }, [curtido, escala]);

  const estiloAnimado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={8}
      style={estilos.botao}
      accessibilityRole="button"
      accessibilityLabel={curtido ? 'Descurtir' : 'Curtir'}
      accessibilityState={{ selected: curtido }}
      testID="botao-curtir">
      <Animated.View style={estiloAnimado}>
        <Ionicons name="heart" size={tamanho} color={curtido ? cores.vermelho : cores.branco} />
      </Animated.View>
      <Texto variante="legenda" style={estilos.contador} testID="total-curtidas">
        {formatarContador(total)}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: { alignItems: 'center', gap: espacos.xxs },
  contador: { textShadowColor: cores.sombra, textShadowRadius: 4 },
});
