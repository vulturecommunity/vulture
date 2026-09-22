import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
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

const ALTURA_REPOUSO = 3;
const ALTURA_ARRASTO = 8;
/** faixa sensível ao toque, bem maior que a linha visível */
const ALTURA_TOQUE = 30;
const DIAMETRO_REPOUSO = 11;
const DIAMETRO_ARRASTO = 20;
/** recuo das bordas: a barra vira um controle "solto", longe dos cantos arredondados */
const MARGEM_LATERAL = espacos.md;
const MARGEM_INFERIOR = espacos.md;

/**
 * Geometria compartilhada: o post reserva esse espaço no rodapé e o post de foto
 * desenha a barra dele no mesmo lugar, para o progresso viver sempre na mesma altura.
 */
export const GEOMETRIA_BARRA = {
  margemLateral: MARGEM_LATERAL,
  margemInferior: MARGEM_INFERIOR,
  alturaToque: ALTURA_TOQUE,
  alturaLinha: ALTURA_REPOUSO,
  /** espaço que o conteúdo do post precisa deixar livre acima da barra */
  espacoReservado: MARGEM_INFERIOR + ALTURA_TOQUE + espacos.xs,
} as const;

/**
 * Linha de progresso do vídeo. Fica sempre visível — trilha em pílula recuada das
 * bordas e um marcador branco com anel — e arrastar para os lados avança/volta.
 * Ao arrastar, a barra engrossa, o preenchimento vira vermelho e o anel acende:
 * o torcedor vê na hora que está no comando. Tudo na thread de UI.
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

  /** 0 em repouso, 1 durante o arrasto: comanda espessura, cor e tamanho do marcador. */
  const destaque = useDerivedValue(() => withTiming(arrastando.get() ? 1 : 0, { duration: 140 }));
  const fracao = useDerivedValue(() => {
    if (arrastando.get()) return fracaoArrasto.get();
    return duracao > 0 ? Math.min(1, Math.max(0, posicao.get() / duracao)) : 0;
  });

  const estiloTrilha = useAnimatedStyle(() => {
    const altura = ALTURA_REPOUSO + destaque.get() * (ALTURA_ARRASTO - ALTURA_REPOUSO);
    return { height: altura, borderRadius: altura / 2 };
  });
  const estiloPreenchido = useAnimatedStyle(() => ({
    width: `${fracao.get() * 100}%`,
    backgroundColor: interpolateColor(destaque.get(), [0, 1], [cores.branco, cores.vermelhoVivo]),
  }));
  const estiloMarcador = useAnimatedStyle(() => {
    const d = DIAMETRO_REPOUSO + destaque.get() * (DIAMETRO_ARRASTO - DIAMETRO_REPOUSO);
    return {
      width: d,
      height: d,
      borderRadius: d / 2,
      left: `${fracao.get() * 100}%`,
      borderColor: interpolateColor(
        destaque.get(),
        [0, 1],
        ['rgba(0,0,0,0.45)', cores.vermelhoVivo],
      ),
      transform: [{ translateX: -d / 2 }, { translateY: -d / 2 }],
    };
  });

  return (
    <View style={estilos.area} pointerEvents="box-none" testID="barra-progresso">
      {tempoArrasto !== null ? (
        // no centro do vídeo: nunca fica atrás das ações nem da legenda
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
          <Animated.View
            style={[estilos.marcador, estiloMarcador]}
            pointerEvents="none"
            testID="marcador-progresso"
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const estilos = StyleSheet.create({
  area: {
    position: 'absolute',
    top: 0,
    left: MARGEM_LATERAL,
    right: MARGEM_LATERAL,
    bottom: MARGEM_INFERIOR,
    justifyContent: 'flex-end',
  },
  tempo: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.xs,
    borderRadius: raios.sm,
    backgroundColor: cores.vidro,
  },
  faixaToque: { height: ALTURA_TOQUE, justifyContent: 'center' },
  trilha: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  preenchido: { height: '100%', borderRadius: ALTURA_ARRASTO / 2 },
  marcador: {
    position: 'absolute',
    top: '50%',
    backgroundColor: cores.branco,
    borderWidth: 2,
    // o marcador precisa aparecer tanto em vídeo claro quanto escuro
    shadowColor: cores.pretoPuro,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
