import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SalaDaLive } from '@/components/lives/SalaDaLive';
import { Botao, Input, Texto } from '@/components/ui';
import { useCriarLive, useEncerrarLive } from '@/hooks/useLive';
import { modoDeLive, motivoDoModoSimulado } from '@/services/live';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import type { Live } from '@/types';

/** Iniciar transmissão: título + preview da câmera → "Entrar ao vivo" → sala com chat → encerrar. */
export default function TelaIniciarLive() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const [permissaoCamera, pedirCamera] = useCameraPermissions();
  const [permissaoMic, pedirMic] = useMicrophonePermissions();
  const criar = useCriarLive();
  const encerrar = useEncerrarLive();
  const [titulo, setTitulo] = useState('');
  const [live, setLive] = useState<Live | null>(null);
  const modo = modoDeLive();

  useFocusEffect(
    useCallback(() => {
      definirFoco(false);
      return () => definirFoco(true);
    }, [definirFoco]),
  );

  useEffect(() => {
    if (permissaoCamera && !permissaoCamera.granted && permissaoCamera.canAskAgain) pedirCamera();
    if (permissaoMic && !permissaoMic.granted && permissaoMic.canAskAgain) pedirMic();
  }, [permissaoCamera, permissaoMic, pedirCamera, pedirMic]);

  async function entrarAoVivo() {
    if (!titulo.trim()) {
      mostrarAviso('Dê um título para a sua live.', 'erro');
      return;
    }
    try {
      const nova = await criar.mutateAsync(titulo);
      setLive(nova);
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : 'Não foi possível iniciar a live', 'erro');
    }
  }

  async function encerrarLive() {
    if (!live) return;
    try {
      await encerrar.mutateAsync(live.id);
      mostrarAviso('Live encerrada. Valeu, nação!', 'sucesso');
      router.back();
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : 'Falha ao encerrar', 'erro');
    }
  }

  if (live) {
    return (
      <SalaDaLive
        live={live}
        anfitriao
        aoSair={encerrarLive}
        aoEncerrar={encerrarLive}
        encerrando={encerrar.isPending}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {permissaoCamera?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="front" mode="video" />
      ) : (
        <View style={[StyleSheet.absoluteFill, estilos.semCamera]}>
          <Ionicons name="videocam-off-outline" size={48} color={cores.textoTerciario} />
          <Texto variante="pequeno" cor={cores.textoSecundario}>
            Libere a câmera para ver o preview
          </Texto>
        </View>
      )}
      <View style={estilos.escurecer} pointerEvents="none" />

      <View style={[estilos.topo, { paddingTop: insets.top + espacos.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Fechar"
          testID="botao-fechar-iniciar">
          <Ionicons name="close" size={30} color={cores.branco} />
        </Pressable>
        <View style={estilos.badgeModo}>
          <Ionicons
            name={modo === 'livekit' ? 'cloud-done-outline' : 'flask-outline'}
            size={14}
            color={cores.branco}
          />
          <Texto variante="legenda">{modo === 'livekit' ? 'LiveKit' : 'Modo simulado'}</Texto>
        </View>
      </View>

      <View style={[estilos.formulario, { paddingBottom: insets.bottom + espacos.xl }]}>
        <Texto variante="subtitulo">Sua live</Texto>
        {modo === 'simulado' ? (
          <Texto variante="legenda" cor={cores.textoSecundario}>
            {motivoDoModoSimulado()} A demo mostra sua câmera local e o chat ao vivo. Com um
            development build + chaves do LiveKit, a transmissão vai para os espectadores de verdade
            (veja SETUP_LIVEKIT.md).
          </Texto>
        ) : null}
        <Input
          placeholder="Título da live (ex.: Esquenta pro clássico 🔴⚫)"
          value={titulo}
          onChangeText={setTitulo}
          maxLength={80}
          testID="campo-titulo-live"
        />
        <Botao
          titulo="Entrar ao vivo"
          onPress={entrarAoVivo}
          carregando={criar.isPending}
          largo
          tamanho="grande"
          icone={<Ionicons name="radio" size={18} color={cores.branco} />}
          testID="botao-entrar-ao-vivo"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  semCamera: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.sm,
    backgroundColor: cores.fundoElevado,
  },
  escurecer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
  },
  badgeModo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: espacos.sm,
    paddingVertical: 4,
    borderRadius: raios.sm,
  },
  formulario: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: espacos.md,
    padding: espacos.xl,
    backgroundColor: 'rgba(17,17,17,0.85)',
    borderTopLeftRadius: raios.xl,
    borderTopRightRadius: raios.xl,
  },
});
