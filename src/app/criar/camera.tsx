import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Icone, Texto } from '@/components/ui';
import { DURACAO_MAXIMA_VIDEO_SEGUNDOS } from '@/constants/interesses';
import { DURACAO_MAXIMA_RASANTE_SEGUNDOS } from '@/constants/rasantes';
import { useVoltar } from '@/hooks/useVoltar';
import { useCriacaoStore } from '@/stores/criacaoStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { escolherTamanhoDeFoto } from '@/utils/camera';
import { formatarDuracao } from '@/utils/formatadores';

type Modo = 'video' | 'foto';

/**
 * Tela de captura: gravar vídeo (pressionar e segurar), tirar foto ou importar da galeria.
 * Com ?destino=rasante grava só vídeo de até 15 s e segue para a publicação do rasante.
 */
export default function TelaCamera() {
  const router = useRouter();
  const voltar = useVoltar('/(tabs)');
  const insets = useSafeAreaInsets();
  const { destino } = useLocalSearchParams<{ destino?: string }>();
  const rasante = destino === 'rasante';
  const limite = rasante ? DURACAO_MAXIMA_RASANTE_SEGUNDOS : DURACAO_MAXIMA_VIDEO_SEGUNDOS;
  const telaSeguinte = rasante ? '/rasante/novo' : '/criar/preview';
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
  const [emFoco, setEmFoco] = useState(true);
  const [tamanhoFoto, setTamanhoFoto] = useState<string | undefined>(undefined);
  const inicioRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // refs síncronas: o estado React pode não ter re-renderizado entre um pressIn e um pressOut
  // rápidos; chamar recordAsync duas vezes derruba o app no Android ("recording in progress")
  const gravandoRef = useRef(false);
  const ocupadoRef = useRef(false);

  // pausa o feed enquanto a câmera está aberta e desliga a câmera ao ir para o preview
  useFocusEffect(
    useCallback(() => {
      definirFoco(false);
      setEmFoco(true);
      return () => {
        definirFoco(true);
        setEmFoco(false);
      };
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

  const pararNativo = useCallback(() => {
    try {
      cameraRef.current?.stopRecording();
    } catch {
      // gravação já encerrada
    }
  }, []);

  const iniciarGravacao = useCallback(async () => {
    if (!cameraRef.current || !pronta || gravandoRef.current || ocupadoRef.current) return;
    gravandoRef.current = true;
    setGravando(true);
    setSegundos(0);
    inicioRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const passado = (Date.now() - inicioRef.current) / 1000;
      setSegundos(passado);
      if (passado >= limite) pararNativo();
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const resultado = await cameraRef.current.recordAsync({ maxDuration: limite });
      const duracao = Math.min(limite, (Date.now() - inicioRef.current) / 1000);
      pararContador();
      gravandoRef.current = false;
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
        router.push(telaSeguinte);
      }
    } catch (erro) {
      pararContador();
      gravandoRef.current = false;
      setGravando(false);
      mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível gravar.', 'erro');
    }
  }, [
    pronta,
    definirMidia,
    router,
    mostrarAviso,
    pararContador,
    pararNativo,
    limite,
    telaSeguinte,
  ]);

  const pararGravacao = useCallback(() => {
    if (!gravandoRef.current) return;
    // dá ao gravador nativo um instante para começar antes de encerrar (toque muito rápido)
    const decorrido = Date.now() - inicioRef.current;
    if (decorrido < 400) setTimeout(pararNativo, 400 - decorrido);
    else pararNativo();
  }, [pararNativo]);

  const tirarFoto = useCallback(async () => {
    if (!cameraRef.current || !pronta || ocupadoRef.current || gravandoRef.current) return;
    ocupadoRef.current = true;
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
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, [pronta, definirMidia, router, mostrarAviso]);

  const importarDaGaleria = useCallback(async () => {
    if (ocupadoRef.current || gravandoRef.current) return;
    ocupadoRef.current = true;
    setOcupado(true);
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        mostrarAviso('Libere o acesso à galeria para importar.', 'erro');
        return;
      }
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: rasante ? ['videos'] : ['videos', 'images'],
        allowsEditing: false,
        quality: 0.9,
        videoMaxDuration: limite,
      });
      if (resultado.canceled || resultado.assets.length === 0) return;
      const a = resultado.assets[0];
      const ehVideo = a.type === 'video';
      if (rasante && !ehVideo) {
        mostrarAviso('Rasante é só vídeo. Escolha um vídeo de até 15 segundos.', 'erro');
        return;
      }
      const duracao = ehVideo ? Math.min(limite, (a.duration ?? 0) / 1000) : 5;
      if (ehVideo && (a.duration ?? 0) / 1000 > limite + 1) {
        mostrarAviso(`Vídeos de até ${limite} segundos. Escolha um trecho menor.`, 'erro');
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
      router.push(telaSeguinte);
    } catch (erro) {
      mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível importar.', 'erro');
    } finally {
      ocupadoRef.current = false;
      setOcupado(false);
    }
  }, [definirMidia, router, mostrarAviso, rasante, limite, telaSeguinte]);

  // Ao ficar pronta, limita a resolução da foto (evita bitmaps de 12 MP+ na memória).
  const aoCameraPronta = useCallback(() => {
    setPronta(true);
    cameraRef.current
      ?.getAvailablePictureSizesAsync()
      .then((tamanhos) => setTamanhoFoto(escolherTamanhoDeFoto(tamanhos)))
      .catch(() => {});
  }, []);

  const semPermissao = !permissaoCamera?.granted || (modo === 'video' && !permissaoMic?.granted);

  if (!permissaoCamera || !permissaoMic) {
    return <View style={estilos.tela} />;
  }

  if (semPermissao) {
    return (
      <View style={[estilos.tela, estilos.centro, { paddingTop: insets.top }]}>
        <View style={estilos.circuloPermissao}>
          <Icone nome="camera" tamanho={30} cor={cores.textoSecundario} />
        </View>
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
        <Botao titulo="Importar da galeria" variante="contorno" onPress={importarDaGaleria} />
        <Botao titulo="Voltar" variante="fantasma" onPress={voltar} />
      </View>
    );
  }

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
        pictureSize={tamanhoFoto}
        mute={false}
        active={emFoco}
        onCameraReady={aoCameraPronta}
        testID="camera"
      />

      {/* barra de progresso da gravação */}
      <View style={[estilos.trilha, { top: insets.top }]}>
        <View style={[estilos.barra, { width: `${progresso * 100}%` }]} />
      </View>

      <View style={[estilos.topo, { paddingTop: insets.top + espacos.sm }]}>
        <Pressable
          onPress={voltar}
          hitSlop={12}
          disabled={gravando}
          accessibilityLabel="Fechar"
          style={estilos.iconeBotao}>
          <Icone nome="fechar" tamanho={20} cor={cores.branco} />
        </Pressable>
        {gravando ? (
          <View style={estilos.contador} testID="contador-gravacao">
            <View style={estilos.pontoVermelho} />
            <Texto variante="corpoForte">
              {formatarDuracao(segundos)} / {formatarDuracao(limite)}
            </Texto>
          </View>
        ) : rasante ? (
          <View style={estilos.contador} testID="etiqueta-rasante">
            <Icone nome="rasante" tamanho={14} cor={cores.vermelhoVivo} />
            <Texto variante="pequeno" cor={cores.branco} style={estilos.modoTextoAtivo}>
              Rasante · até {limite} s
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
                <Texto
                  variante="pequeno"
                  cor={cores.branco}
                  style={modo === m && estilos.modoTextoAtivo}>
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
            <Icone nome="virarCamera" tamanho={22} cor={cores.branco} />
          </Pressable>
          <Pressable
            onPress={() => setFlash((f) => !f)}
            hitSlop={10}
            accessibilityLabel="Flash"
            style={estilos.iconeBotao}
            testID="botao-flash">
            <Icone
              nome={flash ? 'flash' : 'flashDesligado'}
              tamanho={22}
              cor={flash ? cores.aviso : cores.branco}
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
          <View style={estilos.iconeGaleria}>
            <Icone nome="galeria" tamanho={22} cor={cores.branco} />
          </View>
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
  circuloPermissao: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trilha: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  barra: { height: 3, backgroundColor: cores.vermelhoVivo },
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
  iconeBotao: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colunaDireita: { alignItems: 'center', gap: espacos.sm },
  modos: {
    flexDirection: 'row',
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    borderRadius: raios.redondo,
    padding: 3,
  },
  modo: { paddingHorizontal: espacos.lg, paddingVertical: 6, borderRadius: raios.redondo },
  modoAtivo: { backgroundColor: cores.vermelho },
  modoTextoAtivo: { fontWeight: '700' },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    paddingHorizontal: espacos.md,
    paddingVertical: 6,
    borderRadius: raios.redondo,
  },
  pontoVermelho: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.vermelhoVivo },
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
  galeria: { width: 72, alignItems: 'center', gap: espacos.xs },
  iconeGaleria: {
    width: 46,
    height: 46,
    borderRadius: raios.md,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obturadorExterno: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: cores.vermelho,
    backgroundColor: cores.vidro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obturadorGravando: { borderColor: cores.vermelhoVivo },
  obturadorInterno: { width: 62, height: 62, borderRadius: 31, backgroundColor: cores.branco },
  obturadorInternoGravando: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: cores.vermelhoVivo,
  },
  obturadorFoto: { backgroundColor: cores.branco },
});
