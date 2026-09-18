import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Carregando, EstadoVazio, Texto } from '@/components/ui';
import { useBloqueados, useDesbloquear } from '@/hooks/usePerfil';
import { cores, espacos } from '@/theme';

/** Lista de contas bloqueadas, com opção de desbloquear. */
export default function TelaBloqueados() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bloqueados = useBloqueados();
  const desbloquear = useDesbloquear();

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
        <Texto variante="destaque">Contas bloqueadas</Texto>
        <View style={estilos.lado} />
      </View>
      {bloqueados.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          data={bloqueados.data ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ flexGrow: 1 }}
          ListEmptyComponent={
            <EstadoVazio
              icone="shield-checkmark-outline"
              titulo="Nenhuma conta bloqueada"
              descricao="Quem você bloquear aparece aqui."
            />
          }
          renderItem={({ item }) => (
            <View style={estilos.linha}>
              <Avatar url={item.avatarUrl} nome={item.nome} tamanho={44} />
              <View style={{ flex: 1 }}>
                <Texto variante="corpoForte">@{item.apelido}</Texto>
                <Texto variante="pequeno" cor={cores.textoSecundario}>
                  {item.nome}
                </Texto>
              </View>
              <Botao
                titulo="Desbloquear"
                variante="secundario"
                tamanho="pequeno"
                onPress={() => desbloquear.mutate(item.id)}
                carregando={desbloquear.isPending}
              />
            </View>
          )}
        />
      )}
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
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
  },
});
