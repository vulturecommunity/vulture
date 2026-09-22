import type { Interesse, Reacao } from '@/constants/interesses';
import type {
  AlvoDeDenuncia,
  Comentario,
  Denuncia,
  HashtagTrending,
  Id,
  Live,
  MensagemLive,
  MotivoDenuncia,
  Notificacao,
  Pagina,
  Perfil,
  RankingTorcedor,
  Sessao,
  TipoDeMidia,
  TokenPush,
  Usuario,
  Video,
} from '@/types';

export type AbaDoFeed = 'paraVoce' | 'seguindo';

export interface ParametrosDoFeed {
  aba: AbaDoFeed;
  cursor?: string | null;
  limite?: number;
  hashtag?: string;
  categoria?: Interesse;
}

export interface NovoVideo {
  /** URI local do arquivo (file://) gravado ou importado */
  uriLocal: string;
  tipo: TipoDeMidia;
  legenda: string;
  hashtags: string[];
  categoria: Interesse;
  duracao: number;
  largura?: number | null;
  altura?: number | null;
  audio?: string;
  /** thumbnail já gerada localmente (file://); se não vier, o serviço gera */
  thumbnailUriLocal?: string | null;
}

export type ProgressoDeUpload = (fracao: number, etapa: string) => void;

export interface DadosDeCadastro {
  email: string;
  senha: string;
  apelido?: string;
  nome?: string;
}

export interface AtualizacaoDePerfil {
  apelido?: string;
  nome?: string;
  bio?: string;
  interesses?: Interesse[];
  /** URI local (file://) de uma nova foto; o serviço faz o upload */
  avatarUriLocal?: string | null;
}

export interface NovaDenuncia {
  tipoAlvo: AlvoDeDenuncia;
  alvoId: Id;
  motivo: MotivoDenuncia;
  detalhes?: string;
}

export type CancelarAssinatura = () => void;

/**
 * Contrato único da camada de dados.
 * Implementado por MockDataService (offline) e SupabaseDataService (backend real).
 * A escolha é feita por EXPO_PUBLIC_DATA_DRIVER em `src/services/data/index.ts`.
 */
export interface DataService {
  readonly nome: 'mock' | 'supabase';

  // ---- Autenticação ----
  entrar(email: string, senha: string): Promise<Sessao>;
  cadastrar(dados: DadosDeCadastro): Promise<Sessao>;
  entrarComoVisitante(): Promise<Sessao>;
  sair(): Promise<void>;
  sessaoAtual(): Promise<Sessao | null>;
  concluirOnboarding(dados: {
    apelido: string;
    interesses: Interesse[];
    avatarUriLocal?: string | null;
  }): Promise<Sessao>;

  // ---- Feed e vídeos ----
  listFeed(params: ParametrosDoFeed): Promise<Pagina<Video>>;
  getVideo(id: Id): Promise<Video>;
  uploadVideo(novo: NovoVideo, aoProgredir?: ProgressoDeUpload): Promise<Video>;
  excluirVideo(id: Id): Promise<void>;
  registrarVisualizacao(id: Id): Promise<void>;
  registrarCompartilhamento(id: Id): Promise<void>;

  // ---- Interações ----
  like(videoId: Id): Promise<void>;
  unlike(videoId: Id): Promise<void>;
  salvar(videoId: Id): Promise<void>;
  removerSalvo(videoId: Id): Promise<void>;
  listComments(videoId: Id): Promise<Comentario[]>;
  addComment(videoId: Id, texto: string, paiId?: Id | null): Promise<Comentario>;
  excluirComentario(comentarioId: Id): Promise<void>;
  follow(usuarioId: Id): Promise<void>;
  unfollow(usuarioId: Id): Promise<void>;

  // ---- Perfil ----
  getProfile(usuarioId: Id | 'eu'): Promise<Perfil>;
  updateProfile(dados: AtualizacaoDePerfil): Promise<Usuario>;
  listVideosDoUsuario(usuarioId: Id): Promise<Video[]>;
  listVideosCurtidos(usuarioId: Id): Promise<Video[]>;
  listVideosSalvos(): Promise<Video[]>;
  listSeguidores(usuarioId: Id): Promise<Usuario[]>;
  listSeguindo(usuarioId: Id): Promise<Usuario[]>;

  // ---- Explorar ----
  buscarUsuarios(termo: string): Promise<Usuario[]>;
  buscarHashtags(termo: string): Promise<HashtagTrending[]>;
  listTrending(): Promise<Video[]>;
  listHashtagsEmAlta(): Promise<HashtagTrending[]>;
  rankingSemanal(): Promise<RankingTorcedor[]>;

  // ---- Lives ----
  listLives(): Promise<Live[]>;
  getLive(id: Id): Promise<Live>;
  createLive(titulo: string): Promise<Live>;
  encerrarLive(id: Id): Promise<void>;
  entrarNaLive(id: Id): Promise<void>;
  sairDaLive(id: Id): Promise<void>;
  listMensagensDaLive(liveId: Id): Promise<MensagemLive[]>;
  enviarMensagemNaLive(liveId: Id, texto: string): Promise<MensagemLive>;
  enviarReacaoNaLive(liveId: Id, reacao: Reacao): Promise<MensagemLive>;
  assinarLive(liveId: Id, aoReceber: (evento: EventoDaLive) => void): CancelarAssinatura;

  // ---- Notificações ----
  listNotificacoes(): Promise<Notificacao[]>;
  marcarNotificacoesComoLidas(): Promise<void>;
  /** Registra o token de push deste aparelho para o usuário logado (idempotente). */
  registrarTokenPush(token: TokenPush): Promise<void>;
  /** Remove o token deste aparelho (ao sair da conta). */
  removerTokenPush(token: string): Promise<void>;

  // ---- Segurança ----
  report(denuncia: NovaDenuncia): Promise<Denuncia>;
  bloquear(usuarioId: Id): Promise<void>;
  desbloquear(usuarioId: Id): Promise<void>;
  listBloqueados(): Promise<Usuario[]>;
}

export type EventoDaLive =
  | { tipo: 'mensagem'; mensagem: MensagemLive }
  | { tipo: 'reacao'; mensagem: MensagemLive }
  | { tipo: 'espectadores'; total: number }
  | { tipo: 'encerrada' };
