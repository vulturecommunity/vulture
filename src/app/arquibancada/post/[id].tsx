import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotoesDeAnexo } from '@/components/arquibancada/BotoesDeAnexo';
import { CartaoDePost } from '@/components/arquibancada/CartaoDePost';
import { PreviaDeAnexos } from '@/components/arquibancada/PreviaDeAnexos';
import { SheetDeGifs } from '@/components/arquibancada/SheetDeGifs';
import { Cabecalho, Carregando, Erro, Icone, Texto } from '@/components/ui';
import { usePost, usePublicarPost, useRespostas } from '@/hooks/useArquibancada';
import { useAnexos } from '@/hooks/useAnexos';
import { useVoltar } from '@/hooks/useVoltar';
import { cores, espacos, raios, tipografia } from '@/theme';
import { TAMANHO_MAXIMO_POST, type MarcacaoDePartida, type Post } from '@/types';
import { mensagemDeErro } from '@/utils/erros';
import { tamanhoDoPost } from '@/utils/posts';

/** Thread de um post: o post em destaque, as respostas e a caixa para responder. */
export default function TelaDoPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const voltar = useVoltar('/arquibancada');
  const post = usePost(id);
  const respostas = useRespostas(id);
  const publicar = usePublicarPost();
  const [texto, setTexto] = useState('');
  const anexos = useAnexos();
  const [buscandoGif, setBuscandoGif] = useState(false);

  const tamanho = tamanhoDoPost(texto);
  const podeEnviar =
    (tamanho > 0 || anexos.anexos.length > 0) &&
    tamanho <= TAMANHO_MAXIMO_POST &&
    !publicar.isPending &&
    !anexos.preparando;

  const { anexos: midias, limpar } = anexos;
  const enviar = useCallback(async () => {
    if (!id || !podeEnviar) return;
    try {
      await publicar.mutateAsync({ texto, paiId: id, midias });
      setTexto('');
      limpar();
    } catch {
      // erro exibido acima da caixa
    }
  }, [id, podeEnviar, publicar, texto, midias, limpar]);

  // hashtag ou jogo tocados aqui abrem a resenha filtrada
  const porHashtag = useCallback(
    (tag: string) => router.push({ pathname: '/arquibancada', params: { tag } }),
    [router],
  );
  const porPartida = useCallback(
    (p: MarcacaoDePartida) =>
      router.push({ pathname: '/arquibancada', params: { partidaId: p.id, rotulo: p.rotulo } }),
    [router],
  );

  const renderizar = useCallback(
    ({ item }: { item: Post }) => (
      <CartaoDePost post={item} aoTocarHashtag={porHashtag} aoTocarPartida={porPartida} resposta />
    ),
    [porHashtag, porPartida],
  );

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Cabecalho titulo="Post" aoVoltar={voltar} />
      {post.isLoading ? (
        <Carregando />
      ) : post.isError || !post.data ? (
        <Erro
          erro={post.error ?? 'Post não encontrado.'}
          aoTentarNovamente={() => post.refetch()}
        />
      ) : (
        <>
          <FlatList
            data={respostas.data ?? []}
            keyExtractor={(p) => p.id}
            renderItem={renderizar}
            keyboardShouldPersistTaps="handled"
            onRefresh={() => {
              post.refetch();
              respostas.refetch();
            }}
            refreshing={post.isRefetching || respostas.isRefetching}
            ListHeaderComponent={
              <View>
                <CartaoDePost
                  post={post.data}
                  aoTocarHashtag={porHashtag}
                  aoTocarPartida={porPartida}
                  destaque
                  voltarAoExcluir
                />
                <Texto variante="rotulo" cor={cores.textoSecundario} style={estilos.rotulo}>
                  Respostas
                </Texto>
              </View>
            }
            ListEmptyComponent={
              respostas.isLoading ? (
                <Carregando telaCheia={false} />
              ) : (
                <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.vazio}>
                  Ninguém respondeu ainda. Puxa o assunto!
                </Texto>
              )
            }
            contentContainerStyle={estilos.lista}
          />

          {publicar.isError || anexos.erro ? (
            <Texto variante="legenda" cor={cores.erro} style={estilos.erro}>
              {anexos.erro ?? mensagemDeErro(publicar.error)}
            </Texto>
          ) : null}
          {anexos.anexos.length > 0 ? (
            <View style={estilos.previa}>
              <PreviaDeAnexos anexos={anexos.anexos} aoRemover={anexos.remover} compacta />
            </View>
          ) : null}
          <View style={[estilos.caixa, { paddingBottom: insets.bottom + espacos.sm }]}>
            <BotoesDeAnexo
              podeAdicionar={anexos.podeAdicionar}
              podeGif={anexos.podeGif}
              preparando={anexos.preparando}
              aoGaleria={anexos.daGaleria}
              aoGif={() => setBuscandoGif(true)}
            />
            <TextInput
              style={estilos.input}
              placeholder={`Responder @${post.data.autor.apelido}...`}
              placeholderTextColor={cores.textoTerciario}
              value={texto}
              onChangeText={setTexto}
              multiline
              selectionColor={cores.vermelho}
              testID="campo-resposta"
            />
            {tamanho > TAMANHO_MAXIMO_POST - 40 ? (
              <Texto
                variante="legenda"
                cor={tamanho > TAMANHO_MAXIMO_POST ? cores.erro : cores.textoTerciario}>
                {TAMANHO_MAXIMO_POST - tamanho}
              </Texto>
            ) : null}
            <Pressable
              onPress={enviar}
              disabled={!podeEnviar}
              style={[estilos.enviar, !podeEnviar && estilos.enviarInativo]}
              accessibilityRole="button"
              accessibilityLabel="Enviar resposta"
              testID="botao-enviar-resposta">
              {publicar.isPending ? (
                <ActivityIndicator color={cores.branco} />
              ) : (
                <Icone nome="enviar" tamanho={18} cor={cores.branco} />
              )}
            </Pressable>
          </View>
          <SheetDeGifs
            visivel={buscandoGif}
            aoFechar={() => setBuscandoGif(false)}
            aoEscolher={anexos.adicionarGif}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { flexGrow: 1, paddingBottom: espacos.lg },
  rotulo: { paddingHorizontal: espacos.lg, paddingTop: espacos.md, paddingBottom: espacos.xs },
  vazio: { paddingHorizontal: espacos.lg, paddingVertical: espacos.md },
  erro: { paddingHorizontal: espacos.lg, paddingTop: espacos.xs },
  previa: { paddingHorizontal: espacos.lg, paddingTop: espacos.xs },
  caixa: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacos.sm,
    paddingHorizontal: espacos.lg,
    paddingTop: espacos.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
    backgroundColor: cores.fundo,
  },
  input: {
    flex: 1,
    ...tipografia.corpo,
    color: cores.texto,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raios.md,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm + 2,
    maxHeight: 120,
  },
  enviar: {
    width: 44,
    height: 44,
    borderRadius: raios.md,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarInativo: { opacity: 0.4 },
});
