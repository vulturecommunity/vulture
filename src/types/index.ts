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

export type TipoDeNotificacao = 'curtida' | 'comentario' | 'seguiu' | 'live' | 'sistema';

export interface Notificacao {
  id: Id;
  tipo: TipoDeNotificacao;
  deId: Id | null;
  de: Pick<Usuario, 'id' | 'apelido' | 'avatarUrl'> | null;
  videoId: Id | null;
  /** live relacionada (tipo "live"): tocar abre a transmissão */
  liveId: Id | null;
  /** post da Arquibancada curtido ou respondido: tocar abre a thread */
  postId?: Id | null;
  texto: string;
  lida: boolean;
  criadoEm: string;
}

export type PlataformaPush = 'android' | 'ios' | 'web';

export interface TokenPush {
  token: string;
  plataforma: PlataformaPush;
}

export type AlvoDeDenuncia = 'video' | 'usuario' | 'comentario' | 'live' | 'post';

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

// ---------------------------------------------------------------- mensagens, seguidores e rasantes

export type ResumoDeUsuario = Pick<Usuario, 'id' | 'apelido' | 'nome' | 'avatarUrl'>;

/** Quem pode puxar papo comigo (Perfil → Configurações → Mensagens). */
export interface PreferenciasDeMensagens {
  /** aceitar mensagens de quem eu sigo */
  deQuemSigo: boolean;
  /** aceitar mensagens de quem me segue */
  deSeguidores: boolean;
}

export interface Mensagem {
  id: Id;
  conversaId: Id;
  remetenteId: Id;
  texto: string;
  lida: boolean;
  criadoEm: string;
}

/** Conversa privada: sempre entre duas pessoas. */
export interface Conversa {
  id: Id;
  /** o outro participante */
  outro: ResumoDeUsuario;
  ultimaMensagem: Pick<Mensagem, 'texto' | 'remetenteId' | 'criadoEm'> | null;
  naoLidas: number;
  atualizadoEm: string;
}

export type MotivoDeConversaNegada = 'eu_mesmo' | 'bloqueado' | 'nao_aceita' | 'sem_relacao';

export type PermissaoDeConversa =
  { permitido: true } | { permitido: false; motivo: MotivoDeConversaNegada; descricao: string };

export interface NovoSeguidor {
  usuario: ResumoDeUsuario;
  seguiuEm: string;
  /** se eu já sigo essa pessoa de volta */
  sigoDeVolta: boolean;
}

/** Vídeo curto (até 15 s) que some em 24 h: aparece no topo do perfil e das mensagens. */
export interface Rasante {
  id: Id;
  autorId: Id;
  autor: ResumoDeUsuario;
  url: string;
  thumbnailUrl: string | null;
  duracao: number;
  criadoEm: string;
  expiraEm: string;
  /** já assisti (anel apagado) */
  visto: boolean;
}

/** Rasantes ativos de uma pessoa, agrupados para a fileira do topo. */
export interface GrupoDeRasantes {
  autor: ResumoDeUsuario;
  rasantes: Rasante[];
  todosVistos: boolean;
  souEu: boolean;
}

// ---------------------------------------------------------------- arquibancada (resenha e palpites)

export const TAMANHO_MAXIMO_POST = 280;

/** Anexos de post, como no X: até 4 imagens, OU 1 vídeo curto, OU 1 GIF. */
export const LIMITES_DE_MIDIA = {
  imagens: 4,
  videoSegundos: 30,
  videoBytes: 15 * 1024 * 1024,
  /** lado maior da imagem depois da compressão no aparelho */
  imagemLado: 1080,
} as const;

export type TipoDeMidiaDoPost = 'imagem' | 'video' | 'gif';

export interface MidiaDoPost {
  tipo: TipoDeMidiaDoPost;
  url: string;
  /** miniatura do vídeo: o arquivo só é baixado quando a pessoa dá play */
  thumbnailUrl: string | null;
  largura: number | null;
  altura: number | null;
  /** segundos (só vídeo) */
  duracao: number | null;
}

/** Jogo marcado num post ("SAN x FLA"); o id é o da partida no calendário. */
export interface MarcacaoDePartida {
  id: string;
  rotulo: string;
}

/** Post de texto da resenha. Respostas são posts com `paiId` (thread de 1 nível). */
export interface Post {
  id: Id;
  autorId: Id;
  autor: ResumoDeUsuario;
  texto: string;
  hashtags: string[];
  paiId: Id | null;
  partida: MarcacaoDePartida | null;
  midias: MidiaDoPost[];
  curtidas: number;
  respostas: number;
  criadoEm: string;
  curtido: boolean;
}

export interface Palpite {
  partidaId: string;
  golsMandante: number;
  golsVisitante: number;
  atualizadoEm: string;
}

/** O que a torcida está apostando numa partida. */
export interface ResumoDePalpites {
  total: number;
  vitoriaMandante: number;
  empate: number;
  vitoriaVisitante: number;
  placarPopular: { golsMandante: number; golsVisitante: number; votos: number } | null;
}
