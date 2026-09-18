import { create } from 'zustand';

export interface EstadoPlayer {
  /** id do vídeo que está visível/tocando no feed ativo */
  videoAtivoId: string | null;
  /** identifica qual lista (feed paraVoce, seguindo, perfil...) está no controle */
  listaAtiva: string | null;
  mudo: boolean;
  /** true quando o feed perde o foco (outra aba/tela) — pausa tudo */
  feedEmFoco: boolean;

  definirAtivo: (listaId: string, videoId: string | null) => void;
  alternarMudo: () => void;
  definirMudo: (mudo: boolean) => void;
  definirFoco: (emFoco: boolean) => void;
}

/** Controla qual vídeo toca e o estado de áudio, compartilhado por todas as listas. */
export const usePlayerStore = create<EstadoPlayer>((set) => ({
  videoAtivoId: null,
  listaAtiva: null,
  mudo: false,
  feedEmFoco: true,

  definirAtivo: (listaId, videoId) => set({ listaAtiva: listaId, videoAtivoId: videoId }),
  alternarMudo: () => set((s) => ({ mudo: !s.mudo })),
  definirMudo: (mudo) => set({ mudo }),
  definirFoco: (emFoco) => set({ feedEmFoco: emFoco }),
}));
