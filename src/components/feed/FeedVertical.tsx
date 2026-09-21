import {
  FlashList,
  type FlashListRef,
  type ListRenderItemInfo,
  type ViewToken,
} from '@shopify/flash-list';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Carregando, EstadoVazio } from '@/components/ui';
import { usePlayerStore } from '@/stores/playerStore';
import { cores } from '@/theme';
import type { Video } from '@/types';

import { ItemDoFeed } from './ItemDoFeed';

export interface FeedVerticalProps {
  listaId: string;
  videos: Video[];
  meuId: string | null;
  carregando?: boolean;
  atualizando?: boolean;
  aoAtualizar?: () => void;
  aoChegarNoFim?: () => void;
  temMais?: boolean;
  indiceInicial?: number;
  recuoInferior?: number;
  vazio?: {
    titulo: string;
    descricao?: string;
    acao?: { titulo: string; aoPressionar: () => void };
  };
}

const CONFIG_VISIBILIDADE = { itemVisiblePercentThreshold: 60, minimumViewTime: 80 };

/**
 * Lista vertical de tela cheia com snap por item. Controla qual vídeo está ativo
 * e mantém apenas o ativo e seus vizinhos com player montado.
 */
export function FeedVertical({
  listaId,
  videos,
  meuId,
  carregando,
  atualizando,
  aoAtualizar,
  aoChegarNoFim,
  temMais,
  indiceInicial = 0,
  recuoInferior = 0,
  vazio,
}: FeedVerticalProps) {
  const [altura, setAltura] = useState(0);
  const [indiceAtivo, setIndiceAtivo] = useState(indiceInicial);
  const definirAtivo = usePlayerStore((s) => s.definirAtivo);
  const listaRef = useRef<FlashListRef<Video>>(null);

  const aoMedir = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setAltura(h);
  }, []);

  const aoMudarVisiveis = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Video>[] }) => {
      const visivel = viewableItems.find((v) => v.isViewable && v.index != null);
      if (visivel && visivel.index != null) setIndiceAtivo(visivel.index);
    },
    [],
  );

  useEffect(() => {
    definirAtivo(listaId, videos[indiceAtivo]?.id ?? null);
  }, [indiceAtivo, videos, listaId, definirAtivo]);

  const renderizar = useCallback(
    ({ item, index }: ListRenderItemInfo<Video>) => (
      <ItemDoFeed
        video={item}
        altura={altura}
        ativo={index === indiceAtivo}
        // só o próximo é pré-carregado: 2 players nativos no máximo (memória no Android)
        proximo={index - indiceAtivo === 1}
        meuId={meuId}
        recuoInferior={recuoInferior}
      />
    ),
    [altura, indiceAtivo, meuId, recuoInferior],
  );

  const chaveDe = useCallback((v: Video) => v.id, []);

  const rodape = useMemo(() => (temMais ? <Carregando telaCheia={false} /> : null), [temMais]);

  return (
    <View style={estilos.container} onLayout={aoMedir} testID={`feed-${listaId}`}>
      {altura > 0 && !carregando && videos.length === 0 && vazio ? (
        <EstadoVazio titulo={vazio.titulo} descricao={vazio.descricao} acao={vazio.acao} />
      ) : altura > 0 && !carregando ? (
        <FlashList
          ref={listaRef}
          data={videos}
          renderItem={renderizar}
          keyExtractor={chaveDe}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={aoMudarVisiveis}
          viewabilityConfig={CONFIG_VISIBILIDADE}
          onEndReached={aoChegarNoFim}
          onEndReachedThreshold={1.5}
          drawDistance={altura * 1.5}
          initialScrollIndex={indiceInicial > 0 ? indiceInicial : undefined}
          ListFooterComponent={rodape}
          refreshControl={
            aoAtualizar ? (
              <RefreshControl
                refreshing={!!atualizando}
                onRefresh={aoAtualizar}
                tintColor={cores.branco}
                colors={[cores.vermelho]}
                progressViewOffset={80}
              />
            ) : undefined
          }
        />
      ) : (
        <Carregando />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.pretoPuro },
});
