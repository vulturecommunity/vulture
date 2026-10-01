import { create } from 'zustand';

import type { Interesse } from '@/constants/interesses';
import { dataService } from '@/services/data';
import type { DadosDeCadastro } from '@/services/data/types';
import { esquecerTokenPush } from '@/services/push/registro';
import { queryClient } from '@/services/queryClient';
import {
  EVENTOS,
  esquecerUsuario,
  identificar,
  registrar,
  type NomeDeEvento,
  type PropriedadesDeEvento,
} from '@/services/telemetria';
import { useHistoricoStore } from '@/stores/historicoStore';
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
  entrarComGoogle: () => Promise<void>;
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
  async function executar(
    acao: () => Promise<Sessao>,
    registro?: string,
    telemetria?: { evento: NomeDeEvento; props?: PropriedadesDeEvento },
  ) {
    set({ ocupado: true, erro: null });
    try {
      const sessao = await acao();
      set({ sessao, ocupado: false });
      // troca de conta no mesmo aparelho descarta o Centro de atividade da anterior
      const historico = useHistoricoStore.getState();
      historico.definirDono(sessao.usuario.id);
      if (registro) historico.registrarEvento('entrou', registro);

      // Só o uuid e o apelido: e-mail nunca sai do aparelho (ver services/telemetria).
      identificar(sessao.usuario.id, sessao.usuario.apelido);
      if (telemetria) registrar(telemetria.evento, telemetria.props);
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
        if (sessao) useHistoricoStore.getState().definirDono(sessao.usuario.id);
      } catch {
        set({ sessao: null, carregado: true });
      }
    },

    entrar: (email, senha) =>
      executar(() => dataService().entrar(email, senha), 'Você entrou neste aparelho', {
        evento: EVENTOS.LOGIN,
        props: { metodo: 'email' },
      }),
    cadastrar: (dados) =>
      executar(() => dataService().cadastrar(dados), 'Conta criada', {
        evento: EVENTOS.CADASTRO_CONCLUIDO,
        props: { metodo: 'email' },
      }),
    entrarComoVisitante: () =>
      executar(() => dataService().entrarComoVisitante(), 'Entrou como visitante', {
        evento: EVENTOS.LOGIN,
        props: { metodo: 'visitante' },
      }),
    entrarComGoogle: () =>
      executar(() => dataService().entrarComGoogle(), 'Você entrou com o Google', {
        evento: EVENTOS.LOGIN,
        props: { metodo: 'google' },
      }),
    concluirOnboarding: (dados) =>
      executar(() => dataService().concluirOnboarding(dados), undefined, {
        evento: EVENTOS.ONBOARDING_CONCLUIDO,
        props: { interesses: dados.interesses.length },
      }),

    atualizarUsuario: (usuario) =>
      set((estado) => (estado.sessao ? { sessao: { ...estado.sessao, usuario } } : {})),

    sair: async () => {
      set({ ocupado: true });
      try {
        await esquecerTokenPush();
        await dataService().sair();
      } finally {
        queryClient.clear();
        // sem isto, o próximo login no mesmo aparelho herdaria os eventos de quem saiu
        esquecerUsuario();
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
