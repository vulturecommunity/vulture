import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BalaoDeMensagem } from '@/components/mensagens/BalaoDeMensagem';
import { Avatar, Carregando, Erro, Icone, Texto } from '@/components/ui';
import { TAMANHO_MAXIMO_MENSAGEM } from '@/constants/rasantes';
import { useConversa, useEnviarMensagem, useMensagens } from '@/hooks/useMensagens';
import { useVoltar } from '@/hooks/useVoltar';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios, tipografia } from '@/theme';
import type { Mensagem } from '@/types';
import { rotuloDoDia } from '@/utils/formatadores';

type Item = { tipo: 'dia'; id: string; rotulo: string } | { tipo: 'mensagem'; mensagem: Mensagem };

/** Agrupa por dia (separadores) — a lista é invertida, então o separador vem DEPOIS do grupo. */
function montarItens(mensagens: Mensagem[]): Item[] {
  const itens: Item[] = [];
  let diaAtual: string | null = null;
  for (const m of mensagens) {
    const dia = m.criadoEm.slice(0, 10);
    if (dia !== diaAtual) {
      diaAtual = dia;
      itens.push({ tipo: 'dia', id: `dia-${dia}`, rotulo: rotuloDoDia(m.criadoEm) });
    }
    itens.push({ tipo: 'mensagem', mensagem: m });
  }
  return itens.reverse();
}

/** Conversa privada: histórico com balões, separadores por dia, envio e chegada em tempo real. */
export default function TelaConversa() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const voltar = useVoltar('/mensagens');
  const insets = useSafeAreaInsets();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? '');
  const abrirDenuncia = useUiStore((s) => s.abrirDenuncia);
  const conversa = useConversa(id);
  const mensagens = useMensagens(id);
  const { enviar, enviando, erro, limparErro } = useEnviarMensagem(id);
  const [texto, setTexto] = useState('');
  const lista = useRef<FlatList<Item>>(null);

  const itens = useMemo(() => montarItens(mensagens.data ?? []), [mensagens.data]);

  const aoEnviar = useCallback(() => {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setTexto('');
    enviar(limpo);
    lista.current?.scrollToOffset({ offset: 0, animated: true });
  }, [texto, enviando, enviar]);

  const outro = conversa.data?.outro;

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.cabecalho}>
        <Pressable
          onPress={voltar}
          hitSlop={10}
          accessibilityLabel="Voltar"
          style={estilos.botaoVoltar}>
          <Icone nome="voltar" tamanho={20} cor={cores.texto} />
        </Pressable>
        {outro ? (
          <Pressable
            style={estilos.pessoa}
            onPress={() => router.push({ pathname: '/usuario/[id]', params: { id: outro.id } })}
            accessibilityLabel={`Abrir perfil de @${outro.apelido}`}
            testID="cabecalho-conversa">
            <Avatar url={outro.avatarUrl} nome={outro.nome} tamanho={38} />
            <View style={estilos.nomes}>
              <Texto variante="corpoForte" numberOfLines={1}>
                {outro.nome}
              </Texto>
              <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
                @{outro.apelido}
              </Texto>
            </View>
          </Pressable>
        ) : (
          <View style={estilos.pessoa} />
        )}
        {outro ? (
          <Pressable
            onPress={() =>
              abrirDenuncia({
                tipo: 'usuario',
                id: outro.id,
                autorId: outro.id,
                autorApelido: outro.apelido,
              })
            }
            hitSlop={10}
            accessibilityLabel="Mais opções"
            style={estilos.botaoVoltar}>
            <Icone nome="mais" tamanho={18} cor={cores.texto} />
          </Pressable>
        ) : null}
      </View>

      {mensagens.isError ? (
        <Erro erro={mensagens.error} aoTentarNovamente={() => mensagens.refetch()} />
      ) : mensagens.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          ref={lista}
          data={itens}
          inverted
          keyExtractor={(item) => (item.tipo === 'dia' ? item.id : item.mensagem.id)}
          contentContainerStyle={estilos.lista}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={estilos.vazio}>
              <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
                Começo de conversa. Manda um oi! 🔴⚫
              </Texto>
            </View>
          }
          renderItem={({ item, index }) => {
            if (item.tipo === 'dia') {
              return (
                <View style={estilos.dia}>
                  <Texto variante="legenda" cor={cores.textoTerciario}>
                    {item.rotulo}
                  </Texto>
                </View>
              );
            }
            // lista invertida: index+1 é a mensagem anterior no tempo, index-1 a seguinte
            const anterior = itens[index + 1];
            const seguinte = itens[index - 1];
            const mesmoAntes =
              anterior?.tipo === 'mensagem' &&
              anterior.mensagem.remetenteId === item.mensagem.remetenteId;
            const mesmoDepois =
              seguinte?.tipo === 'mensagem' &&
              seguinte.mensagem.remetenteId === item.mensagem.remetenteId;
            return (
              <BalaoDeMensagem
                mensagem={item.mensagem}
                minha={item.mensagem.remetenteId === meuId}
                primeiraDaSequencia={!mesmoAntes}
                ultimaDaSequencia={!mesmoDepois}
              />
            );
          }}
        />
      )}

      {erro ? (
        <Pressable onPress={limparErro} style={estilos.erro} testID="erro-envio">
          <Icone nome="alerta" tamanho={16} cor={cores.erro} />
          <Texto variante="pequeno" cor={cores.erro} style={estilos.flex}>
            {erro}
          </Texto>
        </Pressable>
      ) : null}

      <View style={[estilos.entrada, { paddingBottom: insets.bottom + espacos.sm }]}>
        <TextInput
          style={estilos.input}
          placeholder="Escreva uma mensagem..."
          placeholderTextColor={cores.textoTerciario}
          value={texto}
          onChangeText={setTexto}
          multiline
          maxLength={TAMANHO_MAXIMO_MENSAGEM}
          selectionColor={cores.vermelho}
          cursorColor={cores.vermelho}
          testID="campo-mensagem"
        />
        <Pressable
          onPress={aoEnviar}
          disabled={!texto.trim() || enviando}
          accessibilityLabel="Enviar"
          style={[estilos.botaoEnviar, (!texto.trim() || enviando) && estilos.botaoDesligado]}
          testID="botao-enviar-mensagem">
          <Icone nome="enviar" tamanho={18} cor={cores.branco} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  flex: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  botaoVoltar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pessoa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  nomes: { flex: 1 },
  lista: { paddingVertical: espacos.md, flexGrow: 1 },
  vazio: { flex: 1, justifyContent: 'center', padding: espacos.xl, transform: [{ scaleY: -1 }] },
  dia: {
    alignSelf: 'center',
    paddingHorizontal: espacos.md,
    paddingVertical: 4,
    marginVertical: espacos.sm,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
  },
  erro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginHorizontal: espacos.lg,
    marginBottom: espacos.xs,
    padding: espacos.sm,
    borderRadius: raios.sm,
    backgroundColor: cores.vermelhoSuave,
  },
  entrada: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacos.sm,
    paddingHorizontal: espacos.md,
    paddingTop: espacos.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
    backgroundColor: cores.fundo,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: espacos.md,
    paddingVertical: 10,
    borderRadius: raios.lg,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
    color: cores.texto,
    ...tipografia.corpo,
  },
  botaoEnviar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoDesligado: { opacity: 0.4 },
});
