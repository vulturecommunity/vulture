import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarioDeJogos } from '@/components/arquibancada/CalendarioDeJogos';
import { ListaDaResenha } from '@/components/arquibancada/ListaDaResenha';
import { RankingDePalpiteiros } from '@/components/arquibancada/RankingDePalpiteiros';
import { Cabecalho, Icone, Texto, type NomeDeIcone } from '@/components/ui';
import type { FiltroDaResenha } from '@/hooks/useArquibancada';
import { useVoltar } from '@/hooks/useVoltar';
import type { Partida } from '@/services/partidas';
import { cores, espacos, raios } from '@/theme';
import { rotuloDaPartida } from '@/utils/palpites';

type Aba = 'resenha' | 'jogos' | 'ranking';

const ABAS: { id: Aba; rotulo: string; icone: NomeDeIcone }[] = [
  { id: 'resenha', rotulo: 'Resenha', icone: 'megafone' },
  { id: 'jogos', rotulo: 'Jogos', icone: 'calendario' },
  { id: 'ranking', rotulo: 'Ranking', icone: 'trofeu' },
];

function abaInicial(valor: string | undefined): Aba {
  if (valor === 'jogos' || valor === 'ranking') return valor;
  return 'resenha';
}

/**
 * Arquibancada: a resenha em texto (estilo X), o calendário de jogos com palpites e o
 * ranking de palpiteiros.
 * Parâmetros: ?aba=jogos abre no calendário, ?aba=ranking no pódio; ?tag= ou
 * ?partidaId=&rotulo= abrem a resenha filtrada.
 */
export default function TelaArquibancada() {
  const insets = useSafeAreaInsets();
  const voltar = useVoltar('/(tabs)');
  const params = useLocalSearchParams<{
    aba?: string;
    tag?: string;
    partidaId?: string;
    rotulo?: string;
  }>();
  const [aba, setAba] = useState<Aba>(() => abaInicial(params.aba));
  const [filtro, setFiltro] = useState<FiltroDaResenha>(() => {
    if (params.tag) return { tipo: 'hashtag', tag: params.tag };
    if (params.partidaId) {
      return { tipo: 'partida', id: params.partidaId, rotulo: params.rotulo ?? 'jogo' };
    }
    return null;
  });

  const verResenha = useCallback((partida: Partida) => {
    setFiltro({ tipo: 'partida', id: partida.id, rotulo: rotuloDaPartida(partida) });
    setAba('resenha');
  }, []);

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho
        titulo="Arquibancada"
        subtitulo="A resenha e os jogos da Nação"
        aoVoltar={voltar}
      />
      <View style={estilos.abas} accessibilityRole="tablist">
        {ABAS.map((item) => {
          const ativa = item.id === aba;
          return (
            <Pressable
              key={item.id}
              onPress={() => setAba(item.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              style={[estilos.aba, ativa && estilos.abaAtiva]}
              testID={`aba-arquibancada-${item.id}`}>
              <Icone
                nome={item.icone}
                tamanho={15}
                cor={ativa ? cores.branco : cores.textoSecundario}
              />
              <Texto
                variante="pequeno"
                cor={ativa ? cores.branco : cores.textoSecundario}
                style={ativa && estilos.abaTextoAtivo}>
                {item.rotulo}
              </Texto>
            </Pressable>
          );
        })}
      </View>
      {aba === 'resenha' ? <ListaDaResenha filtro={filtro} aoMudarFiltro={setFiltro} /> : null}
      {aba === 'jogos' ? <CalendarioDeJogos aoVerResenha={verResenha} /> : null}
      {aba === 'ranking' ? <RankingDePalpiteiros /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  abas: {
    flexDirection: 'row',
    marginHorizontal: espacos.lg,
    marginBottom: espacos.sm,
    padding: 3,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs,
    paddingVertical: 8,
    borderRadius: raios.redondo,
  },
  abaAtiva: { backgroundColor: cores.vermelho },
  abaTextoAtivo: { fontWeight: '700' },
});
