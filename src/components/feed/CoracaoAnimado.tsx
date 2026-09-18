import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { cores } from '@/theme';

export interface CoracaoAnimadoProps {
  /** muda a cada duplo toque para disparar a animação */
  disparo: number;
  x: number;
  y: number;
  aoTerminar?: () => void;
}

/** Coração grande que aparece no ponto do duplo toque e some. */
export function CoracaoAnimado({ disparo, x, y, aoTerminar }: CoracaoAnimadoProps) {
  const escala = useSharedValue(0);
  const opacidade = useSharedValue(0);

  useEffect(() => {
    if (disparo === 0) return;
    opacidade.value = 1;
    escala.value = 0;
    escala.value = withSequence(withSpring(1.1, { damping: 8 }), withTiming(1, { duration: 80 }));
    opacidade.value = withDelay(
      550,
      withTiming(0, { duration: 250 }, (fim) => {
        if (fim && aoTerminar) runOnJS(aoTerminar)();
      }),
    );
  }, [disparo, escala, opacidade, aoTerminar]);

  const estilo = useAnimatedStyle(() => ({
    opacity: opacidade.value,
    transform: [{ scale: escala.value }, { rotate: '-8deg' }],
  }));

  if (disparo === 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[estilos.coracao, { left: x - 50, top: y - 50 }, estilo]}>
      <Ionicons name="heart" size={100} color={cores.vermelho} />
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  coracao: {
    position: 'absolute',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
