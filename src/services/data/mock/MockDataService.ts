import { DURACAO_FOTO_SEGUNDOS, type Interesse, type Reacao } from '@/constants/interesses';
import {
  DURACAO_MAXIMA_RASANTE_SEGUNDOS,
  TAMANHO_MAXIMO_MENSAGEM,
  VALIDADE_RASANTE_HORAS,
} from '@/constants/rasantes';
import {
  gerarThumbnail,
  removerArquivoLocal,
  salvarArquivoLocalmente,
} from '@/services/midia/arquivos';
import type {
  Comentario,
  Conversa,
  Denuncia,
  GrupoDeRasantes,
  HashtagTrending,
  Id,
  Live,
  Mensagem,
  MensagemLive,
  Notificacao,
  NovoSeguidor,
  Pagina,
  Perfil,
  PermissaoDeConversa,
  PreferenciasDeMensagens,
  RankingTorcedor,
  Rasante,
  ResumoDeUsuario,
  Sessao,
  TipoDeNotificacao,
  TokenPush,
  Usuario,
  Video,
} from '@/types';
import { ErroDeAplicacao } from '@/utils/erros';
import { esperar } from '@/utils/espera';
import { normalizarHashtag } from '@/utils/hashtags';
import { agoraIso, novoId } from '@/utils/ids';
import { apelidoValido, emailValido, normalizarApelido, senhaValida } from '@/utils/validacao';

import type {
  AtualizacaoDePerfil,
  CancelarAssinatura,
  DadosDeCadastro,
  DataService,
  EventoDaLive,
  NovaDenuncia,
  NovoRasante,
  NovoVideo,
  ParametrosDoFeed,
  ProgressoDeUpload,
} from '../types';
import { ArmazenamentoMock, type BancoMock, type ConversaPersistida } from './banco';
import { RESPOSTAS_DE_DEMO, USUARIOS_SEED, gerarRasantesSeed } from './seed';
import { SimuladorDeLive } from './simuladorLive';

export interface OpcoesMock {
  armazenamento?: ArmazenamentoMock;
  /** atraso artificial (ms) para simular rede; 0 nos testes */
  latenciaMs?: number;
  /** bots no chat da live */
  botsNaLive?: boolean;
  /** perfis de demonstração respondem no chat privado (padrão: igual a botsNaLive) */
  respostasAutomaticas?: boolean;
  gerarId?: () => string;
}

const PREFERENCIAS_PADRAO: PreferenciasDeMensagens = { deQuemSigo: true, deSeguidores: true };

const ID_VISITANTE = 'u-visitante';
const LIMITE_PADRAO = 10;
const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Implementação 100% local do DataService: tudo em AsyncStorage + arquivos do dispositivo.
 * É o modo de demonstração — funciona sem cadastro em nenhum serviço.
 */
export class MockDataService implements DataService {
  readonly nome = 'mock' as const;
  private readonly armazenamento: ArmazenamentoMock;
  private readonly latenciaMs: number;
  private readonly gerarId: () => string;
  private readonly simulador: SimuladorDeLive;
  private readonly respostasAutomaticas: boolean;
  private readonly ouvintesDeConversa = new Map<string, Set<(m: Mensagem) => void>>();

  constructor(opcoes: OpcoesMock = {}) {
    this.armazenamento = opcoes.armazenamento ?? new ArmazenamentoMock();
    this.latenciaMs = opcoes.latenciaMs ?? 120;
    this.gerarId = opcoes.gerarId ?? novoId;
    this.simulador = new SimuladorDeLive(this.gerarId, opcoes.botsNaLive ?? true);
    this.respostasAutomaticas = opcoes.respostasAutomaticas ?? opcoes.botsNaLive ?? true;
  }

  // ---------------------------------------------------------------- utilitários internos

  private async banco(): Promise<BancoMock> {
    const b = await this.armazenamento.carregar();
    if (this.latenciaMs > 0) await esperar(this.latenciaMs);
    return b;
  }

  private persistir(): void {
    this.armazenamento.salvar();
  }

  private usuarioLogado(b: BancoMock): Usuario {
    const id = b.sessao?.usuarioId;
    const usuario = id ? b.usuarios.find((u) => u.id === id) : undefined;
    if (!usuario)
      throw new ErroDeAplicacao('Você precisa entrar para fazer isso.', 'nao_autenticado');
    return usuario;
  }

  private usuarioOuErro(b: BancoMock, id: Id): Usuario {
    const usuario = b.usuarios.find((u) => u.id === id);
    if (!usuario) throw new ErroDeAplicacao('Usuário não encontrado.', 'nao_encontrado');
    return usuario;
  }

  private videoOuErro(b: BancoMock, id: Id): Video {
    const video = b.videos.find((v) => v.id === id);
    if (!video) throw new ErroDeAplicacao('Vídeo não encontrado.', 'nao_encontrado');
    return video;
  }

  private resumo(u: Usuario): Video['autor'] {
    return { id: u.id, apelido: u.apelido, nome: u.nome, avatarUrl: u.avatarUrl };
  }

  private idsBloqueados(b: BancoMock, meuId: string | undefined): Set<string> {
    const ids = new Set<string>();
    if (!meuId) return ids;
    for (const bl of b.bloqueios) {
      if (bl.usuarioId === meuId) ids.add(bl.bloqueadoId);
      if (bl.bloqueadoId === meuId) ids.add(bl.usuarioId);
    }
    return ids;
  }

  /** Enriquecer o vídeo com a relação do usuário logado (curtido/salvo) e autor atualizado. */
  private decorarVideo(b: BancoMock, video: Video): Video {
    const meuId = b.sessao?.usuarioId;
    const autor = b.usuarios.find((u) => u.id === video.autorId);
    return {
      ...video,
      autor: autor ? this.resumo(autor) : video.autor,
      curtido: !!meuId && b.curtidas.some((c) => c.usuarioId === meuId && c.videoId === video.id),
      salvo: !!meuId && b.salvos.some((s) => s.usuarioId === meuId && s.videoId === video.id),
    };
  }

  private montarSessao(b: BancoMock): Sessao {
    const usuario = this.usuarioLogado(b);
    return {
      usuario: { ...usuario },
      visitante: !!b.sessao?.visitante,
      onboardingConcluido: !!b.sessao?.onboardingConcluido,
    };
  }

  private notificar(
    b: BancoMock,
    paraId: string,
    dados: Omit<Notificacao, 'id' | 'lida' | 'criadoEm'>,
  ): void {
    if (paraId === b.sessao?.usuarioId) return; // não notifica a si mesmo
    b.notificacoes.unshift({
      ...dados,
      id: this.gerarId(),
      lida: false,
      criadoEm: agoraIso(),
      paraId,
    });
  }

  private ordenarPorData<T extends { criadoEm: string }>(itens: T[]): T[] {
    return [...itens].sort((a, c) => c.criadoEm.localeCompare(a.criadoEm));
  }

  // ---------------------------------------------------------------- autenticação

  async entrar(email: string, senha: string): Promise<Sessao> {
    const b = await this.banco();
    const conta = b.contas.find((c) => c.email === email.trim().toLowerCase());
    if (!conta || conta.senha !== senha) {
      throw new ErroDeAplicacao('E-mail ou senha incorretos.', 'credenciais_invalidas');
    }
    const usuario = this.usuarioOuErro(b, conta.usuarioId);
    b.sessao = {
      usuarioId: usuario.id,
      visitante: false,
      onboardingConcluido: usuario.interesses.length > 0,
    };
    await this.armazenamento.salvarAgora(); // sessão: grava na hora
    return this.montarSessao(b);
  }

