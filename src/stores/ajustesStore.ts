import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Quem pode interagir comigo. */
export type Publico = 'todos' | 'seguidores' | 'ninguem';

/** Quem enxerga a aba de vídeos curtidos do meu perfil. */
export type PublicoDosCurtidos = 'seguidores' | 'somenteEu';

export interface Preferencias {
  contaPrivada: boolean;
  comentariosDe: Publico;
  mencoesDe: Publico;
  /** esconde comentários que tenham alguma das palavras da lista */
  filtrarComentarios: boolean;
  palavrasFiltradas: string[];
  permitirDownloads: boolean;
  curtidosVisiveisPara: PublicoDosCurtidos;
  /** vídeos do feed não começam sozinhos: a pessoa toca para assistir */
  economizarDados: boolean;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  contaPrivada: false,
  comentariosDe: 'todos',
  mencoesDe: 'todos',
  filtrarComentarios: true,
  palavrasFiltradas: [],
  permitirDownloads: true,
  curtidosVisiveisPara: 'somenteEu',
  economizarDados: false,
};

export interface EstadoAjustes extends Preferencias {
  /** true depois que o AsyncStorage devolveu o que estava salvo */
  hidratado: boolean;
  definir: <C extends keyof Preferencias>(chave: C, valor: Preferencias[C]) => void;
  adicionarPalavra: (palavra: string) => void;
  removerPalavra: (palavra: string) => void;
  restaurarPadroes: () => void;
}

const LIMITE_DE_PALAVRAS = 30;

/** Preferências do aparelho: privacidade, interações e consumo de dados. */
export const useAjustesStore = create<EstadoAjustes>()(
  persist(
    (set) => ({
      ...PREFERENCIAS_PADRAO,
      hidratado: false,

      definir: (chave, valor) => set({ [chave]: valor } as unknown as Partial<EstadoAjustes>),

      adicionarPalavra: (palavra) =>
        set((estado) => {
          const limpa = palavra.trim().toLowerCase();
          if (!limpa || estado.palavrasFiltradas.includes(limpa)) return estado;
          return {
            palavrasFiltradas: [limpa, ...estado.palavrasFiltradas].slice(0, LIMITE_DE_PALAVRAS),
          };
        }),

      removerPalavra: (palavra) =>
        set((estado) => ({
          palavrasFiltradas: estado.palavrasFiltradas.filter((p) => p !== palavra),
        })),

      restaurarPadroes: () => set({ ...PREFERENCIAS_PADRAO }),
    }),
    {
      name: 'vulture.ajustes.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (estado) => ({
        contaPrivada: estado.contaPrivada,
        comentariosDe: estado.comentariosDe,
        mencoesDe: estado.mencoesDe,
        filtrarComentarios: estado.filtrarComentarios,
        palavrasFiltradas: estado.palavrasFiltradas,
        permitirDownloads: estado.permitirDownloads,
        curtidosVisiveisPara: estado.curtidosVisiveisPara,
        economizarDados: estado.economizarDados,
      }),
      // sem isso as telas desenham os padrões por um instante e os switches "pulam"
      onRehydrateStorage: () => () => useAjustesStore.setState({ hidratado: true }),
    },
  ),
);

/** Alguma palavra da lista aparece no texto? Usado para esconder comentários indesejados. */
export function contemPalavraFiltrada(texto: string, palavras: string[]): boolean {
  if (palavras.length === 0) return false;
  const alvo = texto.toLowerCase();
  return palavras.some((p) => alvo.includes(p));
}
