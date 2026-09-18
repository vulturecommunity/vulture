import { create } from 'zustand';

import type { Interesse } from '@/constants/interesses';
import type { TipoDeMidia } from '@/types';

export interface MidiaCapturada {
  uri: string;
  tipo: TipoDeMidia;
  duracao: number;
  largura: number | null;
  altura: number | null;
  /** de onde veio: câmera ou galeria */
  origem: 'camera' | 'galeria';
}

export interface EstadoCriacao {
  midia: MidiaCapturada | null;
  legenda: string;
  categoria: Interesse;
  /** progresso de 0 a 1 durante a publicação */
  progresso: number;
  etapa: string;
  publicando: boolean;
  erro: string | null;

  definirMidia: (midia: MidiaCapturada | null) => void;
  definirLegenda: (legenda: string) => void;
  definirCategoria: (categoria: Interesse) => void;
  definirProgresso: (progresso: number, etapa: string) => void;
  definirPublicando: (publicando: boolean) => void;
  definirErro: (erro: string | null) => void;
  limpar: () => void;
}

const inicial = {
  midia: null,
  legenda: '',
  categoria: 'Torcida' as Interesse,
  progresso: 0,
  etapa: '',
  publicando: false,
  erro: null,
};

/** Estado do fluxo câmera → preview → publicação. */
export const useCriacaoStore = create<EstadoCriacao>((set) => ({
  ...inicial,
  definirMidia: (midia) => set({ midia, erro: null, progresso: 0, etapa: '' }),
  definirLegenda: (legenda) => set({ legenda }),
  definirCategoria: (categoria) => set({ categoria }),
  definirProgresso: (progresso, etapa) => set({ progresso, etapa }),
  definirPublicando: (publicando) => set({ publicando }),
  definirErro: (erro) => set({ erro }),
  limpar: () => set({ ...inicial }),
}));
