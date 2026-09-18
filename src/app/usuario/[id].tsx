import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConteudoDePerfil } from '@/components/perfil/ConteudoDePerfil';
import { Carregando, Erro, Texto } from '@/components/ui';
import { usePerfil } from '@/hooks/usePerfil';
import { cores, espacos } from '@/theme';

/** Perfil de outro torcedor. */
export default function TelaUsuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const perfil = usePerfil(id);

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <View style={estilos.topo}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Voltar"
          style={estilos.lado}>
          <Ionicons name="arrow-back" size={26} color={cores.texto} />
        </Pressable>
        <Texto variante="destaque" numberOfLines={1}>
          {perfil.data ? `@${perfil.data.apelido}` : 'Perfil'}
        </Texto>
        <View style={estilos.lado} />
      </View>
      {perfil.isLoading ? (
        <Carregando />
      ) : perfil.isError ? (
        <Erro erro={perfil.error} aoTentarNovamente={() => perfil.refetch()} />
      ) : perfil.data ? (
        <ConteudoDePerfil
          perfil={perfil.data}
          atualizando={perfil.isRefetching}
          aoAtualizar={() => perfil.refetch()}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
  },
  lado: { width: 32 },
});
