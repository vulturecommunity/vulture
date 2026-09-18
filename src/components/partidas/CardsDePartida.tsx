import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { matchService, type Partida } from '@/services/partidas';
import { chaves } from '@/services/queryClient';
import { cores, espacos, raios } from '@/theme';
import { formatarDataHora } from '@/utils/formatadores';

function CardPartida({ titulo, partida }: { titulo: string; partida: Partida }) {
  const encerrada = partida.status === 'encerrada' && partida.placar;
  return (
    <View style={estilos.card} testID={`card-${titulo}`}>
      <Texto variante="legenda" cor={cores.vermelho} style={estilos.titulo}>
        {titulo.toUpperCase()} · {partida.competicao}
      </Texto>
      <View style={estilos.linha}>
        <Texto variante="corpoForte" numberOfLines={1} style={estilos.time}>
          {partida.mandante}
        </Texto>
        <Texto variante="destaque" style={estilos.placar}>
          {encerrada ? `${partida.placar!.mandante} × ${partida.placar!.visitante}` : 'vs'}
        </Texto>
        <Texto variante="corpoForte" numberOfLines={1} style={[estilos.time, estilos.direita]}>
          {partida.visitante}
        </Texto>
      </View>
      <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
        {encerrada ? 'Encerrado' : formatarDataHora(partida.dataHora)} · {partida.estadio}
      </Texto>
    </View>
  );
}

/** Cards "Próximo jogo" e "Último resultado" no topo do feed. */
export function CardsDePartida() {
  const { data } = useQuery({
    queryKey: chaves.partidas,
    queryFn: async () => {
      const [proximo, ultimo] = await Promise.all([
        matchService().proximoJogo(),
        matchService().ultimoResultado(),
      ]);
      return { proximo, ultimo };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data || (!data.proximo && !data.ultimo)) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.lista}
      testID="cards-partida">
      {data.proximo ? <CardPartida titulo="Próximo jogo" partida={data.proximo} /> : null}
      {data.ultimo ? <CardPartida titulo="Último resultado" partida={data.ultimo} /> : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  lista: { paddingHorizontal: espacos.md, gap: espacos.sm },
  card: {
    width: 230,
    backgroundColor: 'rgba(17,17,17,0.72)',
    borderRadius: raios.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    gap: 2,
  },
  titulo: { letterSpacing: 0.5 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  time: { flex: 1 },
  direita: { textAlign: 'right' },
  placar: { minWidth: 44, textAlign: 'center' },
});
