import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';

import { Texto } from './Texto';

const ICONES = {
  sucesso: 'checkmark-circle',
  erro: 'alert-circle',
  info: 'information-circle',
} as const;
const CORES = { sucesso: cores.sucesso, erro: cores.erro, info: cores.vermelho } as const;

/** Toast global (uiStore.mostrarAviso). Some sozinho depois de 3 segundos. */
export function Aviso() {
  const aviso = useUiStore((s) => s.aviso);
  const limpar = useUiStore((s) => s.limparAviso);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!aviso) return;
    const timer = setTimeout(limpar, 3200);
    return () => clearTimeout(timer);
  }, [aviso, limpar]);

  if (!aviso) return null;
  return (
    <Animated.View
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[estilos.container, { top: insets.top + espacos.sm }]}
      pointerEvents="box-none">
      <Pressable onPress={limpar} style={estilos.caixa} testID="aviso">
        <Ionicons name={ICONES[aviso.tipo]} size={20} color={CORES[aviso.tipo]} />
        <Texto variante="pequeno" style={estilos.texto}>
          {aviso.texto}
        </Texto>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    maxWidth: '90%',
    backgroundColor: cores.fundoCartao,
    borderRadius: raios.lg,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  texto: { flexShrink: 1 },
});
