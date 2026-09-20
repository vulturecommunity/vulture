import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icone } from '@/components/ui';
import { cores } from '@/theme';

/** Botão central da barra de abas: círculo vermelho elevado que abre a câmera como modal. */
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
      {({ pressed }) => (
        <View style={[estilos.aro, pressed && estilos.pressionado]}>
          <View style={estilos.botao}>
            <Icone nome="gravar" tamanho={22} cor={cores.branco} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  aro: {
    marginTop: -26,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: cores.vermelho,
  },
  botao: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: cores.vermelhoVivo,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressionado: { transform: [{ scale: 0.94 }] },
});
