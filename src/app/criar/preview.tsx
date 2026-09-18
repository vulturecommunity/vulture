import { Ionicons } from '@expo/vector-icons';
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

import { Botao, Input, Texto } from '@/components/ui';
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
      mostrarAviso('Publicado! Seu vídeo já está no feed. 🔴⚫', 'sucesso');
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
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          { paddingTop: insets.top + espacos.sm, paddingBottom: insets.bottom + espacos.xl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Pressable
            onPress={refazer}
            hitSlop={12}
            disabled={publicando}
            accessibilityLabel="Refazer"
            style={estilos.voltar}>
            <Ionicons name="arrow-back" size={26} color={cores.texto} />
          </Pressable>
          <Texto variante="destaque">Nova publicação</Texto>
          <View style={estilos.voltar} />
        </View>

        <View style={estilos.linhaMidia}>
          <View style={estilos.caixaMidia}>
            {midia.tipo === 'video' ? (
              <PreviewDeVideo uri={midia.uri} />
            ) : (
              <Image source={{ uri: midia.uri }} style={estilos.midia} contentFit="cover" />
            )}
            <View style={estilos.etiqueta}>
              <Ionicons
                name={midia.tipo === 'video' ? 'videocam' : 'image'}
                size={12}
                color={cores.branco}
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
          <Texto variante="corpoForte">Hashtags sugeridas</Texto>
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
                    #{tag}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={estilos.bloco}>
          <Texto variante="corpoForte">Categoria</Texto>
          <View style={estilos.chips}>
            {INTERESSES.map((i) => (
              <Pressable
                key={i}
                onPress={() => definirCategoria(i)}
                disabled={publicando}
                style={[estilos.chip, categoria === i && estilos.chipAtivo]}
                accessibilityRole="radio"
                accessibilityState={{ selected: categoria === i }}
                testID={`categoria-${i}`}>
                <Texto
                  variante="pequeno"
                  cor={categoria === i ? cores.branco : cores.textoSecundario}>
                  {ICONE_INTERESSE[i]} {i}
                </Texto>
              </Pressable>
            ))}
          </View>
        </View>

        {midia.origem === 'camera' ? (
          <View style={estilos.linhaSwitch}>
            <Texto variante="corpo">Salvar também na galeria do celular</Texto>
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
            variante="secundario"
            onPress={refazer}
            disabled={publicando}
            style={{ flex: 1 }}
          />
          <Botao
            titulo="Publicar"
            onPress={aoPublicar}
            carregando={publicando}
            style={{ flex: 2 }}
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
  conteudo: { paddingHorizontal: espacos.lg, gap: espacos.lg },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voltar: { width: 40, padding: espacos.xs },
  linhaMidia: { flexDirection: 'row', gap: espacos.md },
  caixaMidia: {
    width: 120,
    height: 200,
    borderRadius: raios.md,
    overflow: 'hidden',
    backgroundColor: cores.pretoPuro,
  },
  midia: { width: '100%', height: '100%' },
  etiqueta: {
    position: 'absolute',
    bottom: espacos.xs,
    left: espacos.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: raios.sm,
  },
  colunaLegenda: { flex: 1, gap: espacos.xs },
  inputLegenda: { minHeight: 120, textAlignVertical: 'top' },
  bloco: { gap: espacos.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm },
  chip: {
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.xs + 2,
    borderRadius: raios.redondo,
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
  },
  progresso: { gap: espacos.xs },
  trilha: { height: 8, borderRadius: 4, backgroundColor: cores.fundoCartao, overflow: 'hidden' },
  barra: { height: 8, backgroundColor: cores.vermelho },
  rodape: { flexDirection: 'row', gap: espacos.md },
});
