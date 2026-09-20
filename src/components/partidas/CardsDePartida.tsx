import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import { matchService, type Partida } from '@/services/partidas';
import { chaves } from '@/services/queryClient';
import { cores, espacos, raios } from '@/theme';
import { formatarDataHora } from '@/utils/formatadores';

function CardPartida({ titulo, partida }: { titulo: string; partida: Partida }) {
  const encerrada = partida.status === 'encerrada' && partida.placar;
  return (
    <View style={estilos.card} testID={`card-${titulo}`}>
      <View style={estilos.faixa} />
      <View style={estilos.conteudo}>
        <View style={estilos.cabecalho}>
          <Icone nome={encerrada ? 'apito' : 'estadio'} tamanho={13} cor={cores.vermelhoVivo} />
          <Texto
            variante="rotulo"
            cor={cores.textoSecundario}
            numberOfLines={1}
            style={estilos.flex}>
            {titulo} · {partida.competicao}
          </Texto>
        </View>
        <View style={estilos.linha}>
          <Texto variante="corpoForte" numberOfLines={1} style={estilos.time}>
            {partida.mandante}
          </Texto>
          <View style={estilos.placar}>
            <Texto variante="destaque" centralizado>
              {encerrada ? `${partida.placar!.mandante} – ${partida.placar!.visitante}` : 'vs'}
            </Texto>
          </View>
          <Texto variante="corpoForte" numberOfLines={1} style={[estilos.time, estilos.direita]}>
            {partida.visitante}
          </Texto>
        </View>
        <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
          {encerrada ? 'Encerrado' : formatarDataHora(partida.dataHora)} · {partida.estadio}
        </Texto>
      </View>
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
    width: 236,
    flexDirection: 'row',
    backgroundColor: cores.vidro,
    borderRadius: raios.md,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    overflow: 'hidden',
  },
  faixa: { width: 4, backgroundColor: cores.vermelho },
  conteudo: { flex: 1, paddingHorizontal: espacos.md, paddingVertical: espacos.sm, gap: 3 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  flex: { flex: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  time: { flex: 1 },
  direita: { textAlign: 'right' },
  placar: {
    minWidth: 52,
    paddingHorizontal: espacos.xs,
    paddingVertical: 2,
    borderRadius: raios.sm,
    backgroundColor: cores.vidroClaro,
  },
});
