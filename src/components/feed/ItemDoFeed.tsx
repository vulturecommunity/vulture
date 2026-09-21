import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { Avatar, Icone, Texto } from '@/components/ui';
import { ICONE_INTERESSE } from '@/constants/interesses';
import { useCompartilhar, useCurtir, useSalvar } from '@/hooks/useInteracoes';
import { dataService } from '@/services/data';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import type { Video } from '@/types';

import { BarraDeAcoes } from './BarraDeAcoes';
import { CoracaoAnimado } from './CoracaoAnimado';
import { LegendaComHashtags } from './LegendaComHashtags';
import { PlayerDeVideo } from './PlayerDeVideo';
import { PostDeFoto } from './PostDeFoto';

export interface ItemDoFeedProps {
  video: Video;
  altura: number;
  /** este item é o visível */
  ativo: boolean;
  /** vizinho imediato: mantém o player montado e pré-carregado */
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

  const [coracao, setCoracao] = useState({ disparo: 0, x: 0, y: 0 });
  const [pausado, setPausado] = useState(false);
  const [ativoAnterior, setAtivoAnterior] = useState(ativo);

  // ao sair da tela, esquece a pausa: o vídeo volta a tocar sozinho quando reaparecer
  if (ativo !== ativoAnterior) {
    setAtivoAnterior(ativo);
    if (!ativo) setPausado(false);
  }

  const tocando = ativo && feedEmFoco;

  // registra a visualização depois de 2s com o item ativo
  useEffect(() => {
    if (!tocando) return;
    const timer = setTimeout(
      () =>
        dataService()
          .registrarVisualizacao(video.id)
          .catch(() => {}),
      2000,
    );
    return () => clearTimeout(timer);
  }, [tocando, video.id]);

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
            <PostDeFoto video={video} ativo={tocando} />
          ) : ativo || proximo ? (
            <PlayerDeVideo video={video} tocando={tocando} pausado={pausado} mudo={mudo} />
          ) : (
            <View style={estilos.placeholder} />
          )}
          <CoracaoAnimado disparo={coracao.disparo} x={coracao.x} y={coracao.y} />
        </View>
      </GestureDetector>

      <View
        style={[estilos.overlay, { paddingBottom: recuoInferior + espacos.md }]}
        pointerEvents="box-none">
        {video.tipo === 'video' ? (
          <Pressable
            onPress={alternarMudo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={mudo ? 'Ativar som' : 'Silenciar'}
            testID="botao-mudo"
            style={estilos.botaoMudo}>
            <Icone nome={mudo ? 'somDesligado' : 'somLigado'} tamanho={18} cor={cores.branco} />
          </Pressable>
        ) : null}
        <View style={estilos.painel}>
          <View style={estilos.linhaAutor}>
            <Pressable
              onPress={abrirPerfil}
              accessibilityRole="button"
              accessibilityLabel={`Perfil de @${video.autor.apelido}`}
              style={estilos.autor}>
              <Avatar url={video.autor.avatarUrl} nome={video.autor.nome} tamanho={40} borda />
              <View style={estilos.nomes}>
                <Texto variante="corpoForte" numberOfLines={1}>
                  @{video.autor.apelido}
                </Texto>
                <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
                  {video.autor.nome}
                </Texto>
              </View>
            </Pressable>
            <View style={estilos.categoria}>
              <Icone
                nome={ICONE_INTERESSE[video.categoria]}
                tamanho={12}
                cor={cores.vermelhoVivo}
              />
              <Texto variante="rotulo" cor={cores.textoSecundario}>
                {video.categoria}
              </Texto>
            </View>
          </View>

          {video.legenda ? <LegendaComHashtags texto={video.legenda} numberOfLines={3} /> : null}

          <View style={estilos.linhaAudio}>
            <Icone nome="microfone" tamanho={13} cor={cores.textoSecundario} />
            <Texto
              variante="pequeno"
              cor={cores.textoSecundario}
              numberOfLines={1}
              style={estilos.audio}>
              {video.audio || `Som original - ${video.autor.apelido}`}
            </Texto>
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
    paddingHorizontal: espacos.md,
  },
  painel: {
    backgroundColor: cores.vidro,
    borderRadius: raios.lg,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    padding: espacos.md,
    gap: espacos.sm,
  },
  linhaAutor: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  autor: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm, flex: 1 },
  nomes: { flexShrink: 1 },
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs,
    paddingHorizontal: espacos.sm,
    paddingVertical: 4,
    borderRadius: raios.sm,
    backgroundColor: cores.vidroClaro,
  },
  linhaAudio: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  audio: { flex: 1 },
  botaoMudo: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: espacos.sm,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
