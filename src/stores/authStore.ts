import { create } from 'zustand';

import type { Interesse } from '@/constants/interesses';
import { dataService } from '@/services/data';
import type { DadosDeCadastro } from '@/services/data/types';
import { queryClient } from '@/services/queryClient';
import type { Sessao, Usuario } from '@/types';

export interface EstadoAuth {
  sessao: Sessao | null;
  /** true depois da primeira tentativa de restaurar a sessão */
  carregado: boolean;
  ocupado: boolean;
  erro: string | null;

  restaurarSessao: () => Promise<void>;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: DadosDeCadastro) => Promise<void>;
  entrarComoVisitante: () => Promise<void>;
  concluirOnboarding: (dados: {
    apelido: string;
    interesses: Interesse[];
    avatarUriLocal?: string | null;
  }) => Promise<void>;
  atualizarUsuario: (usuario: Usuario) => void;
  sair: () => Promise<void>;
  limparErro: () => void;
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Algo deu errado. Tente novamente.';
}

/** Estado global de autenticação. A sessão em si é persistida pelo DataService. */
export const useAuthStore = create<EstadoAuth>((set) => {
  async function executar(acao: () => Promise<Sessao>) {
    set({ ocupado: true, erro: null });
    try {
      const sessao = await acao();
      set({ sessao, ocupado: false });
    } catch (erro) {
      set({ erro: mensagem(erro), ocupado: false });
      throw erro;
    }
  }

  return {
    sessao: null,
    carregado: false,
    ocupado: false,
    erro: null,

    restaurarSessao: async () => {
      try {
        const sessao = await dataService().sessaoAtual();
        set({ sessao, carregado: true });
      } catch {
        set({ sessao: null, carregado: true });
      }
    },

    entrar: (email, senha) => executar(() => dataService().entrar(email, senha)),
    cadastrar: (dados) => executar(() => dataService().cadastrar(dados)),
    entrarComoVisitante: () => executar(() => dataService().entrarComoVisitante()),
    concluirOnboarding: (dados) => executar(() => dataService().concluirOnboarding(dados)),

    atualizarUsuario: (usuario) =>
      set((estado) => (estado.sessao ? { sessao: { ...estado.sessao, usuario } } : {})),

    sair: async () => {
      set({ ocupado: true });
      try {
        await dataService().sair();
      } finally {
        queryClient.clear();
        set({ sessao: null, ocupado: false, erro: null });
      }
    },

    limparErro: () => set({ erro: null }),
  };
});

/** Atalho: usuário logado (ou null). */
export function useUsuarioAtual(): Usuario | null {
  return useAuthStore((s) => s.sessao?.usuario ?? null);
}
