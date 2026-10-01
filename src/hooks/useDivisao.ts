import { useQuery } from '@tanstack/react-query';

import { dataService } from '@/services/data';

import { periodoAtual } from './useRanking';

/**
 * Minha divisão e meu grupo no mês.
 *
 * Devolve `data === null` quando a pessoa ainda não palpitou no período — a tela usa isso
 * para convidar a dar o primeiro palpite em vez de mostrar um grupo vazio.
 */
export function useMinhaDivisao(periodo = periodoAtual()) {
  return useQuery({
    queryKey: ['divisao', periodo],
    queryFn: () => dataService().minhaDivisao(periodo),
    // muda uma vez por jogo apurado (~3 dias): não vale releitura a cada troca de aba
    staleTime: 5 * 60 * 1000,
  });
}
