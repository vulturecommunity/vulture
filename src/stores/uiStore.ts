import { create } from 'zustand';

import type { AlvoDeDenuncia } from '@/types';

export interface AlvoParaDenuncia {
  tipo: AlvoDeDenuncia;
  id: string;
  /** id do autor do conteúdo, para oferecer "bloquear" */
  autorId?: string;
  autorApelido?: string;
  /** a tela aberta é a do próprio conteúdo: ao excluir, volta */
  voltarAoExcluir?: boolean;
}

export interface EstadoUi {
  videoParaComentar: string | null;
  alvoParaDenuncia: AlvoParaDenuncia | null;
  aviso: { texto: string; tipo: 'sucesso' | 'erro' | 'info' } | null;
  /** faixa de placar no topo do feed (o torcedor pode recolher) */
  placarVisivel: boolean;

  abrirComentarios: (videoId: string) => void;
  fecharComentarios: () => void;
  abrirDenuncia: (alvo: AlvoParaDenuncia) => void;
  fecharDenuncia: () => void;
  mostrarAviso: (texto: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  limparAviso: () => void;
  alternarPlacar: () => void;
}

/** Estado de interface compartilhado: painéis globais (comentários, denúncia) e avisos (toast). */
export const useUiStore = create<EstadoUi>((set) => ({
  videoParaComentar: null,
  alvoParaDenuncia: null,
  aviso: null,
  placarVisivel: true,

  abrirComentarios: (videoId) => set({ videoParaComentar: videoId }),
  fecharComentarios: () => set({ videoParaComentar: null }),
  abrirDenuncia: (alvo) => set({ alvoParaDenuncia: alvo }),
  fecharDenuncia: () => set({ alvoParaDenuncia: null }),
  mostrarAviso: (texto, tipo = 'info') => set({ aviso: { texto, tipo } }),
  limparAviso: () => set({ aviso: null }),
  alternarPlacar: () => set((estado) => ({ placarVisivel: !estado.placarVisivel })),
}));
