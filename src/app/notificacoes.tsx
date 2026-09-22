import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Cabecalho,
  Carregando,
  EstadoVazio,
  Icone,
  Texto,
  type NomeDeIcone,
} from '@/components/ui';
import { useMarcarNotificacoesComoLidas, useNotificacoes } from '@/hooks/useNotificacoes';
import { cores, espacos, raios } from '@/theme';
import type { Notificacao } from '@/types';
import { tempoRelativo } from '@/utils/formatadores';

const ICONES: Record<Notificacao['tipo'], NomeDeIcone> = {
  curtida: 'curtido',
  comentario: 'comentar',
  seguiu: 'seguiu',
  live: 'aoVivo',
  sistema: 'megafone',
};

const CORES: Record<Notificacao['tipo'], string> = {
  curtida: cores.vermelhoVivo,
  comentario: cores.textoSecundario,
  seguiu: cores.sucesso,
  live: cores.vermelhoVivo,
  sistema: cores.dourado,
};

/** Lista de eventos: curtiu, comentou, seguiu, entrou ao vivo, avisos do app. */
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
    if (n.liveId) router.push({ pathname: '/live/[id]', params: { id: n.liveId } });
    else if (n.videoId) router.push({ pathname: '/video/[id]', params: { id: n.videoId } });
    else if (n.deId) router.push({ pathname: '/usuario/[id]', params: { id: n.deId } });
  }

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho titulo="Notificações" aoVoltar={() => router.back()} />
      {notificacoes.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          data={notificacoes.data ?? []}
          keyExtractor={(n) => n.id}
          contentContainerStyle={estilos.lista}
          onRefresh={() => notificacoes.refetch()}
          refreshing={notificacoes.isRefetching}
          ListEmptyComponent={
            <EstadoVazio
              icone="sinoMudo"
              titulo="Nada por aqui ainda"
              descricao="Curtidas, comentários, novos seguidores e lives de quem você segue aparecem aqui."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => abrir(item)}
              style={({ pressed }) => [
                estilos.linha,
                !item.lida && estilos.naoLida,
                pressed && estilos.pressionada,
              ]}
              testID={`notificacao-${item.id}`}>
              {!item.lida ? <View style={estilos.marcador} /> : null}
              {item.de ? (
                <Avatar url={item.de.avatarUrl} nome={item.de.apelido} tamanho={44} />
              ) : (
                <View style={estilos.iconeSistema}>
                  <Icone nome="megafone" tamanho={20} cor={cores.branco} />
                </View>
              )}
              <View style={estilos.flex}>
                <Texto variante="corpo">
                  {item.de ? <Texto variante="corpoForte">@{item.de.apelido} </Texto> : null}
                  {item.texto}
                </Texto>
                <Texto variante="legenda" cor={cores.textoTerciario}>
                  {item.tipo === 'live' ? 'AO VIVO · ' : ''}
                  {tempoRelativo(item.criadoEm)}
                </Texto>
              </View>
              <View style={estilos.tipo}>
                <Icone nome={ICONES[item.tipo]} tamanho={16} cor={CORES[item.tipo]} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  flex: { flex: 1 },
  lista: { flexGrow: 1, paddingHorizontal: espacos.md, paddingTop: espacos.xs, gap: espacos.xs },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.md,
    borderRadius: raios.md,
    overflow: 'hidden',
  },
  naoLida: { backgroundColor: cores.fundoElevado },
  pressionada: { backgroundColor: cores.fundoCartao },
  marcador: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: cores.vermelho,
  },
  iconeSistema: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
