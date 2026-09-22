import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Cabecalho, Carregando, EstadoVazio, Texto } from '@/components/ui';
import { useBloqueados, useDesbloquear } from '@/hooks/usePerfil';
import { useVoltar } from '@/hooks/useVoltar';
import { cores, espacos, raios } from '@/theme';

/** Lista de contas bloqueadas, com opção de desbloquear. */
export default function TelaBloqueados() {
  const voltar = useVoltar('/(tabs)/perfil');
  const insets = useSafeAreaInsets();
  const bloqueados = useBloqueados();
  const desbloquear = useDesbloquear();

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho titulo="Contas bloqueadas" aoVoltar={voltar} />
      {bloqueados.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          data={bloqueados.data ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={estilos.lista}
          ListEmptyComponent={
            <EstadoVazio
              icone="escudoOk"
              titulo="Nenhuma conta bloqueada"
              descricao="Quem você bloquear aparece aqui."
            />
          }
          renderItem={({ item }) => (
            <View style={estilos.linha}>
              <Avatar url={item.avatarUrl} nome={item.nome} tamanho={44} />
              <View style={estilos.flex}>
                <Texto variante="corpoForte">@{item.apelido}</Texto>
                <Texto variante="pequeno" cor={cores.textoSecundario}>
                  {item.nome}
                </Texto>
              </View>
              <Botao
                titulo="Desbloquear"
                variante="contorno"
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
  flex: { flex: 1 },
  lista: { flexGrow: 1, paddingHorizontal: espacos.lg, paddingTop: espacos.xs, gap: espacos.sm },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
});
