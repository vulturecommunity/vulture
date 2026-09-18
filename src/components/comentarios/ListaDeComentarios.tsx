import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Botao, Carregando, EstadoVazio, Texto } from '@/components/ui';
import {
  useAdicionarComentario,
  useComentarios,
  useExcluirComentario,
} from '@/hooks/useComentarios';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios, tipografia } from '@/theme';
import type { Comentario } from '@/types';
import { tempoRelativo } from '@/utils/formatadores';

export interface ListaDeComentariosProps {
  videoId: string;
  meuId: string | null;
}

function ItemComentario({
  comentario,
  meuId,
  aoResponder,
  aoExcluir,
  aoDenunciar,
  resposta = false,
}: {
  comentario: Comentario;
  meuId: string | null;
  aoResponder: (c: Comentario) => void;
  aoExcluir: (c: Comentario) => void;
  aoDenunciar: (c: Comentario) => void;
  resposta?: boolean;
}) {
  const meu = comentario.autorId === meuId;
  return (
    <View
      style={[estilos.comentario, resposta && estilos.resposta]}
      testID={`comentario-${comentario.id}`}>
      <Avatar
        url={comentario.autor.avatarUrl}
        nome={comentario.autor.nome}
        tamanho={resposta ? 28 : 36}
      />
      <View style={estilos.corpoComentario}>
        <View style={estilos.linhaAutor}>
          <Texto variante="pequeno" cor={cores.textoSecundario}>
            @{comentario.autor.apelido}
          </Texto>
          <Texto variante="legenda" cor={cores.textoTerciario}>
            {tempoRelativo(comentario.criadoEm)}
          </Texto>
        </View>
        <Texto variante="corpo">{comentario.texto}</Texto>
        <View style={estilos.acoes}>
          {!resposta ? (
            <Pressable
              onPress={() => aoResponder(comentario)}
              hitSlop={6}
              accessibilityRole="button">
              <Texto variante="legenda" cor={cores.textoSecundario}>
                Responder
              </Texto>
            </Pressable>
          ) : null}
          {meu ? (
            <Pressable onPress={() => aoExcluir(comentario)} hitSlop={6} accessibilityRole="button">
              <Texto variante="legenda" cor={cores.erro}>
                Excluir
              </Texto>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => aoDenunciar(comentario)}
              hitSlop={6}
              accessibilityRole="button">
              <Texto variante="legenda" cor={cores.textoTerciario}>
                Denunciar
              </Texto>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/** Lista de comentários com respostas em 1 nível e caixa de envio. */
export function ListaDeComentarios({ videoId, meuId }: ListaDeComentariosProps) {
  const { data, isLoading, isError, error, refetch } = useComentarios(videoId);
  const adicionar = useAdicionarComentario(videoId);
  const excluir = useExcluirComentario(videoId);
  const abrirDenuncia = useUiStore((s) => s.abrirDenuncia);
  const [texto, setTexto] = useState('');
  const [respondendo, setRespondendo] = useState<Comentario | null>(null);

  const enviar = useCallback(async () => {
    const limpo = texto.trim();
    if (!limpo) return;
    try {
      await adicionar.mutateAsync({ texto: limpo, paiId: respondendo?.id ?? null });
      setTexto('');
      setRespondendo(null);
    } catch {
      // erro exibido abaixo
    }
  }, [texto, respondendo, adicionar]);

  const aoDenunciar = useCallback(
    (c: Comentario) =>
      abrirDenuncia({
        tipo: 'comentario',
        id: c.id,
        autorId: c.autorId,
        autorApelido: c.autor.apelido,
      }),
    [abrirDenuncia],
  );

  const renderizar = useCallback(
    ({ item }: { item: Comentario }) => (
      <View>
        <ItemComentario
          comentario={item}
          meuId={meuId}
          aoResponder={setRespondendo}
          aoExcluir={(c) => excluir.mutate(c.id)}
          aoDenunciar={aoDenunciar}
        />
        {item.respostas.map((r) => (
          <ItemComentario
            key={r.id}
            comentario={r}
            meuId={meuId}
            aoResponder={setRespondendo}
            aoExcluir={(c) => excluir.mutate(c.id)}
            aoDenunciar={aoDenunciar}
            resposta
          />
        ))}
      </View>
    ),
    [meuId, excluir, aoDenunciar],
  );

  return (
    <View style={estilos.container} testID="lista-comentarios">
      {isLoading ? (
        <Carregando telaCheia={false} />
      ) : isError ? (
        <View style={estilos.erro}>
          <Texto variante="pequeno" cor={cores.erro}>
            {error instanceof Error ? error.message : 'Erro ao carregar'}
          </Texto>
          <Botao
            titulo="Tentar de novo"
            variante="secundario"
            tamanho="pequeno"
            onPress={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(c) => c.id}
          renderItem={renderizar}
          contentContainerStyle={estilos.lista}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EstadoVazio
              icone="chatbubbles-outline"
              titulo="Nenhum comentário ainda"
              descricao="Puxe a resenha: seja o primeiro a comentar."
            />
          }
        />
      )}

      {respondendo ? (
        <View style={estilos.respondendo}>
          <Texto
            variante="pequeno"
            cor={cores.textoSecundario}
            style={{ flex: 1 }}
            numberOfLines={1}>
            Respondendo @{respondendo.autor.apelido}
          </Texto>
          <Pressable
            onPress={() => setRespondendo(null)}
            hitSlop={8}
            accessibilityLabel="Cancelar resposta">
            <Ionicons name="close" size={18} color={cores.textoSecundario} />
          </Pressable>
        </View>
      ) : null}
      {adicionar.isError ? (
        <Texto variante="legenda" cor={cores.erro} style={estilos.erroEnvio}>
          {adicionar.error instanceof Error ? adicionar.error.message : 'Não foi possível comentar'}
        </Texto>
      ) : null}
      <View style={estilos.caixa}>
        <TextInput
          style={estilos.input}
          placeholder={respondendo ? 'Escreva sua resposta...' : 'Comente aqui...'}
          placeholderTextColor={cores.textoTerciario}
          value={texto}
          onChangeText={setTexto}
          multiline
          maxLength={300}
          testID="campo-comentario"
        />
        <Pressable
          onPress={enviar}
          disabled={!texto.trim() || adicionar.isPending}
          style={[estilos.enviar, (!texto.trim() || adicionar.isPending) && estilos.enviarInativo]}
          accessibilityRole="button"
          accessibilityLabel="Enviar comentário"
          testID="botao-enviar-comentario">
          <Ionicons name="send" size={20} color={cores.branco} />
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1 },
  lista: { paddingHorizontal: espacos.lg, paddingVertical: espacos.sm, flexGrow: 1 },
  comentario: { flexDirection: 'row', gap: espacos.sm, paddingVertical: espacos.sm },
  resposta: { paddingLeft: espacos.xxl },
  corpoComentario: { flex: 1, gap: 2 },
  linhaAutor: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  acoes: { flexDirection: 'row', gap: espacos.lg, marginTop: 2 },
  respondendo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.xs,
    backgroundColor: cores.fundoCartao,
  },
  erro: { alignItems: 'center', gap: espacos.sm, padding: espacos.lg },
  erroEnvio: { paddingHorizontal: espacos.lg, paddingTop: espacos.xs },
  caixa: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacos.sm,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
  input: {
    flex: 1,
    ...tipografia.corpo,
    color: cores.texto,
    backgroundColor: cores.fundoCartao,
    borderRadius: raios.lg,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    maxHeight: 100,
  },
  enviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarInativo: { opacity: 0.4 },
});
