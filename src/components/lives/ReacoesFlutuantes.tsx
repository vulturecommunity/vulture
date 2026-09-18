import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { ReacaoFlutuante } from '@/hooks/useLive';

function Reacao({ emoji, deslocamento }: { emoji: string; deslocamento: number }) {
  const progresso = useSharedValue(0);

  useEffect(() => {
    progresso.value = withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) });
  }, [progresso]);

  const estilo = useAnimatedStyle(() => ({
    opacity: 1 - progresso.value,
    transform: [
      { translateY: -progresso.value * 260 },
      { translateX: Math.sin(progresso.value * Math.PI * 2) * 18 + deslocamento },
      { scale: 0.8 + progresso.value * 0.6 },
    ],
  }));

  return (
    <Animated.Text style={[estilos.emoji, estilo]} accessibilityElementsHidden>
      {emoji}
    </Animated.Text>
  );
}

/** Corações/reações temáticas que sobem e somem, no canto inferior direito da live. */
export function ReacoesFlutuantes({ reacoes }: { reacoes: ReacaoFlutuante[] }) {
  return (
    <View style={estilos.area} pointerEvents="none" testID="reacoes-flutuantes">
      {reacoes.map((r, i) => (
        <Reacao key={r.id} emoji={r.emoji} deslocamento={((i * 37) % 40) - 20} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { position: 'absolute', right: 24, bottom: 120, width: 80, height: 320 },
  emoji: { position: 'absolute', bottom: 0, right: 20, fontSize: 30 },
});
