import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConteudoDePerfil } from '@/components/perfil/ConteudoDePerfil';
import { Cabecalho, Carregando, Erro } from '@/components/ui';
import { usePerfil } from '@/hooks/usePerfil';
import { useVoltar } from '@/hooks/useVoltar';
import { cores } from '@/theme';

/** Perfil de outro torcedor. */
export default function TelaUsuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const voltar = useVoltar('/(tabs)');
  const insets = useSafeAreaInsets();
  const perfil = usePerfil(id);

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho titulo={perfil.data ? `@${perfil.data.apelido}` : 'Perfil'} aoVoltar={voltar} />
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
});
