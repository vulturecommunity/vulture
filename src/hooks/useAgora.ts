import { useEffect, useState } from 'react';

/** "Agora" que se atualiza sozinho: contagens regressivas e palpites que fecham no apito. */
export function useAgora(intervaloMs = 30_000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), intervaloMs);
    return () => clearInterval(relogio);
  }, [intervaloMs]);
  return agora;
}
