import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import type { Conversa, Mensagem, PreferenciasDeMensagens } from '@/types';
import { agoraIso } from '@/utils/ids';

import { useNotificacoes } from './useNotificacoes';

export function useConversas() {
  const logado = useAuthStore((s) => !!s.sessao);
  return useQuery({
    queryKey: chaves.conversas,
    queryFn: () => dataService().listConversas(),
    enabled: logado,
    refetchInterval: 15 * 1000,
  });
}

/** Total de conversas com mensagens não lidas (para o badge do ícone de mensagens). */
export function useConversasNaoLidas(): number {
  const { data } = useConversas();
  return data?.filter((c) => c.naoLidas > 0).length ?? 0;
}

/** Badge do botão de mensagens no feed: conversas não lidas + notificações não lidas. */
export function useTotalNaoLido(): number {
  const conversas = useConversasNaoLidas();
  const { data } = useNotificacoes();
  const notificacoes = data?.filter((n) => !n.lida).length ?? 0;
  return conversas + notificacoes;
}

export function useConversa(conversaId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: chaves.conversa(conversaId ?? ''),
    queryFn: () => dataService().getConversa(conversaId!),
    enabled: !!conversaId,
    // aproveita a lista já carregada para abrir a tela sem esperar a rede
    initialData: () =>
      queryClient.getQueryData<Conversa[]>(chaves.conversas)?.find((c) => c.id === conversaId),
  });
}

export function usePermissaoDeConversa(usuarioId: string | undefined) {
  return useQuery({
    queryKey: chaves.permissaoDeConversa(usuarioId ?? ''),
    queryFn: () => dataService().podeConversar(usuarioId!),
    enabled: !!usuarioId,
  });
}

/** Abre (ou reaproveita) a conversa com alguém e devolve a conversa para navegar. */
export function useAbrirConversa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (usuarioId: string) => dataService().abrirConversa(usuarioId),
    onSuccess: (conversa) => {
      queryClient.setQueryData(chaves.conversa(conversa.id), conversa);
      queryClient.invalidateQueries({ queryKey: chaves.conversas });
    },
  });
}

/**
 * Mensagens de uma conversa: histórico + assinatura em tempo real.
 * Mensagens que chegam do outro lado são marcadas como lidas enquanto a tela está aberta.
 */
export function useMensagens(conversaId: string | undefined) {
  const queryClient = useQueryClient();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const consulta = useQuery({
    queryKey: chaves.mensagens(conversaId ?? ''),
    queryFn: () => dataService().listMensagens(conversaId!),
    enabled: !!conversaId,
  });

  const marcarLida = useCallback(() => {
    if (!conversaId) return;
    dataService()
      .marcarConversaComoLida(conversaId)
      .then(() => queryClient.invalidateQueries({ queryKey: chaves.conversas }))
      .catch(() => {});
  }, [conversaId, queryClient]);

  // ao abrir a conversa, zera as não lidas
  useEffect(() => {
    if (consulta.isSuccess) marcarLida();
  }, [consulta.isSuccess, marcarLida]);

  useEffect(() => {
    if (!conversaId) return;
    const cancelar = dataService().assinarConversa(conversaId, (mensagem) => {
      queryClient.setQueryData<Mensagem[]>(chaves.mensagens(conversaId), (atual = []) =>
        atual.some((m) => m.id === mensagem.id) ? atual : [...atual, mensagem],
      );
      if (mensagem.remetenteId !== meuId) marcarLida();
      queryClient.invalidateQueries({ queryKey: chaves.conversas });
    });
    return cancelar;
  }, [conversaId, meuId, queryClient, marcarLida]);

  return consulta;
}

/** Envia com atualização otimista: a mensagem aparece na hora e some se o envio falhar. */
export function useEnviarMensagem(conversaId: string | undefined) {
  const queryClient = useQueryClient();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const mutacao = useMutation({
    mutationFn: (texto: string) => dataService().enviarMensagem(conversaId!, texto),
    onMutate: async (texto) => {
      setErro(null);
      const chave = chaves.mensagens(conversaId ?? '');
      const idTemporario = `temp-${Date.now()}`;
      queryClient.setQueryData<Mensagem[]>(chave, (atual = []) => [
        ...atual,
        {
          id: idTemporario,
          conversaId: conversaId ?? '',
          remetenteId: meuId,
          texto: texto.trim(),
          lida: false,
          criadoEm: agoraIso(),
        },
      ]);
      return { idTemporario };
    },
    onSuccess: (mensagem, _texto, contexto) => {
      queryClient.setQueryData<Mensagem[]>(chaves.mensagens(conversaId ?? ''), (atual = []) => {
        const semTemporaria = atual.filter((m) => m.id !== contexto?.idTemporario);
        return semTemporaria.some((m) => m.id === mensagem.id)
          ? semTemporaria
          : [...semTemporaria, mensagem];
      });
      queryClient.invalidateQueries({ queryKey: chaves.conversas });
    },
    onError: (e, _texto, contexto) => {
      queryClient.setQueryData<Mensagem[]>(chaves.mensagens(conversaId ?? ''), (atual = []) =>
        atual.filter((m) => m.id !== contexto?.idTemporario),
      );
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.');
    },
  });

  return {
    enviar: mutacao.mutate,
    enviando: mutacao.isPending,
    erro,
    limparErro: () => setErro(null),
  };
}

export function useContatos() {
  return useQuery({ queryKey: chaves.contatos, queryFn: () => dataService().listContatos() });
}

export function usePreferenciasDeMensagens() {
  const logado = useAuthStore((s) => !!s.sessao);
  return useQuery({
    queryKey: chaves.preferenciasDeMensagens,
    queryFn: () => dataService().obterPreferenciasDeMensagens(),
    enabled: logado,
  });
}

/** Troca uma preferência com resposta imediata na tela (desfaz se falhar). */
export function useAtualizarPreferenciasDeMensagens() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dados: Partial<PreferenciasDeMensagens>) =>
      dataService().atualizarPreferenciasDeMensagens(dados),
    onMutate: async (dados) => {
      const anterior = queryClient.getQueryData<PreferenciasDeMensagens>(
        chaves.preferenciasDeMensagens,
      );
      if (anterior) {
        queryClient.setQueryData(chaves.preferenciasDeMensagens, { ...anterior, ...dados });
      }
      return { anterior };
    },
    onError: (_erro, _dados, contexto) => {
      if (contexto?.anterior)
        queryClient.setQueryData(chaves.preferenciasDeMensagens, contexto.anterior);
    },
    onSuccess: (novas) => {
      queryClient.setQueryData(chaves.preferenciasDeMensagens, novas);
      queryClient.invalidateQueries({ queryKey: ['permissao-conversa'] });
    },
  });
}
