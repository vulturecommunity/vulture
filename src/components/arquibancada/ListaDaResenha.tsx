import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Carregando, EstadoVazio, Erro, Icone, Texto } from '@/components/ui';
import { usePostsDaResenha, type FiltroDaResenha } from '@/hooks/useArquibancada';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos, raios } from '@/theme';
import type { MarcacaoDePartida, Post } from '@/types';

import { CartaoDePost } from './CartaoDePost';

export interface ListaDaResenhaProps {
  filtro: FiltroDaResenha;
  aoMudarFiltro: (filtro: FiltroDaResenha) => void;
}

/** Timeline de posts de texto, estilo X, com filtro por hashtag ou por jogo. */
export function ListaDaResenha({ filtro, aoMudarFiltro }: ListaDaResenhaProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const eu = useAuthStore((s) => s.sessao?.usuario ?? null);
  const resenha = usePostsDaResenha(filtro);

  const escrever = useCallback(() => {
    if (filtro?.tipo === 'partida') {
      router.push({
        pathname: '/arquibancada/novo',
        params: { partidaId: filtro.id, rotulo: filtro.rotulo },
      });
    } else {
      router.push('/arquibancada/novo');
    }
  }, [router, filtro]);

  const abrir = useCallback(
    (post: Post) => router.push({ pathname: '/arquibancada/post/[id]', params: { id: post.id } }),
    [router],
  );
  const porHashtag = useCallback(
    (tag: string) => aoMudarFiltro({ tipo: 'hashtag', tag }),
    [aoMudarFiltro],
  );
  const porPartida = useCallback(
    (p: MarcacaoDePartida) => aoMudarFiltro({ tipo: 'partida', id: p.id, rotulo: p.rotulo }),
    [aoMudarFiltro],
  );

  const renderizar = useCallback(
    ({ item }: { item: Post }) => (
      <CartaoDePost
        post={item}
        aoAbrir={abrir}
        aoTocarHashtag={porHashtag}
        aoTocarPartida={porPartida}
      />
    ),
    [abrir, porHashtag, porPartida],
  );

  if (resenha.isLoading) return <Carregando />;
  if (resenha.isError) {
    return <Erro erro={resenha.error} aoTentarNovamente={() => resenha.refetch()} />;
  }

  const cabecalho = (
    <View>
      <Pressable
        onPress={escrever}
        style={({ pressed }) => [estilos.convite, pressed && estilos.pressionado]}
        accessibilityRole="button"
        accessibilityLabel="Escrever um post"
        testID="convite-escrever">
        <Avatar url={eu?.avatarUrl} nome={eu?.nome ?? 'Torcedor'} tamanho={38} />
        <Texto variante="corpo" cor={cores.textoTerciario} style={estilos.flex}>
          {filtro?.tipo === 'partida'
            ? `Comente ${filtro.rotulo}...`
            : 'O que tá rolando, torcedor?'}
        </Texto>
        <Icone nome="escrever" tamanho={18} cor={cores.vermelhoVivo} />
      </Pressable>
      {filtro ? (
        <View style={estilos.filtro}>
          <Icone
            nome={filtro.tipo === 'hashtag' ? 'hashtag' : 'bola'}
            tamanho={14}
            cor={cores.vermelhoVivo}
          />
          <Texto variante="pequeno" style={estilos.flex} numberOfLines={1}>
            {filtro.tipo === 'hashtag' ? `#${filtro.tag}` : `Resenha do jogo ${filtro.rotulo}`}
          </Texto>
          <Pressable
            onPress={() => aoMudarFiltro(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Limpar filtro"
            testID="limpar-filtro">
            <Icone nome="fechar" tamanho={16} cor={cores.textoSecundario} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={estilos.flex}>
      <FlatList
        data={resenha.posts}
        keyExtractor={(p) => p.id}
        renderItem={renderizar}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={[estilos.lista, { paddingBottom: insets.bottom + 96 }]}
        onRefresh={() => resenha.refetch()}
        refreshing={resenha.isRefetching && !resenha.isFetchingNextPage}
        onEndReached={() => {
          if (resenha.hasNextPage && !resenha.isFetchingNextPage) resenha.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          resenha.isFetchingNextPage ? (
            <ActivityIndicator color={cores.vermelho} style={estilos.rodape} />
          ) : null
        }
        ListEmptyComponent={
          <EstadoVazio
            icone="megafone"
            titulo={filtro ? 'Ninguém falou disso ainda' : 'A arquibancada tá quieta'}
            descricao="Puxe a resenha: seja o primeiro a postar."
            acao={{ titulo: 'Escrever post', aoPressionar: escrever }}
          />
        }
        testID="lista-resenha"
      />
      <Pressable
        onPress={escrever}
        style={({ pressed }) => [
          estilos.fab,
          { bottom: insets.bottom + espacos.lg },
          pressed && estilos.fabPressionado,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Novo post"
        testID="botao-novo-post">
        <Icone nome="escrever" tamanho={22} cor={cores.branco} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  lista: { flexGrow: 1 },
  convite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  pressionado: { backgroundColor: cores.fundoElevado },
  filtro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginHorizontal: espacos.lg,
    marginVertical: espacos.sm,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    borderRadius: raios.md,
    backgroundColor: cores.vermelhoSuave,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelho,
  },
  rodape: { paddingVertical: espacos.lg },
  fab: {
    position: 'absolute',
    right: espacos.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: cores.pretoPuro,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressionado: { transform: [{ scale: 0.94 }], backgroundColor: cores.vermelhoEscuro },
});
