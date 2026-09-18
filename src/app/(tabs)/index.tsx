import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedVertical } from '@/components/feed/FeedVertical';
import { CardsDePartida } from '@/components/partidas/CardsDePartida';
import { Erro, Texto } from '@/components/ui';
import { useFeed } from '@/hooks/useFeed';
import { useNotificacoesNaoLidas } from '@/hooks/useNotificacoes';
import type { AbaDoFeed } from '@/services/data/types';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cores, espacos } from '@/theme';

const ABAS: { id: AbaDoFeed; rotulo: string }[] = [
  { id: 'seguindo', rotulo: 'Seguindo' },
  { id: 'paraVoce', rotulo: 'Para Você' },
];

export default function TelaFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const [aba, setAba] = useState<AbaDoFeed>('paraVoce');
  const feed = useFeed({ aba });
  const naoLidas = useNotificacoesNaoLidas();

  useFocusEffect(
    useCallback(() => {
      definirFoco(true);
      return () => definirFoco(false);
    }, [definirFoco]),
  );

  const aoChegarNoFim = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
  }, [feed]);

  if (feed.isError) {
    return <Erro erro={feed.error} aoTentarNovamente={() => feed.refetch()} />;
  }

  return (
    <View style={estilos.tela}>
      <FeedVertical
        listaId={`feed-${aba}`}
        videos={feed.videos}
        meuId={meuId}
        carregando={feed.isLoading}
        atualizando={feed.isRefetching && !feed.isFetchingNextPage}
        aoAtualizar={() => feed.refetch()}
        aoChegarNoFim={aoChegarNoFim}
        temMais={feed.hasNextPage}
        vazio={
          aba === 'seguindo'
            ? {
                titulo: 'Você ainda não segue ninguém',
                descricao: 'Siga torcedores no Explorar para ver os vídeos deles aqui.',
                acao: {
                  titulo: 'Ir para o Explorar',
                  aoPressionar: () => router.push('/(tabs)/explorar'),
                },
              }
            : {
                titulo: 'Nenhum vídeo por aqui',
                descricao: 'Seja o primeiro a publicar!',
                acao: { titulo: 'Gravar', aoPressionar: () => router.push('/criar/camera') },
              }
        }
      />

      <View
        style={[estilos.topo, { paddingTop: insets.top + espacos.sm }]}
        pointerEvents="box-none">
        <View style={estilos.abas}>
          {ABAS.map((item) => {
            const ativa = item.id === aba;
            return (
              <Pressable
                key={item.id}
                onPress={() => setAba(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                testID={`aba-${item.id}`}
                style={estilos.aba}>
                <Texto
                  variante="destaque"
                  cor={ativa ? cores.branco : 'rgba(255,255,255,0.6)'}
                  style={estilos.sombra}>
                  {item.rotulo}
                </Texto>
                {ativa ? <View style={estilos.indicador} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => router.push('/notificacoes')}
          style={[estilos.sino, { top: insets.top + espacos.sm }]}
          hitSlop={8}
          accessibilityLabel="Notificações"
          testID="botao-notificacoes">
          <Ionicons name="notifications-outline" size={26} color={cores.branco} />
          {naoLidas > 0 ? (
            <View style={estilos.badge}>
              <Texto variante="legenda">{naoLidas > 9 ? '9+' : naoLidas}</Texto>
            </View>
          ) : null}
        </Pressable>
        <CardsDePartida />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  topo: { position: 'absolute', top: 0, left: 0, right: 0, gap: espacos.sm },
  abas: { flexDirection: 'row', justifyContent: 'center', gap: espacos.xl },
  aba: { alignItems: 'center', gap: 4, paddingVertical: espacos.xs },
  indicador: { width: 28, height: 3, borderRadius: 2, backgroundColor: cores.vermelho },
  sombra: { textShadowColor: cores.sombra, textShadowRadius: 6 },
  sino: { position: 'absolute', right: espacos.lg },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
