import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Icone, Input, Texto } from '@/components/ui';
import { ICONE_INTERESSE, INTERESSES } from '@/constants/interesses';
import { usePublicar } from '@/hooks/usePublicar';
import { useCriacaoStore } from '@/stores/criacaoStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { formatarDuracao } from '@/utils/formatadores';
import { extrairHashtags } from '@/utils/hashtags';

const SUGESTOES = ['Maracanã', 'Bastidores', 'Golaço', 'Torcida', 'Base', 'Resenha'];

function PreviewDeVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={estilos.midia}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
    />
  );
}

/** Pré-visualização da captura + legenda, hashtags, categoria e publicação com progresso. */
export default function TelaPreview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const midia = useCriacaoStore((s) => s.midia);
  const legenda = useCriacaoStore((s) => s.legenda);
  const categoria = useCriacaoStore((s) => s.categoria);
  const progresso = useCriacaoStore((s) => s.progresso);
  const etapa = useCriacaoStore((s) => s.etapa);
  const publicando = useCriacaoStore((s) => s.publicando);
  const erro = useCriacaoStore((s) => s.erro);
  const definirLegenda = useCriacaoStore((s) => s.definirLegenda);
  const definirCategoria = useCriacaoStore((s) => s.definirCategoria);
  const limpar = useCriacaoStore((s) => s.limpar);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const publicar = usePublicar();
  const [salvarNaGaleria, setSalvarNaGaleria] = useState(true);

  if (!midia) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Texto variante="corpo" cor={cores.textoSecundario}>
          Nada para publicar.
        </Texto>
        <Botao titulo="Voltar para a câmera" onPress={() => router.replace('/criar/camera')} />
      </View>
    );
  }

  const hashtags = extrairHashtags(legenda);

  function adicionarHashtag(tag: string) {
    if (hashtags.some((h) => h.toLowerCase() === tag.toLowerCase())) return;
    definirLegenda(`${legenda.trimEnd()} #${tag}`.trim());
  }

  async function aoPublicar() {
    try {
      await publicar.mutateAsync({ salvarNaGaleria });
      limpar();
      mostrarAviso('Publicado! Seu vídeo já está no feed.', 'sucesso');
      router.dismissAll();
      router.replace('/(tabs)');
    } catch {
      // erro exibido pelo store
    }
  }

  function refazer() {
    limpar();
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Cabecalho titulo="Nova publicação" aoVoltar={refazer} rotuloVoltar="Refazer" />
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + espacos.xl }]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.linhaMidia}>
          <View style={estilos.caixaMidia}>
            {midia.tipo === 'video' ? (
              <PreviewDeVideo uri={midia.uri} />
            ) : (
              <Image source={{ uri: midia.uri }} style={estilos.midia} contentFit="cover" />
            )}
            <View style={estilos.etiqueta}>
              <Icone
                nome={midia.tipo === 'video' ? 'video' : 'foto'}
                tamanho={11}
                cor={cores.branco}
              />
              <Texto variante="legenda">{formatarDuracao(midia.duracao)}</Texto>
            </View>
          </View>
          <View style={estilos.colunaLegenda}>
            <Input
              placeholder="Escreva uma legenda... use #hashtags"
              value={legenda}
              onChangeText={definirLegenda}
              multiline
              maxLength={300}
              style={estilos.inputLegenda}
              editable={!publicando}
              testID="campo-legenda"
            />
            <Texto variante="legenda" cor={cores.textoTerciario}>
              {legenda.length}/300 · {hashtags.length} hashtag{hashtags.length === 1 ? '' : 's'}
            </Texto>
          </View>
        </View>

        <View style={estilos.bloco}>
          <Texto variante="rotulo" cor={cores.textoSecundario}>
            Hashtags sugeridas
          </Texto>
          <View style={estilos.chips}>
            {SUGESTOES.map((tag) => {
              const ativa = hashtags.some((h) => h.toLowerCase() === tag.toLowerCase());
              return (
                <Pressable
                  key={tag}
                  onPress={() => adicionarHashtag(tag)}
                  disabled={publicando || ativa}
                  style={[estilos.chip, ativa && estilos.chipAtivo]}
                  testID={`sugestao-${tag}`}>
                  <Texto variante="pequeno" cor={ativa ? cores.branco : cores.textoSecundario}>
                    <Texto variante="pequeno" cor={ativa ? cores.branco : cores.vermelhoVivo}>
                      #
                    </Texto>
                    {tag}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={estilos.bloco}>
          <Texto variante="rotulo" cor={cores.textoSecundario}>
            Categoria
          </Texto>
          <View style={estilos.chips}>
            {INTERESSES.map((i) => {
              const ativa = categoria === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => definirCategoria(i)}
                  disabled={publicando}
                  style={[estilos.chip, ativa && estilos.chipAtivo]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativa }}
                  testID={`categoria-${i}`}>
                  <Icone
                    nome={ICONE_INTERESSE[i]}
                    tamanho={13}
                    cor={ativa ? cores.branco : cores.vermelhoVivo}
                  />
                  <Texto variante="pequeno" cor={ativa ? cores.branco : cores.textoSecundario}>
                    {i}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>

        {midia.origem === 'camera' ? (
          <View style={estilos.linhaSwitch}>
            <View style={estilos.flex}>
              <Texto variante="corpo">Salvar na galeria</Texto>
              <Texto variante="pequeno" cor={cores.textoTerciario}>
                Guarda uma cópia no seu celular
              </Texto>
            </View>
            <Switch
              value={salvarNaGaleria}
              onValueChange={setSalvarNaGaleria}
              disabled={publicando}
              trackColor={{ true: cores.vermelho, false: cores.borda }}
              thumbColor={cores.branco}
            />
          </View>
        ) : null}

        {publicando || progresso > 0 ? (
          <View style={estilos.progresso} testID="progresso-upload">
            <View style={estilos.trilha}>
              <View style={[estilos.barra, { width: `${Math.round(progresso * 100)}%` }]} />
            </View>
            <Texto variante="pequeno" cor={cores.textoSecundario}>
              {etapa || 'Enviando'}… {Math.round(progresso * 100)}%
            </Texto>
          </View>
        ) : null}

        {erro ? (
          <Texto variante="pequeno" cor={cores.erro} centralizado testID="erro-publicar">
            {erro}
          </Texto>
        ) : null}

        <View style={estilos.rodape}>
          <Botao
            titulo="Refazer"
            variante="contorno"
            onPress={refazer}
            disabled={publicando}
            style={estilos.flex}
          />
          <Botao
            titulo="Publicar"
            onPress={aoPublicar}
            carregando={publicando}
            icone={<Icone nome="enviar" tamanho={16} cor={cores.branco} />}
            style={estilos.flex2}
            testID="botao-publicar"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  centro: { alignItems: 'center', justifyContent: 'center', gap: espacos.md },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  conteudo: { paddingHorizontal: espacos.lg, paddingTop: espacos.xs, gap: espacos.lg },
  linhaMidia: { flexDirection: 'row', gap: espacos.md },
  caixaMidia: {
    width: 120,
    height: 200,
    borderRadius: raios.md,
    overflow: 'hidden',
    backgroundColor: cores.pretoPuro,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  midia: { width: '100%', height: '100%' },
  etiqueta: {
    position: 'absolute',
    bottom: espacos.xs + 2,
    left: espacos.xs + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cores.vidro,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: raios.sm,
  },
  colunaLegenda: { flex: 1, gap: espacos.xs },
  inputLegenda: { minHeight: 120, textAlignVertical: 'top' },
  bloco: { gap: espacos.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 1,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    borderRadius: raios.md,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundoElevado,
  },
  chipAtivo: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacos.md,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  progresso: { gap: espacos.xs },
  trilha: { height: 6, borderRadius: 3, backgroundColor: cores.fundoCartao, overflow: 'hidden' },
  barra: { height: 6, backgroundColor: cores.vermelhoVivo },
  rodape: { flexDirection: 'row', gap: espacos.md },
});
