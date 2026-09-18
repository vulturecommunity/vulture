import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedVertical } from '@/components/feed/FeedVertical';
import { Erro, Texto } from '@/components/ui';
import { useFeed } from '@/hooks/useFeed';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cores, espacos } from '@/theme';

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
          <Ionicons name="arrow-back" size={26} color={cores.branco} />
        </Pressable>
        <Texto variante="destaque" style={estilos.titulo}>
          #{tag}
        </Texto>
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
  voltar: { padding: espacos.xs },
  titulo: { textShadowColor: cores.sombra, textShadowRadius: 6 },
});
