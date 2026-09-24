import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface VideoAssistido {
  videoId: string;
  legenda: string;
  apelido: string;
  thumbnailUrl: string | null;
  em: string;
}

export interface ComentarioFeito {
  id: string;
  videoId: string;
  texto: string;
  em: string;
}

export interface PesquisaFeita {
  termo: string;
  em: string;
}

export type TipoDeEventoDaConta = 'entrou' | 'saiu' | 'perfil' | 'senha' | 'privacidade';

export interface EventoDaConta {
  id: string;
  tipo: TipoDeEventoDaConta;
  descricao: string;
  em: string;
}

export type ColecaoDoHistorico = 'assistidos' | 'comentarios' | 'pesquisas' | 'conta';

export interface EstadoHistorico {
  /** dono dos registros: ao entrar com outra conta o histórico é descartado */
  donoId: string | null;
  assistidos: VideoAssistido[];
  comentarios: ComentarioFeito[];
  pesquisas: PesquisaFeita[];
  conta: EventoDaConta[];
  hidratado: boolean;

  definirDono: (usuarioId: string | null) => void;
  registrarAssistido: (video: Omit<VideoAssistido, 'em'>) => void;
  registrarComentario: (comentario: Omit<ComentarioFeito, 'em'>) => void;
  registrarPesquisa: (termo: string) => void;
  registrarEvento: (tipo: TipoDeEventoDaConta, descricao: string) => void;
  limpar: (colecao: ColecaoDoHistorico) => void;
  limparTudo: () => void;
}

/** Guarda só o passado recente: o histórico é conveniência, não arquivo. */
const LIMITE = 200;

function vazio(): Pick<EstadoHistorico, ColecaoDoHistorico> {
  return { assistidos: [], comentarios: [], pesquisas: [], conta: [] };
}

function comLimite<T>(itens: T[]): T[] {
  return itens.length > LIMITE ? itens.slice(0, LIMITE) : itens;
}

/** Histórico de uso guardado só neste aparelho (Centro de atividade). */
export const useHistoricoStore = create<EstadoHistorico>()(
  persist(
    (set) => ({
      donoId: null,
      ...vazio(),
      hidratado: false,

      definirDono: (usuarioId) =>
        set((estado) => {
          if (estado.donoId === usuarioId) return estado;
          return { donoId: usuarioId, ...vazio() };
        }),

      registrarAssistido: (video) =>
        set((estado) => ({
          assistidos: comLimite([
            { ...video, em: new Date().toISOString() },
            ...estado.assistidos.filter((a) => a.videoId !== video.videoId),
          ]),
        })),

      registrarComentario: (comentario) =>
        set((estado) => ({
          comentarios: comLimite([
            { ...comentario, em: new Date().toISOString() },
            ...estado.comentarios,
          ]),
        })),

      registrarPesquisa: (termo) =>
        set((estado) => {
          const limpo = termo.trim();
          if (limpo.length < 2) return estado;
          return {
            pesquisas: comLimite([
              { termo: limpo, em: new Date().toISOString() },
              ...estado.pesquisas.filter((p) => p.termo.toLowerCase() !== limpo.toLowerCase()),
            ]),
          };
        }),

      registrarEvento: (tipo, descricao) =>
        set((estado) => {
          const em = new Date().toISOString();
          return {
            conta: comLimite([{ id: `${tipo}-${em}`, tipo, descricao, em }, ...estado.conta]),
          };
        }),

      limpar: (colecao) => set({ [colecao]: [] } as unknown as Partial<EstadoHistorico>),

      limparTudo: () => set(vazio()),
    }),
    {
      name: 'vulture.historico.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (estado) => ({
        donoId: estado.donoId,
        assistidos: estado.assistidos,
        comentarios: estado.comentarios,
        pesquisas: estado.pesquisas,
        conta: estado.conta,
      }),
      onRehydrateStorage: () => () => useHistoricoStore.setState({ hidratado: true }),
    },
  ),
);
