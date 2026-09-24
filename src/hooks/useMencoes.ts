import { useQuery } from '@tanstack/react-query';

import { dataService } from '@/services/data';
import { useAuthStore } from '@/stores/authStore';
import type { Post } from '@/types';
import { mencionaApelido } from '@/utils/hashtags';

/** Quantas páginas da resenha varrer atrás de menções antes de desistir. */
const PAGINAS = 4;
const POR_PAGINA = 50;

/**
 * Posts da resenha que chamam o meu apelido. A varredura é do lado do app: só
 * alcança a parte recente da resenha, o suficiente para "quem falou de mim".
 */
export function useMencoes() {
  const apelido = useAuthStore((s) => s.sessao?.usuario.apelido);

  return useQuery<Post[]>({
    queryKey: ['mencoes', apelido ?? ''],
    enabled: !!apelido,
    queryFn: async () => {
      const encontrados: Post[] = [];
      let cursor: string | null = null;
      for (let pagina = 0; pagina < PAGINAS; pagina++) {
        const resposta = await dataService().listPosts({ cursor, limite: POR_PAGINA });
        encontrados.push(...resposta.itens.filter((p) => mencionaApelido(p.texto, apelido!)));
        if (!resposta.proximoCursor) break;
        cursor = resposta.proximoCursor;
      }
      return encontrados;
    },
  });
}
