import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icone } from '@/components/ui';
import { cores } from '@/theme';

export interface CoracaoAnimadoProps {
  /** muda a cada duplo toque para disparar a animação */
  disparo: number;
  x: number;
  y: number;
  aoTerminar?: () => void;
}

const TAMANHO = 92;

/** Selo vermelho com coração branco e um anel que se expande, no ponto do duplo toque. */
export function CoracaoAnimado({ disparo, x, y, aoTerminar }: CoracaoAnimadoProps) {
  const escala = useSharedValue(0);
  const opacidade = useSharedValue(0);
  const anel = useSharedValue(0);

  useEffect(() => {
    if (disparo === 0) return;
    opacidade.value = 1;
    escala.value = 0;
    anel.value = 0;
    escala.value = withSequence(withSpring(1.05, { damping: 9 }), withTiming(1, { duration: 80 }));
    anel.value = withTiming(1, { duration: 600 });
    opacidade.value = withDelay(
      520,
      withTiming(0, { duration: 220 }, (fim) => {
        if (fim && aoTerminar) runOnJS(aoTerminar)();
      }),
    );
  }, [disparo, escala, opacidade, anel, aoTerminar]);

  const estiloSelo = useAnimatedStyle(() => ({
    opacity: opacidade.value,
    transform: [{ scale: escala.value }],
  }));
  const estiloAnel = useAnimatedStyle(() => ({
    opacity: (1 - anel.value) * opacidade.value,
    transform: [{ scale: 0.9 + anel.value * 0.9 }],
  }));

  if (disparo === 0) return null;
  return (
    <View
      pointerEvents="none"
      style={[estilos.area, { left: x - TAMANHO / 2, top: y - TAMANHO / 2 }]}>
      <Animated.View style={[estilos.anel, estiloAnel]} />
      <Animated.View style={[estilos.selo, estiloSelo]}>
        <Icone nome="curtido" tamanho={44} cor={cores.branco} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: {
    position: 'absolute',
    width: TAMANHO,
    height: TAMANHO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selo: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  anel: {
    position: 'absolute',
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    borderWidth: 2,
    borderColor: cores.vermelhoVivo,
  },
});
