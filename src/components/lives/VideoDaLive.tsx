import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Texto } from '@/components/ui';
import { carregarLiveKit, obterCredenciaisLiveKit, type ModoDeLive } from '@/services/live';
import { cores, espacos } from '@/theme';
import type { Live } from '@/types';

export interface VideoDaLiveProps {
  live: Live;
  modo: ModoDeLive;
  /** true quando quem está vendo é o anfitrião (publica a câmera) */
  anfitriao: boolean;
  identidade: string;
  nome: string;
  aoErro?: (mensagem: string) => void;
}

/**
 * Área de vídeo da live.
 *  - modo "livekit": conecta na sala e mostra a câmera do anfitrião (WebRTC de verdade)
 *  - modo "simulado": anfitrião vê a própria câmera local; espectador vê a capa animada
 */
export function VideoDaLive(props: VideoDaLiveProps) {
  if (props.modo === 'livekit') return <SalaLiveKit {...props} />;
  return props.anfitriao ? <PreviewLocal /> : <CapaSimulada live={props.live} />;
}

// ---------------------------------------------------------------- LiveKit real

function SalaLiveKit({ live, anfitriao, identidade, nome, aoErro }: VideoDaLiveProps) {
  const LK = carregarLiveKit();
  const [credenciais, setCredenciais] = useState<{ url: string; token: string } | null>(null);

  useEffect(() => {
    let ativo = true;
    obterCredenciaisLiveKit({ sala: live.sala, identidade, nome, podePublicar: anfitriao })
      .then((c) => {
        if (ativo) setCredenciais(c);
      })
      .catch((e) => aoErro?.(e instanceof Error ? e.message : 'Falha ao conectar na live'));
    return () => {
      ativo = false;
    };
  }, [live.sala, identidade, nome, anfitriao, aoErro]);

  useEffect(() => {
    if (!LK) return;
    LK.AudioSession.startAudioSession().catch(() => {});
    return () => {
      LK.AudioSession.stopAudioSession().catch(() => {});
    };
  }, [LK]);

  if (!LK || !credenciais) {
    return (
      <View style={[StyleSheet.absoluteFill, estilos.centro]}>
        <ActivityIndicator color={cores.branco} />
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          Conectando à sala...
        </Texto>
      </View>
    );
  }

  const { LiveKitRoom } = LK;
  return (
    <LiveKitRoom
      serverUrl={credenciais.url}
      token={credenciais.token}
      connect
      audio={anfitriao}
      video={anfitriao}
      options={{ adaptiveStream: { pixelDensity: 'screen' } }}
      onError={(e) => aoErro?.(e.message)}>
      <TrilhaDeVideo />
    </LiveKitRoom>
  );
}

/** Mostra a primeira trilha de câmera disponível (a do anfitrião). */
function TrilhaDeVideo() {
  const LK = carregarLiveKit()!;
  const trilhas = LK.useTracks([LK.cliente.Track.Source.Camera], { onlySubscribed: false });
  const trilha = trilhas.find((t) => LK.isTrackReference(t));
  if (!trilha) {
    return (
      <View style={[StyleSheet.absoluteFill, estilos.centro]}>
        <ActivityIndicator color={cores.branco} />
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          Aguardando o vídeo do anfitrião...
        </Texto>
      </View>
    );
  }
  return <LK.VideoTrack trackRef={trilha} style={StyleSheet.absoluteFill} objectFit="cover" />;
}

// ---------------------------------------------------------------- modo simulado

function PreviewLocal() {
  const [permissao, pedir] = useCameraPermissions();
  useEffect(() => {
    if (permissao && !permissao.granted && permissao.canAskAgain) pedir();
  }, [permissao, pedir]);

  if (!permissao?.granted) {
    return (
      <View style={[StyleSheet.absoluteFill, estilos.centro]}>
        <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
          Libere a câmera para ver o preview da sua live.
        </Texto>
      </View>
    );
  }
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="front"
      mode="video"
      testID="preview-local"
    />
  );
}

function CapaSimulada({ live }: { live: Live }) {
  const pulso = useSharedValue(1);
  useEffect(() => {
    pulso.value = withRepeat(
      withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulso]);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: pulso.value }] }));

  return (
    <View style={StyleSheet.absoluteFill} testID="capa-simulada">
      {live.thumbnailUrl ? (
        <Animated.View style={[StyleSheet.absoluteFill, estilo]}>
          <Image
            source={{ uri: live.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </Animated.View>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.fundoElevado }]} />
      )}
      <View style={estilos.escurecer} />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.sm,
    backgroundColor: cores.pretoPuro,
  },
  escurecer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
