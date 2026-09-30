import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Carregando, EstadoVazio, Erro, Icone, Texto } from '@/components/ui';
import { useAgora } from '@/hooks/useAgora';
import { useCalendario, useMeusPalpites } from '@/hooks/usePalpites';
import type { Partida } from '@/services/partidas';
import { cores, espacos, raios } from '@/theme';
import type { Palpite } from '@/types';
import { diaDaSemana, formatarContagem, formatarDataHora, nomeDoMes } from '@/utils/formatadores';
import {
  chaveDoMes,
  palpiteAberto,
  pontosDoPalpite,
  proximaPartida,
  resumirMes,
  siglasDa,
} from '@/utils/palpites';

import { CartaoDeJogo } from './CartaoDeJogo';
import { SheetDePalpite } from './SheetDePalpite';

export interface CalendarioDeJogosProps {
  aoVerResenha: (partida: Partida) => void;
}

function rotuloDoPalpite(palpite: Palpite | undefined, aberto: boolean): string {
  if (palpite) return `Seu palpite: ${palpite.golsMandante} x ${palpite.golsVisitante}`;
  return aberto ? 'Dar palpite' : 'Palpites da torcida';
}

/** Abre no mês de hoje; fora da temporada, no mês mais próximo que tem jogo. */
function mesInicial(meses: string[], atual: string): string {
  if (meses.includes(atual)) return atual;
  return meses.find((m) => m > atual) ?? meses.at(-1) ?? atual;
}

