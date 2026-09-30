import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { chaveDoMes } from '@/utils/palpites';

/** Mês corrente no formato do ranking ("2026-09"). */
export function periodoAtual(agora: Date = new Date()): string {
  return chaveDoMes(agora);
}

/**
 * Meses que já têm jogo apurado. O ranking muda uma vez por jogo (a cada ~3 dias), então
 * não vale releitura agressiva: o cache longo evita bater no servidor a cada troca de aba.
 */
export function usePeriodosDoRanking() {
  const consulta = useQuery({
    queryKey: chaves.periodosDoRanking,
    queryFn: () => dataService().periodosDoRanking(),
    staleTime: 30 * 60 * 1000,
  });
  // o mês corrente aparece na lista mesmo antes do primeiro jogo apurado
  const periodos = useMemo(() => {
    const atual = periodoAtual();
    const vindos = consulta.data ?? [];
    return vindos.some((p) => p.periodo === atual)
      ? vindos
      : [{ periodo: atual, jogos: 0, temporada: Number(atual.slice(0, 4)) }, ...vindos];
  }, [consulta.data]);
  return { ...consulta, periodos };
}

export function useRankingDePalpites(periodo: string, limite = 20) {
  return useQuery({
    queryKey: chaves.rankingDePalpites(periodo),
    queryFn: () => dataService().rankingDePalpites(periodo, limite),
    enabled: !!periodo,
    staleTime: 5 * 60 * 1000,
  });
}

/** Pódio de um jogo: a recompensa que chega a cada rodada, não a cada mês. */
export function usePodioDaPartida(partidaId: string | null, habilitado = true) {
  return useQuery({
    queryKey: chaves.podioDaPartida(partidaId ?? ''),
    queryFn: () => dataService().podioDaPartida(partidaId!, 10),
    enabled: !!partidaId && habilitado,
    staleTime: 10 * 60 * 1000,
  });
}

/** Medalhas de pódio mensal exibidas no perfil. */
export function useTitulos(usuarioId: string | undefined) {
  return useQuery({
    queryKey: chaves.titulos(usuarioId ?? ''),
    queryFn: () => dataService().titulosDoUsuario(usuarioId!),
    enabled: !!usuarioId,
    staleTime: 30 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------- ligas

export function useMinhasLigas(periodo: string) {
  return useQuery({
    queryKey: chaves.minhasLigas(periodo),
    queryFn: () => dataService().minhasLigas(periodo),
    enabled: !!periodo,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRankingDaLiga(ligaId: string | null, periodo: string) {
  return useQuery({
    queryKey: chaves.rankingDaLiga(ligaId ?? '', periodo),
    queryFn: () => dataService().rankingDaLiga(ligaId!, periodo),
    enabled: !!ligaId && !!periodo,
    staleTime: 5 * 60 * 1000,
  });
}

/** Criar e entrar compartilham a invalidação: as duas mudam a lista de ligas. */
function useMutacaoDeLiga<T>(acao: (valor: string) => Promise<T>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acao,
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['ligas'] });
    },
  });
}

export function useCriarLiga() {
  return useMutacaoDeLiga((nome: string) => dataService().criarLiga(nome));
}

export function useEntrarNaLiga() {
  return useMutacaoDeLiga((codigo: string) => dataService().entrarNaLiga(codigo));
}

export function useSairDaLiga() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ligaId: string) => dataService().sairDaLiga(ligaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ligas'] }),
  });
}
