import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Avatar, Icone, Texto } from '@/components/ui';
import { ICONE_INTERESSE } from '@/constants/interesses';
import { useCompartilhar, useCurtir, useSalvar } from '@/hooks/useInteracoes';
import { dataService } from '@/services/data';
import { useAjustesStore } from '@/stores/ajustesStore';
import { useHistoricoStore } from '@/stores/historicoStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos } from '@/theme';
import type { Video } from '@/types';

import { BarraDeAcoes } from './BarraDeAcoes';
import { GEOMETRIA_BARRA } from './BarraDeProgresso';
import { CoracaoAnimado } from './CoracaoAnimado';
import { LegendaComHashtags } from './LegendaComHashtags';
import { PlayerDeVideo } from './PlayerDeVideo';
import { PostDeFoto } from './PostDeFoto';

export interface ItemDoFeedProps {
  video: Video;
  altura: number;
  /** este item é o visível */
  ativo: boolean;
  /** é o próximo item: mantém o player montado e pré-carregado */
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

  const economizarDados = useAjustesStore((s) => s.economizarDados);
  const registrarAssistido = useHistoricoStore((s) => s.registrarAssistido);

  const [coracao, setCoracao] = useState({ disparo: 0, x: 0, y: 0 });
  const [pausado, setPausado] = useState(economizarDados);
  const [ativoAnterior, setAtivoAnterior] = useState(ativo);

  // ao sair da tela, esquece a pausa; ao chegar, o economizador de dados segura
  // o vídeo na capa até a pessoa tocar
  if (ativo !== ativoAnterior) {
    setAtivoAnterior(ativo);
    setPausado(ativo ? economizarDados : false);
  }

  const tocando = ativo && feedEmFoco;
  const assistindo = tocando && !pausado;
  // o nome só entra quando diz algo além do apelido
  const mostrarNome =
    video.autor.nome.trim().toLowerCase() !== video.autor.apelido.trim().toLowerCase();

  // registra a visualização (e o histórico local) depois de 2s de vídeo rodando
  useEffect(() => {
    if (!assistindo) return;
    const timer = setTimeout(() => {
      dataService()
        .registrarVisualizacao(video.id)
        .catch(() => {});
      registrarAssistido({
        videoId: video.id,
        legenda: video.legenda,
        apelido: video.autor.apelido,
        thumbnailUrl: video.thumbnailUrl,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [assistindo, registrarAssistido, video]);

  // toque simples = pausar / retomar (como no TikTok e no Kwai)
  const aoToqueSimples = useCallback(() => {
    setPausado((p) => !p);
  }, []);

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

  const abrirPerfil = useCallback(() => {
    if (meuId === video.autorId) router.push('/(tabs)/perfil');
    else router.push({ pathname: '/usuario/[id]', params: { id: video.autorId } });
  }, [meuId, router, video.autorId]);

  return (
    <View style={[estilos.item, { height: altura }]} testID={`item-feed-${video.id}`}>
      <GestureDetector gesture={gestos}>
        <View style={StyleSheet.absoluteFill}>
          {video.tipo === 'foto' ? (
            <PostDeFoto video={video} />
          ) : ativo || proximo ? (
            <PlayerDeVideo video={video} tocando={tocando} pausado={pausado} mudo={mudo} />
          ) : (
            // fora da janela de players: só a miniatura, sem custo de player nativo
            <View style={estilos.placeholder}>
              {video.thumbnailUrl ? (
                <Image
                  source={{ uri: video.thumbnailUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit={(video.altura ?? 0) > (video.largura ?? 0) ? 'cover' : 'contain'}
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>
          )}
          <CoracaoAnimado disparo={coracao.disparo} x={coracao.x} y={coracao.y} />
        </View>
      </GestureDetector>

      {video.tipo === 'video' ? (
        <Pressable
          onPress={alternarMudo}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={mudo ? 'Ativar som' : 'Silenciar'}
          testID="botao-mudo"
          style={estilos.botaoMudo}>
          <Icone nome={mudo ? 'somDesligado' : 'somLigado'} tamanho={18} cor={cores.branco} />
        </Pressable>
      ) : null}

      <View
        style={[
          estilos.overlay,
          {
            paddingBottom:
              recuoInferior +
              (video.tipo === 'video' ? GEOMETRIA_BARRA.espacoReservado : espacos.lg),
          },
        ]}
        pointerEvents="box-none">
        <Pressable
          onPress={abrirPerfil}
          accessibilityRole="button"
          accessibilityLabel={`Perfil de @${video.autor.apelido}`}
          style={estilos.autor}>
          <Avatar url={video.autor.avatarUrl} nome={video.autor.nome} tamanho={34} borda />
          <Texto variante="corpoForte" numberOfLines={1} style={estilos.sombra}>
            @{video.autor.apelido}
          </Texto>
          {mostrarNome ? (
            <Texto
              variante="pequeno"
              cor={cores.textoSecundario}
              numberOfLines={1}
              style={[estilos.sombra, estilos.nome]}>
              {video.autor.nome}
            </Texto>
          ) : null}
        </Pressable>

        {video.legenda ? (
          <LegendaComHashtags texto={video.legenda} numberOfLines={2} style={estilos.sombra} />
        ) : null}

        <View style={estilos.linhaMeta}>
          <Icone nome="microfone" tamanho={12} cor={cores.textoSecundario} />
          <Texto
            variante="legenda"
            cor={cores.textoSecundario}
            numberOfLines={1}
            style={[estilos.audio, estilos.sombra]}>
            {video.audio || `Som original - ${video.autor.apelido}`}
          </Texto>
          <View style={estilos.categoria}>
            <Icone nome={ICONE_INTERESSE[video.categoria]} tamanho={10} cor={cores.vermelhoVivo} />
            <Texto variante="legenda" cor={cores.textoSecundario}>
              {video.categoria}
            </Texto>
          </View>
        </View>

        <BarraDeAcoes
          video={video}
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: espacos.lg,
    gap: espacos.sm,
  },
  // sem véu atrás: o contorno é o que garante a leitura sobre vídeo claro
  sombra: {
    textShadowColor: cores.sombraForte,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  autor: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  nome: { flexShrink: 1 },
  linhaMeta: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs + 2 },
  audio: { flex: 1 },
  categoria: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  botaoMudo: {
    position: 'absolute',
    top: espacos.md,
    right: espacos.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
