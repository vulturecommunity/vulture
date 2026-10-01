import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

import { dataService } from '@/services/data';
import type { NovoPalpite } from '@/services/data/types';
import { calendarioService, type Partida } from '@/services/partidas';
import { chaves } from '@/services/queryClient';
import { EVENTOS, registrar } from '@/services/telemetria';
import type { Palpite } from '@/types';

import { haJogoAgora, usePlacarAoVivo } from './usePlacarAoVivo';

/**
 * Temporada inteira. Com jogo rolando o placar chega pelo Realtime (usePlacarAoVivo);
 * a releitura a cada 3 min é só a rede de segurança se o Realtime cair.
 */
export function useCalendario() {
  const consulta = useQuery({
    queryKey: chaves.calendario,
    queryFn: () => calendarioService().listarTemporada(),
    staleTime: 10 * 60 * 1000,
    refetchInterval: (c) => (haJogoAgora(c.state.data ?? []) ? 3 * 60 * 1000 : false),
  });
  usePlacarAoVivo(haJogoAgora(consulta.data ?? []));
  return consulta;
}

/** Meus palpites da temporada, indexados pelo id da partida. */
export function useMeusPalpites(partidas: Partida[] | undefined) {
  const ids = useMemo(() => (partidas ?? []).map((p) => p.id), [partidas]);
  const consulta = useQuery({
    queryKey: chaves.meusPalpites,
    queryFn: () => dataService().listMeusPalpites(ids),
    enabled: ids.length > 0,
  });
  const porPartida = useMemo(
    () => new Map((consulta.data ?? []).map((p) => [p.partidaId, p])),
    [consulta.data],
  );
  return { ...consulta, porPartida };
}

export function useResumoDosPalpites(partidaId: string | null, habilitado = true) {
  return useQuery({
    queryKey: chaves.resumoDosPalpites(partidaId ?? ''),
    queryFn: () => dataService().resumoDosPalpites(partidaId!),
    enabled: !!partidaId && habilitado,
  });
}

export function useSalvarPalpite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (novo: NovoPalpite) => dataService().salvarPalpite(novo),
    onSuccess: (palpite) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.setQueryData<Palpite[]>(chaves.meusPalpites, (atual = []) => [
        ...atual.filter((p) => p.partidaId !== palpite.partidaId),
        palpite,
      ]);
      queryClient.invalidateQueries({ queryKey: chaves.resumoDosPalpites(palpite.partidaId) });
      // A aposta de produto do app. Sem este evento não há como saber se o palpite pega
      // antes de investir semanas em vídeo.
      registrar(EVENTOS.PALPITE_CRAVADO, { partida: palpite.partidaId });
    },
  });
}
