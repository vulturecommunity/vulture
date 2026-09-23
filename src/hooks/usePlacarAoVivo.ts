import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { calendarioService, type Partida } from '@/services/partidas';
import { chaves } from '@/services/queryClient';

const QUINZE_MINUTOS = 15 * 60 * 1000;

/** Jogo rolando ou que começa nos próximos 15 minutos: hora de ouvir o placar. */
export function haJogoAgora(partidas: (Partida | null | undefined)[], agora = Date.now()): boolean {
  return partidas.some(
    (p) =>
      !!p &&
      (p.status === 'ao_vivo' ||
        (p.status === 'agendada' && new Date(p.dataHora).getTime() - agora < QUINZE_MINUTOS)),
  );
}

/**
 * Enquanto `ativo`, recebe cada placar novo pelo Realtime e atualiza na hora o calendário
 * e a faixa do feed — sem ninguém precisar puxar a lista de novo.
 */
export function usePlacarAoVivo(ativo: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const servico = calendarioService();
    if (!ativo || !servico.assinar) return;
    return servico.assinar((partida) => {
      queryClient.setQueryData<Partida[]>(chaves.calendario, (atual) =>
        atual?.map((p) => (p.id === partida.id ? partida : p)),
      );
      queryClient.setQueryData<{ proximo: Partida | null; ultimo: Partida | null }>(
        chaves.partidas,
        (atual) => {
          if (!atual) return atual;
          if (atual.proximo?.id === partida.id && partida.status === 'encerrada') {
            // acabou: o "último resultado" e o "próximo jogo" mudam de lugar
            queryClient.invalidateQueries({ queryKey: chaves.partidas });
            return atual;
          }
          return {
            proximo: atual.proximo?.id === partida.id ? partida : atual.proximo,
            ultimo: atual.ultimo?.id === partida.id ? partida : atual.ultimo,
          };
        },
      );
    });
  }, [ativo, queryClient]);
}
