import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Texto } from '@/components/ui';
import { useRankingSemanal } from '@/hooks/useExplorar';
import { cores, espacos, raios } from '@/theme';
import { formatarContador } from '@/utils/formatadores';

const MEDALHAS = ['🥇', '🥈', '🥉'];

/** Ranking semanal de torcedores por curtidas recebidas. */
export function RankingSemanal() {
  const router = useRouter();
  const { data } = useRankingSemanal();
  if (!data || data.length === 0) return null;

  return (
    <View style={estilos.container} testID="ranking-semanal">
      <View style={estilos.cabecalho}>
        <Texto variante="destaque">🏆 Torcedores da semana</Texto>
        <Texto variante="legenda" cor={cores.textoSecundario}>
          por curtidas recebidas
        </Texto>
      </View>
      {data.slice(0, 5).map((item) => (
        <Pressable
          key={item.usuario.id}
          onPress={() =>
            router.push({ pathname: '/usuario/[id]', params: { id: item.usuario.id } })
          }
          style={estilos.linha}
          accessibilityRole="button"
          testID={`ranking-${item.posicao}`}>
          <Texto variante="corpoForte" style={estilos.posicao}>
            {MEDALHAS[item.posicao - 1] ?? `${item.posicao}º`}
          </Texto>
          <Avatar url={item.usuario.avatarUrl} nome={item.usuario.nome} tamanho={36} />
          <View style={estilos.nome}>
            <Texto variante="corpoForte" numberOfLines={1}>
              @{item.usuario.apelido}
            </Texto>
            <Texto variante="legenda" cor={cores.textoSecundario}>
              {item.videosNaSemana} vídeo{item.videosNaSemana === 1 ? '' : 's'} na semana
            </Texto>
          </View>
          <Texto variante="corpoForte" cor={cores.vermelho}>
            ♥ {formatarContador(item.curtidasNaSemana)}
          </Texto>
        </Pressable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    marginHorizontal: espacos.lg,
    backgroundColor: cores.fundoElevado,
    borderRadius: raios.lg,
    padding: espacos.md,
    gap: espacos.xs,
  },
  cabecalho: { marginBottom: espacos.xs },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingVertical: espacos.xs,
  },
  posicao: { width: 28, textAlign: 'center' },
  nome: { flex: 1 },
});
