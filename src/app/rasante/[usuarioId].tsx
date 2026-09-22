import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Carregando, EstadoVazio, Icone, Texto } from '@/components/ui';
import {
  useExcluirRasante,
  useMarcarRasanteVisto,
  useRasantes,
  useRasantesDoUsuario,
} from '@/hooks/useRasantes';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import type { Rasante } from '@/types';
import { tempoRelativo } from '@/utils/formatadores';

function seguro(acao: () => void): void {
  try {
    acao();
  } catch {
    // player liberado
  }
}

/**
 * Visualizador de rasantes de uma pessoa: tela cheia, barrinhas de progresso no topo,
 * toque à direita avança, à esquerda volta, segurar pausa. No fim, passa para a próxima
 * pessoa da fileira (ou fecha).
 */
export default function TelaRasante() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const lista = useRasantesDoUsuario(usuarioId);
  const grupos = useRasantes();
  const marcarVisto = useMarcarRasanteVisto();
  const excluir = useExcluirRasante();
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const vistos = useRef(new Set<string>());

  const rasantes = lista.data ?? [];
  const atual: Rasante | undefined = rasantes[indice];

  // pausa o feed enquanto o rasante está aberto
  useEffect(() => {
    definirFoco(false);
    return () => definirFoco(true);
  }, [definirFoco]);

  const player = useVideoPlayer(atual ? { uri: atual.url } : null, (p) => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.1;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const [progresso, setProgresso] = useState(0);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const d = atual?.duracao || player.duration || 1;
    setProgresso(Math.min(1, currentTime / d));
  });

  const irParaProximaPessoa = useCallback(() => {
    const ordem = grupos.data?.filter((g) => !g.souEu).map((g) => g.autor.id) ?? [];
    const posicao = ordem.indexOf(usuarioId ?? '');
    const proxima = posicao >= 0 ? ordem[posicao + 1] : undefined;
    if (proxima)
      router.replace({ pathname: '/rasante/[usuarioId]', params: { usuarioId: proxima } });
    else router.back();
  }, [grupos.data, usuarioId, router]);

  const avancar = useCallback(() => {
    if (indice + 1 < rasantes.length) {
      setIndice(indice + 1);
      setProgresso(0);
    } else {
      irParaProximaPessoa();
    }
  }, [indice, rasantes.length, irParaProximaPessoa]);

  const voltar = useCallback(() => {
    if (indice > 0) {
      setIndice(indice - 1);
      setProgresso(0);
    } else {
      seguro(() => {
        player.currentTime = 0;
      });
      setProgresso(0);
    }
  }, [indice, player]);

  useEventListener(player, 'playToEnd', avancar);

  // toca/pausa conforme o estado e marca como visto ao exibir
  useEffect(() => {
    if (!atual) return;
    seguro(() => {
      if (pausado) player.pause();
      else player.play();
    });
    if (!vistos.current.has(atual.id)) {
      vistos.current.add(atual.id);
      marcarVisto.mutate(atual.id);
    }
    // marcarVisto é estável o bastante: só depende do queryClient
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id, pausado, player]);

  // lista vazia (tudo expirou) ou índice fora: fecha
  useEffect(() => {
    if (lista.isSuccess && rasantes.length === 0) {
      const timer = setTimeout(() => router.back(), 1500);
      return () => clearTimeout(timer);
    }
  }, [lista.isSuccess, rasantes.length, router]);

  function apagar() {
    if (!atual) return;
    Alert.alert('Apagar rasante?', 'Ele some para todo mundo agora.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await excluir.mutateAsync(atual.id);
            mostrarAviso('Rasante apagado.', 'sucesso');
            if (rasantes.length <= 1) router.back();
            else setIndice((i) => Math.max(0, Math.min(i, rasantes.length - 2)));
          } catch (erro) {
            mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível apagar.', 'erro');
          }
        },
      },
    ]);
  }

  if (lista.isLoading) return <Carregando />;
  if (!atual) {
    return (
      <View style={[estilos.tela, { paddingTop: insets.top }]}>
        <EstadoVazio
          icone="rasante"
          titulo="Esse rasante já voou"
          descricao="Rasantes somem depois de 24 horas."
          acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
        />
      </View>
    );
  }

  const souEu = atual.autorId === meuId;
  const carregando = status !== 'readyToPlay' && status !== 'error';

  return (
    <View style={estilos.tela} testID="tela-rasante">
      {atual.thumbnailUrl ? (
        <Image
          source={{ uri: atual.thumbnailUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        fullscreenOptions={{ enable: false }}
      />
      {carregando ? (
        <View style={estilos.centro} pointerEvents="none">
          <ActivityIndicator color={cores.branco} />
        </View>
      ) : null}
      {pausado ? (
        <View style={estilos.centro} pointerEvents="none">
          <View style={estilos.iconePausa}>
            <Icone nome="pausa" tamanho={28} cor={cores.branco} />
          </View>
        </View>
      ) : null}

      {/* zonas de toque: esquerda volta, direita avança; segurar pausa */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={estilos.zonas}>
          <Pressable
            style={estilos.zona}
            onPress={voltar}
            onLongPress={() => setPausado(true)}
            onPressOut={() => setPausado(false)}
            delayLongPress={180}
            accessibilityLabel="Rasante anterior"
            testID="zona-voltar"
          />
          <Pressable
            style={estilos.zona}
            onPress={avancar}
            onLongPress={() => setPausado(true)}
            onPressOut={() => setPausado(false)}
            delayLongPress={180}
            accessibilityLabel="Próximo rasante"
            testID="zona-avancar"
          />
        </View>
      </View>

      <View
        style={[estilos.topo, { paddingTop: insets.top + espacos.sm }]}
        pointerEvents="box-none">
        <View style={estilos.barras}>
          {rasantes.map((r, i) => (
            <View key={r.id} style={estilos.trilha}>
              <View
                style={[
                  estilos.barra,
                  { width: `${(i < indice ? 1 : i === indice ? progresso : 0) * 100}%` },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={estilos.linhaAutor}>
          <Pressable
            style={estilos.autor}
            onPress={() =>
              router.push({ pathname: '/usuario/[id]', params: { id: atual.autorId } })
            }
            accessibilityLabel={`Abrir perfil de @${atual.autor.apelido}`}>
            <Avatar url={atual.autor.avatarUrl} nome={atual.autor.nome} tamanho={36} />
            <View>
              <Texto variante="corpoForte" style={estilos.sombra}>
                {souEu ? 'Você' : `@${atual.autor.apelido}`}
              </Texto>
              <Texto variante="legenda" cor={cores.textoSecundario} style={estilos.sombra}>
                {tempoRelativo(atual.criadoEm)} · {indice + 1}/{rasantes.length}
              </Texto>
            </View>
          </Pressable>
          {souEu ? (
            <Pressable
              onPress={apagar}
              hitSlop={10}
              accessibilityLabel="Apagar rasante"
              style={estilos.botao}
              testID="botao-apagar-rasante">
              <Icone nome="excluir" tamanho={18} cor={cores.branco} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Fechar"
            style={estilos.botao}
            testID="botao-fechar-rasante">
            <Icone nome="fechar" tamanho={20} cor={cores.branco} />
          </Pressable>
        </View>
      </View>

      <View
        style={[estilos.rodape, { paddingBottom: insets.bottom + espacos.lg }]}
        pointerEvents="none">
        <Icone nome="rasante" tamanho={14} cor={cores.textoSecundario} />
        <Texto variante="legenda" cor={cores.textoSecundario} style={estilos.sombra}>
          Toque para avançar · segure para pausar
        </Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  centro: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconePausa: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: cores.vidro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zonas: { flex: 1, flexDirection: 'row' },
  zona: { flex: 1 },
  topo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: espacos.md,
    gap: espacos.sm,
  },
  barras: { flexDirection: 'row', gap: 4 },
  trilha: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  barra: { height: 3, backgroundColor: cores.branco },
  linhaAutor: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  autor: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  botao: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.vidro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sombra: { textShadowColor: cores.sombra, textShadowRadius: 6 },
  rodape: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs,
    paddingHorizontal: espacos.lg,
    borderRadius: raios.md,
  },
});
