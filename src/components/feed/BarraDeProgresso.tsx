import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
import { formatarDuracao } from '@/utils/formatadores';

export interface BarraDeProgressoProps {
  /** posição atual em segundos (shared value alimentado pelo player, sem re-render) */
  posicao: SharedValue<number>;
  duracao: number;
  /** chamado enquanto o dedo arrasta (fração 0..1) e ao soltar */
  aoBuscar: (fracao: number) => void;
  aoComecarArrasto?: () => void;
  aoTerminarArrasto?: () => void;
}

const ALTURA_REPOUSO = 2;
const ALTURA_ARRASTO = 6;
/** faixa sensível ao toque, maior que a linha visível */
const ALTURA_TOQUE = 28;

/**
 * Linha de progresso no rodapé do vídeo. Arrastar para os lados avança/volta o vídeo
 * (como no TikTok/Kwai); durante o arrasto a barra engrossa e mostra o tempo.
 * Toda a animação roda na thread de UI: o componente só re-renderiza durante o arrasto.
 */
export function BarraDeProgresso({
  posicao,
  duracao,
  aoBuscar,
  aoComecarArrasto,
  aoTerminarArrasto,
}: BarraDeProgressoProps) {
  const [largura, setLargura] = useState(1);
  const arrastando = useSharedValue(false);
  const fracaoArrasto = useSharedValue(0);
  const [tempoArrasto, setTempoArrasto] = useState<number | null>(null);
  const ultimoSeek = useRef(0);

  const aoMedir = useCallback((e: LayoutChangeEvent) => {
    setLargura(Math.max(1, e.nativeEvent.layout.width));
  }, []);

  const buscarComLimite = useCallback(
    (fracao: number, forcar: boolean) => {
      setTempoArrasto(fracao * duracao);
      const agora = Date.now();
      // limita os seeks a ~12 por segundo para não sobrecarregar o player nativo
      if (forcar || agora - ultimoSeek.current > 80) {
        ultimoSeek.current = agora;
        aoBuscar(fracao);
      }
    },
    [aoBuscar, duracao],
  );

  const comecar = useCallback(() => aoComecarArrasto?.(), [aoComecarArrasto]);
  const terminar = useCallback(() => {
    setTempoArrasto(null);
    aoTerminarArrasto?.();
  }, [aoTerminarArrasto]);

  // Os callbacks do gesto rodam na thread de UI, fora da renderização: ler/escrever os
  // shared values aqui é o padrão do Reanimated + Gesture Handler (falso positivo do lint).
  // O gesto é memoizado para não reconfigurar o handler nativo a cada render.
  /* eslint-disable react-hooks/refs */
  const arrasto = useMemo(
    () =>
      Gesture.Pan()
        // só ativa em movimento horizontal; vertical continua rolando o feed
        .activeOffsetX([-8, 8])
        .failOffsetY([-12, 12])
        .onStart((e) => {
          arrastando.set(true);
          fracaoArrasto.set(Math.min(1, Math.max(0, e.x / largura)));
          runOnJS(comecar)();
        })
        .onUpdate((e) => {
          const f = Math.min(1, Math.max(0, e.x / largura));
          fracaoArrasto.set(f);
          runOnJS(buscarComLimite)(f, false);
        })
        .onEnd(() => {
          runOnJS(buscarComLimite)(fracaoArrasto.get(), true);
        })
        .onFinalize(() => {
          arrastando.set(false);
          runOnJS(terminar)();
        }),
    [arrastando, fracaoArrasto, largura, comecar, buscarComLimite, terminar],
  );
  /* eslint-enable react-hooks/refs */

  const estiloTrilha = useAnimatedStyle(() => ({
    height: withTiming(arrastando.get() ? ALTURA_ARRASTO : ALTURA_REPOUSO, { duration: 120 }),
  }));
  const estiloPreenchido = useAnimatedStyle(() => {
    const fracaoAtual = duracao > 0 ? Math.min(1, Math.max(0, posicao.get() / duracao)) : 0;
    return { width: `${(arrastando.get() ? fracaoArrasto.get() : fracaoAtual) * 100}%` };
  });
  const estiloBolinha = useAnimatedStyle(() => {
    const fracaoAtual = duracao > 0 ? Math.min(1, Math.max(0, posicao.get() / duracao)) : 0;
    return {
      opacity: withTiming(arrastando.get() ? 1 : 0, { duration: 120 }),
      left: `${(arrastando.get() ? fracaoArrasto.get() : fracaoAtual) * 100}%`,
    };
  });

  return (
    <View style={estilos.area} testID="barra-progresso">
      {tempoArrasto !== null ? (
        <View style={estilos.tempo} pointerEvents="none">
          <Texto variante="corpoForte">{formatarDuracao(tempoArrasto)}</Texto>
          <Texto variante="corpo" cor={cores.textoSecundario}>
            {' / '}
            {formatarDuracao(duracao)}
          </Texto>
        </View>
      ) : null}
      <GestureDetector gesture={arrasto}>
        <View style={estilos.faixaToque} onLayout={aoMedir} accessibilityLabel="Progresso do vídeo">
          <Animated.View style={[estilos.trilha, estiloTrilha]}>
            <Animated.View style={[estilos.preenchido, estiloPreenchido]} />
          </Animated.View>
          <Animated.View style={[estilos.bolinha, estiloBolinha]} pointerEvents="none" />
        </View>
      </GestureDetector>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  tempo: {
    position: 'absolute',
    bottom: ALTURA_TOQUE + espacos.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.xs,
    borderRadius: raios.sm,
    backgroundColor: cores.vidro,
  },
  faixaToque: { height: ALTURA_TOQUE, justifyContent: 'flex-end' },
  trilha: { width: '100%', backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  preenchido: { height: '100%', backgroundColor: cores.vermelhoVivo },
  bolinha: {
    position: 'absolute',
    bottom: -3,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: cores.branco,
  },
});
