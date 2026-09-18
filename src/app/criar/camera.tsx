import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Texto } from '@/components/ui';
import { DURACAO_MAXIMA_VIDEO_SEGUNDOS } from '@/constants/interesses';
import { useCriacaoStore } from '@/stores/criacaoStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { formatarDuracao } from '@/utils/formatadores';

type Modo = 'video' | 'foto';

/** Tela de captura: gravar vídeo (pressionar e segurar), tirar foto ou importar da galeria. */
export default function TelaCamera() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permissaoCamera, pedirCamera] = useCameraPermissions();
  const [permissaoMic, pedirMic] = useMicrophonePermissions();
  const definirMidia = useCriacaoStore((s) => s.definirMidia);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);

  const [modo, setModo] = useState<Modo>('video');
  const [lado, setLado] = useState<CameraType>('back');
  const [flash, setFlash] = useState(false);
  const [pronta, setPronta] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const inicioRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // pausa o feed enquanto a câmera está aberta
  useFocusEffect(
    useCallback(() => {
      definirFoco(false);
      return () => definirFoco(true);
    }, [definirFoco]),
  );

  useEffect(() => {
    if (permissaoCamera && !permissaoCamera.granted && permissaoCamera.canAskAgain) pedirCamera();
  }, [permissaoCamera, pedirCamera]);

  useEffect(() => {
    if (permissaoMic && !permissaoMic.granted && permissaoMic.canAskAgain) pedirMic();
  }, [permissaoMic, pedirMic]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const pararContador = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const iniciarGravacao = useCallback(async () => {
    if (!cameraRef.current || !pronta || gravando || ocupado) return;
    setGravando(true);
    setSegundos(0);
    inicioRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const passado = (Date.now() - inicioRef.current) / 1000;
      setSegundos(passado);
      if (passado >= DURACAO_MAXIMA_VIDEO_SEGUNDOS) cameraRef.current?.stopRecording();
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const resultado = await cameraRef.current.recordAsync({
        maxDuration: DURACAO_MAXIMA_VIDEO_SEGUNDOS,
      });
      const duracao = Math.min(
        DURACAO_MAXIMA_VIDEO_SEGUNDOS,
        (Date.now() - inicioRef.current) / 1000,
      );
      pararContador();
      setGravando(false);
      if (resultado?.uri) {
        if (duracao < 1) {
          mostrarAviso('Segure o botão para gravar (mínimo 1 segundo).', 'info');
          return;
        }
        definirMidia({
          uri: resultado.uri,
          tipo: 'video',
          duracao,
          largura: null,
          altura: null,
          origem: 'camera',
        });
        router.push('/criar/preview');
      }
    } catch (erro) {
      pararContador();
      setGravando(false);
      mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível gravar.', 'erro');
    }
  }, [pronta, gravando, ocupado, definirMidia, router, mostrarAviso, pararContador]);

  const pararGravacao = useCallback(() => {
    if (!gravando) return;
    cameraRef.current?.stopRecording();
  }, [gravando]);

  const tirarFoto = useCallback(async () => {
    if (!cameraRef.current || !pronta || ocupado) return;
    setOcupado(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const foto = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (foto?.uri) {
        definirMidia({
          uri: foto.uri,
          tipo: 'foto',
          duracao: 5,
          largura: foto.width,
          altura: foto.height,
          origem: 'camera',
        });
        router.push('/criar/preview');
      }
    } catch (erro) {
      mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível tirar a foto.', 'erro');
    } finally {
      setOcupado(false);
    }
  }, [pronta, ocupado, definirMidia, router, mostrarAviso]);

  const importarDaGaleria = useCallback(async () => {
    setOcupado(true);
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        mostrarAviso('Libere o acesso à galeria para importar.', 'erro');
        return;
      }
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos', 'images'],
        allowsEditing: false,
        quality: 0.9,
        videoMaxDuration: DURACAO_MAXIMA_VIDEO_SEGUNDOS,
      });
      if (resultado.canceled || resultado.assets.length === 0) return;
      const a = resultado.assets[0];
      const ehVideo = a.type === 'video';
      const duracao = ehVideo
        ? Math.min(DURACAO_MAXIMA_VIDEO_SEGUNDOS, (a.duration ?? 0) / 1000)
        : 5;
      if (ehVideo && (a.duration ?? 0) / 1000 > DURACAO_MAXIMA_VIDEO_SEGUNDOS + 1) {
        mostrarAviso('Vídeos de até 60 segundos. Escolha um trecho menor.', 'erro');
        return;
      }
      definirMidia({
        uri: a.uri,
        tipo: ehVideo ? 'video' : 'foto',
        duracao,
        largura: a.width,
        altura: a.height,
        origem: 'galeria',
      });
      router.push('/criar/preview');
    } finally {
      setOcupado(false);
    }
  }, [definirMidia, router, mostrarAviso]);

  const semPermissao = !permissaoCamera?.granted || (modo === 'video' && !permissaoMic?.granted);

  if (!permissaoCamera || !permissaoMic) {
    return <View style={estilos.tela} />;
  }

  if (semPermissao) {
    return (
      <View style={[estilos.tela, estilos.centro, { paddingTop: insets.top }]}>
        <Ionicons name="camera-outline" size={56} color={cores.textoSecundario} />
        <Texto variante="subtitulo" centralizado>
          Precisamos da câmera e do microfone
        </Texto>
        <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
          Para gravar seus vídeos da torcida, libere o acesso nas permissões.
        </Texto>
        <Botao
          titulo="Permitir acesso"
          onPress={async () => {
            const c = await pedirCamera();
            const m = await pedirMic();
            if ((!c.granted || !m.granted) && !(c.canAskAgain && m.canAskAgain))
              Linking.openSettings();
          }}
        />
        <Botao titulo="Importar da galeria" variante="secundario" onPress={importarDaGaleria} />
        <Botao titulo="Voltar" variante="fantasma" onPress={() => router.back()} />
      </View>
    );
  }

  const limite = DURACAO_MAXIMA_VIDEO_SEGUNDOS;
  const progresso = Math.min(1, segundos / limite);

  return (
    <View style={estilos.tela}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={lado}
        mode={modo === 'video' ? 'video' : 'picture'}
        enableTorch={flash && modo === 'video'}
        flash={flash && modo === 'foto' ? 'on' : 'off'}
        videoQuality="720p"
        mute={false}
        onCameraReady={() => setPronta(true)}
        testID="camera"
      />

      {/* barra de progresso da gravação */}
      <View style={[estilos.trilha, { top: insets.top }]}>
        <View style={[estilos.barra, { width: `${progresso * 100}%` }]} />
      </View>

      <View style={[estilos.topo, { paddingTop: insets.top + espacos.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          disabled={gravando}
          accessibilityLabel="Fechar"
          style={estilos.iconeBotao}>
          <Ionicons name="close" size={30} color={cores.branco} />
        </Pressable>
        {gravando ? (
          <View style={estilos.contador} testID="contador-gravacao">
            <View style={estilos.pontoVermelho} />
            <Texto variante="corpoForte">
              {formatarDuracao(segundos)} / {formatarDuracao(limite)}
            </Texto>
          </View>
        ) : (
          <View style={estilos.modos}>
            {(['video', 'foto'] as Modo[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setModo(m)}
                style={[estilos.modo, modo === m && estilos.modoAtivo]}
                accessibilityRole="tab"
                accessibilityState={{ selected: modo === m }}
                testID={`modo-${m}`}>
                <Texto variante="pequeno" cor={modo === m ? cores.preto : cores.branco}>
                  {m === 'video' ? 'Vídeo' : 'Foto'}
                </Texto>
              </Pressable>
            ))}
          </View>
        )}
        <View style={estilos.colunaDireita}>
          <Pressable
            onPress={() => setLado((l) => (l === 'back' ? 'front' : 'back'))}
            hitSlop={10}
            disabled={gravando}
            accessibilityLabel="Alternar câmera"
            style={estilos.iconeBotao}
            testID="botao-alternar-camera">
            <Ionicons name="camera-reverse-outline" size={28} color={cores.branco} />
          </Pressable>
          <Pressable
            onPress={() => setFlash((f) => !f)}
            hitSlop={10}
            accessibilityLabel="Flash"
            style={estilos.iconeBotao}
            testID="botao-flash">
            <Ionicons
              name={flash ? 'flash' : 'flash-off-outline'}
              size={26}
              color={flash ? cores.aviso : cores.branco}
            />
          </Pressable>
        </View>
      </View>

      <View style={[estilos.rodape, { paddingBottom: insets.bottom + espacos.xl }]}>
        <Pressable
          onPress={importarDaGaleria}
          disabled={gravando || ocupado}
          style={estilos.galeria}
          accessibilityLabel="Importar da galeria"
          testID="botao-galeria">
          <Ionicons name="images-outline" size={28} color={cores.branco} />
          <Texto variante="legenda">Galeria</Texto>
        </Pressable>

        {modo === 'video' ? (
          <Pressable
            onPressIn={iniciarGravacao}
            onPressOut={pararGravacao}
            disabled={!pronta || ocupado}
            accessibilityLabel="Pressione e segure para gravar"
            testID="botao-gravar-video"
            style={[estilos.obturadorExterno, gravando && estilos.obturadorGravando]}>
            <View
              style={[estilos.obturadorInterno, gravando && estilos.obturadorInternoGravando]}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={tirarFoto}
            disabled={!pronta || ocupado}
            accessibilityLabel="Tirar foto"
            testID="botao-tirar-foto"
            style={estilos.obturadorExterno}>
            <View style={[estilos.obturadorInterno, estilos.obturadorFoto]} />
          </Pressable>
        )}

        <View style={estilos.galeria}>
          <Texto variante="legenda" cor={cores.textoSecundario} centralizado>
            {modo === 'video' ? 'Segure para gravar' : 'Toque para fotografar'}
          </Texto>
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  centro: { alignItems: 'center', justifyContent: 'center', gap: espacos.md, padding: espacos.xl },
  trilha: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  barra: { height: 4, backgroundColor: cores.vermelho },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
  },
  iconeBotao: { padding: espacos.xs },
  colunaDireita: { alignItems: 'center', gap: espacos.md },
  modos: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: raios.redondo,
    padding: 3,
  },
  modo: { paddingHorizontal: espacos.lg, paddingVertical: espacos.xs, borderRadius: raios.redondo },
  modoAtivo: { backgroundColor: cores.branco },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.xs,
    borderRadius: raios.redondo,
  },
  pontoVermelho: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.vermelho },
  rodape: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.xxl,
  },
  galeria: { width: 72, alignItems: 'center', gap: 2 },
  obturadorExterno: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: cores.branco,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obturadorGravando: { borderColor: cores.vermelho },
  obturadorInterno: { width: 64, height: 64, borderRadius: 32, backgroundColor: cores.vermelho },
  obturadorInternoGravando: { width: 36, height: 36, borderRadius: 8 },
  obturadorFoto: { backgroundColor: cores.branco },
});
