import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Icone, Texto } from '@/components/ui';
import { REACOES, type Reacao } from '@/constants/interesses';
import { cores, espacos, raios, tipografia } from '@/theme';
import type { MensagemLive } from '@/types';

export interface ChatDaLiveProps {
  mensagens: MensagemLive[];
  aoEnviar: (texto: string) => Promise<void>;
  aoReagir: (reacao: Reacao) => Promise<void>;
  desabilitado?: boolean;
}

function ItemMensagem({ mensagem }: { mensagem: MensagemLive }) {
  return (
    <View style={estilos.mensagem}>
      <Avatar url={mensagem.autor.avatarUrl} nome={mensagem.autor.apelido} tamanho={26} />
      <Texto variante="pequeno" style={estilos.textoMensagem}>
        <Texto variante="pequeno" cor={cores.vermelhoVivo} style={estilos.autorMensagem}>
          @{mensagem.autor.apelido}{' '}
        </Texto>
        {mensagem.tipo === 'reacao' ? `reagiu ${mensagem.texto}` : mensagem.texto}
      </Texto>
    </View>
  );
}

/** Chat da live (lista + caixa de envio) e barra de reações temáticas. */
export function ChatDaLive({ mensagens, aoEnviar, aoReagir, desabilitado }: ChatDaLiveProps) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const listaRef = useRef<FlatList<MensagemLive>>(null);

  useEffect(() => {
    const timer = setTimeout(() => listaRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [mensagens.length]);

  const enviar = useCallback(async () => {
    const limpo = texto.trim();
    if (!limpo || enviando) return;
    setEnviando(true);
    try {
      await aoEnviar(limpo);
      setTexto('');
    } finally {
      setEnviando(false);
    }
  }, [texto, enviando, aoEnviar]);

  return (
    <View style={estilos.container} testID="chat-live">
      <FlatList
        ref={listaRef}
        data={mensagens}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ItemMensagem mensagem={item} />}
        style={estilos.lista}
        contentContainerStyle={estilos.conteudoLista}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      <View style={estilos.reacoes}>
        {REACOES.map((r) => (
          <Pressable
            key={r}
            onPress={() => aoReagir(r)}
            disabled={desabilitado}
            style={({ pressed }) => [estilos.reacao, pressed && estilos.reacaoPressionada]}
            accessibilityLabel={`Reagir com ${r}`}
            testID={`reacao-${r}`}>
            <Texto style={estilos.emoji}>{r}</Texto>
          </Pressable>
        ))}
      </View>
      <View style={estilos.caixa}>
        <TextInput
          style={estilos.input}
          placeholder={desabilitado ? 'Live encerrada' : 'Mande uma mensagem...'}
          placeholderTextColor={cores.textoTerciario}
          value={texto}
          onChangeText={setTexto}
          editable={!desabilitado}
          onSubmitEditing={enviar}
          returnKeyType="send"
          maxLength={200}
          selectionColor={cores.vermelho}
          testID="campo-chat"
        />
        <Pressable
          onPress={enviar}
          disabled={desabilitado || !texto.trim() || enviando}
          style={[estilos.enviar, (desabilitado || !texto.trim()) && estilos.enviarInativo]}
          accessibilityLabel="Enviar"
          testID="botao-enviar-chat">
          <Icone nome="enviar" tamanho={18} cor={cores.branco} />
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: espacos.sm },
  lista: { maxHeight: 220 },
  conteudoLista: { gap: espacos.xs, paddingHorizontal: espacos.lg },
  mensagem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.sm,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    borderRadius: raios.md,
    paddingHorizontal: espacos.sm,
    paddingVertical: espacos.xs + 1,
  },
  textoMensagem: { flexShrink: 1 },
  autorMensagem: { fontWeight: '700' },
  reacoes: { flexDirection: 'row', gap: espacos.sm, paddingHorizontal: espacos.lg },
  reacao: {
    width: 44,
    height: 44,
    borderRadius: raios.md,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reacaoPressionada: { borderColor: cores.vermelho, backgroundColor: cores.vermelhoSuave },
  emoji: { fontSize: 22, lineHeight: 26 },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.lg,
  },
  input: {
    flex: 1,
    ...tipografia.corpo,
    color: cores.texto,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    borderRadius: raios.md,
    paddingHorizontal: espacos.lg,
    height: 44,
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
