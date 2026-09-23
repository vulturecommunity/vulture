import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedVertical } from '@/components/feed/FeedVertical';
import { CardsDePartida } from '@/components/partidas/CardsDePartida';
import { Erro, Icone, Texto } from '@/components/ui';
import { useFeed } from '@/hooks/useFeed';
import { useTotalNaoLido } from '@/hooks/useMensagens';
import type { AbaDoFeed } from '@/services/data/types';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cores, espacos, raios } from '@/theme';

const ABAS: { id: AbaDoFeed; rotulo: string }[] = [
  { id: 'paraVoce', rotulo: 'Para você' },
  { id: 'seguindo', rotulo: 'Seguindo' },
];

/**
 * Feed principal. O cabeçalho (arquibancada, abas, mensagens e placar) fica em fluxo
 * normal e os posts começam logo abaixo dele — nada de controles por cima do vídeo.
 */
export default function TelaFeed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const [aba, setAba] = useState<AbaDoFeed>('paraVoce');
  const feed = useFeed({ aba });
  const naoLidas = useTotalNaoLido();

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
      <View style={[estilos.cabecalho, { paddingTop: insets.top + espacos.xs }]}>
        <View style={estilos.linhaMarca}>
          <View style={estilos.ladoEsquerdo}>
            <Pressable
              onPress={() => router.push('/arquibancada')}
              style={estilos.botaoRedondo}
              hitSlop={8}
              accessibilityLabel="Arquibancada: resenha e jogos"
              testID="botao-arquibancada">
              <Icone nome="estadio" tamanho={21} cor={cores.texto} />
            </Pressable>
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
          <View style={estilos.ladoDireito}>
            <Pressable
              onPress={() => router.push('/mensagens')}
              style={estilos.botaoRedondo}
              hitSlop={8}
              accessibilityLabel="Mensagens"
              testID="botao-mensagens">
              <Icone nome="mensagens" tamanho={21} cor={cores.texto} />
              {naoLidas > 0 ? (
                <View style={estilos.badge}>
                  <Texto variante="legenda" style={estilos.badgeTexto}>
                    {naoLidas > 9 ? '9+' : naoLidas}
                  </Texto>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        <CardsDePartida />
      </View>

      <View style={estilos.palco}>
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
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { backgroundColor: cores.fundo, paddingBottom: espacos.sm, gap: espacos.sm },
  linhaMarca: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacos.md,
  },
  ladoEsquerdo: { flex: 1, alignItems: 'flex-start' },
  ladoDireito: { flex: 1, alignItems: 'flex-end' },
  seletor: {
    flexDirection: 'row',
    width: 200,
    padding: 3,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  opcao: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: raios.redondo },
  opcaoAtiva: { backgroundColor: cores.vermelho },
  opcaoTextoAtivo: { fontWeight: '700' },
  botaoRedondo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
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
    borderColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontSize: 10, lineHeight: 12 },
  // os posts vivem aqui, abaixo do cabeçalho; o canto arredondado separa as duas áreas
  palco: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: raios.lg,
    borderTopRightRadius: raios.lg,
    backgroundColor: cores.pretoPuro,
  },
});
