import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Cabecalho, Carregando, EstadoVazio, Texto } from '@/components/ui';
import { useSeguir } from '@/hooks/useInteracoes';
import { useMarcarNotificacoesComoLidas } from '@/hooks/useNotificacoes';
import { useNovosSeguidores } from '@/hooks/useSeguidores';
import { useVoltar } from '@/hooks/useVoltar';
import { cores, espacos } from '@/theme';
import { formatarQuandoSeguiu } from '@/utils/formatadores';

/**
 * Quem começou a me seguir: "Hoje", "Ontem", "Há N dias" e, passados 15 dias,
 * a data completa com ano. Dá para seguir de volta na hora.
 */
export default function TelaNovosSeguidores() {
  const router = useRouter();
  const voltar = useVoltar('/mensagens');
  const insets = useSafeAreaInsets();
  const seguidores = useNovosSeguidores();
  const { alternar, ocupado } = useSeguir();
  const { mutate: marcarLidas } = useMarcarNotificacoesComoLidas();

  // abrir a tela zera o badge de "seguiu"
  useEffect(() => {
    const timer = setTimeout(() => marcarLidas(['seguiu']), 800);
    return () => clearTimeout(timer);
  }, [marcarLidas]);

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho titulo="Novos seguidores" aoVoltar={voltar} />
      {seguidores.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          data={seguidores.data ?? []}
          keyExtractor={(s) => s.usuario.id}
          contentContainerStyle={estilos.lista}
          onRefresh={() => seguidores.refetch()}
          refreshing={seguidores.isRefetching}
          ListEmptyComponent={
            <EstadoVazio
              icone="adicionarPessoa"
              titulo="Ninguém novo por enquanto"
              descricao="Quando alguém começar a te seguir, aparece aqui com a data."
            />
          }
          renderItem={({ item }) => (
            <View style={estilos.linha} testID={`seguidor-${item.usuario.id}`}>
              <Pressable
                style={estilos.pessoa}
                onPress={() =>
                  router.push({ pathname: '/usuario/[id]', params: { id: item.usuario.id } })
                }
                accessibilityLabel={`Abrir perfil de @${item.usuario.apelido}`}>
                <Avatar url={item.usuario.avatarUrl} nome={item.usuario.nome} tamanho={48} />
                <View style={estilos.textos}>
                  <Texto variante="corpo" numberOfLines={2}>
                    <Texto variante="corpoForte">@{item.usuario.apelido}</Texto> começou a seguir
                    você
                  </Texto>
                  <Texto
                    variante="legenda"
                    cor={cores.textoTerciario}
                    testID={`quando-${item.usuario.id}`}>
                    {formatarQuandoSeguiu(item.seguiuEm)}
                  </Texto>
                </View>
              </Pressable>
              <Botao
                titulo={item.sigoDeVolta ? 'Seguindo' : 'Seguir de volta'}
                variante={item.sigoDeVolta ? 'contorno' : 'primario'}
                tamanho="pequeno"
                carregando={ocupado}
                onPress={() => alternar(item.usuario.id, item.sigoDeVolta).catch(() => {})}
                testID={`seguir-de-volta-${item.usuario.id}`}
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
  lista: { flexGrow: 1, paddingBottom: espacos.xl },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm + 2,
  },
  pessoa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacos.md },
  textos: { flex: 1, gap: 2 },
});
