import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Carregando, Erro, EstadoVazio, Texto } from '@/components/ui';
import { useLives } from '@/hooks/useLive';
import { modoDeLive, motivoDoModoSimulado } from '@/services/live';
import { cores, espacos, raios } from '@/theme';
import type { Live } from '@/types';
import { formatarContador, tempoRelativo } from '@/utils/formatadores';

function CardLive({ live, aoAbrir }: { live: Live; aoAbrir: () => void }) {
  return (
    <Pressable
      onPress={aoAbrir}
      style={estilos.card}
      accessibilityRole="button"
      testID={`card-live-${live.id}`}>
      <View style={estilos.capa}>
        {live.thumbnailUrl ? (
          <Image
            source={{ uri: live.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, estilos.capaVazia]}>
            <Ionicons name="radio" size={40} color={cores.textoTerciario} />
          </View>
        )}
        <View style={estilos.badgeAoVivo}>
          <View style={estilos.ponto} />
          <Texto variante="legenda">AO VIVO</Texto>
        </View>
        <View style={estilos.badgeEspectadores}>
          <Ionicons name="eye" size={12} color={cores.branco} />
          <Texto variante="legenda">{formatarContador(live.espectadores)}</Texto>
        </View>
      </View>
      <View style={estilos.info}>
        <Avatar url={live.anfitriao.avatarUrl} nome={live.anfitriao.nome} tamanho={36} />
        <View style={{ flex: 1 }}>
          <Texto variante="corpoForte" numberOfLines={2}>
            {live.titulo}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSecundario}>
            @{live.anfitriao.apelido} · há {tempoRelativo(live.iniciadaEm)}
          </Texto>
        </View>
      </View>
    </Pressable>
  );
}

/** Lista de transmissões ativas + botão para iniciar a própria live. */
export default function TelaLives() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lives = useLives();
  const modo = modoDeLive();

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <View style={estilos.topo}>
        <Texto variante="titulo">Lives</Texto>
        <Botao
          titulo="Iniciar live"
          tamanho="pequeno"
          icone={<Ionicons name="videocam" size={16} color={cores.branco} />}
          onPress={() => router.push('/live/iniciar')}
          testID="botao-iniciar-live"
        />
      </View>
      {modo === 'simulado' ? (
        <View style={estilos.avisoModo} testID="aviso-modo-simulado">
          <Ionicons name="information-circle-outline" size={16} color={cores.aviso} />
          <Texto variante="legenda" cor={cores.textoSecundario} style={{ flex: 1 }}>
            Modo live simulada: {motivoDoModoSimulado()} Chat e reações funcionam normalmente.
          </Texto>
        </View>
      ) : null}

      {lives.isLoading ? (
        <Carregando />
      ) : lives.isError ? (
        <Erro erro={lives.error} aoTentarNovamente={() => lives.refetch()} />
      ) : (
        <FlatList
          data={lives.data ?? []}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <CardLive
              live={item}
              aoAbrir={() => router.push({ pathname: '/live/[id]', params: { id: item.id } })}
            />
          )}
          contentContainerStyle={estilos.lista}
          onRefresh={() => lives.refetch()}
          refreshing={lives.isRefetching}
          ListEmptyComponent={
            <EstadoVazio
              icone="radio-outline"
              titulo="Nenhuma live no ar"
              descricao="Seja o primeiro a transmitir para a nação."
              acao={{ titulo: 'Iniciar live', aoPressionar: () => router.push('/live/iniciar') }}
            />
          }
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
  avisoModo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginHorizontal: espacos.lg,
    marginBottom: espacos.sm,
    padding: espacos.sm,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
  },
  lista: { padding: espacos.lg, gap: espacos.lg, flexGrow: 1 },
  card: { backgroundColor: cores.fundoElevado, borderRadius: raios.lg, overflow: 'hidden' },
  capa: { height: 180, backgroundColor: cores.fundoCartao },
  capaVazia: { alignItems: 'center', justifyContent: 'center' },
  badgeAoVivo: {
    position: 'absolute',
    top: espacos.sm,
    left: espacos.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: cores.vermelho,
    paddingHorizontal: espacos.sm,
    paddingVertical: 3,
    borderRadius: raios.sm,
  },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.branco },
  badgeEspectadores: {
    position: 'absolute',
    top: espacos.sm,
    right: espacos.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: espacos.sm,
    paddingVertical: 3,
    borderRadius: raios.sm,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm, padding: espacos.md },
});
