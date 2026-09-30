import type { Interesse, Reacao } from '@/constants/interesses';
import type {
  AlvoDeDenuncia,
  Comentario,
  Conversa,
  Denuncia,
  GrupoDeRasantes,
  HashtagTrending,
  Id,
  Liga,
  Live,
  MarcacaoDePartida,
  Mensagem,
  MensagemLive,
  MotivoDenuncia,
  Notificacao,
  NovoSeguidor,
  Pagina,
  Palpite,
  PalpiteiroDaPartida,
  Palpiteiro,
  PeriodoDoRanking,
  Perfil,
  PermissaoDeConversa,
  Post,
  PreferenciasDeMensagens,
  RankingDePalpites,
  RankingTorcedor,
  Rasante,
  ResumoDePalpites,
  Sessao,
  Titulo,
  TipoDeMidia,
  TipoDeNotificacao,
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

export interface NovoRasante {
  /** URI local (file://) do vídeo curto */
  uriLocal: string;
  duracao: number;
  largura?: number | null;
  altura?: number | null;
  thumbnailUriLocal?: string | null;
}

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

export interface ParametrosDaResenha {
  cursor?: string | null;
  limite?: number;
  hashtag?: string;
  /** só os posts marcados com esse jogo */
  partidaId?: string;
}

/** Anexo escolhido no composer: imagem/vídeo ainda no aparelho, ou GIF já hospedado no GIPHY. */
export type NovaMidia =
  | { tipo: 'imagem'; uriLocal: string; largura: number; altura: number }
  | {
      tipo: 'video';
      uriLocal: string;
      largura: number | null;
      altura: number | null;
      /** segundos */
      duracao: number;
      tamanhoBytes: number;
    }
  | { tipo: 'gif'; url: string; largura: number; altura: number };

export interface NovoPost {
  /** pode ser vazio quando há mídia */
  texto: string;
  /** responder a um post (respostas de respostas caem no post raiz) */
  paiId?: Id | null;
  partida?: MarcacaoDePartida | null;
  midias?: NovaMidia[];
}

export interface NovoPalpite {
  partidaId: string;
  /** horário do jogo (ISO): palpites fecham quando a bola rola */
  inicioDaPartida: string;
  golsMandante: number;
  golsVisitante: number;
}

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
  /**
   * Entra com a conta Google. Cria o perfil na primeira vez, como no cadastro por e-mail.
   * Recusa com 'google_indisponivel' quando o provedor não está configurado no projeto.
   */
  entrarComGoogle(): Promise<Sessao>;
  sair(): Promise<void>;
  sessaoAtual(): Promise<Sessao | null>;
  concluirOnboarding(dados: {
    apelido: string;
    interesses: Interesse[];
    avatarUriLocal?: string | null;
  }): Promise<Sessao>;
  /** Troca a senha do login; recusa quando a senha atual não bate. */
  alterarSenha(senhaAtual: string, novaSenha: string): Promise<void>;
  /** Dispara o e-mail de redefinição de senha. */
  enviarRedefinicaoDeSenha(email: string): Promise<void>;

  // ---- Feed e vídeos ----
  listFeed(params: ParametrosDoFeed): Promise<Pagina<Video>>;
  getVideo(id: Id): Promise<Video>;
  uploadVideo(novo: NovoVideo, aoProgredir?: ProgressoDeUpload): Promise<Video>;
  excluirVideo(id: Id): Promise<void>;
  registrarVisualizacao(id: Id): Promise<void>;
  /** Visualizações acumuladas no aparelho e enviadas de uma vez (ver `useFeed`). */
  registrarVisualizacoes(ids: Id[]): Promise<void>;
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
  /**
   * Assina os eventos de uma live. `anfitriao` evita contar quem transmite como
   * espectador e é o que mantém o contador honesto.
   */
  assinarLive(
    liveId: Id,
    aoReceber: (evento: EventoDaLive) => void,
    opcoes?: { anfitriao?: boolean },
  ): CancelarAssinatura;

  // ---- Notificações ----
  listNotificacoes(): Promise<Notificacao[]>;
  /** Marca como lidas todas as notificações ou só as dos tipos informados. */
  marcarNotificacoesComoLidas(tipos?: TipoDeNotificacao[]): Promise<void>;
  /** Registra o token de push deste aparelho para o usuário logado (idempotente). */
  registrarTokenPush(token: TokenPush): Promise<void>;
  /** Remove o token deste aparelho (ao sair da conta). */
  removerTokenPush(token: string): Promise<void>;

  // ---- Mensagens diretas ----
  listConversas(): Promise<Conversa[]>;
  getConversa(conversaId: Id): Promise<Conversa>;
  /** Se posso puxar papo com alguém (bloqueios e preferências de quem recebe). */
  podeConversar(usuarioId: Id): Promise<PermissaoDeConversa>;
  /** Abre (ou reaproveita) a conversa com alguém. */
  abrirConversa(usuarioId: Id): Promise<Conversa>;
  listMensagens(conversaId: Id): Promise<Mensagem[]>;
  enviarMensagem(conversaId: Id, texto: string): Promise<Mensagem>;
  marcarConversaComoLida(conversaId: Id): Promise<void>;
  assinarConversa(conversaId: Id, aoReceber: (mensagem: Mensagem) => void): CancelarAssinatura;
  /** Pessoas com quem posso conversar (quem sigo + quem me segue), sem bloqueados. */
  listContatos(): Promise<Usuario[]>;
  obterPreferenciasDeMensagens(): Promise<PreferenciasDeMensagens>;
  atualizarPreferenciasDeMensagens(
    dados: Partial<PreferenciasDeMensagens>,
  ): Promise<PreferenciasDeMensagens>;

  // ---- Seguidores e sugestões ----
  /** Quem começou a me seguir, do mais recente para o mais antigo. */
  listNovosSeguidores(): Promise<NovoSeguidor[]>;
  /** Torcedores para seguir (que ainda não sigo). */
  sugerirTorcedores(): Promise<Usuario[]>;

  // ---- Rasantes (vídeos curtos de 24 h) ----
  /** Meus rasantes primeiro, depois os de quem eu sigo. */
  listRasantes(): Promise<GrupoDeRasantes[]>;
  listRasantesDoUsuario(usuarioId: Id): Promise<Rasante[]>;
  publicarRasante(novo: NovoRasante, aoProgredir?: ProgressoDeUpload): Promise<Rasante>;
  marcarRasanteComoVisto(id: Id): Promise<void>;
  excluirRasante(id: Id): Promise<void>;

  // ---- Arquibancada: resenha (posts de texto) ----
  /** Posts raiz, do mais novo para o mais antigo; respostas ficam na thread. */
  listPosts(params: ParametrosDaResenha): Promise<Pagina<Post>>;
  getPost(id: Id): Promise<Post>;
  /** Respostas de um post, da mais antiga para a mais nova. */
  listRespostas(postId: Id): Promise<Post[]>;
  /** Envia os anexos (se houver) e publica; `aoProgredir` acompanha o upload. */
  publicarPost(novo: NovoPost, aoProgredir?: ProgressoDeUpload): Promise<Post>;
  excluirPost(id: Id): Promise<void>;
  curtirPost(id: Id): Promise<void>;
  descurtirPost(id: Id): Promise<void>;

  // ---- Arquibancada: palpites de placar ----
  listMeusPalpites(partidaIds: string[]): Promise<Palpite[]>;
  /** Cria ou troca o palpite; recusa depois que a partida começou. */
  salvarPalpite(novo: NovoPalpite): Promise<Palpite>;
  resumoDosPalpites(partidaId: string): Promise<ResumoDePalpites>;

  // ---- Arquibancada: ranking de palpiteiros ----
  /** Meses que já têm jogo apurado (o mais recente primeiro) + a temporada. */
  periodosDoRanking(): Promise<PeriodoDoRanking[]>;
  /** Top N do período e a faixa em volta do usuário logado. */
  rankingDePalpites(periodo: string, limite?: number): Promise<RankingDePalpites>;
  /** Quem mais pontuou num jogo. */
  podioDaPartida(partidaId: string, limite?: number): Promise<PalpiteiroDaPartida[]>;
  /** Medalhas de pódio mensal de um perfil. */
  titulosDoUsuario(usuarioId: Id): Promise<Titulo[]>;

  // ---- Arquibancada: ligas privadas ----
  minhasLigas(periodo?: string): Promise<Liga[]>;
  criarLiga(nome: string): Promise<Liga>;
  entrarNaLiga(codigo: string): Promise<Liga>;
  sairDaLiga(ligaId: Id): Promise<void>;
  rankingDaLiga(ligaId: Id, periodo?: string): Promise<Palpiteiro[]>;

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