/** O jogo que está rolando ou o próximo, com contagem regressiva e atalho para o palpite. */
function DestaqueDoJogo({
  partida,
  palpite,
  agora,
  aoPalpitar,
  aoVerResenha,
}: {
  partida: Partida;
  palpite?: Palpite;
  agora: Date;
  aoPalpitar: () => void;
  aoVerResenha: () => void;
}) {
  const siglas = siglasDa(partida);
  const aoVivo = partida.status === 'ao_vivo';
  const aberto = palpiteAberto(partida, agora);
  const falta = new Date(partida.dataHora).getTime() - agora.getTime();

  return (
    <View style={[estilos.destaque, aoVivo && estilos.destaqueAoVivo]} testID="destaque-jogo">
      <View style={estilos.destaqueTopo}>
        {aoVivo ? <View style={estilos.ponto} /> : null}
        <Texto variante="rotulo" cor={aoVivo ? cores.vermelhoVivo : cores.textoSecundario}>
          {aoVivo ? `Ao vivo${partida.minuto ? ` · ${partida.minuto}'` : ''}` : 'Próximo jogo'}
        </Texto>
        <Texto variante="legenda" cor={cores.textoTerciario} numberOfLines={1} style={estilos.flex}>
          · {partida.competicao}
          {partida.fase ? ` · ${partida.fase}` : ''}
        </Texto>
      </View>

      <View style={estilos.destaqueConfronto}>
        <View style={estilos.destaqueTime}>
          <Texto variante="titulo">{siglas.mandante}</Texto>
          <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
            {partida.mandante}
          </Texto>
        </View>
        <Texto variante="titulo" cor={aoVivo ? cores.vermelhoVivo : cores.textoTerciario}>
          {partida.placar ? `${partida.placar.mandante} – ${partida.placar.visitante}` : 'x'}
        </Texto>
        <View style={estilos.destaqueTime}>
          <Texto variante="titulo">{siglas.visitante}</Texto>
          <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
            {partida.visitante}
          </Texto>
        </View>
      </View>

      <Texto variante="pequeno" cor={cores.textoSecundario} centralizado numberOfLines={1}>
        {diaDaSemana(partida.dataHora)} {formatarDataHora(partida.dataHora)}
        {partida.estadio ? ` · ${partida.estadio}` : ''}
      </Texto>
      {!aoVivo && falta > 0 ? (
        <View style={estilos.contagem} testID="contagem-regressiva">
          <Icone nome="relogio" tamanho={14} cor={cores.dourado} />
          <Texto variante="corpoForte" cor={cores.dourado}>
            Faltam {formatarContagem(falta)}
          </Texto>
        </View>
      ) : null}

      <View style={estilos.destaqueAcoes}>
        <Pressable
          onPress={aoPalpitar}
          style={({ pressed }) => [
            estilos.botaoDestaque,
            aberto && !palpite && estilos.botaoPrincipal,
            pressed && estilos.pressionado,
          ]}
          accessibilityRole="button"
          testID="destaque-palpitar">
          <Icone nome="palpite" tamanho={16} cor={cores.branco} />
          <Texto variante="corpoForte" cor={cores.branco}>
            {rotuloDoPalpite(palpite, aberto)}
          </Texto>
        </Pressable>
        <Pressable
          onPress={aoVerResenha}
          style={({ pressed }) => [estilos.botaoDestaque, pressed && estilos.pressionado]}
          accessibilityRole="button"
          accessibilityLabel="Resenha do jogo"
          testID="destaque-resenha">
          <Icone nome="comentarios" tamanho={16} cor={cores.branco} />
          <Texto variante="corpoForte" cor={cores.branco}>
            Resenha
          </Texto>
        </Pressable>
      </View>
    </View>
  );
}

function Estatistica({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <View style={estilos.estatistica}>
      <Texto variante="destaque" cor={cor}>
        {valor}
      </Texto>
      <Texto variante="legenda" cor={cores.textoTerciario}>
        {rotulo}
      </Texto>
    </View>
  );
}

/** Aba "Jogos" da Arquibancada: calendário mês a mês com resultados e palpites. */
export function CalendarioDeJogos({ aoVerResenha }: CalendarioDeJogosProps) {
  const insets = useSafeAreaInsets();
  const agora = useAgora();
  const calendario = useCalendario();
  const partidas = calendario.data;
  const palpites = useMeusPalpites(partidas);
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);
  const [palpitando, setPalpitando] = useState<Partida | null>(null);

  const meses = useMemo(
    () => [...new Set((partidas ?? []).map((p) => chaveDoMes(new Date(p.dataHora))))].sort(),
    [partidas],
  );
  const mes = mesEscolhido ?? mesInicial(meses, chaveDoMes(agora));
  const indice = meses.indexOf(mes);
  const temAnterior = indice > 0;
  const temSeguinte = indice >= 0 && indice < meses.length - 1;

  const doMes = useMemo(
    () => (partidas ?? []).filter((p) => chaveDoMes(new Date(p.dataHora)) === mes),
    [partidas, mes],
  );
  const resumo = useMemo(() => resumirMes(doMes), [doMes]);
  const pontosNoMes = useMemo(() => {
    let feitos = 0;
    let pontos = 0;
    for (const p of doMes) {
      const meu = palpites.porPartida.get(p.id);
      if (!meu) continue;
      feitos += 1;
      if (p.status === 'encerrada' && p.placar) pontos += pontosDoPalpite(meu, p.placar);
    }
    return { feitos, pontos };
  }, [doMes, palpites.porPartida]);
  const destaque = useMemo(() => proximaPartida(partidas ?? [], agora), [partidas, agora]);

  const verResenha = useCallback((p: Partida) => aoVerResenha(p), [aoVerResenha]);
  const renderizar = useCallback(
    ({ item }: { item: Partida }) => (
      <CartaoDeJogo
        partida={item}
        palpite={palpites.porPartida.get(item.id)}
        agora={agora}
        aoPalpitar={setPalpitando}
        aoVerResenha={verResenha}
      />
    ),
    [palpites.porPartida, agora, verResenha],
  );

  if (calendario.isLoading) return <Carregando mensagem="Buscando o calendário do Mengão..." />;
  if (calendario.isError) {
    return <Erro erro={calendario.error} aoTentarNovamente={() => calendario.refetch()} />;
  }

  const encerrados = resumo.vitorias + resumo.empates + resumo.derrotas;
  const cabecalho = (
    <View style={estilos.cabecalho}>
      {destaque ? (
        <DestaqueDoJogo
          partida={destaque}
          palpite={palpites.porPartida.get(destaque.id)}
          agora={agora}
          aoPalpitar={() => setPalpitando(destaque)}
          aoVerResenha={() => aoVerResenha(destaque)}
        />
      ) : null}

      <View style={estilos.seletorMes}>
        <Pressable
          onPress={() => setMesEscolhido(meses[indice - 1])}
          disabled={!temAnterior}
          hitSlop={10}
          style={[estilos.seta, !temAnterior && estilos.setaInativa]}
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          testID="mes-anterior">
          <Icone nome="chevronEsquerda" tamanho={20} cor={cores.texto} />
        </Pressable>
        <View style={estilos.nomeMes}>
          <Icone nome="calendario" tamanho={16} cor={cores.vermelhoVivo} />
          <Texto variante="destaque" testID="nome-do-mes">
            {nomeDoMes(mes)}
          </Texto>
        </View>
        <Pressable
          onPress={() => setMesEscolhido(meses[indice + 1])}
          disabled={!temSeguinte}
          hitSlop={10}
          style={[estilos.seta, !temSeguinte && estilos.setaInativa]}
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          testID="mes-seguinte">
          <Icone nome="avancar" tamanho={20} cor={cores.texto} />
        </Pressable>
      </View>

      {doMes.length > 0 ? (
        <View style={estilos.resumo} testID="resumo-do-mes">
          <Estatistica
            valor={String(resumo.jogos)}
            rotulo={resumo.jogos === 1 ? 'jogo' : 'jogos'}
          />
          {encerrados > 0 ? (
            <>
              <Estatistica
                valor={`${resumo.vitorias}-${resumo.empates}-${resumo.derrotas}`}
                rotulo="V-E-D"
              />
              <Estatistica valor={`${resumo.golsPro}:${resumo.golsContra}`} rotulo="gols" />
            </>
          ) : null}
          {pontosNoMes.feitos > 0 ? (
            <Estatistica
              valor={`${pontosNoMes.pontos} pts`}
              rotulo={`${pontosNoMes.feitos} ${pontosNoMes.feitos === 1 ? 'palpite' : 'palpites'}`}
              cor={cores.dourado}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={doMes}
        keyExtractor={(p) => p.id}
        renderItem={renderizar}
        ListHeaderComponent={cabecalho}
        contentContainerStyle={[estilos.lista, { paddingBottom: insets.bottom + espacos.xl }]}
        onRefresh={() => calendario.refetch()}
        refreshing={calendario.isRefetching}
        ListEmptyComponent={
          <EstadoVazio
            icone="calendario"
            titulo="Sem jogos neste mês"
            descricao="Troque o mês nas setas acima."
          />
        }
        testID="lista-jogos"
      />
      <SheetDePalpite
        partida={palpitando}
        palpite={palpitando ? palpites.porPartida.get(palpitando.id) : undefined}
        aoFechar={() => setPalpitando(null)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  lista: { flexGrow: 1 },
  cabecalho: { gap: espacos.md, paddingTop: espacos.md, paddingBottom: espacos.sm },
  destaque: {
    marginHorizontal: espacos.lg,
    padding: espacos.lg,
    gap: espacos.sm,
    borderRadius: raios.lg,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
    borderTopWidth: 3,
    borderTopColor: cores.vermelho,
  },
  destaqueAoVivo: { borderColor: cores.vermelho },
  destaqueTopo: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.vermelhoVivo },
  destaqueConfronto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.lg,
    marginVertical: espacos.xs,
  },
  destaqueTime: { flex: 1, alignItems: 'center' },
  contagem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs,
  },
  destaqueAcoes: { flexDirection: 'row', gap: espacos.sm, marginTop: espacos.xs },
  botaoDestaque: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs,
    height: 42,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoPrincipal: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  pressionado: { opacity: 0.85 },
  seletorMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
  },
  seta: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setaInativa: { opacity: 0.3 },
  nomeMes: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  resumo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  estatistica: { alignItems: 'center' },
});
