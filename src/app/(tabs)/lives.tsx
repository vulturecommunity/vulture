import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Carregando, Erro, EstadoVazio, Icone, Texto } from '@/components/ui';
import { useLives } from '@/hooks/useLive';
import { modoDeLive, motivoDoModoSimulado } from '@/services/live';
import { cores, espacos, raios } from '@/theme';
import type { Live } from '@/types';
import { formatarContador, tempoRelativo } from '@/utils/formatadores';

function CardLive({ live, aoAbrir }: { live: Live; aoAbrir: () => void }) {
  return (
    <Pressable
      onPress={aoAbrir}
      style={({ pressed }) => [estilos.card, pressed && estilos.cardPressionado]}
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
            <Icone nome="aoVivo" tamanho={36} cor={cores.textoTerciario} />
          </View>
        )}
        <View style={estilos.badgeAoVivo}>
          <View style={estilos.ponto} />
          <Texto variante="rotulo">AO VIVO</Texto>
        </View>
        <View style={estilos.badgeEspectadores}>
          <Icone nome="olho" tamanho={12} cor={cores.branco} />
          <Texto variante="legenda">{formatarContador(live.espectadores)}</Texto>
        </View>
      </View>
      <View style={estilos.info}>
        <Avatar url={live.anfitriao.avatarUrl} nome={live.anfitriao.nome} tamanho={40} borda />
        <View style={estilos.flex}>
          <Texto variante="corpoForte" numberOfLines={2}>
            {live.titulo}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSecundario}>
            @{live.anfitriao.apelido} · há {tempoRelativo(live.iniciadaEm)}
          </Texto>
        </View>
        <Icone nome="avancar" tamanho={18} cor={cores.textoTerciario} />
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
        <View style={estilos.flex}>
          <Texto variante="titulo">Lives</Texto>
          <Texto variante="pequeno" cor={cores.textoSecundario}>
            A nação ao vivo, agora.
          </Texto>
        </View>
        <Botao
          titulo="Iniciar live"
          tamanho="pequeno"
          icone={<Icone nome="gravar" tamanho={16} cor={cores.branco} />}
          onPress={() => router.push('/live/iniciar')}
          testID="botao-iniciar-live"
        />
      </View>
      {modo === 'simulado' ? (
        <View style={estilos.avisoModo} testID="aviso-modo-simulado">
          <Icone nome="laboratorio" tamanho={16} cor={cores.aviso} />
          <Texto variante="legenda" cor={cores.textoSecundario} style={estilos.flex}>
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
              icone="lives"
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
  flex: { flex: 1 },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingTop: espacos.md,
    paddingBottom: espacos.sm,
  },
  avisoModo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginHorizontal: espacos.lg,
    marginBottom: espacos.sm,
    padding: espacos.sm + 2,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  lista: { padding: espacos.lg, gap: espacos.lg, flexGrow: 1 },
  card: {
    backgroundColor: cores.fundoElevado,
    borderRadius: raios.lg,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  cardPressionado: { borderColor: cores.vermelho },
  capa: { aspectRatio: 16 / 9, backgroundColor: cores.fundoCartao },
  capaVazia: { alignItems: 'center', justifyContent: 'center' },
  badgeAoVivo: {
    position: 'absolute',
    top: espacos.sm,
    left: espacos.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: cores.vermelho,
    paddingHorizontal: espacos.sm,
    paddingVertical: 4,
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
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    paddingHorizontal: espacos.sm,
    paddingVertical: 4,
    borderRadius: raios.sm,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: espacos.md, padding: espacos.md },
});
