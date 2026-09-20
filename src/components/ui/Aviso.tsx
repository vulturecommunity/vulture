import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';

import { Icone, type NomeDeIcone } from './Icone';
import { Texto } from './Texto';

const ICONES: Record<'sucesso' | 'erro' | 'info', NomeDeIcone> = {
  sucesso: 'ok',
  erro: 'alerta',
  info: 'info',
};
const CORES = { sucesso: cores.sucesso, erro: cores.erro, info: cores.vermelhoVivo } as const;

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
        <View style={[estilos.barra, { backgroundColor: CORES[aviso.tipo] }]} />
        <Icone nome={ICONES[aviso.tipo]} tamanho={18} cor={CORES[aviso.tipo]} />
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
    borderRadius: raios.md,
    paddingRight: espacos.lg,
    paddingLeft: espacos.md,
    paddingVertical: espacos.md,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  barra: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  texto: { flexShrink: 1 },
});
