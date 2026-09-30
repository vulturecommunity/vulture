import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Carregando, Erro, EstadoVazio, Icone, Texto } from '@/components/ui';
import {
  periodoAtual,
  useMinhasLigas,
  usePeriodosDoRanking,
  useRankingDaLiga,
  useRankingDePalpites,
} from '@/hooks/useRanking';
import { cores, espacos, raios } from '@/theme';
import type { Liga, Palpiteiro } from '@/types';
import { formatarContador, nomeDoMes } from '@/utils/formatadores';

import { LinhaDoRanking, corDaPosicao } from './LinhaDoRanking';
import { SheetDeLigas } from './SheetDeLigas';

type Aba = 'nacao' | 'ligas';

/** O pódio: os três primeiros ganham tamanho, medalha e o degrau visual. */
function Podio({ tres }: { tres: Palpiteiro[] }) {
  if (tres.length === 0) return null;
  // ordem visual: 2º à esquerda, 1º no meio (mais alto), 3º à direita
  const ordem = [tres[1], tres[0], tres[2]].filter(Boolean);

  return (
    <View style={estilos.podio} testID="podio-do-ranking">
      {ordem.map((p) => {
        const campeao = p.posicao === 1;
        return (
          <View
            key={p.usuario.id}
            style={[estilos.degrau, campeao && estilos.degrauCampeao]}
            testID={`podio-${p.posicao}`}>
            <Icone
              nome={campeao ? 'trofeu' : 'premio'}
              tamanho={campeao ? 22 : 16}
              cor={corDaPosicao(p.posicao)}
            />
            <Avatar
              url={p.usuario.avatarUrl}
              nome={p.usuario.nome || p.usuario.apelido}
              tamanho={campeao ? 62 : 48}
              borda={campeao}
            />
            <Texto variante="legenda" numberOfLines={1} centralizado>
              {p.souEu ? 'Você' : `@${p.usuario.apelido}`}
            </Texto>
            <Texto variante={campeao ? 'destaque' : 'corpoForte'} cor={corDaPosicao(p.posicao)}>
              {formatarContador(p.pontos)} pts
            </Texto>
            {p.cravadas > 0 ? (
              <Texto variante="legenda" cor={cores.textoTerciario}>
                {p.cravadas} cravada{p.cravadas > 1 ? 's' : ''}
              </Texto>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Cartão de uma liga na lista: posição do usuário dentro dela e o código de convite. */
function CartaoDeLiga({
  liga,
  selecionada,
  aoTocar,
}: {
  liga: Liga;
  selecionada: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.cartaoLiga,
        selecionada && estilos.cartaoLigaAtivo,
        pressed && estilos.pressionado,
      ]}
      accessibilityRole="button"
      testID={`liga-${liga.id}`}>
      <View style={estilos.flex}>
        <Texto variante="corpoForte" numberOfLines={1}>
          {liga.nome}
        </Texto>
        <Texto variante="legenda" cor={cores.textoTerciario}>
          {liga.membros} {liga.membros === 1 ? 'membro' : 'membros'} · código {liga.codigo}
        </Texto>
      </View>
      <View style={estilos.posicaoNaLiga}>
        <Texto variante="destaque" cor={corDaPosicao(liga.minhaPosicao)}>
          {liga.minhaPosicao > 0 ? `${liga.minhaPosicao}º` : '—'}
        </Texto>
        <Texto variante="legenda" cor={cores.textoTerciario}>
          {formatarContador(liga.meusPontos)} pts
        </Texto>
      </View>
    </Pressable>
  );
}

/**
 * Aba "Ranking" da Arquibancada: pódio e Top 20 do mês, com a linha do próprio usuário
 * sempre visível, e as ligas privadas.
 *
 * Nada aqui é agregado na hora: a apuração de cada jogo já congelou a posição de todo
 * mundo, então a tela abre igual com dez ou com um milhão de palpiteiros.
 */
export function RankingDePalpiteiros() {
  const insets = useSafeAreaInsets();
  const [aba, setAba] = useState<Aba>('nacao');
  const [periodo, setPeriodo] = useState<string>(() => periodoAtual());
  const [ligaAberta, setLigaAberta] = useState<string | null>(null);
  const [sheetDeLigas, setSheetDeLigas] = useState(false);

  const { periodos } = usePeriodosDoRanking();
  const ranking = useRankingDePalpites(periodo);
  const ligas = useMinhasLigas(periodo);
  const rankingDaLiga = useRankingDaLiga(aba === 'ligas' ? ligaAberta : null, periodo);

  const topo = useMemo(() => ranking.data?.topo ?? [], [ranking.data]);
  const podio = useMemo(() => topo.slice(0, 3), [topo]);
  const restante = useMemo(() => topo.slice(3), [topo]);
  const minhaFaixa = ranking.data?.minhaFaixa ?? [];

  const renderizar = useCallback(
    ({ item }: { item: Palpiteiro }) => <LinhaDoRanking palpiteiro={item} />,
    [],
  );

  const seletorDePeriodo = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.chips}>
      {periodos.map((p) => {
        const ativo = p.periodo === periodo;
        return (
          <Pressable
            key={p.periodo}
            onPress={() => setPeriodo(p.periodo)}
            style={[estilos.chip, ativo && estilos.chipAtivo]}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            testID={`periodo-${p.periodo}`}>
            <Texto variante="legenda" cor={ativo ? cores.branco : cores.textoSecundario}>
              {nomeDoMes(p.periodo)}
              {p.jogos > 0 ? ` · ${p.jogos}` : ''}
            </Texto>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  const abas = (
    <View style={estilos.abas} accessibilityRole="tablist">
      {(
        [
          { id: 'nacao' as const, rotulo: 'Nação', icone: 'torcida' as const },
          { id: 'ligas' as const, rotulo: 'Minhas ligas', icone: 'escudo' as const },
        ] satisfies { id: Aba; rotulo: string; icone: 'torcida' | 'escudo' }[]
      ).map((item) => {
        const ativa = item.id === aba;
        return (
          <Pressable
            key={item.id}
            onPress={() => setAba(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativa }}
            style={[estilos.abaBotao, ativa && estilos.abaAtiva]}
            testID={`aba-ranking-${item.id}`}>
            <Icone
              nome={item.icone}
              tamanho={14}
              cor={ativa ? cores.branco : cores.textoSecundario}
            />
            <Texto variante="legenda" cor={ativa ? cores.branco : cores.textoSecundario}>
              {item.rotulo}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );

  if (ranking.isLoading) return <Carregando mensagem="Somando os pontos da Nação..." />;
  if (ranking.isError) {
    return <Erro erro={ranking.error} aoTentarNovamente={() => ranking.refetch()} />;
  }

  // na aba de ligas a lista só aparece depois de escolher uma liga
  const daLigaAberta = ligaAberta ? (rankingDaLiga.data ?? []) : [];
  const dados = aba === 'nacao' ? restante : daLigaAberta;

  const cabecalho = (
    <View style={estilos.cabecalho}>
      {seletorDePeriodo}
      {abas}

      {aba === 'nacao' ? (
        <>
          {topo.length === 0 ? (
            <EstadoVazio
              icone="trofeu"
              titulo="O ranking começa no próximo jogo"
              descricao="Dê seu palpite na aba Jogos: cravar o placar vale 10 pontos."
            />
          ) : (
            <>
              <Podio tres={podio} />
              <View style={estilos.regras}>
                <Texto variante="legenda" cor={cores.textoTerciario} centralizado>
                  Cravou 10 · Saldo 5 · Vencedor 3 · Clássico e mata-mata valem em dobro
                </Texto>
              </View>
            </>
          )}
        </>
      ) : (
        <View style={estilos.blocoLigas}>
          <Botao
            titulo="Criar liga ou entrar com código"
            variante="contorno"
            onPress={() => setSheetDeLigas(true)}
            largo
            testID="abrir-ligas"
          />
          {(ligas.data ?? []).map((liga) => (
            <CartaoDeLiga
              key={liga.id}
              liga={liga}
              selecionada={liga.id === ligaAberta}
              aoTocar={() => setLigaAberta(liga.id === ligaAberta ? null : liga.id)}
            />
          ))}
          {(ligas.data ?? []).length === 0 && !ligas.isLoading ? (
            <EstadoVazio
              icone="escudo"
              titulo="Você ainda não tem liga"
              descricao="Crie uma e mande o código no grupo: na liga, a disputa é com quem você conhece."
            />
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <>
      <FlatList
        data={dados}
        keyExtractor={(p) => `${p.posicao}-${p.usuario.id}`}
        renderItem={renderizar}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={[estilos.lista, { paddingBottom: insets.bottom + espacos.xl }]}
        onRefresh={() => {
          ranking.refetch();
          if (aba === 'ligas') ligas.refetch();
        }}
        refreshing={ranking.isRefetching || ligas.isRefetching}
        testID="lista-ranking"
      />

      {/* A faixa fica ancorada no rodapé: quem está em 4.312º precisa se achar sem rolar
          a lista inteira — é o que transforma "não vou ganhar" em "faltam 3 pontos". */}
      {aba === 'nacao' && minhaFaixa.length > 0 ? (
        <View style={[estilos.ancora, { paddingBottom: insets.bottom + espacos.sm }]}>
          <Texto variante="rotulo" cor={cores.textoSecundario} style={estilos.ancoraTitulo}>
            Sua posição
          </Texto>
          {minhaFaixa.map((p) => (
            <LinhaDoRanking key={p.usuario.id} palpiteiro={p} />
          ))}
        </View>
      ) : null}

      <SheetDeLigas
        visivel={sheetDeLigas}
        aoFechar={() => setSheetDeLigas(false)}
        aoEntrar={(liga) => setLigaAberta(liga.id)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  lista: { flexGrow: 1, paddingHorizontal: espacos.md },
  cabecalho: { gap: espacos.md, paddingTop: espacos.sm, paddingBottom: espacos.sm },
  chips: { gap: espacos.xs, paddingVertical: 2 },
  chip: {
    paddingHorizontal: espacos.md,
    paddingVertical: 7,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  abas: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  abaBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs,
    paddingVertical: 8,
    borderRadius: raios.redondo,
  },
  abaAtiva: { backgroundColor: cores.vermelho },
  podio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: espacos.sm,
  },
  degrau: {
    flex: 1,
    alignItems: 'center',
    gap: espacos.xs,
    paddingVertical: espacos.md,
    paddingHorizontal: espacos.xs,
    borderRadius: raios.lg,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  degrauCampeao: {
    paddingVertical: espacos.lg,
    borderColor: cores.dourado,
    borderTopWidth: 3,
    borderTopColor: cores.dourado,
  },
  regras: {
    paddingVertical: espacos.sm,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
  },
  blocoLigas: { gap: espacos.sm },
  cartaoLiga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaoLigaAtivo: { borderColor: cores.vermelho },
  pressionado: { opacity: 0.85 },
  posicaoNaLiga: { alignItems: 'flex-end' },
  ancora: {
    paddingTop: espacos.sm,
    paddingHorizontal: espacos.md,
    backgroundColor: cores.fundoElevado,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  ancoraTitulo: { paddingHorizontal: espacos.md, paddingBottom: 2 },
});
