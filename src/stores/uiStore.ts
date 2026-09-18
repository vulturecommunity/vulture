import { create } from 'zustand';

import type { AlvoDeDenuncia } from '@/types';

export interface AlvoParaDenuncia {
  tipo: AlvoDeDenuncia;
  id: string;
  /** id do autor do conteúdo, para oferecer "bloquear" */
  autorId?: string;
  autorApelido?: string;
}

export interface EstadoUi {
  videoParaComentar: string | null;
  alvoParaDenuncia: AlvoParaDenuncia | null;
  aviso: { texto: string; tipo: 'sucesso' | 'erro' | 'info' } | null;

  abrirComentarios: (videoId: string) => void;
  fecharComentarios: () => void;
  abrirDenuncia: (alvo: AlvoParaDenuncia) => void;
  fecharDenuncia: () => void;
  mostrarAviso: (texto: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  limparAviso: () => void;
}

/** Estado de interface compartilhado: painéis globais (comentários, denúncia) e avisos (toast). */
export const useUiStore = create<EstadoUi>((set) => ({
  videoParaComentar: null,
  alvoParaDenuncia: null,
  aviso: null,

  abrirComentarios: (videoId) => set({ videoParaComentar: videoId }),
  fecharComentarios: () => set({ videoParaComentar: null }),
  abrirDenuncia: (alvo) => set({ alvoParaDenuncia: alvo }),
  fecharDenuncia: () => set({ alvoParaDenuncia: null }),
  mostrarAviso: (texto, tipo = 'info') => set({ aviso: { texto, tipo } }),
  limparAviso: () => set({ aviso: null }),
}));
