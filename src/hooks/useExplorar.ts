import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';

/** Valor com atraso (debounce) para não buscar a cada tecla. */
export function useValorAtrasado<T>(valor: T, atrasoMs = 300): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const timer = setTimeout(() => setAtrasado(valor), atrasoMs);
    return () => clearTimeout(timer);
  }, [valor, atrasoMs]);
  return atrasado;
}

export function useBuscaDeUsuarios(termo: string) {
  return useQuery({
    queryKey: chaves.buscaUsuarios(termo),
    queryFn: () => dataService().buscarUsuarios(termo),
    enabled: termo.trim().length > 0,
  });
}

export function useBuscaDeHashtags(termo: string) {
  return useQuery({
    queryKey: chaves.buscaHashtags(termo),
    queryFn: () => dataService().buscarHashtags(termo),
    enabled: termo.trim().length > 0,
  });
}

export function useTrending() {
  return useQuery({ queryKey: chaves.trending, queryFn: () => dataService().listTrending() });
}

export function useHashtagsEmAlta() {
  return useQuery({
    queryKey: chaves.hashtagsEmAlta,
    queryFn: () => dataService().listHashtagsEmAlta(),
  });
}

export function useRankingSemanal() {
  return useQuery({ queryKey: chaves.ranking, queryFn: () => dataService().rankingSemanal() });
}
