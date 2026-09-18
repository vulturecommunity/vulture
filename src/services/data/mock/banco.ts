import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  Comentario,
  Denuncia,
  Live,
  MensagemLive,
  Notificacao,
  Usuario,
  Video,
} from '@/types';

import {
  USUARIOS_SEED,
  gerarComentariosSeed,
  gerarLivesSeed,
  gerarMensagensDeLiveSeed,
  gerarNotificacoesSeed,
  gerarVideosSeed,
} from './seed';

export const CHAVE_BANCO = 'vulture.mock.banco.v1';
const VERSAO_BANCO = 1;

export interface Conta {
  email: string;
  /** Senha em texto puro: o driver mock é apenas para demonstração local. */
  senha: string;
  usuarioId: string;
}

export interface SessaoPersistida {
  usuarioId: string;
  visitante: boolean;
  onboardingConcluido: boolean;
}

export interface BancoMock {
  versao: number;
  usuarios: Usuario[];
  contas: Conta[];
  videos: Video[];
  curtidas: { usuarioId: string; videoId: string; criadoEm: string }[];
  salvos: { usuarioId: string; videoId: string; criadoEm: string }[];
  comentarios: Comentario[];
  seguidores: { seguidorId: string; seguidoId: string; criadoEm: string }[];
  lives: Live[];
  mensagensLive: MensagemLive[];
  notificacoes: (Notificacao & { paraId: string })[];
  denuncias: Denuncia[];
  bloqueios: { usuarioId: string; bloqueadoId: string }[];
  sessao: SessaoPersistida | null;
}

export function criarBancoInicial(): BancoMock {
  const videos = gerarVideosSeed();
  const comentarios = gerarComentariosSeed(videos);
  const lives = gerarLivesSeed();
  const usuarios = USUARIOS_SEED.map((u) => ({ ...u }));

  // contadores coerentes com os dados gerados
  for (const video of videos) {
    video.comentarios = comentarios.filter((c) => c.videoId === video.id).length;
  }
  for (const usuario of usuarios) {
    const meus = videos.filter((v) => v.autorId === usuario.id);
    usuario.totalVideos = meus.length;
    usuario.curtidasRecebidas = meus.reduce((soma, v) => soma + v.curtidas, 0);
    usuario.seguidores = 1200 + ((usuario.id.length * 137) % 9000);
    usuario.seguindo = 40 + ((usuario.id.length * 31) % 300);
  }

  return {
    versao: VERSAO_BANCO,
    usuarios,
    contas: [],
    videos,
    curtidas: [],
    salvos: [],
    comentarios,
    seguidores: [],
    lives,
    mensagensLive: gerarMensagensDeLiveSeed(lives),
    notificacoes: gerarNotificacoesSeed().map((n) => ({ ...n, paraId: '*' })),
    denuncias: [],
    bloqueios: [],
    sessao: null,
  };
}

/**
 * Persistência do banco mock: um único JSON no AsyncStorage, carregado em memória
 * e salvo com um pequeno atraso após cada mutação.
 */
export class ArmazenamentoMock {
  private banco: BancoMock | null = null;
  private carregando: Promise<BancoMock> | null = null;
  private salvarAgendado: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly chave: string = CHAVE_BANCO) {}

  async carregar(): Promise<BancoMock> {
    if (this.banco) return this.banco;
    if (!this.carregando) {
      this.carregando = (async () => {
        try {
          const bruto = await AsyncStorage.getItem(this.chave);
          if (bruto) {
            const salvo = JSON.parse(bruto) as BancoMock;
            if (salvo.versao === VERSAO_BANCO) {
              this.banco = salvo;
              return salvo;
            }
          }
        } catch {
          // JSON corrompido ou storage indisponível: recomeça do zero
        }
        this.banco = criarBancoInicial();
        await this.salvarAgora();
        return this.banco;
      })();
    }
    return this.carregando;
  }

  /** Agenda a gravação (debounce) para não escrever no disco a cada toque. */
  salvar(): void {
    if (this.salvarAgendado) clearTimeout(this.salvarAgendado);
    this.salvarAgendado = setTimeout(() => {
      this.salvarAgendado = null;
      this.salvarAgora().catch(() => {});
    }, 150);
  }

  async salvarAgora(): Promise<void> {
    if (!this.banco) return;
    await AsyncStorage.setItem(this.chave, JSON.stringify(this.banco));
  }

  async limpar(): Promise<void> {
    if (this.salvarAgendado) clearTimeout(this.salvarAgendado);
    this.salvarAgendado = null;
    this.banco = null;
    this.carregando = null;
    await AsyncStorage.removeItem(this.chave);
  }
}
