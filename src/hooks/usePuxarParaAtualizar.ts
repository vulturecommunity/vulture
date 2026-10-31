import { useCallback, useEffect, useRef, useState } from 'react';

type Atualizacao = () => unknown;

/**
 * Controla o giro do "puxar para atualizar".
 *
 * O `isRefetching` do React Query fica verdadeiro em qualquer busca em segundo plano —
 * o `refetchOnMount` ao abrir a tela, o `refetchInterval` das lives/mensagens/notificações,
 * a volta da conexão. Ligar o `refreshing` nele faz a roda aparecer sozinha e sumir
 * segundos depois, sem ninguém ter puxado a lista. Aqui o giro só existe entre o gesto
 * do torcedor e o fim das buscas que ele mesmo disparou.
 */
export function usePuxarParaAtualizar(...atualizacoes: Atualizacao[]) {
  const [atualizando, setAtualizando] = useState(false);
  const montado = useRef(true);
  const atuais = useRef<Atualizacao[]>(atualizacoes);

  // guardadas numa ref para o `aoAtualizar` nunca mudar de identidade e remontar o RefreshControl
  useEffect(() => {
    atuais.current = atualizacoes;
  });

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const aoAtualizar = useCallback(() => {
    setAtualizando(true);
    Promise.allSettled(atuais.current.map((atualizar) => atualizar())).finally(() => {
      if (montado.current) setAtualizando(false);
    });
  }, []);

  return { atualizando, aoAtualizar };
}
