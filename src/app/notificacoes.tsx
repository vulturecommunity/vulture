import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Carregando, EstadoVazio, Texto } from '@/components/ui';
import { useMarcarNotificacoesComoLidas, useNotificacoes } from '@/hooks/useNotificacoes';
import { cores, espacos } from '@/theme';
import type { Notificacao } from '@/types';
import { tempoRelativo } from '@/utils/formatadores';

const ICONES: Record<Notificacao['tipo'], keyof typeof Ionicons.glyphMap> = {
  curtida: 'heart',
  comentario: 'chatbubble-ellipses',
  seguiu: 'person-add',
  sistema: 'megaphone',
};

/** Lista de eventos: curtiu, comentou, seguiu, avisos do app. */
export default function TelaNotificacoes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notificacoes = useNotificacoes();
  const { mutate: marcarLidas } = useMarcarNotificacoesComoLidas();

  useEffect(() => {
    if (notificacoes.data?.some((n) => !n.lida)) {
      const timer = setTimeout(() => marcarLidas(), 1200);
      return () => clearTimeout(timer);
    }
  }, [notificacoes.data, marcarLidas]);

  function abrir(n: Notificacao) {
    if (n.videoId) router.push({ pathname: '/video/[id]', params: { id: n.videoId } });
    else if (n.deId) router.push({ pathname: '/usuario/[id]', params: { id: n.deId } });
  }

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <View style={estilos.topo}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Voltar"
          style={estilos.lado}>
          <Ionicons name="arrow-back" size={26} color={cores.texto} />
        </Pressable>
        <Texto variante="destaque">Notificações</Texto>
        <View style={estilos.lado} />
      </View>
      {notificacoes.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          data={notificacoes.data ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ flexGrow: 1 }}
          onRefresh={() => notificacoes.refetch()}
          refreshing={notificacoes.isRefetching}
          ListEmptyComponent={
            <EstadoVazio
              icone="notifications-off-outline"
              titulo="Nada por aqui ainda"
              descricao="Curtidas, comentários e novos seguidores aparecem aqui."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => abrir(item)}
              style={[estilos.linha, !item.lida && estilos.naoLida]}
              testID={`notificacao-${item.id}`}>
              {item.de ? (
                <Avatar url={item.de.avatarUrl} nome={item.de.apelido} tamanho={44} />
              ) : (
                <View style={estilos.iconeSistema}>
                  <Ionicons name="megaphone" size={20} color={cores.branco} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Texto variante="corpo">
                  {item.de ? <Texto variante="corpoForte">@{item.de.apelido} </Texto> : null}
                  {item.texto}
                </Texto>
                <Texto variante="legenda" cor={cores.textoTerciario}>
                  {tempoRelativo(item.criadoEm)}
                </Texto>
              </View>
              <Ionicons
                name={ICONES[item.tipo]}
                size={18}
                color={item.tipo === 'curtida' ? cores.vermelho : cores.textoSecundario}
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
  },
  lado: { width: 32 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
  },
  naoLida: { backgroundColor: cores.vermelhoSuave },
  iconeSistema: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
