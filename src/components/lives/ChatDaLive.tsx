import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Texto } from '@/components/ui';
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
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          @{mensagem.autor.apelido}{' '}
        </Texto>
        {mensagem.tipo === 'reacao' ? `reagiu ${mensagem.texto}` : mensagem.texto}
      </Texto>
    </View>
  );
}

/** Chat da live (lista + caixa de envio) e barra de reações temáticas 🔴⚫🦅🏆. */
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
            style={estilos.reacao}
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
          testID="campo-chat"
        />
        <Pressable
          onPress={enviar}
          disabled={desabilitado || !texto.trim() || enviando}
          style={[estilos.enviar, (desabilitado || !texto.trim()) && estilos.enviarInativo]}
          accessibilityLabel="Enviar"
          testID="botao-enviar-chat">
          <Ionicons name="send" size={18} color={cores.branco} />
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: raios.lg,
    paddingHorizontal: espacos.sm,
    paddingVertical: espacos.xs,
  },
  textoMensagem: { flexShrink: 1 },
  reacoes: { flexDirection: 'row', gap: espacos.sm, paddingHorizontal: espacos.lg },
  reacao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: raios.redondo,
    paddingHorizontal: espacos.lg,
    height: 42,
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enviarInativo: { opacity: 0.4 },
});
