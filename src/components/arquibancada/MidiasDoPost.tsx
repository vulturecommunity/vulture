import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
import type { MidiaDoPost } from '@/types';
import { formatarDuracao } from '@/utils/formatadores';

/** Proporção do anexo, contida para uma foto em pé não ocupar a tela inteira. */
function proporcao(m: MidiaDoPost, minima: number, maxima: number): number {
  const p = m.largura && m.altura ? m.largura / m.altura : 16 / 9;
  return Math.min(maxima, Math.max(minima, p));
}

/** 2 a 4 fotos em colunas, como no X: [A|B], [A|B/C], [A/C|B/D]. */
const COLUNAS: Record<number, number[][]> = {
  2: [[0], [1]],
  3: [[0], [1, 2]],
  4: [
    [0, 2],
    [1, 3],
  ],
};

function GradeDeImagens({
  imagens,
  aoAbrir,
}: {
  imagens: MidiaDoPost[];
  aoAbrir: (indice: number) => void;
}) {
  const foto = (i: number, estilo: object) => (
    <Pressable
      key={imagens[i].url}
      onPress={() => aoAbrir(i)}
      style={estilo}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Imagem ${i + 1} de ${imagens.length}`}
      testID={`imagem-do-post-${i}`}>
      <Image
        source={{ uri: imagens[i].url }}
        style={estilos.preencher}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={imagens[i].url}
      />
    </Pressable>
  );
  if (imagens.length === 1) {
    return (
      <View style={[estilos.moldura, { aspectRatio: proporcao(imagens[0], 0.8, 1.9) }]}>
        {foto(0, estilos.preencher)}
      </View>
    );
  }
  return (
    <View style={[estilos.moldura, estilos.grade]}>
      {(COLUNAS[imagens.length] ?? COLUNAS[4]).map((coluna) => (
        <View key={coluna.join('-')} style={estilos.coluna}>
          {coluna.map((i) => foto(i, estilos.celula))}
        </View>
      ))}
    </View>
  );
}

function VisualizadorDeImagens({
  imagens,
  inicial,
  aoFechar,
}: {
  imagens: MidiaDoPost[];
  inicial: number | null;
  aoFechar: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [atual, setAtual] = useState(inicial ?? 0);
  return (
    <Modal visible={inicial !== null} transparent animationType="fade" onRequestClose={aoFechar}>
      <View style={estilos.visualizador}>
        {inicial !== null ? (
          <FlatList
            data={imagens}
            keyExtractor={(m) => m.url}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={inicial}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.url }}
                style={{ width, height }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
          />
        ) : null}
        <View style={[estilos.barraDoVisualizador, { top: insets.top + espacos.sm }]}>
          <Texto variante="pequeno" cor={cores.branco}>
            {imagens.length > 1 ? `${atual + 1} / ${imagens.length}` : ''}
          </Texto>
          <Pressable
            onPress={aoFechar}
            hitSlop={12}
            style={estilos.fechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar imagem">
            <Icone nome="fechar" tamanho={22} cor={cores.branco} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Só monta o player (e só baixa o vídeo) depois do toque no play. */
function PlayerDoPost({ url }: { url: string }) {
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={estilos.preencher}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
    />
  );
}

function VideoDoPost({ midia }: { midia: MidiaDoPost }) {
  const [tocando, setTocando] = useState(false);
  return (
    <View
      style={[estilos.moldura, estilos.fundoVideo, { aspectRatio: proporcao(midia, 0.8, 1.78) }]}>
      {tocando ? (
        <PlayerDoPost url={midia.url} />
      ) : (
        <Pressable
          onPress={() => setTocando(true)}
          style={estilos.preencher}
          accessibilityRole="button"
          accessibilityLabel="Reproduzir vídeo"
          testID="play-video-do-post">
          {midia.thumbnailUrl ? (
            <Image
              source={{ uri: midia.thumbnailUrl }}
              style={estilos.preencher}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : null}
          <View style={estilos.centro}>
            <View style={estilos.play}>
              <Icone nome="play" tamanho={26} cor={cores.branco} />
            </View>
          </View>
          {midia.duracao ? (
            <View style={estilos.selo}>
              <Texto variante="legenda" cor={cores.branco}>
                {formatarDuracao(midia.duracao)}
              </Texto>
            </View>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}

function GifDoPost({ midia }: { midia: MidiaDoPost }) {
  return (
    <View
      style={[estilos.moldura, estilos.gif, { aspectRatio: proporcao(midia, 0.8, 2) }]}
      testID="gif-do-post">
      <Image source={{ uri: midia.url }} style={estilos.preencher} contentFit="cover" autoplay />
      <View style={estilos.selo}>
        <Texto variante="legenda" cor={cores.branco}>
          GIF
        </Texto>
      </View>
    </View>
  );
}

/** Anexos de um post: grade de fotos (com tela cheia), vídeo com play manual ou GIF. */
export function MidiasDoPost({ midias }: { midias: MidiaDoPost[] }) {
  const [aberta, setAberta] = useState<number | null>(null);
  if (midias.length === 0) return null;
  const primeira = midias[0];
  if (primeira.tipo === 'video') return <VideoDoPost midia={primeira} />;
  if (primeira.tipo === 'gif') return <GifDoPost midia={primeira} />;
  return (
    <>
      <GradeDeImagens imagens={midias} aoAbrir={setAberta} />
      <VisualizadorDeImagens
        key={aberta ?? 'fechado'}
        imagens={midias}
        inicial={aberta}
        aoFechar={() => setAberta(null)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  preencher: { ...StyleSheet.absoluteFill },
  moldura: {
    width: '100%',
    marginTop: espacos.xs,
    borderRadius: raios.md,
    overflow: 'hidden',
    backgroundColor: cores.fundoCartao,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  grade: { flexDirection: 'row', height: 220, gap: 2 },
  coluna: { flex: 1, gap: 2 },
  celula: { flex: 1, position: 'relative' },
  fundoVideo: { backgroundColor: cores.pretoPuro },
  gif: { maxHeight: 260 },
  centro: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: cores.overlayEscuro,
    borderWidth: 1.5,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  selo: {
    position: 'absolute',
    left: espacos.sm,
    bottom: espacos.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: cores.overlayEscuro,
  },
  visualizador: { flex: 1, backgroundColor: cores.pretoPuro },
  barraDoVisualizador: {
    position: 'absolute',
    left: espacos.lg,
    right: espacos.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fechar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: cores.vidroClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
