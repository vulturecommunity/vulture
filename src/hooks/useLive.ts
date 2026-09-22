import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Reacao } from '@/constants/interesses';
import { dataService } from '@/services/data';
import { exibirNotificacaoDeLiveLocal } from '@/services/push';
import { chaves } from '@/services/queryClient';
import type { Live, MensagemLive } from '@/types';

export function useLives() {
  return useQuery({
    queryKey: chaves.lives,
    queryFn: () => dataService().listLives(),
    refetchInterval: 15 * 1000,
  });
}

export function useLiveAtual(id: string | undefined) {
  return useQuery({
    queryKey: chaves.live(id ?? ''),
    queryFn: () => dataService().getLive(id!),
    enabled: !!id,
  });
}

export function useCriarLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (titulo: string) => dataService().createLive(titulo),
    onSuccess: (live) => {
      queryClient.setQueryData<Live>(chaves.live(live.id), live);
      queryClient.invalidateQueries({ queryKey: chaves.lives });
      queryClient.invalidateQueries({ queryKey: chaves.notificacoes });
      // Modo demo: sem servidor, a notificação "está ao vivo" aparece neste mesmo aparelho
      // para demonstrar o aviso e o toque que abre a live. No Supabase quem envia é a Edge Function.
      if (dataService().nome === 'mock') exibirNotificacaoDeLiveLocal(live).catch(() => {});
    },
  });
}

export function useEncerrarLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataService().encerrarLive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.lives }),
  });
}

export interface ReacaoFlutuante {
  id: string;
  emoji: string;
}

const LIMITE_MENSAGENS = 150;

/**
 * Chat em tempo real de uma live: histórico + assinatura de eventos (mensagens, reações,
 * espectadores, encerramento). Funciona igual no mock (simulador local) e no Supabase (Realtime).
 */
export function useChatDaLive(
  liveId: string | undefined,
  espectadoresIniciais = 0,
  meuId: string | null = null,
) {
  const [mensagens, setMensagens] = useState<MensagemLive[]>([]);
  const [reacoes, setReacoes] = useState<ReacaoFlutuante[]>([]);
  const [espectadoresAoVivo, setEspectadores] = useState<number | null>(null);
  const espectadores = espectadoresAoVivo ?? espectadoresIniciais;
  const [encerrada, setEncerrada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const contadorReacao = useRef(0);

  const adicionarReacaoFlutuante = useCallback((emoji: string) => {
    const id = `r-${Date.now()}-${contadorReacao.current++}`;
    setReacoes((atual) => [...atual.slice(-24), { id, emoji }]);
    setTimeout(() => setReacoes((atual) => atual.filter((r) => r.id !== id)), 2600);
  }, []);

  useEffect(() => {
    if (!liveId) return;
    let ativo = true;
    dataService()
      .listMensagensDaLive(liveId)
      .then((historico) => {
        if (ativo) setMensagens(historico.slice(-LIMITE_MENSAGENS));
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    dataService()
      .entrarNaLive(liveId)
      .catch(() => {});
    const cancelar = dataService().assinarLive(liveId, (evento) => {
      if (!ativo) return;
      switch (evento.tipo) {
        case 'mensagem':
          setMensagens((atual) =>
            atual.some((m) => m.id === evento.mensagem.id)
              ? atual
              : [...atual, evento.mensagem].slice(-LIMITE_MENSAGENS),
          );
          break;
        case 'reacao':
          // as minhas reações já aparecem na hora (enviarReacao); evita duplicar ao voltar do servidor
          if (evento.mensagem.autorId !== meuId) {
            adicionarReacaoFlutuante(evento.mensagem.reacao ?? evento.mensagem.texto);
          }
          setMensagens((atual) =>
            atual.some((m) => m.id === evento.mensagem.id)
              ? atual
              : [...atual, evento.mensagem].slice(-LIMITE_MENSAGENS),
          );
          break;
        case 'espectadores':
          setEspectadores(evento.total);
          break;
        case 'encerrada':
          setEncerrada(true);
          break;
      }
    });

    return () => {
      ativo = false;
      cancelar();
      dataService()
        .sairDaLive(liveId)
        .catch(() => {});
    };
  }, [liveId, meuId, adicionarReacaoFlutuante]);

  const enviarMensagem = useCallback(
    async (texto: string) => {
      if (!liveId || !texto.trim()) return;
      const mensagem = await dataService().enviarMensagemNaLive(liveId, texto);
      // no Supabase a própria mensagem volta pelo Realtime; no mock, pelo simulador. Garante exibição:
      setMensagens((atual) =>
        atual.some((m) => m.id === mensagem.id) ? atual : [...atual, mensagem],
      );
    },
    [liveId],
  );

  const enviarReacao = useCallback(
    async (reacao: Reacao) => {
      if (!liveId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      adicionarReacaoFlutuante(reacao);
      await dataService().enviarReacaoNaLive(liveId, reacao);
    },
    [liveId, adicionarReacaoFlutuante],
  );

  return { mensagens, reacoes, espectadores, encerrada, carregando, enviarMensagem, enviarReacao };
}
