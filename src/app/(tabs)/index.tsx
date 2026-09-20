import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedVertical } from '@/components/feed/FeedVertical';
import { CardsDePartida } from '@/components/partidas/CardsDePartida';
import { Erro, Icone, Listras, Texto } from '@/components/ui';
import { useFeed } from '@/hooks/useFeed';
import { useNotificacoesNaoLidas } from '@/hooks/useNotificacoes';
import type { AbaDoFeed } from '@/services/data/types';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cores, espacos, raios } from '@/theme';

const ABAS: { id: AbaDoFeed; rotulo: string }[] = [
  { id: 'paraVoce', rotulo: 'Para você' },
  { id: 'seguindo', rotulo: 'Seguindo' },
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
        <View style={estilos.linhaMarca} pointerEvents="box-none">
          <View style={estilos.marca}>
            <Listras altura={14} faixas={6} style={estilos.marcaListras} />
            <Texto variante="marca" style={estilos.sombra}>
              VULTURE
            </Texto>
          </View>
          <View style={estilos.seletor}>
            {ABAS.map((item) => {
              const ativa = item.id === aba;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setAba(item.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  testID={`aba-${item.id}`}
                  style={[estilos.opcao, ativa && estilos.opcaoAtiva]}>
                  <Texto
                    variante="pequeno"
                    cor={ativa ? cores.branco : cores.textoSecundario}
                    style={ativa && estilos.opcaoTextoAtivo}>
                    {item.rotulo}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => router.push('/notificacoes')}
            style={estilos.sino}
            hitSlop={8}
            accessibilityLabel="Notificações"
            testID="botao-notificacoes">
            <Icone nome="sino" tamanho={20} cor={cores.branco} />
            {naoLidas > 0 ? (
              <View style={estilos.badge}>
                <Texto variante="legenda" style={estilos.badgeTexto}>
                  {naoLidas > 9 ? '9+' : naoLidas}
                </Texto>
              </View>
            ) : null}
          </Pressable>
        </View>
        <CardsDePartida />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  topo: { position: 'absolute', top: 0, left: 0, right: 0, gap: espacos.sm },
  linhaMarca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.md,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs + 2 },
  marcaListras: { width: 18 },
  sombra: { textShadowColor: cores.sombra, textShadowRadius: 6 },
  seletor: {
    flex: 1,
    flexDirection: 'row',
    alignSelf: 'center',
    marginLeft: espacos.xs,
    padding: 3,
    borderRadius: raios.redondo,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    maxWidth: 210,
  },
  opcao: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: raios.redondo,
  },
  opcaoAtiva: { backgroundColor: cores.vermelho },
  opcaoTextoAtivo: { fontWeight: '700' },
  sino: {
    marginLeft: 'auto',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: cores.vermelhoVivo,
    borderWidth: 2,
    borderColor: cores.pretoPuro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontSize: 10, lineHeight: 12 },
});
