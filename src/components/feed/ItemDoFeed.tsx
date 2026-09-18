import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Texto } from '@/components/ui';
import { useCompartilhar, useCurtir, useSalvar } from '@/hooks/useInteracoes';
import { dataService } from '@/services/data';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos } from '@/theme';
import type { Video } from '@/types';

import { AcoesLaterais } from './AcoesLaterais';
import { CoracaoAnimado } from './CoracaoAnimado';
import { LegendaComHashtags } from './LegendaComHashtags';
import { PlayerDeVideo } from './PlayerDeVideo';
import { PostDeFoto } from './PostDeFoto';

export interface ItemDoFeedProps {
  video: Video;
  altura: number;
  /** este item é o visível */
  ativo: boolean;
  /** vizinho imediato: mantém o player montado e pré-carregado */
  proximo: boolean;
  meuId: string | null;
  /** espaço extra no rodapé (ex.: barra de abas transparente) */
  recuoInferior?: number;
}

function ItemDoFeedBase({
  video,
  altura,
  ativo,
  proximo,
  meuId,
  recuoInferior = 0,
}: ItemDoFeedProps) {
  const router = useRouter();
  const mudo = usePlayerStore((s) => s.mudo);
  const alternarMudo = usePlayerStore((s) => s.alternarMudo);
  const feedEmFoco = usePlayerStore((s) => s.feedEmFoco);
  const abrirComentarios = useUiStore((s) => s.abrirComentarios);
  const abrirDenuncia = useUiStore((s) => s.abrirDenuncia);
  const { alternar: alternarCurtida, curtir } = useCurtir();
  const { alternar: alternarSalvo } = useSalvar();
  const compartilhar = useCompartilhar();

  const [coracao, setCoracao] = useState({ disparo: 0, x: 0, y: 0 });
  const [mostrarMudo, setMostrarMudo] = useState(false);

  const tocando = ativo && feedEmFoco;

  // registra a visualização depois de 2s com o item ativo
  useEffect(() => {
    if (!tocando) return;
    const timer = setTimeout(
      () =>
        dataService()
          .registrarVisualizacao(video.id)
          .catch(() => {}),
      2000,
    );
    return () => clearTimeout(timer);
  }, [tocando, video.id]);

  const aoToqueSimples = useCallback(() => {
    alternarMudo();
    setMostrarMudo(true);
    setTimeout(() => setMostrarMudo(false), 900);
  }, [alternarMudo]);

  const aoToqueDuplo = useCallback(
    (x: number, y: number) => {
      setCoracao((c) => ({ disparo: c.disparo + 1, x, y }));
      curtir(video);
    },
    [curtir, video],
  );

  const toqueDuplo = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((e, sucesso) => {
      if (sucesso) runOnJS(aoToqueDuplo)(e.x, e.y);
    });
  const toqueSimples = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_e, sucesso) => {
      if (sucesso) runOnJS(aoToqueSimples)();
    });
  const gestos = Gesture.Exclusive(toqueDuplo, toqueSimples);

  const abrirMais = useCallback(() => {
    abrirDenuncia({
      tipo: 'video',
      id: video.id,
      autorId: video.autorId,
      autorApelido: video.autor.apelido,
    });
  }, [abrirDenuncia, video]);

  return (
    <View style={[estilos.item, { height: altura }]} testID={`item-feed-${video.id}`}>
      <GestureDetector gesture={gestos}>
        <View style={StyleSheet.absoluteFill}>
          {video.tipo === 'foto' ? (
            <PostDeFoto video={video} ativo={tocando} />
          ) : ativo || proximo ? (
            <PlayerDeVideo video={video} tocando={tocando} mudo={mudo} />
          ) : (
            <View style={estilos.placeholder} />
          )}
          <CoracaoAnimado disparo={coracao.disparo} x={coracao.x} y={coracao.y} />
          {mostrarMudo ? (
            <View style={estilos.indicadorMudo} pointerEvents="none">
              <Ionicons
                name={mudo ? 'volume-mute' : 'volume-high'}
                size={40}
                color={cores.branco}
              />
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <View
        style={[estilos.overlay, { paddingBottom: recuoInferior + espacos.lg }]}
        pointerEvents="box-none">
        <View style={estilos.info} pointerEvents="box-none">
          <Pressable
            onPress={() =>
              meuId === video.autorId
                ? router.push('/(tabs)/perfil')
                : router.push({ pathname: '/usuario/[id]', params: { id: video.autorId } })
            }
            accessibilityRole="link">
            <Texto variante="destaque" style={estilos.sombra}>
              @{video.autor.apelido}
            </Texto>
          </Pressable>
          {video.legenda ? (
            <LegendaComHashtags texto={video.legenda} style={estilos.sombra} numberOfLines={3} />
          ) : null}
          <View style={estilos.linhaAudio}>
            <Ionicons name="musical-notes" size={14} color={cores.branco} />
            <Texto variante="pequeno" style={[estilos.sombra, estilos.audio]} numberOfLines={1}>
              {video.audio || `Som original - ${video.autor.apelido}`}
            </Texto>
          </View>
        </View>
        <AcoesLaterais
          video={video}
          souOAutor={meuId === video.autorId}
          aoCurtir={() => alternarCurtida(video)}
          aoComentar={() => abrirComentarios(video.id)}
          aoSalvar={() => alternarSalvo(video)}
          aoCompartilhar={() => compartilhar(video)}
          aoMais={abrirMais}
        />
      </View>
    </View>
  );
}

export const ItemDoFeed = memo(ItemDoFeedBase);

const ABSOLUTO = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const estilos = StyleSheet.create({
  item: { width: '100%', backgroundColor: cores.pretoPuro },
  placeholder: { ...ABSOLUTO, backgroundColor: cores.pretoPuro },
  overlay: {
    ...ABSOLUTO,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.md,
  },
  info: { flex: 1, gap: espacos.xs, paddingRight: espacos.md },
  linhaAudio: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  audio: { flex: 1 },
  sombra: {
    textShadowColor: cores.sombra,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  indicadorMudo: {
    ...ABSOLUTO,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
