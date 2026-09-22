import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Icone, Texto } from '@/components/ui';
import { cores, espacos } from '@/theme';
import { formatarContador } from '@/utils/formatadores';

export interface BotaoCurtirProps {
  curtido: boolean;
  total: number;
  aoPressionar: () => void;
  tamanho?: number;
}

/** Curtir da barra de ações: coração branco quando neutro, vermelho e com pulo quando curtido. */
export function BotaoCurtir({ curtido, total, aoPressionar, tamanho = 24 }: BotaoCurtirProps) {
  const escala = useSharedValue(1);

  useEffect(() => {
    if (curtido) escala.value = withSequence(withSpring(1.3, { damping: 6 }), withSpring(1));
  }, [curtido, escala]);

  const estiloAnimado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={10}
      style={({ pressed }) => [estilos.acao, pressed && estilos.pressionado]}
      accessibilityRole="button"
      accessibilityLabel={curtido ? 'Descurtir' : 'Curtir'}
      accessibilityState={{ selected: curtido }}
      testID="botao-curtir">
      <Animated.View style={estiloAnimado}>
        <Icone
          nome={curtido ? 'curtido' : 'curtir'}
          tamanho={tamanho}
          cor={curtido ? cores.vermelhoVivo : cores.branco}
          style={estilos.sombraIcone}
        />
      </Animated.View>
      <Texto variante="legenda" cor={cores.branco} style={estilos.contador} testID="total-curtidas">
        {formatarContador(total)}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  acao: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs + 2 },
  pressionado: { opacity: 0.6 },
  sombraIcone: { textShadowColor: cores.sombra, textShadowRadius: 6 },
  contador: { textShadowColor: cores.sombra, textShadowRadius: 5 },
});
