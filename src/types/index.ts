import type { Interesse, Reacao } from '@/constants/interesses';

export type Id = string;

export interface Usuario {
  id: Id;
  apelido: string;
  nome: string;
  avatarUrl: string | null;
  bio: string;
  interesses: Interesse[];
  seguidores: number;
  seguindo: number;
  curtidasRecebidas: number;
  totalVideos: number;
  criadoEm: string;
}

/** Usuário + relação com quem está logado. */
export interface Perfil extends Usuario {
  souEu: boolean;
  estouSeguindo: boolean;
  bloqueado: boolean;
}

export type TipoDeMidia = 'video' | 'foto';

export interface Video {
  id: Id;
  autorId: Id;
  autor: Pick<Usuario, 'id' | 'apelido' | 'nome' | 'avatarUrl'>;
  tipo: TipoDeMidia;
  url: string;
  thumbnailUrl: string | null;
  legenda: string;
  hashtags: string[];
  categoria: Interesse;
  audio: string;
  duracao: number;
  largura: number | null;
  altura: number | null;
  curtidas: number;
  comentarios: number;
  salvos: number;
  compartilhamentos: number;
  visualizacoes: number;
  criadoEm: string;
  /** relação com o usuário logado */
  curtido: boolean;
  salvo: boolean;
}

export interface Comentario {
  id: Id;
  videoId: Id;
  autorId: Id;
  autor: Pick<Usuario, 'id' | 'apelido' | 'nome' | 'avatarUrl'>;
  texto: string;
  paiId: Id | null;
  curtidas: number;
  criadoEm: string;
  respostas: Comentario[];
}

export interface Live {
  id: Id;
  anfitriaoId: Id;
  anfitriao: Pick<Usuario, 'id' | 'apelido' | 'nome' | 'avatarUrl'>;
  titulo: string;
  thumbnailUrl: string | null;
  sala: string;
  espectadores: number;
  ativa: boolean;
  iniciadaEm: string;
  encerradaEm: string | null;
}

export type TipoDeMensagemLive = 'texto' | 'reacao' | 'sistema';

export interface MensagemLive {
  id: Id;
  liveId: Id;
  autorId: Id;
  autor: Pick<Usuario, 'id' | 'apelido' | 'avatarUrl'>;
  tipo: TipoDeMensagemLive;
  texto: string;
  reacao: Reacao | null;
  criadoEm: string;
}

export type TipoDeNotificacao = 'curtida' | 'comentario' | 'seguiu' | 'sistema';

export interface Notificacao {
  id: Id;
  tipo: TipoDeNotificacao;
  deId: Id | null;
  de: Pick<Usuario, 'id' | 'apelido' | 'avatarUrl'> | null;
  videoId: Id | null;
  texto: string;
  lida: boolean;
  criadoEm: string;
}

export type AlvoDeDenuncia = 'video' | 'usuario' | 'comentario' | 'live';

export const MOTIVOS_DENUNCIA = [
  'Spam ou golpe',
  'Discurso de ódio',
  'Violência',
  'Conteúdo sexual',
  'Assédio ou bullying',
  'Informação falsa',
  'Outro',
] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number];

export interface Denuncia {
  id: Id;
  tipoAlvo: AlvoDeDenuncia;
  alvoId: Id;
  motivo: MotivoDenuncia;
  detalhes: string;
  criadoEm: string;
}

export interface Sessao {
  usuario: Usuario;
  visitante: boolean;
  onboardingConcluido: boolean;
}

export interface RankingTorcedor {
  posicao: number;
  usuario: Pick<Usuario, 'id' | 'apelido' | 'nome' | 'avatarUrl'>;
  curtidasNaSemana: number;
  videosNaSemana: number;
}

export interface HashtagTrending {
  tag: string;
  totalVideos: number;
}

export interface Pagina<T> {
  itens: T[];
  proximoCursor: string | null;
}