  async cadastrar(dados: DadosDeCadastro): Promise<Sessao> {
    const b = await this.banco();
    const email = dados.email.trim().toLowerCase();
    if (!emailValido(email))
      throw new ErroDeAplicacao('Informe um e-mail válido.', 'email_invalido');
    if (!senhaValida(dados.senha)) {
      throw new ErroDeAplicacao('A senha precisa ter pelo menos 6 caracteres.', 'senha_invalida');
    }
    if (b.contas.some((c) => c.email === email)) {
      throw new ErroDeAplicacao('Já existe uma conta com esse e-mail.', 'email_em_uso');
    }
    let apelido = normalizarApelido(dados.apelido ?? email.split('@')[0]);
    if (!apelidoValido(apelido)) apelido = `torcedor${Math.floor(Math.random() * 9000 + 1000)}`;
    while (b.usuarios.some((u) => u.apelido === apelido))
      apelido = `${apelido}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 20);

    const usuario: Usuario = {
      id: this.gerarId(),
      apelido,
      nome: dados.nome?.trim() || apelido,
      avatarUrl: null,
      bio: '',
      interesses: [],
      seguidores: 0,
      seguindo: 0,
      curtidasRecebidas: 0,
      totalVideos: 0,
      criadoEm: agoraIso(),
    };
    b.usuarios.push(usuario);
    b.contas.push({ email, senha: dados.senha, usuarioId: usuario.id });
    this.semearRelacoesDeDemo(b, usuario);
    b.sessao = { usuarioId: usuario.id, visitante: false, onboardingConcluido: false };
    await this.armazenamento.salvarAgora(); // sessão: grava na hora
    return this.montarSessao(b);
  }

  async entrarComoVisitante(): Promise<Sessao> {
    const b = await this.banco();
    let visitante = b.usuarios.find((u) => u.id === ID_VISITANTE);
    if (!visitante) {
      visitante = {
        id: ID_VISITANTE,
        apelido: 'visitante',
        nome: 'Torcedor Visitante',
        avatarUrl: null,
        bio: 'Explorando o Vulture no modo demonstração.',
        interesses: ['Torcida', 'Jogos', 'Memes'],
        seguidores: 0,
        seguindo: 0,
        curtidasRecebidas: 0,
        totalVideos: 0,
        criadoEm: agoraIso(),
      };
      b.usuarios.push(visitante);
      // o visitante já começa seguindo dois perfis para a aba "Seguindo" ter conteúdo
      for (const seguidoId of ['u-nacao', 'u-golaco']) {
        if (b.usuarios.some((u) => u.id === seguidoId)) {
          b.seguidores.push({ seguidorId: ID_VISITANTE, seguidoId, criadoEm: agoraIso() });
          const seguido = b.usuarios.find((u) => u.id === seguidoId)!;
          seguido.seguidores += 1;
          visitante.seguindo += 1;
        }
      }
      this.semearRelacoesDeDemo(b, visitante);
    }
    b.sessao = { usuarioId: visitante.id, visitante: true, onboardingConcluido: true };
    await this.armazenamento.salvarAgora(); // sessão: grava na hora
    return this.montarSessao(b);
  }

  async sair(): Promise<void> {
    const b = await this.banco();
    b.sessao = null;
    await this.armazenamento.salvarAgora();
  }

  async sessaoAtual(): Promise<Sessao | null> {
    const b = await this.armazenamento.carregar();
    if (!b.sessao) return null;
    try {
      return this.montarSessao(b);
    } catch {
      b.sessao = null;
      this.persistir();
      return null;
    }
  }

  async concluirOnboarding(dados: {
    apelido: string;
    interesses: Interesse[];
    avatarUriLocal?: string | null;
  }): Promise<Sessao> {
    const b = await this.banco();
    const usuario = this.usuarioLogado(b);
    const apelido = normalizarApelido(dados.apelido);
    if (!apelidoValido(apelido)) {
      throw new ErroDeAplicacao(
        'Apelido inválido: use 3 a 20 letras, números, ponto ou _.',
        'apelido_invalido',
      );
    }
    if (b.usuarios.some((u) => u.apelido === apelido && u.id !== usuario.id)) {
      throw new ErroDeAplicacao('Esse apelido já está em uso.', 'apelido_em_uso');
    }
    if (dados.interesses.length < 1) {
      throw new ErroDeAplicacao('Escolha pelo menos um interesse.', 'interesses_invalidos');
    }
    usuario.apelido = apelido;
    usuario.interesses = [...dados.interesses];
    if (dados.avatarUriLocal) {
      usuario.avatarUrl = await salvarArquivoLocalmente(
        dados.avatarUriLocal,
        'avatars',
        usuario.id,
        'jpg',
      );
    }
    if (b.sessao) b.sessao.onboardingConcluido = true;
    await this.armazenamento.salvarAgora(); // sessão: grava na hora
    return this.montarSessao(b);
  }

  // ---------------------------------------------------------------- feed e vídeos

  async listFeed(params: ParametrosDoFeed): Promise<Pagina<Video>> {
    const b = await this.banco();
    const meuId = b.sessao?.usuarioId;
    const bloqueados = this.idsBloqueados(b, meuId);
    const limite = params.limite ?? LIMITE_PADRAO;
    const inicio = params.cursor ? Number.parseInt(params.cursor, 10) || 0 : 0;

    let videos = b.videos.filter((v) => !bloqueados.has(v.autorId));
    if (params.aba === 'seguindo') {
      const seguidos = new Set(
        b.seguidores.filter((s) => s.seguidorId === meuId).map((s) => s.seguidoId),
      );
      videos = videos.filter((v) => seguidos.has(v.autorId));
    }
    if (params.hashtag) {
      const tag = normalizarHashtag(params.hashtag);
      videos = videos.filter((v) => v.hashtags.some((h) => normalizarHashtag(h) === tag));
    }
    if (params.categoria) videos = videos.filter((v) => v.categoria === params.categoria);

    const ordenados = this.ordenarPorData(videos);
    const pagina = ordenados.slice(inicio, inicio + limite).map((v) => this.decorarVideo(b, v));
    const fim = inicio + limite;
    return { itens: pagina, proximoCursor: fim < ordenados.length ? String(fim) : null };
  }

  async getVideo(id: Id): Promise<Video> {
    const b = await this.banco();
    return this.decorarVideo(b, this.videoOuErro(b, id));
  }

  async uploadVideo(novo: NovoVideo, aoProgredir?: ProgressoDeUpload): Promise<Video> {
    const b = await this.banco();
    const autor = this.usuarioLogado(b);
    const id = this.gerarId();
    const progresso = (fracao: number, etapa: string) => aoProgredir?.(Math.min(1, fracao), etapa);

    progresso(0.05, 'Preparando arquivo');
    const url = await salvarArquivoLocalmente(
      novo.uriLocal,
      novo.tipo === 'video' ? 'videos' : 'fotos',
      id,
      novo.tipo === 'video' ? 'mp4' : 'jpg',
    );
    progresso(0.45, 'Arquivo salvo no dispositivo');

    let thumbnailUrl: string | null = null;
    if (novo.tipo === 'foto') {
      thumbnailUrl = url;
    } else {
      const origemThumb = novo.thumbnailUriLocal ?? (await gerarThumbnail(url));
      if (origemThumb) {
        thumbnailUrl = await salvarArquivoLocalmente(origemThumb, 'thumbnails', id, 'jpg');
      }
    }
    progresso(0.8, 'Gerando miniatura');
    if (this.latenciaMs > 0) await esperar(this.latenciaMs * 2);

    const video: Video = {
      id,
      autorId: autor.id,
      autor: this.resumo(autor),
      tipo: novo.tipo,
      url,
      thumbnailUrl,
      legenda: novo.legenda.trim(),
      hashtags: novo.hashtags,
      categoria: novo.categoria,
      audio: novo.audio ?? `Som original - ${autor.apelido}`,
      duracao: novo.tipo === 'foto' ? DURACAO_FOTO_SEGUNDOS : Math.round(novo.duracao),
      largura: novo.largura ?? null,
      altura: novo.altura ?? null,
      curtidas: 0,
      comentarios: 0,
      salvos: 0,
      compartilhamentos: 0,
      visualizacoes: 0,
      criadoEm: agoraIso(),
      curtido: false,
      salvo: false,
    };
    b.videos.unshift(video);
    autor.totalVideos += 1;
    progresso(1, 'Publicado');
    this.persistir();
    return this.decorarVideo(b, video);
  }

  async excluirVideo(id: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const video = this.videoOuErro(b, id);
    if (video.autorId !== eu.id)
      throw new ErroDeAplicacao('Você só pode excluir seus vídeos.', 'sem_permissao');
    b.videos = b.videos.filter((v) => v.id !== id);
    b.curtidas = b.curtidas.filter((c) => c.videoId !== id);
    b.salvos = b.salvos.filter((s) => s.videoId !== id);
    b.comentarios = b.comentarios.filter((c) => c.videoId !== id);
    eu.totalVideos = Math.max(0, eu.totalVideos - 1);
    eu.curtidasRecebidas = Math.max(0, eu.curtidasRecebidas - video.curtidas);
    removerArquivoLocal(video.url);
    removerArquivoLocal(video.thumbnailUrl);
    this.persistir();
  }

  async registrarVisualizacao(id: Id): Promise<void> {
    const b = await this.armazenamento.carregar();
    const video = b.videos.find((v) => v.id === id);
    if (video) {
      video.visualizacoes += 1;
      this.persistir();
    }
  }

  async registrarCompartilhamento(id: Id): Promise<void> {
    const b = await this.armazenamento.carregar();
    const video = b.videos.find((v) => v.id === id);
    if (video) {
      video.compartilhamentos += 1;
      this.persistir();
    }
  }

  // ---------------------------------------------------------------- interações

  async like(videoId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const video = this.videoOuErro(b, videoId);
    if (b.curtidas.some((c) => c.usuarioId === eu.id && c.videoId === videoId)) return;
    b.curtidas.push({ usuarioId: eu.id, videoId, criadoEm: agoraIso() });
    video.curtidas += 1;
    const autor = b.usuarios.find((u) => u.id === video.autorId);
    if (autor) autor.curtidasRecebidas += 1;
    this.notificar(b, video.autorId, {
      tipo: 'curtida',
      deId: eu.id,
      de: { id: eu.id, apelido: eu.apelido, avatarUrl: eu.avatarUrl },
      videoId,
      liveId: null,
      texto: 'curtiu seu vídeo',
    });
    this.persistir();
  }

  async unlike(videoId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const video = this.videoOuErro(b, videoId);
    const antes = b.curtidas.length;
    b.curtidas = b.curtidas.filter((c) => !(c.usuarioId === eu.id && c.videoId === videoId));
    if (b.curtidas.length === antes) return;
    video.curtidas = Math.max(0, video.curtidas - 1);
    const autor = b.usuarios.find((u) => u.id === video.autorId);
    if (autor) autor.curtidasRecebidas = Math.max(0, autor.curtidasRecebidas - 1);
    this.persistir();
  }

  async salvar(videoId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const video = this.videoOuErro(b, videoId);
    if (b.salvos.some((s) => s.usuarioId === eu.id && s.videoId === videoId)) return;
    b.salvos.push({ usuarioId: eu.id, videoId, criadoEm: agoraIso() });
    video.salvos += 1;
    this.persistir();
  }

  async removerSalvo(videoId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const video = this.videoOuErro(b, videoId);
    const antes = b.salvos.length;
    b.salvos = b.salvos.filter((s) => !(s.usuarioId === eu.id && s.videoId === videoId));
    if (b.salvos.length === antes) return;
    video.salvos = Math.max(0, video.salvos - 1);
    this.persistir();
  }

  async listComments(videoId: Id): Promise<Comentario[]> {
    const b = await this.banco();
    const bloqueados = this.idsBloqueados(b, b.sessao?.usuarioId);
    const todos = b.comentarios.filter((c) => c.videoId === videoId && !bloqueados.has(c.autorId));
    const raizes = this.ordenarPorData(todos.filter((c) => !c.paiId));
    return raizes.map((raiz) => ({
      ...raiz,
      respostas: todos
        .filter((c) => c.paiId === raiz.id)
        .sort((a, c) => a.criadoEm.localeCompare(c.criadoEm)),
    }));
  }

  async addComment(videoId: Id, texto: string, paiId: Id | null = null): Promise<Comentario> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const video = this.videoOuErro(b, videoId);
    const limpo = texto.trim();
    if (!limpo) throw new ErroDeAplicacao('Escreva um comentário.', 'comentario_vazio');
    let paiValido: Id | null = null;
    if (paiId) {
      const pai = b.comentarios.find((c) => c.id === paiId && c.videoId === videoId);
      if (!pai) throw new ErroDeAplicacao('Comentário respondido não existe.', 'nao_encontrado');
      // respostas têm apenas 1 nível: responder uma resposta cai no comentário raiz
      paiValido = pai.paiId ?? pai.id;
    }
    const comentario: Comentario = {
      id: this.gerarId(),
      videoId,
      autorId: eu.id,
      autor: this.resumo(eu),
      texto: limpo,
      paiId: paiValido,
      curtidas: 0,
      criadoEm: agoraIso(),
      respostas: [],
    };
    b.comentarios.push(comentario);
    video.comentarios += 1;
    this.notificar(b, video.autorId, {
      tipo: 'comentario',
      deId: eu.id,
      de: { id: eu.id, apelido: eu.apelido, avatarUrl: eu.avatarUrl },
      videoId,
      liveId: null,
      texto: `comentou: "${limpo.slice(0, 60)}"`,
    });
    this.persistir();
    return comentario;
  }

  async excluirComentario(comentarioId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const comentario = b.comentarios.find((c) => c.id === comentarioId);
    if (!comentario) return;
    if (comentario.autorId !== eu.id)
      throw new ErroDeAplicacao('Você só pode excluir seus comentários.', 'sem_permissao');
    const removidos = b.comentarios.filter(
      (c) => c.id === comentarioId || c.paiId === comentarioId,
    );
    b.comentarios = b.comentarios.filter((c) => !removidos.includes(c));
    const video = b.videos.find((v) => v.id === comentario.videoId);
    if (video) video.comentarios = Math.max(0, video.comentarios - removidos.length);
    this.persistir();
  }

  async follow(usuarioId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    if (usuarioId === eu.id)
      throw new ErroDeAplicacao('Você não pode seguir a si mesmo.', 'invalido');
    const alvo = this.usuarioOuErro(b, usuarioId);
    if (b.seguidores.some((s) => s.seguidorId === eu.id && s.seguidoId === usuarioId)) return;
    b.seguidores.push({ seguidorId: eu.id, seguidoId: usuarioId, criadoEm: agoraIso() });
    alvo.seguidores += 1;
    eu.seguindo += 1;
    this.notificar(b, usuarioId, {
      tipo: 'seguiu',
      deId: eu.id,
      de: { id: eu.id, apelido: eu.apelido, avatarUrl: eu.avatarUrl },
      videoId: null,
      liveId: null,
      texto: 'começou a seguir você',
    });
    this.persistir();
  }

  async unfollow(usuarioId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const alvo = this.usuarioOuErro(b, usuarioId);
    const antes = b.seguidores.length;
    b.seguidores = b.seguidores.filter(
      (s) => !(s.seguidorId === eu.id && s.seguidoId === usuarioId),
    );
    if (b.seguidores.length === antes) return;
    alvo.seguidores = Math.max(0, alvo.seguidores - 1);
    eu.seguindo = Math.max(0, eu.seguindo - 1);
    this.persistir();
  }

  // ---------------------------------------------------------------- perfil

  async getProfile(usuarioId: Id | 'eu'): Promise<Perfil> {
    const b = await this.banco();
    const meuId = b.sessao?.usuarioId;
    const alvoId = usuarioId === 'eu' ? meuId : usuarioId;
    if (!alvoId)
      throw new ErroDeAplicacao('Você precisa entrar para ver o perfil.', 'nao_autenticado');
    const usuario = this.usuarioOuErro(b, alvoId);
    return {
      ...usuario,
      souEu: usuario.id === meuId,
      estouSeguindo:
        !!meuId && b.seguidores.some((s) => s.seguidorId === meuId && s.seguidoId === usuario.id),
      bloqueado:
        !!meuId &&
        b.bloqueios.some((bl) => bl.usuarioId === meuId && bl.bloqueadoId === usuario.id),
    };
  }

  async updateProfile(dados: AtualizacaoDePerfil): Promise<Usuario> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    if (dados.apelido !== undefined) {
      const apelido = normalizarApelido(dados.apelido);
      if (!apelidoValido(apelido))
        throw new ErroDeAplicacao('Apelido inválido.', 'apelido_invalido');
      if (b.usuarios.some((u) => u.apelido === apelido && u.id !== eu.id)) {
        throw new ErroDeAplicacao('Esse apelido já está em uso.', 'apelido_em_uso');
      }
      eu.apelido = apelido;
    }
    if (dados.nome !== undefined) eu.nome = dados.nome.trim() || eu.apelido;
    if (dados.bio !== undefined) eu.bio = dados.bio.trim().slice(0, 160);
    if (dados.interesses !== undefined) eu.interesses = [...dados.interesses];
    if (dados.avatarUriLocal) {
      eu.avatarUrl = await salvarArquivoLocalmente(
        dados.avatarUriLocal,
        'avatars',
        `${eu.id}-${Date.now()}`,
        'jpg',
      );
    } else if (dados.avatarUriLocal === null) {
      eu.avatarUrl = null;
    }
    // propaga o autor atualizado para vídeos e comentários
    for (const v of b.videos) if (v.autorId === eu.id) v.autor = this.resumo(eu);
    for (const c of b.comentarios) if (c.autorId === eu.id) c.autor = this.resumo(eu);
    this.persistir();
    return { ...eu };
  }

  async listVideosDoUsuario(usuarioId: Id): Promise<Video[]> {
    const b = await this.banco();
    return this.ordenarPorData(b.videos.filter((v) => v.autorId === usuarioId)).map((v) =>
      this.decorarVideo(b, v),
    );
  }

  async listVideosCurtidos(usuarioId: Id): Promise<Video[]> {
    const b = await this.banco();
    const ids = this.ordenarPorData(b.curtidas.filter((c) => c.usuarioId === usuarioId)).map(
      (c) => c.videoId,
    );
    return ids
      .map((id) => b.videos.find((v) => v.id === id))
      .filter((v): v is Video => !!v)
      .map((v) => this.decorarVideo(b, v));
  }

  async listVideosSalvos(): Promise<Video[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const ids = this.ordenarPorData(b.salvos.filter((s) => s.usuarioId === eu.id)).map(
      (s) => s.videoId,
    );
    return ids
      .map((id) => b.videos.find((v) => v.id === id))
      .filter((v): v is Video => !!v)
      .map((v) => this.decorarVideo(b, v));
  }

  async listSeguidores(usuarioId: Id): Promise<Usuario[]> {
    const b = await this.banco();
    const ids = b.seguidores.filter((s) => s.seguidoId === usuarioId).map((s) => s.seguidorId);
    return b.usuarios.filter((u) => ids.includes(u.id));
  }

  async listSeguindo(usuarioId: Id): Promise<Usuario[]> {
    const b = await this.banco();
    const ids = b.seguidores.filter((s) => s.seguidorId === usuarioId).map((s) => s.seguidoId);
    return b.usuarios.filter((u) => ids.includes(u.id));
  }

  // ---------------------------------------------------------------- explorar

  async buscarUsuarios(termo: string): Promise<Usuario[]> {
    const b = await this.banco();
    const t = termo.trim().toLowerCase().replace(/^@/, '');
    if (!t) return [];
    const bloqueados = this.idsBloqueados(b, b.sessao?.usuarioId);
    return b.usuarios
      .filter((u) => !bloqueados.has(u.id))
      .filter((u) => u.apelido.toLowerCase().includes(t) || u.nome.toLowerCase().includes(t))
      .slice(0, 20);
  }

  private contarHashtags(videos: Video[]): HashtagTrending[] {
    const mapa = new Map<string, HashtagTrending>();
    for (const v of videos) {
      for (const h of v.hashtags) {
        const chave = normalizarHashtag(h);
        const atual = mapa.get(chave);
        if (atual) atual.totalVideos += 1;
        else mapa.set(chave, { tag: h, totalVideos: 1 });
      }
    }
    return [...mapa.values()].sort((a, c) => c.totalVideos - a.totalVideos);
  }

  async buscarHashtags(termo: string): Promise<HashtagTrending[]> {
    const b = await this.banco();
    const t = normalizarHashtag(termo);
    if (!t) return [];
    return this.contarHashtags(b.videos)
      .filter((h) => normalizarHashtag(h.tag).includes(t))
      .slice(0, 20);
  }

  async listTrending(): Promise<Video[]> {
    const b = await this.banco();
    const limite = Date.now() - SEMANA_MS;
    const bloqueados = this.idsBloqueados(b, b.sessao?.usuarioId);
    const recentes = b.videos.filter(
      (v) => !bloqueados.has(v.autorId) && new Date(v.criadoEm).getTime() >= limite,
    );
    const base =
      recentes.length >= 12 ? recentes : b.videos.filter((v) => !bloqueados.has(v.autorId));
    return [...base]
      .sort((a, c) => c.curtidas + c.visualizacoes / 10 - (a.curtidas + a.visualizacoes / 10))
      .slice(0, 30)
      .map((v) => this.decorarVideo(b, v));
  }

  async listHashtagsEmAlta(): Promise<HashtagTrending[]> {
    const b = await this.banco();
    return this.contarHashtags(b.videos).slice(0, 12);
  }

  async rankingSemanal(): Promise<RankingTorcedor[]> {
    const b = await this.banco();
    const limite = Date.now() - SEMANA_MS;
    const porAutor = new Map<string, { curtidas: number; videos: number }>();
    for (const v of b.videos) {
      if (new Date(v.criadoEm).getTime() < limite) continue;
      const atual = porAutor.get(v.autorId) ?? { curtidas: 0, videos: 0 };
      atual.curtidas += v.curtidas;
      atual.videos += 1;
      porAutor.set(v.autorId, atual);
    }
    return [...porAutor.entries()]
      .map(([autorId, dados]) => ({ autorId, ...dados }))
      .sort((a, c) => c.curtidas - a.curtidas)
      .slice(0, 10)
      .map((item, i) => {
        const u = b.usuarios.find((x) => x.id === item.autorId);
        return {
          posicao: i + 1,
          usuario: u
            ? this.resumo(u)
            : { id: item.autorId, apelido: '?', nome: '?', avatarUrl: null },
          curtidasNaSemana: item.curtidas,
          videosNaSemana: item.videos,
        };
      });
  }

  // ---------------------------------------------------------------- lives

  async listLives(): Promise<Live[]> {
    const b = await this.banco();
    return b.lives
      .filter((l) => l.ativa)
      .map((l) => ({ ...l, espectadores: this.simulador.espectadores(l.id) ?? l.espectadores }))
      .sort((a, c) => c.espectadores - a.espectadores);
  }

  async getLive(id: Id): Promise<Live> {
    const b = await this.banco();
    const live = b.lives.find((l) => l.id === id);
    if (!live) throw new ErroDeAplicacao('Live não encontrada.', 'nao_encontrado');
    return { ...live, espectadores: this.simulador.espectadores(live.id) ?? live.espectadores };
  }

  async createLive(titulo: string): Promise<Live> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const limpo = titulo.trim();
    if (!limpo) throw new ErroDeAplicacao('Dê um título para a live.', 'titulo_vazio');
    // encerra qualquer live anterior do mesmo usuário
    for (const l of b.lives) if (l.anfitriaoId === eu.id && l.ativa) l.ativa = false;
    const live: Live = {
      id: this.gerarId(),
      anfitriaoId: eu.id,
      anfitriao: this.resumo(eu),
      titulo: limpo,
      thumbnailUrl: null,
      sala: `vulture-${this.gerarId()}`,
      espectadores: 1,
      ativa: true,
      iniciadaEm: agoraIso(),
      encerradaEm: null,
    };
    b.lives.unshift(live);
    // avisa quem segue o anfitrião (aparece na lista de notificações; o push é enviado pelo app)
    for (const s of b.seguidores) {
      if (s.seguidoId !== eu.id) continue;
      this.notificar(b, s.seguidorId, {
        tipo: 'live',
        deId: eu.id,
        de: { id: eu.id, apelido: eu.apelido, avatarUrl: eu.avatarUrl },
        videoId: null,
        liveId: live.id,
        texto: `está ao vivo: ${limpo}`,
      });
    }
    this.persistir();
    return live;
  }

  async encerrarLive(id: Id): Promise<void> {
    const b = await this.banco();
    const live = b.lives.find((l) => l.id === id);
    if (!live) return;
    live.ativa = false;
    live.encerradaEm = agoraIso();
    this.simulador.encerrar(id);
    this.persistir();
  }

  async entrarNaLive(id: Id): Promise<void> {
    const b = await this.armazenamento.carregar();
    const live = b.lives.find((l) => l.id === id);
    if (live) {
      live.espectadores += 1;
      this.persistir();
    }
  }

  async sairDaLive(id: Id): Promise<void> {
    const b = await this.armazenamento.carregar();
    const live = b.lives.find((l) => l.id === id);
    if (live) {
      live.espectadores = Math.max(0, live.espectadores - 1);
      this.persistir();
    }
  }

  async listMensagensDaLive(liveId: Id): Promise<MensagemLive[]> {
    const b = await this.banco();
    return b.mensagensLive
      .filter((m) => m.liveId === liveId)
      .sort((a, c) => a.criadoEm.localeCompare(c.criadoEm))
      .slice(-100);
  }

  private async criarMensagem(
    liveId: Id,
    texto: string,
    reacao: Reacao | null,
  ): Promise<MensagemLive> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const live = b.lives.find((l) => l.id === liveId);
    if (!live || !live.ativa)
      throw new ErroDeAplicacao('Essa live já foi encerrada.', 'live_encerrada');
    const mensagem: MensagemLive = {
      id: this.gerarId(),
      liveId,
      autorId: eu.id,
      autor: { id: eu.id, apelido: eu.apelido, avatarUrl: eu.avatarUrl },
      tipo: reacao ? 'reacao' : 'texto',
      texto: reacao ?? texto.trim(),
      reacao,
      criadoEm: agoraIso(),
    };
    b.mensagensLive.push(mensagem);
    if (b.mensagensLive.length > 2000) b.mensagensLive.splice(0, b.mensagensLive.length - 2000);
    this.persistir();
    this.simulador.emitir(liveId, { tipo: reacao ? 'reacao' : 'mensagem', mensagem });
    return mensagem;
  }

  async enviarMensagemNaLive(liveId: Id, texto: string): Promise<MensagemLive> {
    if (!texto.trim()) throw new ErroDeAplicacao('Escreva uma mensagem.', 'mensagem_vazia');
    return this.criarMensagem(liveId, texto, null);
  }

  async enviarReacaoNaLive(liveId: Id, reacao: Reacao): Promise<MensagemLive> {
    return this.criarMensagem(liveId, reacao, reacao);
  }

  assinarLive(liveId: Id, aoReceber: (evento: EventoDaLive) => void): CancelarAssinatura {
    let cancelado = false;
    let cancelar: CancelarAssinatura = () => {};
    this.armazenamento.carregar().then((b) => {
      if (cancelado) return;
      const live = b.lives.find((l) => l.id === liveId);
      cancelar = this.simulador.assinar(liveId, aoReceber, live?.espectadores ?? 1, (m) => {
        b.mensagensLive.push(m);
        this.persistir();
      });
    });
    return () => {
      cancelado = true;
      cancelar();
    };
  }

  // ---------------------------------------------------------------- notificações

  async listNotificacoes(): Promise<Notificacao[]> {
    const b = await this.banco();
    const meuId = b.sessao?.usuarioId;
    if (!meuId) return [];
    return this.ordenarPorData(
      b.notificacoes.filter((n) => n.paraId === meuId || n.paraId === '*'),
    ).map(({ paraId: _paraId, ...n }) => n);
  }

  async registrarTokenPush(token: TokenPush): Promise<void> {
    const b = await this.armazenamento.carregar();
    const eu = this.usuarioLogado(b);
    // um token pertence a um único aparelho: troca de dono se outro usuário logar nele
    b.tokensPush = (b.tokensPush ?? []).filter((t) => t.token !== token.token);
    b.tokensPush.push({ usuarioId: eu.id, token: token.token, plataforma: token.plataforma });
    this.persistir();
  }

  async removerTokenPush(token: string): Promise<void> {
    const b = await this.armazenamento.carregar();
    b.tokensPush = (b.tokensPush ?? []).filter((t) => t.token !== token);
    this.persistir();
  }

  /** Tokens de push dos seguidores de um usuário (usado pelo envio local no modo demo). */
  async tokensDosSeguidores(usuarioId: Id): Promise<TokenPush[]> {
    const b = await this.armazenamento.carregar();
    const seguidores = new Set(
      b.seguidores.filter((s) => s.seguidoId === usuarioId).map((s) => s.seguidorId),
    );
    return (b.tokensPush ?? [])
      .filter((t) => seguidores.has(t.usuarioId))
      .map((t) => ({ token: t.token, plataforma: t.plataforma as TokenPush['plataforma'] }));
  }

  async marcarNotificacoesComoLidas(tipos?: TipoDeNotificacao[]): Promise<void> {
    const b = await this.banco();
    const meuId = b.sessao?.usuarioId;
    for (const n of b.notificacoes) {
      if (n.paraId !== meuId && n.paraId !== '*') continue;
      if (tipos && !tipos.includes(n.tipo)) continue;
      n.lida = true;
    }
    this.persistir();
  }

  // ---------------------------------------------------------------- segurança

  async report(denuncia: NovaDenuncia): Promise<Denuncia> {
    const b = await this.banco();
    this.usuarioLogado(b);
    const registro: Denuncia = {
      id: this.gerarId(),
      tipoAlvo: denuncia.tipoAlvo,
      alvoId: denuncia.alvoId,
      motivo: denuncia.motivo,
      detalhes: denuncia.detalhes?.trim() ?? '',
      criadoEm: agoraIso(),
    };
    b.denuncias.push(registro);
    this.persistir();
    return registro;
  }

  async bloquear(usuarioId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    if (usuarioId === eu.id) return;
    this.usuarioOuErro(b, usuarioId);
    if (!b.bloqueios.some((bl) => bl.usuarioId === eu.id && bl.bloqueadoId === usuarioId)) {
      b.bloqueios.push({ usuarioId: eu.id, bloqueadoId: usuarioId });
    }
    // bloquear também desfaz o "seguir" nos dois sentidos
    b.seguidores = b.seguidores.filter(
      (s) =>
        !(s.seguidorId === eu.id && s.seguidoId === usuarioId) &&
        !(s.seguidorId === usuarioId && s.seguidoId === eu.id),
    );
    this.persistir();
  }

  async desbloquear(usuarioId: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    b.bloqueios = b.bloqueios.filter(
      (bl) => !(bl.usuarioId === eu.id && bl.bloqueadoId === usuarioId),
    );
    this.persistir();
  }

  async listBloqueados(): Promise<Usuario[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const ids = b.bloqueios.filter((bl) => bl.usuarioId === eu.id).map((bl) => bl.bloqueadoId);
    return b.usuarios.filter((u) => ids.includes(u.id));
  }

  // ---------------------------------------------------------------- demonstração: relações iniciais

  /**
   * Toda conta nova no modo demo já chega com alguns torcedores seguindo (com datas variadas,
   * para a tela "Novos seguidores" mostrar dias e datas) e uma mensagem de boas-vindas.
   */
  private semearRelacoesDeDemo(b: BancoMock, usuario: Usuario): void {
    const HORA = 60 * 60 * 1000;
    const plano: { id: string; horasAtras: number }[] = [
      { id: 'u-nacao', horasAtras: 0.2 },
      { id: 'u-maraca', horasAtras: 2 },
      { id: 'u-memes', horasAtras: 3 * 24 },
      { id: 'u-resenha', horasAtras: 20 * 24 },
    ];
    for (const p of plano) {
      const seguidor = b.usuarios.find((u) => u.id === p.id);
      if (!seguidor || seguidor.id === usuario.id) continue;
      if (b.seguidores.some((s) => s.seguidorId === p.id && s.seguidoId === usuario.id)) continue;
      const quando = new Date(Date.now() - p.horasAtras * HORA).toISOString();
      b.seguidores.push({ seguidorId: p.id, seguidoId: usuario.id, criadoEm: quando });
      seguidor.seguindo += 1;
      usuario.seguidores += 1;
      b.notificacoes.unshift({
        id: this.gerarId(),
        tipo: 'seguiu',
        deId: seguidor.id,
        de: { id: seguidor.id, apelido: seguidor.apelido, avatarUrl: seguidor.avatarUrl },
        videoId: null,
        liveId: null,
        texto: 'começou a seguir você',
        lida: false,
        criadoEm: quando,
        paraId: usuario.id,
      });
    }
    const anfitria = b.usuarios.find((u) => u.id === 'u-nacao');
    if (anfitria && anfitria.id !== usuario.id) {
      const conversa = this.conversaEntre(b, anfitria.id, usuario.id, true)!;
      const quando = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      b.mensagens.push({
        id: this.gerarId(),
        conversaId: conversa.id,
        remetenteId: anfitria.id,
        texto: `Fala, @${usuario.apelido}! Bem-vindo ao Vulture 🔴⚫ Qualquer dúvida é só chamar aqui.`,
        lida: false,
        criadoEm: quando,
      });
      conversa.atualizadoEm = quando;
    }
  }

  // ---------------------------------------------------------------- mensagens diretas

  private preferenciasDe(b: BancoMock, usuarioId: string): PreferenciasDeMensagens {
    return { ...PREFERENCIAS_PADRAO, ...(b.preferenciasMensagens[usuarioId] ?? {}) };
  }

  private resumoDe(b: BancoMock, id: string): ResumoDeUsuario {
    const u = b.usuarios.find((x) => x.id === id);
    return u ? this.resumo(u) : { id, apelido: 'torcedor', nome: 'Torcedor', avatarUrl: null };
  }

  private conversaEntre(
    b: BancoMock,
    a: string,
    c: string,
    criar = false,
  ): ConversaPersistida | null {
    const existente = b.conversas.find(
      (x) => x.participantes.includes(a) && x.participantes.includes(c),
    );
    if (existente || !criar) return existente ?? null;
    const nova: ConversaPersistida = {
      id: this.gerarId(),
      participantes: [a, c],
      criadoEm: agoraIso(),
      atualizadoEm: agoraIso(),
    };
    b.conversas.push(nova);
    return nova;
  }

  private conversaOuErro(b: BancoMock, conversaId: string, meuId: string): ConversaPersistida {
    const c = b.conversas.find((x) => x.id === conversaId);
    if (!c || !c.participantes.includes(meuId))
      throw new ErroDeAplicacao('Conversa não encontrada.', 'nao_encontrado');
    return c;
  }

  private montarConversa(b: BancoMock, c: ConversaPersistida, meuId: string): Conversa {
    const outroId = c.participantes.find((p) => p !== meuId) ?? meuId;
    const mensagens = b.mensagens.filter((m) => m.conversaId === c.id);
    const ultima = mensagens.reduce<Mensagem | null>(
      (maior, m) => (!maior || m.criadoEm >= maior.criadoEm ? m : maior),
      null,
    );
    return {
      id: c.id,
      outro: this.resumoDe(b, outroId),
      ultimaMensagem: ultima
        ? { texto: ultima.texto, remetenteId: ultima.remetenteId, criadoEm: ultima.criadoEm }
        : null,
      naoLidas: mensagens.filter((m) => m.remetenteId !== meuId && !m.lida).length,
      atualizadoEm: c.atualizadoEm,
    };
  }

  /** Regra de quem pode falar com quem: bloqueios + preferências de quem RECEBE. */
  private permissaoDeConversa(b: BancoMock, meuId: string, outroId: string): PermissaoDeConversa {
    if (outroId === meuId) {
      return {
        permitido: false,
        motivo: 'eu_mesmo',
        descricao: 'Você não pode conversar consigo mesmo.',
      };
    }
    const outro = b.usuarios.find((u) => u.id === outroId);
    if (!outro || this.idsBloqueados(b, meuId).has(outroId)) {
      return {
        permitido: false,
        motivo: 'bloqueado',
        descricao: 'Não é possível conversar com esse perfil.',
      };
    }
    const prefs = this.preferenciasDe(b, outroId);
    const outroMeSegue = b.seguidores.some(
      (s) => s.seguidorId === outroId && s.seguidoId === meuId,
    );
    const euSigoOutro = b.seguidores.some((s) => s.seguidorId === meuId && s.seguidoId === outroId);
    if ((outroMeSegue && prefs.deQuemSigo) || (euSigoOutro && prefs.deSeguidores)) {
      return { permitido: true };
    }
    if (outroMeSegue || euSigoOutro) {
      return {
        permitido: false,
        motivo: 'nao_aceita',
        descricao: `@${outro.apelido} não está recebendo mensagens no momento.`,
      };
    }
    return {
      permitido: false,
      motivo: 'sem_relacao',
      descricao: `Siga @${outro.apelido} ou espere que te siga para puxar papo.`,
    };
  }

  private emitirMensagem(mensagem: Mensagem): void {
    for (const ouvinte of this.ouvintesDeConversa.get(mensagem.conversaId) ?? []) ouvinte(mensagem);
  }

  /** Perfis de demonstração (do seed) respondem sozinhos, para o chat parecer vivo. */
  private agendarRespostaDeDemo(conversaId: string, deId: string): void {
    if (!this.respostasAutomaticas) return;
    if (!USUARIOS_SEED.some((u) => u.id === deId)) return;
    const atraso = 1200 + Math.floor(Math.random() * 1800);
    setTimeout(async () => {
      try {
        const b = await this.armazenamento.carregar();
        const conversa = b.conversas.find((c) => c.id === conversaId);
        if (!conversa) return;
        const resposta: Mensagem = {
          id: this.gerarId(),
          conversaId,
          remetenteId: deId,
          texto: RESPOSTAS_DE_DEMO[Math.floor(Math.random() * RESPOSTAS_DE_DEMO.length)],
          lida: false,
          criadoEm: agoraIso(),
        };
        b.mensagens.push(resposta);
        conversa.atualizadoEm = resposta.criadoEm;
        this.persistir();
        this.emitirMensagem(resposta);
      } catch {
        // demo: resposta perdida não é problema
      }
    }, atraso);
  }

  async listConversas(): Promise<Conversa[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const bloqueados = this.idsBloqueados(b, eu.id);
    return b.conversas
      .filter((c) => c.participantes.includes(eu.id))
      .filter((c) => !c.participantes.some((p) => bloqueados.has(p)))
      .map((c) => this.montarConversa(b, c, eu.id))
      .sort((a, c) => c.atualizadoEm.localeCompare(a.atualizadoEm));
  }

  async getConversa(conversaId: Id): Promise<Conversa> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    return this.montarConversa(b, this.conversaOuErro(b, conversaId, eu.id), eu.id);
  }

  async podeConversar(usuarioId: Id): Promise<PermissaoDeConversa> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    return this.permissaoDeConversa(b, eu.id, usuarioId);
  }

  async abrirConversa(usuarioId: Id): Promise<Conversa> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const existente = this.conversaEntre(b, eu.id, usuarioId);
    if (!existente) {
      const permissao = this.permissaoDeConversa(b, eu.id, usuarioId);
      if (!permissao.permitido) throw new ErroDeAplicacao(permissao.descricao, 'conversa_negada');
    }
    const conversa = existente ?? this.conversaEntre(b, eu.id, usuarioId, true)!;
    this.persistir();
    return this.montarConversa(b, conversa, eu.id);
  }

  async listMensagens(conversaId: Id): Promise<Mensagem[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    this.conversaOuErro(b, conversaId, eu.id);
    return b.mensagens
      .filter((m) => m.conversaId === conversaId)
      .sort((a, c) => a.criadoEm.localeCompare(c.criadoEm))
      .slice(-300);
  }

  async enviarMensagem(conversaId: Id, texto: string): Promise<Mensagem> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const conversa = this.conversaOuErro(b, conversaId, eu.id);
    const limpo = texto.trim();
    if (!limpo) throw new ErroDeAplicacao('Escreva uma mensagem.', 'mensagem_vazia');
    if (limpo.length > TAMANHO_MAXIMO_MENSAGEM)
      throw new ErroDeAplicacao('Mensagem longa demais.', 'mensagem_longa');
    const outroId = conversa.participantes.find((p) => p !== eu.id) ?? eu.id;
    const permissao = this.permissaoDeConversa(b, eu.id, outroId);
    if (!permissao.permitido) throw new ErroDeAplicacao(permissao.descricao, 'conversa_negada');
    const mensagem: Mensagem = {
      id: this.gerarId(),
      conversaId,
      remetenteId: eu.id,
      texto: limpo,
      lida: false,
      criadoEm: agoraIso(),
    };
    b.mensagens.push(mensagem);
    conversa.atualizadoEm = mensagem.criadoEm;
    this.persistir();
    this.emitirMensagem(mensagem);
    this.agendarRespostaDeDemo(conversaId, outroId);
    return mensagem;
  }

  async marcarConversaComoLida(conversaId: Id): Promise<void> {
    const b = await this.armazenamento.carregar();
    const meuId = b.sessao?.usuarioId;
    if (!meuId) return;
    let mudou = false;
    for (const m of b.mensagens) {
      if (m.conversaId === conversaId && m.remetenteId !== meuId && !m.lida) {
        m.lida = true;
        mudou = true;
      }
    }
    if (mudou) this.persistir();
  }

  assinarConversa(conversaId: Id, aoReceber: (mensagem: Mensagem) => void): CancelarAssinatura {
    let ouvintes = this.ouvintesDeConversa.get(conversaId);
    if (!ouvintes) {
      ouvintes = new Set();
      this.ouvintesDeConversa.set(conversaId, ouvintes);
    }
    ouvintes.add(aoReceber);
    return () => {
      ouvintes.delete(aoReceber);
      if (ouvintes.size === 0) this.ouvintesDeConversa.delete(conversaId);
    };
  }

  async listContatos(): Promise<Usuario[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const bloqueados = this.idsBloqueados(b, eu.id);
    const ids = new Set<string>();
    for (const s of b.seguidores) {
      if (s.seguidorId === eu.id) ids.add(s.seguidoId);
      if (s.seguidoId === eu.id) ids.add(s.seguidorId);
    }
    return b.usuarios
      .filter((u) => ids.has(u.id) && !bloqueados.has(u.id))
      .sort((a, c) => a.apelido.localeCompare(c.apelido));
  }

  async obterPreferenciasDeMensagens(): Promise<PreferenciasDeMensagens> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    return this.preferenciasDe(b, eu.id);
  }

  async atualizarPreferenciasDeMensagens(
    dados: Partial<PreferenciasDeMensagens>,
  ): Promise<PreferenciasDeMensagens> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const novas = { ...this.preferenciasDe(b, eu.id), ...dados };
    b.preferenciasMensagens[eu.id] = novas;
    this.persistir();
    return novas;
  }

  // ---------------------------------------------------------------- seguidores e sugestões

  async listNovosSeguidores(): Promise<NovoSeguidor[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const bloqueados = this.idsBloqueados(b, eu.id);
    const sigo = new Set(
      b.seguidores.filter((s) => s.seguidorId === eu.id).map((s) => s.seguidoId),
    );
    return this.ordenarPorData(
      b.seguidores.filter((s) => s.seguidoId === eu.id && !bloqueados.has(s.seguidorId)),
    ).map((s) => ({
      usuario: this.resumoDe(b, s.seguidorId),
      seguiuEm: s.criadoEm,
      sigoDeVolta: sigo.has(s.seguidorId),
    }));
  }

  async sugerirTorcedores(): Promise<Usuario[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const bloqueados = this.idsBloqueados(b, eu.id);
    const sigo = new Set(
      b.seguidores.filter((s) => s.seguidorId === eu.id).map((s) => s.seguidoId),
    );
    const meusInteresses = new Set<string>(eu.interesses);
    const pontuacao = (u: Usuario) =>
      u.interesses.filter((i) => meusInteresses.has(i)).length * 1000 + u.seguidores;
    return b.usuarios
      .filter(
        (u) => u.id !== eu.id && u.id !== ID_VISITANTE && !sigo.has(u.id) && !bloqueados.has(u.id),
      )
      .sort((a, c) => pontuacao(c) - pontuacao(a))
      .slice(0, 20);
  }

  // ---------------------------------------------------------------- rasantes

  /** Os rasantes do seed somem em 24 h; quando todos expiram, renasce um lote novo (só na demo). */
  private renovarRasantesDeDemo(b: BancoMock): void {
    const agora = Date.now();
    const doSeed = b.rasantes.filter((r) => r.id.startsWith('r-seed-'));
    if (doSeed.some((r) => new Date(r.expiraEm).getTime() > agora)) return;
    b.rasantes = b.rasantes.filter((r) => !r.id.startsWith('r-seed-'));
    b.rasantesVistos = b.rasantesVistos.filter((v) => !v.rasanteId.startsWith('r-seed-'));
    b.rasantes.push(...gerarRasantesSeed(agora));
    this.persistir();
  }

  private montarRasante(b: BancoMock, r: BancoMock['rasantes'][number], meuId: string): Rasante {
    return {
      ...r,
      autor: this.resumoDe(b, r.autorId),
      visto: b.rasantesVistos.some((v) => v.usuarioId === meuId && v.rasanteId === r.id),
    };
  }

  private rasantesAtivos(b: BancoMock): BancoMock['rasantes'] {
    const agora = Date.now();
    return b.rasantes.filter((r) => new Date(r.expiraEm).getTime() > agora);
  }

  async listRasantes(): Promise<GrupoDeRasantes[]> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    this.renovarRasantesDeDemo(b);
    const bloqueados = this.idsBloqueados(b, eu.id);
    const sigo = new Set(
      b.seguidores.filter((s) => s.seguidorId === eu.id).map((s) => s.seguidoId),
    );
    const grupos = new Map<string, GrupoDeRasantes>();
    for (const r of this.rasantesAtivos(b).sort((a, c) => a.criadoEm.localeCompare(c.criadoEm))) {
      const meu = r.autorId === eu.id;
      if (!meu && (!sigo.has(r.autorId) || bloqueados.has(r.autorId))) continue;
      let grupo = grupos.get(r.autorId);
      if (!grupo) {
        grupo = { autor: this.resumoDe(b, r.autorId), rasantes: [], todosVistos: true, souEu: meu };
        grupos.set(r.autorId, grupo);
      }
      const rasante = this.montarRasante(b, r, eu.id);
      grupo.rasantes.push(rasante);
      if (!rasante.visto) grupo.todosVistos = false;
    }
    const ultimo = (g: GrupoDeRasantes) => g.rasantes[g.rasantes.length - 1].criadoEm;
    return [...grupos.values()].sort((a, c) => {
      if (a.souEu !== c.souEu) return a.souEu ? -1 : 1;
      if (a.todosVistos !== c.todosVistos) return a.todosVistos ? 1 : -1;
      return ultimo(c).localeCompare(ultimo(a));
    });
  }

  async listRasantesDoUsuario(usuarioId: Id): Promise<Rasante[]> {
    const b = await this.banco();
    const meuId = b.sessao?.usuarioId ?? '';
    return this.rasantesAtivos(b)
      .filter((r) => r.autorId === usuarioId)
      .sort((a, c) => a.criadoEm.localeCompare(c.criadoEm))
      .map((r) => this.montarRasante(b, r, meuId));
  }

  async publicarRasante(novo: NovoRasante, aoProgredir?: ProgressoDeUpload): Promise<Rasante> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    if (novo.duracao > DURACAO_MAXIMA_RASANTE_SEGUNDOS + 0.5) {
      throw new ErroDeAplicacao(
        `Rasantes têm até ${DURACAO_MAXIMA_RASANTE_SEGUNDOS} segundos.`,
        'rasante_longo',
      );
    }
    const id = this.gerarId();
    aoProgredir?.(0.1, 'Preparando');
    const url = await salvarArquivoLocalmente(novo.uriLocal, 'rasantes', id, 'mp4');
    aoProgredir?.(0.6, 'Gerando miniatura');
    const origemThumb = novo.thumbnailUriLocal ?? (await gerarThumbnail(url));
    const thumbnailUrl = origemThumb
      ? await salvarArquivoLocalmente(origemThumb, 'thumbnails', `rasante-${id}`, 'jpg')
      : null;
    const criadoEm = agoraIso();
    const registro = {
      id,
      autorId: eu.id,
      url,
      thumbnailUrl,
      duracao: Math.max(1, Math.round(novo.duracao)),
      criadoEm,
      expiraEm: new Date(Date.now() + VALIDADE_RASANTE_HORAS * 60 * 60 * 1000).toISOString(),
    };
    b.rasantes.push(registro);
    aoProgredir?.(1, 'Publicado');
    this.persistir();
    return this.montarRasante(b, registro, eu.id);
  }

  async marcarRasanteComoVisto(id: Id): Promise<void> {
    const b = await this.armazenamento.carregar();
    const meuId = b.sessao?.usuarioId;
    if (!meuId) return;
    if (b.rasantesVistos.some((v) => v.usuarioId === meuId && v.rasanteId === id)) return;
    b.rasantesVistos.push({ usuarioId: meuId, rasanteId: id });
    this.persistir();
  }

  async excluirRasante(id: Id): Promise<void> {
    const b = await this.banco();
    const eu = this.usuarioLogado(b);
    const rasante = b.rasantes.find((r) => r.id === id);
    if (!rasante) return;
    if (rasante.autorId !== eu.id)
      throw new ErroDeAplicacao('Você só pode apagar seus rasantes.', 'sem_permissao');
    b.rasantes = b.rasantes.filter((r) => r.id !== id);
    b.rasantesVistos = b.rasantesVistos.filter((v) => v.rasanteId !== id);
    removerArquivoLocal(rasante.url);
    removerArquivoLocal(rasante.thumbnailUrl);
    this.persistir();
  }

  // ---------------------------------------------------------------- utilitários de teste/demonstração

  /** Apaga todos os dados locais e volta ao seed (usado em testes e no botão "Resetar demo"). */
  async resetar(): Promise<void> {
    await this.armazenamento.limpar();
  }
}
