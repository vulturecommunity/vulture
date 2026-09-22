import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { SalaDaLive } from '@/components/lives/SalaDaLive';
import { Carregando, Erro } from '@/components/ui';
import { useEncerrarLive, useLiveAtual } from '@/hooks/useLive';
import { useVoltar } from '@/hooks/useVoltar';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';

/** Assistir uma live (ou continuar a própria live já iniciada). */
export default function TelaAssistirLive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const voltar = useVoltar('/(tabs)/lives');
  const meuId = useAuthStore((s) => s.sessao?.usuario.id);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const live = useLiveAtual(id);
  const encerrar = useEncerrarLive();

  useFocusEffect(
    useCallback(() => {
      definirFoco(false);
      return () => definirFoco(true);
    }, [definirFoco]),
  );

  if (live.isLoading) return <Carregando mensagem="Entrando na live..." />;
  if (live.isError || !live.data) {
    return (
      <Erro erro={live.error ?? 'Live não encontrada'} aoTentarNovamente={() => live.refetch()} />
    );
  }

  const anfitriao = live.data.anfitriaoId === meuId;

  return (
    <SalaDaLive
      live={live.data}
      anfitriao={anfitriao}
      aoSair={voltar}
      aoEncerrar={
        anfitriao
          ? async () => {
              await encerrar.mutateAsync(live.data!.id);
              mostrarAviso('Live encerrada. Valeu, nação!', 'sucesso');
              voltar();
            }
          : undefined
      }
      encerrando={encerrar.isPending}
    />
  );
}
