import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
import type { Conversa } from '@/types';
import { tempoRelativo } from '@/utils/formatadores';

export interface LinhaDeConversaProps {
  conversa: Conversa;
  meuId: string;
  aoPressionar: () => void;
}

/** Item da lista de conversas: avatar, nome, prévia da última mensagem, hora e não lidas. */
export function LinhaDeConversa({ conversa, meuId, aoPressionar }: LinhaDeConversaProps) {
  const ultima = conversa.ultimaMensagem;
  const previa = ultima
    ? `${ultima.remetenteId === meuId ? 'Você: ' : ''}${ultima.texto}`
    : 'Diga oi 👋';
  const naoLidas = conversa.naoLidas > 0;
  return (
    <Pressable
      onPress={aoPressionar}
      style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
      accessibilityRole="button"
      accessibilityLabel={`Conversa com @${conversa.outro.apelido}`}
      testID={`conversa-${conversa.id}`}>
      <Avatar url={conversa.outro.avatarUrl} nome={conversa.outro.nome} tamanho={52} />
      <View style={estilos.textos}>
        <View style={estilos.topo}>
          <Texto
            variante={naoLidas ? 'corpoForte' : 'corpo'}
            numberOfLines={1}
            style={estilos.nome}>
            {conversa.outro.nome}
          </Texto>
          <Texto variante="legenda" cor={naoLidas ? cores.vermelhoVivo : cores.textoTerciario}>
            {tempoRelativo(ultima?.criadoEm ?? conversa.atualizadoEm)}
          </Texto>
        </View>
        <View style={estilos.baixo}>
          <Texto
            variante="pequeno"
            cor={naoLidas ? cores.texto : cores.textoSecundario}
            numberOfLines={1}
            style={estilos.previa}>
            {previa}
          </Texto>
          {naoLidas ? (
            <View style={estilos.badge} testID={`nao-lidas-${conversa.id}`}>
              <Texto variante="legenda" style={estilos.badgeTexto}>
                {conversa.naoLidas > 99 ? '99+' : conversa.naoLidas}
              </Texto>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
  },
  pressionada: { backgroundColor: cores.fundoElevado },
  textos: { flex: 1, gap: 3 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  nome: { flex: 1 },
  baixo: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  previa: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: raios.redondo,
    paddingHorizontal: 6,
    backgroundColor: cores.vermelhoVivo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontSize: 10, lineHeight: 12 },
});
