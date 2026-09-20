import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icone, Texto, TituloDeSecao } from '@/components/ui';
import { useRankingSemanal } from '@/hooks/useExplorar';
import { cores, espacos, raios } from '@/theme';
import { formatarContador } from '@/utils/formatadores';

const COR_POSICAO: Record<number, string> = {
  1: cores.dourado,
  2: '#B9BDC5',
  3: '#B5794C',
};

/** Ranking semanal de torcedores por curtidas recebidas. */
export function RankingSemanal() {
  const router = useRouter();
  const { data } = useRankingSemanal();
  if (!data || data.length === 0) return null;

  return (
    <View style={estilos.container} testID="ranking-semanal">
      <TituloDeSecao
        titulo="Torcedores da semana"
        subtitulo="por curtidas recebidas"
        icone="trofeu"
        semMargem
      />
      <View style={estilos.lista}>
        {data.slice(0, 5).map((item) => {
          const destaque = COR_POSICAO[item.posicao];
          return (
            <Pressable
              key={item.usuario.id}
              onPress={() =>
                router.push({ pathname: '/usuario/[id]', params: { id: item.usuario.id } })
              }
              style={({ pressed }) => [estilos.linha, pressed && estilos.pressionado]}
              accessibilityRole="button"
              testID={`ranking-${item.posicao}`}>
              <View style={[estilos.posicao, destaque ? { backgroundColor: destaque } : null]}>
                <Texto
                  variante="legenda"
                  cor={destaque ? cores.preto : cores.textoSecundario}
                  style={estilos.posicaoTexto}>
                  {item.posicao}
                </Texto>
              </View>
              <Avatar url={item.usuario.avatarUrl} nome={item.usuario.nome} tamanho={38} />
              <View style={estilos.nome}>
                <Texto variante="corpoForte" numberOfLines={1}>
                  @{item.usuario.apelido}
                </Texto>
                <Texto variante="legenda" cor={cores.textoSecundario}>
                  {item.videosNaSemana} vídeo{item.videosNaSemana === 1 ? '' : 's'} na semana
                </Texto>
              </View>
              <View style={estilos.curtidas}>
                <Icone nome="curtido" tamanho={14} cor={cores.vermelhoVivo} />
                <Texto variante="corpoForte">{formatarContador(item.curtidasNaSemana)}</Texto>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    marginHorizontal: espacos.lg,
    backgroundColor: cores.fundoElevado,
    borderRadius: raios.lg,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: espacos.md,
    gap: espacos.sm,
  },
  lista: { gap: espacos.xxs },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm + 2,
    paddingVertical: espacos.sm,
    borderRadius: raios.md,
  },
  pressionado: { backgroundColor: cores.fundoCartao },
  posicao: {
    width: 26,
    height: 26,
    borderRadius: raios.sm,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posicaoTexto: { fontWeight: '800' },
  nome: { flex: 1 },
  curtidas: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
});
