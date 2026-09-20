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
          style={({ pressed }) => [estilos.canal, pressed && estilos.pressionado]}
          accessibilityRole="button"
          testID={`canal-${canal}`}>
          <Texto variante="corpoForte">
            <Texto variante="corpoForte" cor={cores.vermelhoVivo}>
              #
            </Texto>
            {canal}
          </Texto>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  lista: { paddingHorizontal: espacos.lg, gap: espacos.sm },
  canal: {
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm + 2,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pressionado: { borderColor: cores.vermelho },
});
