import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import { matchService, type Partida } from '@/services/partidas';
import { chaves } from '@/services/queryClient';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { abreviarTime, formatarDataHora, formatarDiaEMes } from '@/utils/formatadores';

/**
 * Chip de uma partida em uma linha só: "⚽ FLA vs PAL · 25/09 18:30".
 * Compacto de propósito — no feed o vídeo é o que importa.
 */
function ChipDePartida({ titulo, partida }: { titulo: string; partida: Partida }) {
  const aoVivo = partida.status === 'ao_vivo';
  const comPlacar = partida.placar && (aoVivo || partida.status === 'encerrada');
  const mandante = abreviarTime(partida.mandante);
  const visitante = abreviarTime(partida.visitante);
  const meio = comPlacar ? `${partida.placar!.mandante} – ${partida.placar!.visitante}` : 'vs';
  const detalhe = aoVivo
    ? 'AO VIVO'
    : partida.status === 'encerrada'
      ? formatarDiaEMes(partida.dataHora)
      : formatarDataHora(partida.dataHora);

  return (
    <View style={estilos.chip} testID={`card-${titulo}`}>
      <View style={estilos.faixa} />
      {aoVivo ? (
        <View style={estilos.pontoAoVivo} testID="ponto-ao-vivo" />
      ) : (
        <Icone
          nome={partida.status === 'encerrada' ? 'apito' : 'estadio'}
          tamanho={12}
          cor={partida.status === 'encerrada' ? cores.textoSecundario : cores.vermelhoVivo}
        />
      )}
      <Texto variante="pequeno" numberOfLines={1}>
        <Texto variante="corpoForte" style={estilos.time}>
          {mandante}
        </Texto>
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          {' '}
          {meio}{' '}
        </Texto>
        <Texto variante="corpoForte" style={estilos.time}>
          {visitante}
        </Texto>
      </Texto>
      <Texto
        variante="legenda"
        cor={aoVivo ? cores.vermelhoVivo : cores.textoTerciario}
        numberOfLines={1}>
        · {detalhe}
      </Texto>
    </View>
  );
}

/** Faixa fina com o próximo jogo e o último resultado, recolhível pelo torcedor. */
export function CardsDePartida() {
  const visivel = useUiStore((s) => s.placarVisivel);
  const alternar = useUiStore((s) => s.alternarPlacar);
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
    // com a bola rolando, o placar se atualiza sozinho a cada minuto
    refetchInterval: (consulta) => {
      const d = consulta.state.data;
      const rolando = d?.proximo?.status === 'ao_vivo' || d?.ultimo?.status === 'ao_vivo';
      return rolando ? 60 * 1000 : false;
    },
  });

  if (!data || (!data.proximo && !data.ultimo)) return null;

  return (
    <View style={estilos.linha} testID="cards-partida">
      {visivel ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.lista}>
          {data.ultimo ? <ChipDePartida titulo="Último resultado" partida={data.ultimo} /> : null}
          {data.proximo ? <ChipDePartida titulo="Próximo jogo" partida={data.proximo} /> : null}
        </ScrollView>
      ) : (
        <Pressable onPress={alternar} style={estilos.recolhido} testID="placar-recolhido">
          <Icone nome="bola" tamanho={12} cor={cores.textoTerciario} />
          <Texto variante="legenda" cor={cores.textoTerciario}>
            Placar
          </Texto>
        </Pressable>
      )}
      <Pressable
        onPress={alternar}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visivel ? 'Esconder o placar' : 'Mostrar o placar'}
        style={estilos.botaoRecolher}
        testID="botao-recolher-placar">
        <Icone
          nome={visivel ? 'chevronBaixo' : 'avancar'}
          tamanho={16}
          cor={cores.textoTerciario}
        />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  lista: { paddingLeft: espacos.md, paddingRight: espacos.xs, gap: espacos.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    height: 30,
    paddingRight: espacos.md,
    borderRadius: raios.sm,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  faixa: { width: 3, alignSelf: 'stretch', backgroundColor: cores.vermelho },
  pontoAoVivo: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.vermelhoVivo },
  time: { letterSpacing: 0.5 },
  recolhido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs,
    marginLeft: espacos.md,
    paddingHorizontal: espacos.sm,
    height: 26,
    borderRadius: raios.sm,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoRecolher: {
    width: 30,
    height: 30,
    marginRight: espacos.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
