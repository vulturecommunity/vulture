import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedVertical } from '@/components/feed/FeedVertical';
import { Erro, Icone, Texto } from '@/components/ui';
import { useFeed } from '@/hooks/useFeed';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cores, espacos, raios } from '@/theme';

/** Feed vertical filtrado por hashtag. */
export default function TelaHashtag() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const feed = useFeed({ aba: 'paraVoce', hashtag: tag ?? '', habilitado: !!tag });

  useFocusEffect(
    useCallback(() => {
      definirFoco(true);
      return () => definirFoco(false);
    }, [definirFoco]),
  );

  if (feed.isError) return <Erro erro={feed.error} aoTentarNovamente={() => feed.refetch()} />;

  return (
    <View style={estilos.tela}>
      <FeedVertical
        listaId={`hashtag-${tag}`}
        videos={feed.videos}
        meuId={meuId}
        carregando={feed.isLoading}
        aoChegarNoFim={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        temMais={feed.hasNextPage}
        recuoInferior={insets.bottom}
        vazio={{
          titulo: `Nada em #${tag} ainda`,
          descricao: 'Publique o primeiro vídeo com essa hashtag!',
        }}
      />
      <View
        style={[estilos.topo, { paddingTop: insets.top + espacos.sm }]}
        pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Voltar"
          style={estilos.voltar}>
          <Icone nome="voltar" tamanho={20} cor={cores.branco} />
        </Pressable>
        <View style={estilos.etiqueta}>
          <Icone nome="hashtag" tamanho={14} cor={cores.vermelhoVivo} />
          <Texto variante="corpoForte">{tag}</Texto>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacos.lg,
    gap: espacos.md,
  },
  voltar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs,
    paddingHorizontal: espacos.md,
    height: 38,
    borderRadius: raios.redondo,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
  },
});
