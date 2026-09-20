import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Icone, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
import { formatarContador } from '@/utils/formatadores';

export interface BotaoCurtirProps {
  curtido: boolean;
  total: number;
  aoPressionar: () => void;
  tamanho?: number;
}

/** Pílula de curtir da barra de ações: contorno quando neutro, preenchida em vermelho quando curtido. */
export function BotaoCurtir({ curtido, total, aoPressionar, tamanho = 20 }: BotaoCurtirProps) {
  const escala = useSharedValue(1);

  useEffect(() => {
    if (curtido) escala.value = withSequence(withSpring(1.3, { damping: 6 }), withSpring(1));
  }, [curtido, escala]);

  const estiloAnimado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={6}
      style={({ pressed }) => [
        estilos.pilula,
        curtido && estilos.curtido,
        pressed && estilos.pressionado,
      ]}
      accessibilityRole="button"
      accessibilityLabel={curtido ? 'Descurtir' : 'Curtir'}
      accessibilityState={{ selected: curtido }}
      testID="botao-curtir">
      <Animated.View style={estiloAnimado}>
        <Icone nome={curtido ? 'curtido' : 'curtir'} tamanho={tamanho} cor={cores.branco} />
      </Animated.View>
      <Texto variante="legenda" testID="total-curtidas">
        {formatarContador(total)}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    height: 38,
    paddingHorizontal: espacos.md,
    borderRadius: raios.redondo,
    backgroundColor: cores.vidroClaro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
  },
  curtido: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  pressionado: { opacity: 0.8 },
});
