import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Texto } from '@/components/ui';
import { CANAIS } from '@/constants/interesses';
import { cores, espacos, raios } from '@/theme';

/** Barra horizontal de canais temáticos (#Maracanã #Bastidores #Golaço #Torcida #Base #Resenha). */
export function BarraDeCanais() {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.lista}
      testID="barra-canais">
      {CANAIS.map((canal) => (
        <Pressable
          key={canal}
          onPress={() => router.push({ pathname: '/hashtag/[tag]', params: { tag: canal } })}
          style={estilos.canal}
          accessibilityRole="button"
          testID={`canal-${canal}`}>
          <Texto variante="corpoForte">#{canal}</Texto>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  lista: { paddingHorizontal: espacos.lg, gap: espacos.sm },
  canal: {
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
    borderRadius: raios.redondo,
    backgroundColor: cores.vermelho,
  },
});
