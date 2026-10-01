import Constants, { ExecutionEnvironment } from 'expo-constants';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { DURACAO_FOTO_SEGUNDOS, type Interesse, type Reacao } from '@/constants/interesses';
import {
  DURACAO_MAXIMA_RASANTE_SEGUNDOS,
  TAMANHO_MAXIMO_MENSAGEM,
  VALIDADE_RASANTE_HORAS,
} from '@/constants/rasantes';
import { gerarThumbnail, tipoMimeDe } from '@/services/midia/arquivos';
import {
  apagarNoR2,
  chaveDoR2,
  enviarParaR2,
  usandoR2,
  type PastaDeMidia,
} from '@/services/midia/remoto';
import type {
  Comentario,
  Conversa,
  Denuncia,
  GrupoDeRasantes,
  HashtagTrending,
  Id,
  Liga,
  Live,
  Mensagem,
  MensagemLive,
  MidiaDoPost,
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
  ResultadoDoPalpite,
  ResumoDePalpites,
  ResumoDeUsuario,
  Sessao,
  TipoDeNotificacao,
  Titulo,
  TokenPush,
  Usuario,
  Video,
} from '@/types';
import { ErroDeAplicacao } from '@/utils/erros';
import { extrairHashtags, normalizarHashtag } from '@/utils/hashtags';
import { novoId } from '@/utils/ids';
import { validarPalpite } from '@/utils/palpites';
import { normalizarMidias, validarMidiasDoPost, validarTextoDoPost } from '@/utils/posts';
import { apelidoValido, normalizarApelido } from '@/utils/validacao';

import type {
  AtualizacaoDePerfil,
  CancelarAssinatura,
  DadosDeCadastro,
  DataService,
  EventoDaLive,
  NovaDenuncia,
  NovaMidia,
  NovoPalpite,
  NovoPost,
  NovoRasante,
  NovoVideo,
  ParametrosDaResenha,
  ParametrosDoFeed,
  ProgressoDeUpload,
} from '../types';
import { configuracaoSupabase, supabase } from './cliente';

// ---------------------------------------------------------------- linhas do banco (snake_case)

interface LinhaPerfil {
  id: string;
  apelido: string;
  nome: string;
  avatar_url: string | null;
  bio: string | null;
  interesses: string[] | null;
  seguidores_count: number;
  seguindo_count: number;
  curtidas_recebidas: number;
  videos_count: number;
  criado_em: string;
}

interface LinhaVideo {
  id: string;
  autor_id: string;
  tipo: 'video' | 'foto';
  url: string;
  thumbnail_url: string | null;
  legenda: string;
  hashtags: string[] | null;
  categoria: string;
  audio: string | null;
  duracao: number;
  largura: number | null;
  altura: number | null;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  shares_count: number;
  views_count: number;
  criado_em: string;
  autor?: LinhaPerfilResumo | null;
}

type LinhaPerfilResumo = Pick<LinhaPerfil, 'id' | 'apelido' | 'nome' | 'avatar_url'>;

interface LinhaComentario {
  id: string;
  video_id: string;
  autor_id: string;
  texto: string;
  pai_id: string | null;
  likes_count: number;
  criado_em: string;
  autor?: LinhaPerfilResumo | null;
}

interface LinhaLive {
  id: string;
  anfitriao_id: string;
  titulo: string;
  thumbnail_url: string | null;
  sala: string;
  espectadores: number;
  ativa: boolean;
  iniciada_em: string;
  encerrada_em: string | null;
  anfitriao?: LinhaPerfilResumo | null;
}

interface LinhaMensagemLive {
  id: string;
  live_id: string;
  autor_id: string;
  tipo: 'texto' | 'reacao' | 'sistema';
  texto: string;
  reacao: string | null;
  criado_em: string;
  autor?: LinhaPerfilResumo | null;
}

interface LinhaNotificacao {
  id: string;
  tipo: 'curtida' | 'comentario' | 'seguiu' | 'live' | 'sistema';
  de_id: string | null;
  video_id: string | null;
  live_id: string | null;
  post_id?: string | null;
  texto: string;
  lida: boolean;
  criado_em: string;
  de?: LinhaPerfilResumo | null;
}

interface LinhaConversaResumo {
  id: string;
  outro_id: string;
  ultima_mensagem: string | null;
  ultima_remetente_id: string | null;
  atualizado_em: string;
  nao_lidas: number | string | null;
}

interface LinhaMensagem {
  id: string;
  conversa_id: string;
  remetente_id: string;
  texto: string;
  lida: boolean;
  criado_em: string;
}

interface LinhaRasante {
  id: string;
  autor_id: string;
  url: string;
  thumbnail_url: string | null;
  duracao: number;
  criado_em: string;
  expira_em: string;
}

interface LinhaPost {
  id: string;
  autor_id: string;
  texto: string;
  hashtags: string[] | null;
  pai_id: string | null;
  partida_id: string | null;
  partida_rotulo: string | null;
  midias: unknown;
  likes_count: number;
  replies_count: number;
  criado_em: string;
  autor?: LinhaPerfilResumo | null;
}

interface LinhaPalpite {
  partida_id: string;
  gols_mandante: number;
  gols_visitante: number;
  atualizado_em: string;
  pontos?: number | null;
  resultado?: ResultadoDoPalpite | null;
}

interface LinhaDoRanking {
  posicao: number;
  usuario_id: string;
  apelido: string;
  nome: string;
  avatar_url: string | null;
  pontos: number;
  palpites: number;
  cravadas: number;
  sequencia: number;
  variacao?: number;
  sou_eu?: boolean;
}

interface LinhaDeLiga {
  id: string;
  nome: string;
  codigo: string;
  membros: number | string;
  sou_dono: boolean;
  minha_posicao?: number | null;
  meus_pontos?: number | null;
}

interface LinhaResumoDePalpites {
  total: number | string;
  vitoria_mandante: number | string;
  empate: number | string;
  vitoria_visitante: number | string;
  gols_mandante: number | null;
  gols_visitante: number | null;
  votos_placar: number | string | null;
}

// profiles tem privilégio por coluna no Postgres (email fica fora): nunca usar '*' nessa tabela.
const COLUNAS_PERFIL =
  'id, apelido, nome, avatar_url, bio, interesses, seguidores_count, seguindo_count, curtidas_recebidas, videos_count, criado_em';
const SELECAO_AUTOR = 'autor:profiles!videos_autor_id_fkey(id, apelido, nome, avatar_url)';
const SELECAO_VIDEO = `*, ${SELECAO_AUTOR}`;
const SELECAO_POST = '*, autor:profiles!posts_autor_id_fkey(id, apelido, nome, avatar_url)';
const LIMITE_PADRAO = 10;

function paraPost(p: LinhaPost, curtidos: Set<string>): Post {
  return {
    id: p.id,
    autorId: p.autor_id,
    autor: resumo(p.autor, p.autor_id),
    texto: p.texto,
    hashtags: p.hashtags ?? [],
    paiId: p.pai_id,
    partida: p.partida_id ? { id: p.partida_id, rotulo: p.partida_rotulo ?? '' } : null,
    midias: normalizarMidias(p.midias),
    curtidas: p.likes_count ?? 0,
    respostas: p.replies_count ?? 0,
    criadoEm: p.criado_em,
    curtido: curtidos.has(p.id),
  };
}

function paraPalpite(p: LinhaPalpite): Palpite {
  return {
    partidaId: p.partida_id,
    golsMandante: p.gols_mandante,
    golsVisitante: p.gols_visitante,
    atualizadoEm: p.atualizado_em,
    pontos: p.pontos ?? null,
    resultado: p.resultado ?? null,
  };
}

function paraPalpiteiro(r: LinhaDoRanking): Palpiteiro {
  return {
    posicao: Number(r.posicao),
    usuario: { id: r.usuario_id, apelido: r.apelido, nome: r.nome, avatarUrl: r.avatar_url },
    pontos: Number(r.pontos ?? 0),
    palpites: Number(r.palpites ?? 0),
    cravadas: Number(r.cravadas ?? 0),
    sequencia: Number(r.sequencia ?? 0),
    variacao: Number(r.variacao ?? 0),
    souEu: r.sou_eu ?? false,
  };
}

function paraLiga(l: LinhaDeLiga): Liga {
  return {
    id: l.id,
    nome: l.nome,
    codigo: l.codigo,
    membros: Number(l.membros ?? 0),
    souDono: !!l.sou_dono,
    minhaPosicao: Number(l.minha_posicao ?? 0),
    meusPontos: Number(l.meus_pontos ?? 0),
  };
}

function resumo(p: LinhaPerfilResumo | null | undefined, idPadrao: string): Video['autor'] {
  if (!p) return { id: idPadrao, apelido: 'usuario', nome: 'Usuário', avatarUrl: null };
  return { id: p.id, apelido: p.apelido, nome: p.nome, avatarUrl: p.avatar_url };
}

function paraUsuario(p: LinhaPerfil): Usuario {
  return {
    id: p.id,
    apelido: p.apelido,
    nome: p.nome,
    avatarUrl: p.avatar_url,
    bio: p.bio ?? '',
    interesses: (p.interesses ?? []) as Interesse[],
    seguidores: p.seguidores_count ?? 0,
    seguindo: p.seguindo_count ?? 0,
    curtidasRecebidas: p.curtidas_recebidas ?? 0,
    totalVideos: p.videos_count ?? 0,
    criadoEm: p.criado_em,
  };
}

function paraVideo(v: LinhaVideo, curtidos: Set<string>, salvos: Set<string>): Video {
  return {
    id: v.id,
    autorId: v.autor_id,
    autor: resumo(v.autor, v.autor_id),
    tipo: v.tipo,
    url: v.url,
    thumbnailUrl: v.thumbnail_url,
    legenda: v.legenda ?? '',
    hashtags: v.hashtags ?? [],
    categoria: (v.categoria as Interesse) ?? 'Torcida',
    audio: v.audio ?? '',
    duracao: v.duracao ?? 0,
    largura: v.largura,
    altura: v.altura,
    curtidas: v.likes_count ?? 0,
    comentarios: v.comments_count ?? 0,
    salvos: v.saves_count ?? 0,
    compartilhamentos: v.shares_count ?? 0,
    visualizacoes: v.views_count ?? 0,
    criadoEm: v.criado_em,
    curtido: curtidos.has(v.id),
    salvo: salvos.has(v.id),
  };
}

function paraLive(l: LinhaLive): Live {
  return {
    id: l.id,
    anfitriaoId: l.anfitriao_id,
    anfitriao: resumo(l.anfitriao, l.anfitriao_id),
    titulo: l.titulo,
    thumbnailUrl: l.thumbnail_url,
    sala: l.sala,
    espectadores: l.espectadores ?? 0,
    ativa: l.ativa,
    iniciadaEm: l.iniciada_em,
    encerradaEm: l.encerrada_em,
  };
}

function paraMensagem(m: LinhaMensagemLive): MensagemLive {
  const autor = m.autor;
  return {
    id: m.id,
    liveId: m.live_id,
    autorId: m.autor_id,
    autor: autor
      ? { id: autor.id, apelido: autor.apelido, avatarUrl: autor.avatar_url }
      : { id: m.autor_id, apelido: 'torcedor', avatarUrl: null },
    tipo: m.tipo,
    texto: m.texto,
    reacao: (m.reacao as Reacao | null) ?? null,
    criadoEm: m.criado_em,
  };
}

function paraMensagemDireta(m: LinhaMensagem): Mensagem {
  return {
    id: m.id,
    conversaId: m.conversa_id,
    remetenteId: m.remetente_id,
    texto: m.texto,
    lida: m.lida,
    criadoEm: m.criado_em,
  };
}

function erroDoSupabase(erro: { message: string; code?: string } | null, contexto: string): never {
  const mensagem = erro?.message ?? contexto;
  if (/invalid login credentials/i.test(mensagem)) {
    throw new ErroDeAplicacao('E-mail ou senha incorretos.', 'credenciais_invalidas');
  }
  if (/already registered|already exists/i.test(mensagem)) {
    throw new ErroDeAplicacao('Já existe uma conta com esse e-mail.', 'email_em_uso');
  }
  if (/duplicate key.*apelido/i.test(mensagem)) {
    throw new ErroDeAplicacao('Esse apelido já está em uso.', 'apelido_em_uso');
  }
  throw new ErroDeAplicacao(`${contexto}: ${mensagem}`, erro?.code ?? 'supabase');
}

/**
 * Implementação real do DataService contra o Supabase (Postgres + Auth + Storage + Realtime).
 * Requer o schema de `supabase/schema.sql` aplicado e as chaves no .env.
 */
export class SupabaseDataService implements DataService {
  readonly nome = 'supabase' as const;

  private get db() {
    return supabase();
  }

  private async meuId(): Promise<string | null> {
    const { data } = await this.db.auth.getSession();
    return data.session?.user.id ?? null;
  }

  private async meuIdOuErro(): Promise<string> {
    const id = await this.meuId();
    if (!id) throw new ErroDeAplicacao('Você precisa entrar para fazer isso.', 'nao_autenticado');
    return id;
  }

  private async perfil(id: string): Promise<LinhaPerfil> {
    const { data, error } = await this.db
      .from('profiles')
      .select(COLUNAS_PERFIL)
      .eq('id', id)
      .single();
    if (error || !data) erroDoSupabase(error, 'Perfil não encontrado');
    return data as LinhaPerfil;
  }

  private async montarSessao(
    usuarioId: string,
    visitante: boolean,
    email: string | null = null,
  ): Promise<Sessao> {
    // o perfil é criado por trigger no cadastro; se faltar (perfil apagado, trigger
    // antigo), a RPC garantir_perfil() recria antes de tentar de novo
    let linha: LinhaPerfil | null = null;
    for (let tentativa = 0; tentativa < 3 && !linha; tentativa++) {
      const { data, error } = await this.db
        .from('profiles')
        .select(COLUNAS_PERFIL)
        .eq('id', usuarioId)
        .maybeSingle();
      // erro de permissão/rede não é "perfil ainda não existe": mostra a causa real
      if (error) erroDoSupabase(error, 'Falha ao carregar o perfil');
      linha = (data as LinhaPerfil | null) ?? null;
      if (!linha) {
        const { error: erroRpc } = await this.db.rpc('garantir_perfil');
        if (erroRpc) erroDoSupabase(erroRpc, 'Falha ao criar o perfil');
      }
    }
    if (!linha)
      throw new ErroDeAplicacao('Perfil ainda não criado. Tente novamente.', 'perfil_ausente');
    const usuario = paraUsuario(linha);
    return {
      usuario,
      visitante,
      onboardingConcluido: visitante || usuario.interesses.length > 0,
      email: email || null,
    };
  }

  /** Conjunto de vídeos curtidos/salvos pelo usuário logado, entre os ids informados. */
  private async relacoes(ids: string[]): Promise<{ curtidos: Set<string>; salvos: Set<string> }> {
    const meuId = await this.meuId();
    const curtidos = new Set<string>();
    const salvos = new Set<string>();
    if (!meuId || ids.length === 0) return { curtidos, salvos };
    const [likes, saves] = await Promise.all([
      this.db.from('likes').select('video_id').eq('usuario_id', meuId).in('video_id', ids),
      this.db.from('saves').select('video_id').eq('usuario_id', meuId).in('video_id', ids),
    ]);
    for (const l of (likes.data ?? []) as { video_id: string }[]) curtidos.add(l.video_id);
    for (const s of (saves.data ?? []) as { video_id: string }[]) salvos.add(s.video_id);
    return { curtidos, salvos };
  }

  private async decorarVideos(linhas: LinhaVideo[]): Promise<Video[]> {
    const { curtidos, salvos } = await this.relacoes(linhas.map((l) => l.id));
    return linhas.map((l) => paraVideo(l, curtidos, salvos));
  }

  /**
   * A lista de bloqueados era relida do banco em quase toda listagem — uma ida extra por
   * chamada, para um dado que muda uma vez por mês. Fica em memória por 60 s e é derrubada
   * na hora quando o usuário bloqueia ou desbloqueia alguém.
   */
  private bloqueadosEmCache: { ids: string[]; ate: number; dono: string } | null = null;

  private async idsBloqueados(): Promise<string[]> {
    const meuId = await this.meuId();
    if (!meuId) return [];
    const agora = Date.now();
    const cache = this.bloqueadosEmCache;
    if (cache && cache.dono === meuId && cache.ate > agora) return cache.ids;
    const { data } = await this.db.from('blocks').select('bloqueado_id').eq('usuario_id', meuId);
    const ids = ((data ?? []) as { bloqueado_id: string }[]).map((b) => b.bloqueado_id);
    this.bloqueadosEmCache = { ids, ate: agora + 60_000, dono: meuId };
    return ids;
  }

  private esquecerBloqueados() {
    this.bloqueadosEmCache = null;
  }

  /** Invoca uma Edge Function com o JWT do usuário e devolve o corpo já tipado. */
  private readonly funcoes = {
    invocar: async <T>(nome: string, corpo: Record<string, unknown>): Promise<T> => {
      const { data, error } = await this.db.functions.invoke(nome, { body: corpo });
      if (error) {
        // a função devolve {error: "..."} no corpo; essa mensagem é mais útil que a genérica
        const detalhe = (data as { error?: string } | null)?.error;
        throw new ErroDeAplicacao(detalhe ?? error.message, 'funcao_de_midia');
      }
      return data as T;
    },
  };

  /**
   * Único ponto de upload do app.
   *
   * Com `EXPO_PUBLIC_MIDIA_URL` no .env, o arquivo vai para o Cloudflare R2 (egress zero);
   * sem ela, continua no Storage da Supabase exatamente como antes. Os arquivos já
   * enviados não se movem: as URLs estão no banco e seguem funcionando dos dois lados.
   */
  private async enviarArquivo(
    bucket: PastaDeMidia,
    caminho: string,
    uriLocal: string,
    tipoMime: string,
    aoProgredir?: (fracao: number) => void,
  ): Promise<string> {
    if (usandoR2()) {
      return enviarParaR2(this.funcoes, bucket, caminho, uriLocal, tipoMime, aoProgredir);
    }
    return this.enviarParaSupabase(bucket, caminho, uriLocal, tipoMime, aoProgredir);
  }

  /**
   * Remove arquivos dos dois destinos, sem se importar com onde eles estão.
   *
   * Durante a transição o acervo fica dividido: o que foi enviado antes está na Supabase,
   * o que vier depois está no R2. Tentar nos dois é idempotente e barato — bem melhor do
   * que descobrir a origem de cada arquivo e errar, deixando lixo pago no bucket.
   */
  private async removerArquivos(bucket: PastaDeMidia, caminhos: string[]): Promise<void> {
    if (caminhos.length === 0) return;
    await Promise.all([
      this.db.storage
        .from(bucket)
        .remove(caminhos)
        .then(undefined, () => {}),
      apagarNoR2(
        this.funcoes,
        caminhos.map((c) => `${bucket}/${c}`),
      ),
    ]);
  }

  private async enviarParaSupabase(
    bucket: PastaDeMidia,
    caminho: string,
    uriLocal: string,
    tipoMime: string,
    aoProgredir?: (fracao: number) => void,
  ): Promise<string> {
    const cfg = configuracaoSupabase();
    if (!cfg) throw new ErroDeAplicacao('Supabase não configurado.', 'supabase_nao_configurado');
    const { data: sessao } = await this.db.auth.getSession();
    const token = sessao.session?.access_token ?? cfg.chave;
    const arquivo = new File(uriLocal);
    const tarefa = arquivo.createUploadTask(`${cfg.url}/storage/v1/object/${bucket}/${caminho}`, {
      httpMethod: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: cfg.chave,
        'Content-Type': tipoMime,
        'x-upsert': 'true',
        'cache-control': 'max-age=31536000',
      },
      mimeType: tipoMime,
      onProgress: ({ bytesSent, totalBytes }) => {
        if (totalBytes > 0) aoProgredir?.(bytesSent / totalBytes);
      },
    });
    const resposta = await tarefa.uploadAsync();
    if (resposta.status < 200 || resposta.status >= 300) {
      throw new ErroDeAplicacao(`Falha no upload (${resposta.status}): ${resposta.body}`, 'upload');
    }
    return this.db.storage.from(bucket).getPublicUrl(caminho).data.publicUrl;
  }

  // ---------------------------------------------------------------- autenticação

  async entrar(email: string, senha: string): Promise<Sessao> {
    const { data, error } = await this.db.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error || !data.user) erroDoSupabase(error, 'Falha ao entrar');
    return this.montarSessao(data.user.id, false, data.user.email ?? null);
  }

  async cadastrar(dados: DadosDeCadastro): Promise<Sessao> {
    const apelido = normalizarApelido(dados.apelido ?? dados.email.split('@')[0]);
    const { data, error } = await this.db.auth.signUp({
      email: dados.email.trim(),
      password: dados.senha,
      options: {
        data: {
          apelido: apelidoValido(apelido)
            ? apelido
            : `torcedor${Math.floor(Math.random() * 9000 + 1000)}`,
          nome: dados.nome?.trim() || apelido,
        },
      },
    });
    if (error || !data.user) erroDoSupabase(error, 'Falha ao cadastrar');
    if (!data.session) {
      throw new ErroDeAplicacao(
        'Cadastro criado! Confirme o e-mail antes de entrar (ou desative a confirmação no painel do Supabase).',
        'confirmar_email',
      );
    }
    return this.montarSessao(data.user.id, false, data.user.email ?? null);
  }

  async entrarComoVisitante(): Promise<Sessao> {
    const { data, error } = await this.db.auth.signInAnonymously({
      options: {
        data: {
          apelido: `visitante_${Math.floor(Math.random() * 90000 + 10000)}`,
          nome: 'Torcedor Visitante',
        },
      },
    });
    if (error || !data.user)
      erroDoSupabase(
        error,
        'Falha ao entrar como visitante (ative "Anonymous sign-ins" no Supabase)',
      );
    return this.montarSessao(data.user.id, true);
  }

  /**
   * Para onde o Google deve devolver o login.
   *
   * O Supabase compara este endereço com a lista de Redirect URLs caractere a caractere:
   * uma barra a mais e o login falha. Por isso, em build, ele é escrito à mão em vez de
   * sair do `Linking.createURL` — a forma que o createURL monta depende do `hostUri`, que
   * existe no development build e não existe no APK, e as duas não dão o mesmo texto.
   *
   * No Expo Go não há esquema próprio: o retorno passa pelo Metro, vira
   * `exp://<ip>:<porta>/--/login-google`, e só o createURL sabe montar isso. Esse endereço
   * muda de rede para rede, então precisa estar na lista do Supabase a cada IP novo — ou
   * use `expo start --tunnel`, que troca o IP por um nome fixo. Veja SETUP_GOOGLE.md.
   */
  private enderecoDeRetornoDoGoogle(): string {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
      return Linking.createURL('login-google');
    }
    // `scheme` pode vir como lista quando o app declara mais de um
    const esquema = [Constants.expoConfig?.scheme ?? 'vulture'].flat()[0];
    return `${esquema}://login-google`;
  }

  /**
   * Login com Google pelo fluxo de OAuth do Supabase.
   *
   * O caminho é: pedir a URL de autorização ao Supabase → abrir na aba segura do sistema
   * (`openAuthSessionAsync`, que é o navegador real, com as senhas salvas do usuário, e
   * não um WebView do app) → o Google devolve para `vulture://login-google` com um código
   * → trocamos o código pela sessão.
   *
   * `skipBrowserRedirect` existe porque quem abre o navegador aqui somos nós: sem isso o
   * supabase-js tentaria redirecionar sozinho, o que não faz sentido em app nativo.
   *
   * NÃO use `preferEphemeralSession`. Parece a correção óbvia para o diálogo do iOS
   * ("App" quer usar "<domínio>" para fazer login, que mostra o endereço cru do projeto
   * Supabase) — e por uma versão, esteve ligada aqui. Mas sessão efêmera derrubou o
   * retorno via esquema customizado nos testes deste projeto: o mesmo túnel do Expo Go,
   * com o mesmo endereço já liberado no Supabase, funcionava sem a opção e parava de
   * voltar para o app com ela. Não é só relato de terceiros — a diferença apareceu entre
   * duas tentativas consecutivas, mudando só essa opção. O diálogo feio é um preço
   * aceitável; login que não volta não é.
   *
   * O perfil é criado pelo mesmo trigger do cadastro por e-mail (`handle_new_user`), então
   * quem entra pela primeira vez já chega com apelido e perfil prontos.
   */
  async entrarComGoogle(): Promise<Sessao> {
    const redirectTo = this.enderecoDeRetornoDoGoogle();
    const { data, error } = await this.db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      if (error && /provider is not enabled/i.test(error.message)) {
        throw new ErroDeAplicacao(
          'Entrar com Google ainda não está ligado neste projeto.',
          'google_indisponivel',
        );
      }
      erroDoSupabase(error, 'Falha ao abrir o login do Google');
    }

    const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (resultado.type !== 'success') {
      // O navegador fechou sem devolver para o app. O motivo óbvio é desistência, mas há
      // um segundo que parece idêntico daqui: se `redirectTo` não estiver liberado no
      // Supabase, ele manda o navegador para a Site URL depois do consentimento e o app
      // nunca é chamado de volta. A pessoa fecha a aba e chega aqui tendo feito tudo
      // certo. Dizer "cancelado" nesse caso esconde a única informação útil, então a
      // mensagem nomeia o endereço que precisa estar na lista.
      const sessaoTardia = await this.sessaoAtual();
      if (sessaoTardia) return sessaoTardia;
      throw new ErroDeAplicacao(
        'O navegador fechou sem voltar para o app. Se você chegou a autorizar no Google, ' +
          `falta liberar "${redirectTo}" em Authentication → URL Configuration → ` +
          'Redirect URLs no painel do Supabase.',
        'login_nao_retornou',
      );
    }

    const devolvido = new URL(resultado.url);
    // O retorno pode trazer os dados na query (?code=…, fluxo PKCE) ou no fragmento
    // (#access_token=…, fluxo implícito). Erro também vem num ou noutro, dependendo de
    // onde o Supabase desistiu, então os dois são lidos juntos.
    const fragmento = new URLSearchParams(devolvido.hash.replace(/^#/, ''));
    const doRetorno = (campo: string) =>
      devolvido.searchParams.get(campo) ?? fragmento.get(campo);

    // o Google devolve `error=access_denied` quando a pessoa recusa na tela de consentimento
    const recusa = doRetorno('error_description') ?? doRetorno('error');
    if (recusa) {
      throw new ErroDeAplicacao(
        recusa === 'access_denied' ? 'Login com Google cancelado.' : `O Google recusou: ${recusa}`,
        'login_cancelado',
      );
    }

    // Fluxo implícito: o par de tokens vem pronto no fragmento, sem código para trocar.
    // O cliente pede PKCE, mas um link antigo ainda em trânsito pode chegar assim.
    const tokenDeAcesso = doRetorno('access_token');
    const tokenDeRenovacao = doRetorno('refresh_token');
    if (tokenDeAcesso && tokenDeRenovacao) {
      const { data: posto, error: erroAoPor } = await this.db.auth.setSession({
        access_token: tokenDeAcesso,
        refresh_token: tokenDeRenovacao,
      });
      if (erroAoPor || !posto.user) erroDoSupabase(erroAoPor, 'Falha ao concluir o login');
      return this.montarSessao(posto.user.id, false, posto.user.email ?? null);
    }

    const codigo = doRetorno('code');
    if (!codigo) {
      // alguns fluxos devolvem a sessão direto no fragmento em vez de código
      const sessaoAtual = await this.sessaoAtual();
      if (sessaoAtual) return sessaoAtual;
      throw new ErroDeAplicacao('O Google não devolveu o código de acesso.', 'google_sem_codigo');
    }

    const { data: troca, error: erroTroca } =
      await this.db.auth.exchangeCodeForSession(codigo);
    if (erroTroca || !troca.user) erroDoSupabase(erroTroca, 'Falha ao concluir o login');
    return this.montarSessao(troca.user.id, false, troca.user.email ?? null);
  }

  async sair(): Promise<void> {
    await this.db.auth.signOut();
  }

  async sessaoAtual(): Promise<Sessao | null> {
    const { data } = await this.db.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) return null;
    try {
      return await this.montarSessao(usuario.id, !!usuario.is_anonymous, usuario.email ?? null);
    } catch {
      return null;
    }
  }

  async concluirOnboarding(dados: {
    apelido: string;
    interesses: Interesse[];
    avatarUriLocal?: string | null;
  }): Promise<Sessao> {
    const meuId = await this.meuIdOuErro();
    const apelido = normalizarApelido(dados.apelido);
    if (!apelidoValido(apelido)) throw new ErroDeAplicacao('Apelido inválido.', 'apelido_invalido');
    if (dados.interesses.length < 1)
      throw new ErroDeAplicacao('Escolha pelo menos um interesse.', 'interesses_invalidos');
    let avatar_url: string | undefined;
    if (dados.avatarUriLocal) {
      avatar_url = await this.enviarArquivo(
        'avatars',
        `${meuId}/${novoId()}.jpg`,
        dados.avatarUriLocal,
        tipoMimeDe(dados.avatarUriLocal, 'foto'),
      );
    }
    const { error } = await this.db
      .from('profiles')
      .update({ apelido, interesses: dados.interesses, ...(avatar_url ? { avatar_url } : {}) })
      .eq('id', meuId);
    if (error) erroDoSupabase(error, 'Falha ao salvar o perfil');
    const { data } = await this.db.auth.getSession();
    return this.montarSessao(
      meuId,
      !!data.session?.user.is_anonymous,
      data.session?.user.email ?? null,
    );
  }

  async alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const { data } = await this.db.auth.getSession();
    const email = data.session?.user.email;
    if (!email) {
      throw new ErroDeAplicacao(
        'O visitante não tem senha: crie uma conta para poder definir uma.',
        'sem_conta',
      );
    }
    // o Supabase troca a senha sem pedir a atual; conferir antes evita que uma
    // sessão esquecida aberta no aparelho consiga assumir a conta
    const { error: erroConferencia } = await this.db.auth.signInWithPassword({
      email,
      password: senhaAtual,
    });
    if (erroConferencia) throw new ErroDeAplicacao('A senha atual não confere.', 'senha_incorreta');
    const { error } = await this.db.auth.updateUser({ password: novaSenha });
    if (error) erroDoSupabase(error, 'Falha ao trocar a senha');
  }

  async enviarRedefinicaoDeSenha(email: string): Promise<void> {
    const { error } = await this.db.auth.resetPasswordForEmail(email.trim());
    if (error) erroDoSupabase(error, 'Falha ao enviar o e-mail de redefinição');
  }

  // ---------------------------------------------------------------- feed e vídeos

  /**
   * A ordem e os filtros vêm da RPC `feed_ids`; aqui só buscamos as linhas dos ids.
   *
   * Antes o app baixava todos os ids de quem o usuário segue (e todos os bloqueados) para
   * montar um `.in(...)` na querystring. Quem segue alguns milhares de perfis gerava uma
   * URL de dezenas de KB, que o PostgREST recusa — o feed simplesmente parava de carregar
   * justamente para os usuários mais engajados.
   */
  async listFeed(params: ParametrosDoFeed): Promise<Pagina<Video>> {
    const limite = params.limite ?? LIMITE_PADRAO;
    const { data, error } = await this.db.rpc('feed_ids', {
      p_aba: params.aba === 'seguindo' ? 'seguindo' : 'para-voce',
      p_cursor: params.cursor ?? null,
      p_limite: limite + 1,
      p_categoria: params.categoria ?? null,
      p_hashtag: params.hashtag ? normalizarHashtag(params.hashtag) : null,
    });
    if (error) erroDoSupabase(error, 'Falha ao carregar o feed');
    const refs = (data ?? []) as { id: string; criado_em: string }[];
    const temMais = refs.length > limite;
    const pagina = temMais ? refs.slice(0, limite) : refs;
    if (pagina.length === 0) return { itens: [], proximoCursor: null };

    const itens = await this.videosPorId(pagina.map((r) => r.id));
    return { itens, proximoCursor: temMais ? pagina[pagina.length - 1].criado_em : null };
  }

  /** Busca os vídeos de uma lista de ids preservando a ordem pedida. */
  private async videosPorId(ids: string[]): Promise<Video[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from('videos').select(SELECAO_VIDEO).in('id', ids);
    if (error) erroDoSupabase(error, 'Falha ao carregar os vídeos');
    const linhas = (data ?? []) as unknown as LinhaVideo[];
    const ordem = new Map(ids.map((id, i) => [id, i]));
    linhas.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
    return this.decorarVideos(linhas);
  }

  async getVideo(id: Id): Promise<Video> {
    const { data, error } = await this.db
      .from('videos')
      .select(SELECAO_VIDEO)
      .eq('id', id)
      .single();
    if (error || !data) erroDoSupabase(error, 'Vídeo não encontrado');
    const [video] = await this.decorarVideos([data as unknown as LinhaVideo]);
    return video;
  }

  async uploadVideo(novo: NovoVideo, aoProgredir?: ProgressoDeUpload): Promise<Video> {
    const meuId = await this.meuIdOuErro();
    const id = novoId();
    const progresso = (f: number, etapa: string) => aoProgredir?.(Math.min(1, f), etapa);

    progresso(0.02, 'Enviando arquivo');
    const ehVideo = novo.tipo === 'video';
    const extensao = ehVideo ? 'mp4' : 'jpg';
    const url = await this.enviarArquivo(
      ehVideo ? 'videos' : 'thumbnails',
      `${meuId}/${id}.${extensao}`,
      novo.uriLocal,
      tipoMimeDe(novo.uriLocal, novo.tipo),
      (f) => progresso(0.02 + f * 0.75, 'Enviando arquivo'),
    );

    let thumbnail_url: string | null = ehVideo ? null : url;
    if (ehVideo) {
      progresso(0.8, 'Gerando miniatura');
      const thumbLocal = novo.thumbnailUriLocal ?? (await gerarThumbnail(novo.uriLocal));
      if (thumbLocal) {
        thumbnail_url = await this.enviarArquivo(
          'thumbnails',
          `${meuId}/${id}.jpg`,
          thumbLocal,
          'image/jpeg',
        );
      }
    }

    progresso(0.92, 'Publicando');
    const { data, error } = await this.db
      .from('videos')
      .insert({
        id,
        autor_id: meuId,
        tipo: novo.tipo,
        url,
        thumbnail_url,
        legenda: novo.legenda.trim(),
        hashtags: novo.hashtags,
        hashtags_norm: novo.hashtags.map(normalizarHashtag),
        categoria: novo.categoria,
        audio: novo.audio ?? null,
        duracao: ehVideo ? Math.round(novo.duracao) : DURACAO_FOTO_SEGUNDOS,
        largura: novo.largura ?? null,
        altura: novo.altura ?? null,
      })
      .select(SELECAO_VIDEO)
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao publicar');
    progresso(1, 'Publicado');
    const [video] = await this.decorarVideos([data as unknown as LinhaVideo]);
    return video;
  }

  async excluirVideo(id: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db.from('videos').delete().eq('id', id).eq('autor_id', meuId);
    if (error) erroDoSupabase(error, 'Falha ao excluir');
    await Promise.all([
      this.removerArquivos('videos', [`${meuId}/${id}.mp4`]),
      this.removerArquivos('thumbnails', [`${meuId}/${id}.jpg`]),
    ]);
  }

  async registrarVisualizacao(id: Id): Promise<void> {
    await this.registrarVisualizacoes([id]);
  }

  /**
   * Um UPDATE por vídeo assistido era a maior fonte de escrita do app: 100 mil usuários
   * vendo 30 vídeos por dia dão 3 milhões de gravações diárias, cada uma travando a linha
   * do vídeo em alta. Agora o app junta os ids (`useFeed`) e manda de uma vez; no banco
   * vira insert numa fila que o cron consolida.
   */
  async registrarVisualizacoes(ids: Id[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.rpc('registrar_visualizacoes', { p_ids: ids });
  }

  async registrarCompartilhamento(id: Id): Promise<void> {
    await this.db.rpc('incrementar_compartilhamento', { p_video_id: id });
  }

  // ---------------------------------------------------------------- interações

  async like(videoId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('likes')
      .upsert(
        { usuario_id: meuId, video_id: videoId },
        { onConflict: 'usuario_id,video_id', ignoreDuplicates: true },
      );
    if (error) erroDoSupabase(error, 'Falha ao curtir');
  }

  async unlike(videoId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('likes')
      .delete()
      .eq('usuario_id', meuId)
      .eq('video_id', videoId);
    if (error) erroDoSupabase(error, 'Falha ao descurtir');
  }

  async salvar(videoId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('saves')
      .upsert(
        { usuario_id: meuId, video_id: videoId },
        { onConflict: 'usuario_id,video_id', ignoreDuplicates: true },
      );
    if (error) erroDoSupabase(error, 'Falha ao salvar');
  }

  async removerSalvo(videoId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('saves')
      .delete()
      .eq('usuario_id', meuId)
      .eq('video_id', videoId);
    if (error) erroDoSupabase(error, 'Falha ao remover dos salvos');
  }

  async listComments(videoId: Id): Promise<Comentario[]> {
    const { data, error } = await this.db
      .from('comments')
      .select('*, autor:profiles!comments_autor_id_fkey(id, apelido, nome, avatar_url)')
      .eq('video_id', videoId)
      .order('criado_em', { ascending: true });
    if (error) erroDoSupabase(error, 'Falha ao carregar comentários');
    const bloqueados = new Set(await this.idsBloqueados());
    const linhas = ((data ?? []) as unknown as LinhaComentario[]).filter(
      (c) => !bloqueados.has(c.autor_id),
    );
    const converter = (c: LinhaComentario): Comentario => ({
      id: c.id,
      videoId: c.video_id,
      autorId: c.autor_id,
      autor: resumo(c.autor, c.autor_id),
      texto: c.texto,
      paiId: c.pai_id,
      curtidas: c.likes_count ?? 0,
      criadoEm: c.criado_em,
      respostas: [],
    });
    const raizes = linhas
      .filter((c) => !c.pai_id)
      .map(converter)
      .reverse();
    for (const raiz of raizes) {
      raiz.respostas = linhas.filter((c) => c.pai_id === raiz.id).map(converter);
    }
    return raizes;
  }

  async addComment(videoId: Id, texto: string, paiId: Id | null = null): Promise<Comentario> {
    const meuId = await this.meuIdOuErro();
    const limpo = texto.trim();
    if (!limpo) throw new ErroDeAplicacao('Escreva um comentário.', 'comentario_vazio');
    let paiValido: string | null = null;
    if (paiId) {
      const { data: pai } = await this.db
        .from('comments')
        .select('id, pai_id')
        .eq('id', paiId)
        .maybeSingle();
      const p = pai as { id: string; pai_id: string | null } | null;
      paiValido = p ? (p.pai_id ?? p.id) : null;
    }
    const { data, error } = await this.db
      .from('comments')
      .insert({ video_id: videoId, autor_id: meuId, texto: limpo, pai_id: paiValido })
      .select('*, autor:profiles!comments_autor_id_fkey(id, apelido, nome, avatar_url)')
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao comentar');
    const c = data as unknown as LinhaComentario;
    return {
      id: c.id,
      videoId: c.video_id,
      autorId: c.autor_id,
      autor: resumo(c.autor, c.autor_id),
      texto: c.texto,
      paiId: c.pai_id,
      curtidas: 0,
      criadoEm: c.criado_em,
      respostas: [],
    };
  }

  async excluirComentario(comentarioId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('comments')
      .delete()
      .eq('id', comentarioId)
      .eq('autor_id', meuId);
    if (error) erroDoSupabase(error, 'Falha ao excluir comentário');
  }

  async follow(usuarioId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    if (usuarioId === meuId)
      throw new ErroDeAplicacao('Você não pode seguir a si mesmo.', 'invalido');
    const { error } = await this.db
      .from('follows')
      .upsert(
        { seguidor_id: meuId, seguido_id: usuarioId },
        { onConflict: 'seguidor_id,seguido_id', ignoreDuplicates: true },
      );
    if (error) erroDoSupabase(error, 'Falha ao seguir');
  }

  async unfollow(usuarioId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('follows')
      .delete()
      .eq('seguidor_id', meuId)
      .eq('seguido_id', usuarioId);
    if (error) erroDoSupabase(error, 'Falha ao deixar de seguir');
  }

  // ---------------------------------------------------------------- perfil

  async getProfile(usuarioId: Id | 'eu'): Promise<Perfil> {
    const meuId = await this.meuId();
    const alvoId = usuarioId === 'eu' ? meuId : usuarioId;
    if (!alvoId)
      throw new ErroDeAplicacao('Você precisa entrar para ver o perfil.', 'nao_autenticado');
    const usuario = paraUsuario(await this.perfil(alvoId));
    let estouSeguindo = false;
    let bloqueado = false;
    if (meuId && meuId !== alvoId) {
      const [f, b] = await Promise.all([
        this.db
          .from('follows')
          .select('seguido_id')
          .eq('seguidor_id', meuId)
          .eq('seguido_id', alvoId)
          .maybeSingle(),
        this.db
          .from('blocks')
          .select('bloqueado_id')
          .eq('usuario_id', meuId)
          .eq('bloqueado_id', alvoId)
          .maybeSingle(),
      ]);
      estouSeguindo = !!f.data;
      bloqueado = !!b.data;
    }
    return { ...usuario, souEu: usuario.id === meuId, estouSeguindo, bloqueado };
  }

  async updateProfile(dados: AtualizacaoDePerfil): Promise<Usuario> {
    const meuId = await this.meuIdOuErro();
    const patch: Record<string, unknown> = {};
    if (dados.apelido !== undefined) {
      const apelido = normalizarApelido(dados.apelido);
      if (!apelidoValido(apelido))
        throw new ErroDeAplicacao('Apelido inválido.', 'apelido_invalido');
      patch.apelido = apelido;
    }
    if (dados.nome !== undefined) patch.nome = dados.nome.trim();
    if (dados.bio !== undefined) patch.bio = dados.bio.trim().slice(0, 160);
    if (dados.interesses !== undefined) patch.interesses = dados.interesses;
    if (dados.avatarUriLocal) {
      patch.avatar_url = await this.enviarArquivo(
        'avatars',
        `${meuId}/${novoId()}.jpg`,
        dados.avatarUriLocal,
        tipoMimeDe(dados.avatarUriLocal, 'foto'),
      );
    } else if (dados.avatarUriLocal === null) {
      patch.avatar_url = null;
    }
    const { data, error } = await this.db
      .from('profiles')
      .update(patch)
      .eq('id', meuId)
      .select(COLUNAS_PERFIL)
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao atualizar o perfil');
    return paraUsuario(data as LinhaPerfil);
  }

  async listVideosDoUsuario(usuarioId: Id): Promise<Video[]> {
    const { data, error } = await this.db
      .from('videos')
      .select(SELECAO_VIDEO)
      .eq('autor_id', usuarioId)
      .order('criado_em', { ascending: false })
      .limit(200);
    if (error) erroDoSupabase(error, 'Falha ao carregar vídeos');
    return this.decorarVideos((data ?? []) as unknown as LinhaVideo[]);
  }

  async listVideosCurtidos(usuarioId: Id): Promise<Video[]> {
    const { data, error } = await this.db
      .from('likes')
      .select(`criado_em, video:videos(${SELECAO_VIDEO})`)
      .eq('usuario_id', usuarioId)
      .order('criado_em', { ascending: false })
      .limit(200);
    if (error) erroDoSupabase(error, 'Falha ao carregar curtidos');
    const linhas = ((data ?? []) as unknown as { video: LinhaVideo | null }[])
      .map((l) => l.video)
      .filter((v): v is LinhaVideo => !!v);
    return this.decorarVideos(linhas);
  }

  async listVideosSalvos(): Promise<Video[]> {
    const meuId = await this.meuIdOuErro();
    const { data, error } = await this.db
      .from('saves')
      .select(`criado_em, video:videos(${SELECAO_VIDEO})`)
      .eq('usuario_id', meuId)
      .order('criado_em', { ascending: false })
      .limit(200);
    if (error) erroDoSupabase(error, 'Falha ao carregar salvos');
    const linhas = ((data ?? []) as unknown as { video: LinhaVideo | null }[])
      .map((l) => l.video)
      .filter((v): v is LinhaVideo => !!v);
    return this.decorarVideos(linhas);
  }

  async listSeguidores(usuarioId: Id): Promise<Usuario[]> {
    const { data } = await this.db
      .from('follows')
      .select(`perfil:profiles!follows_seguidor_id_fkey(${COLUNAS_PERFIL})`)
      .eq('seguido_id', usuarioId)
      .limit(200);
    return ((data ?? []) as unknown as { perfil: LinhaPerfil | null }[])
      .map((l) => l.perfil)
      .filter((p): p is LinhaPerfil => !!p)
      .map(paraUsuario);
  }

  async listSeguindo(usuarioId: Id): Promise<Usuario[]> {
    const { data } = await this.db
      .from('follows')
      .select(`perfil:profiles!follows_seguido_id_fkey(${COLUNAS_PERFIL})`)
      .eq('seguidor_id', usuarioId)
      .limit(200);
    return ((data ?? []) as unknown as { perfil: LinhaPerfil | null }[])
      .map((l) => l.perfil)
      .filter((p): p is LinhaPerfil => !!p)
      .map(paraUsuario);
  }

  // ---------------------------------------------------------------- explorar

  async buscarUsuarios(termo: string): Promise<Usuario[]> {
    const t = termo.trim().replace(/^@/, '');
    if (!t) return [];
    const { data, error } = await this.db
      .from('profiles')
      .select(COLUNAS_PERFIL)
      .or(`apelido.ilike.%${t}%,nome.ilike.%${t}%`)
      .limit(20);
    if (error) erroDoSupabase(error, 'Falha na busca');
    const bloqueados = new Set(await this.idsBloqueados());
    return ((data ?? []) as LinhaPerfil[]).filter((p) => !bloqueados.has(p.id)).map(paraUsuario);
  }

  async buscarHashtags(termo: string): Promise<HashtagTrending[]> {
    const t = normalizarHashtag(termo);
    if (!t) return [];
    const { data, error } = await this.db.rpc('buscar_hashtags', { p_termo: t });
    if (error) erroDoSupabase(error, 'Falha na busca');
    return ((data ?? []) as { tag: string; total: number }[]).map((h) => ({
      tag: h.tag,
      totalVideos: Number(h.total),
    }));
  }

  async listTrending(): Promise<Video[]> {
    const { data, error } = await this.db.rpc('videos_em_alta', { p_limite: 30 });
    if (error) erroDoSupabase(error, 'Falha ao carregar em alta');
    const ids = ((data ?? []) as { id: string }[]).map((v) => v.id);
    if (ids.length === 0) return [];
    const { data: videos } = await this.db.from('videos').select(SELECAO_VIDEO).in('id', ids);
    const linhas = (videos ?? []) as unknown as LinhaVideo[];
    const ordem = new Map(ids.map((id, i) => [id, i]));
    linhas.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
    return this.decorarVideos(linhas);
  }

  async listHashtagsEmAlta(): Promise<HashtagTrending[]> {
    const { data, error } = await this.db.rpc('hashtags_em_alta', { p_limite: 12 });
    if (error) erroDoSupabase(error, 'Falha ao carregar hashtags');
    return ((data ?? []) as { tag: string; total: number }[]).map((h) => ({
      tag: h.tag,
      totalVideos: Number(h.total),
    }));
  }

  async rankingSemanal(): Promise<RankingTorcedor[]> {
    const { data, error } = await this.db.rpc('ranking_semanal', { p_limite: 10 });
    if (error) erroDoSupabase(error, 'Falha ao carregar ranking');
    return (
      (data ?? []) as {
        id: string;
        apelido: string;
        nome: string;
        avatar_url: string | null;
        curtidas: number;
        videos: number;
      }[]
    ).map((r, i) => ({
      posicao: i + 1,
      usuario: { id: r.id, apelido: r.apelido, nome: r.nome, avatarUrl: r.avatar_url },
      curtidasNaSemana: Number(r.curtidas),
      videosNaSemana: Number(r.videos),
    }));
  }

  // ---------------------------------------------------------------- lives

  private readonly selecaoLive =
    '*, anfitriao:profiles!live_streams_anfitriao_id_fkey(id, apelido, nome, avatar_url)';

  async listLives(): Promise<Live[]> {
    const { data, error } = await this.db
      .from('live_streams')
      .select(this.selecaoLive)
      .eq('ativa', true)
      .order('espectadores', { ascending: false })
      .limit(50);
    if (error) erroDoSupabase(error, 'Falha ao carregar lives');
    return ((data ?? []) as unknown as LinhaLive[]).map(paraLive);
  }

  async getLive(id: Id): Promise<Live> {
    const { data, error } = await this.db
      .from('live_streams')
      .select(this.selecaoLive)
      .eq('id', id)
      .single();
    if (error || !data) erroDoSupabase(error, 'Live não encontrada');
    return paraLive(data as unknown as LinhaLive);
  }

  async createLive(titulo: string): Promise<Live> {
    const meuId = await this.meuIdOuErro();
    const limpo = titulo.trim();
    if (!limpo) throw new ErroDeAplicacao('Dê um título para a live.', 'titulo_vazio');
    await this.db
      .from('live_streams')
      .update({ ativa: false, encerrada_em: new Date().toISOString() })
      .eq('anfitriao_id', meuId)
      .eq('ativa', true);
    const { data, error } = await this.db
      .from('live_streams')
      .insert({
        anfitriao_id: meuId,
        titulo: limpo,
        sala: `vulture-${novoId()}`,
        ativa: true,
        // ninguém assistindo ainda: o anfitrião transmite, não conta como espectador
        espectadores: 0,
      })
      .select(this.selecaoLive)
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao iniciar a live');
    const live = paraLive(data as unknown as LinhaLive);
    // Avisa os seguidores sem atrasar o início da live. O fan-out inteiro (notificação em
    // tela + push enfileirado) é feito em dois INSERT ... SELECT dentro do Postgres, então
    // 200 mil seguidores custam uma varredura de índice — e não 2 mil chamadas HTTP em
    // série dentro de uma Edge Function, que estourava o tempo limite.
    void (async () => {
      try {
        const { error: erroRpc } = await this.db.rpc('notificar_live', { p_live_id: live.id });
        if (erroRpc) console.warn('notificar_live falhou:', erroRpc.message);
      } catch (e) {
        console.warn('notificar_live indisponível:', e);
      }
    })();
    return live;
  }

  async encerrarLive(id: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('live_streams')
      .update({ ativa: false, encerrada_em: new Date().toISOString() })
      .eq('id', id)
      .eq('anfitriao_id', meuId);
    if (error) erroDoSupabase(error, 'Falha ao encerrar a live');
  }

  async entrarNaLive(id: Id): Promise<void> {
    await this.db.rpc('ajustar_espectadores', { p_live_id: id, p_delta: 1 });
  }

  async sairDaLive(id: Id): Promise<void> {
    await this.db.rpc('ajustar_espectadores', { p_live_id: id, p_delta: -1 });
  }

  private readonly selecaoMensagem =
    '*, autor:profiles!live_messages_autor_id_fkey(id, apelido, nome, avatar_url)';

  async listMensagensDaLive(liveId: Id): Promise<MensagemLive[]> {
    const { data, error } = await this.db
      .from('live_messages')
      .select(this.selecaoMensagem)
      .eq('live_id', liveId)
      .order('criado_em', { ascending: false })
      .limit(100);
    if (error) erroDoSupabase(error, 'Falha ao carregar o chat');
    return ((data ?? []) as unknown as LinhaMensagemLive[]).map(paraMensagem).reverse();
  }

  private async criarMensagem(
    liveId: Id,
    texto: string,
    reacao: Reacao | null,
  ): Promise<MensagemLive> {
    const meuId = await this.meuIdOuErro();
    const { data, error } = await this.db
      .from('live_messages')
      .insert({
        live_id: liveId,
        autor_id: meuId,
        tipo: reacao ? 'reacao' : 'texto',
        texto: reacao ?? texto.trim(),
        reacao,
      })
      .select(this.selecaoMensagem)
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao enviar mensagem');
    return paraMensagem(data as unknown as LinhaMensagemLive);
  }

  async enviarMensagemNaLive(liveId: Id, texto: string): Promise<MensagemLive> {
    if (!texto.trim()) throw new ErroDeAplicacao('Escreva uma mensagem.', 'mensagem_vazia');
    return this.criarMensagem(liveId, texto, null);
  }

  async enviarReacaoNaLive(liveId: Id, reacao: Reacao): Promise<MensagemLive> {
    return this.criarMensagem(liveId, reacao, reacao);
  }

  assinarLive(
    liveId: Id,
    aoReceber: (evento: EventoDaLive) => void,
    opcoes: { anfitriao?: boolean } = {},
  ): CancelarAssinatura {
    // Quem assiste marca presença no canal; o anfitrião só escuta. Assim o número é
    // exatamente quem está com a sala aberta — e se alguém fechar o app no tapa, o
    // Realtime derruba a presença sozinho, sem deixar o contador inflado.
    let ultimoTotal = -1;
    const canal = this.db
      .channel(`live:${liveId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `live_id=eq.${liveId}`,
        },
        async (payload) => {
          const linha = payload.new as LinhaMensagemLive;
          // o payload do realtime não traz o join com o autor: busca o perfil
          const { data: autor } = await this.db
            .from('profiles')
            .select('id, apelido, nome, avatar_url')
            .eq('id', linha.autor_id)
            .maybeSingle();
          const mensagem = paraMensagem({
            ...linha,
            autor: (autor as LinhaPerfilResumo | null) ?? null,
          });
          aoReceber({ tipo: mensagem.tipo === 'reacao' ? 'reacao' : 'mensagem', mensagem });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${liveId}` },
        (payload) => {
          const linha = payload.new as LinhaLive;
          // o número de espectadores vem da presença, que é exata; daqui só interessa o fim
          if (!linha.ativa) aoReceber({ tipo: 'encerrada' });
        },
      )
      .on('presence', { event: 'sync' }, () => {
        const total = Object.keys(canal.presenceState()).length;
        if (total === ultimoTotal) return;
        ultimoTotal = total;
        aoReceber({ tipo: 'espectadores', total });
        // o anfitrião publica o número para quem olha a lista de lives de fora
        if (opcoes.anfitriao) {
          this.db
            .from('live_streams')
            .update({ espectadores: total })
            .eq('id', liveId)
            .then(undefined, () => {});
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !opcoes.anfitriao) {
          canal.track({ entrouEm: Date.now() }).catch(() => {});
        }
      });
    return () => {
      this.db.removeChannel(canal).catch(() => {});
    };
  }

  // ---------------------------------------------------------------- notificações

  async listNotificacoes(): Promise<Notificacao[]> {
    const meuId = await this.meuId();
    if (!meuId) return [];
    const { data, error } = await this.db
      .from('notifications')
      .select('*, de:profiles!notifications_de_id_fkey(id, apelido, nome, avatar_url)')
      .eq('para_id', meuId)
      .order('criado_em', { ascending: false })
      .limit(100);
    if (error) erroDoSupabase(error, 'Falha ao carregar notificações');
    return ((data ?? []) as unknown as LinhaNotificacao[]).map((n) => ({
      id: n.id,
      tipo: n.tipo,
      deId: n.de_id,
      de: n.de ? { id: n.de.id, apelido: n.de.apelido, avatarUrl: n.de.avatar_url } : null,
      videoId: n.video_id,
      liveId: n.live_id ?? null,
      postId: n.post_id ?? null,
      texto: n.texto,
      lida: n.lida,
      criadoEm: n.criado_em,
    }));
  }

  async registrarTokenPush(token: TokenPush): Promise<void> {
    await this.meuIdOuErro();
    // RPC (security definer): permite o token trocar de dono quando outra conta loga no aparelho
    const { error } = await this.db.rpc('registrar_token_push', {
      p_token: token.token,
      p_plataforma: token.plataforma,
    });
    if (error) erroDoSupabase(error, 'Falha ao registrar notificações');
  }

  async removerTokenPush(token: string): Promise<void> {
    await this.db.from('push_tokens').delete().eq('token', token);
  }

  async marcarNotificacoesComoLidas(tipos?: TipoDeNotificacao[]): Promise<void> {
    const meuId = await this.meuIdOuErro();
    let consulta = this.db
      .from('notifications')
      .update({ lida: true })
      .eq('para_id', meuId)
      .eq('lida', false);
    if (tipos && tipos.length > 0) consulta = consulta.in('tipo', tipos);
    await consulta;
  }

  // ---------------------------------------------------------------- mensagens diretas

  /** Perfis resumidos de vários ids numa consulta só (quem falta vira um placeholder). */
  private async resumos(ids: string[]): Promise<Map<string, ResumoDeUsuario>> {
    const mapa = new Map<string, ResumoDeUsuario>();
    const unicos = [...new Set(ids)].filter(Boolean);
    if (unicos.length === 0) return mapa;
    const { data } = await this.db
      .from('profiles')
      .select('id, apelido, nome, avatar_url')
      .in('id', unicos);
    for (const p of (data ?? []) as LinhaPerfilResumo[]) mapa.set(p.id, resumo(p, p.id));
    for (const id of unicos) if (!mapa.has(id)) mapa.set(id, resumo(null, id));
    return mapa;
  }

  private async montarConversas(linhas: LinhaConversaResumo[]): Promise<Conversa[]> {
    const perfis = await this.resumos(linhas.map((l) => l.outro_id));
    return linhas.map((l) => ({
      id: l.id,
      outro: perfis.get(l.outro_id) ?? resumo(null, l.outro_id),
      ultimaMensagem:
        l.ultima_mensagem !== null && l.ultima_remetente_id
          ? {
              texto: l.ultima_mensagem,
              remetenteId: l.ultima_remetente_id,
              criadoEm: l.atualizado_em,
            }
          : null,
      naoLidas: Number(l.nao_lidas ?? 0),
      atualizadoEm: l.atualizado_em,
    }));
  }

  async listConversas(): Promise<Conversa[]> {
    await this.meuIdOuErro();
    const { data, error } = await this.db.rpc('listar_conversas');
    if (error) erroDoSupabase(error, 'Falha ao carregar conversas');
    return this.montarConversas((data ?? []) as LinhaConversaResumo[]);
  }

  async getConversa(conversaId: Id): Promise<Conversa> {
    const conversas = await this.listConversas();
    const conversa = conversas.find((c) => c.id === conversaId);
    if (!conversa) throw new ErroDeAplicacao('Conversa não encontrada.', 'nao_encontrado');
    return conversa;
  }

  async podeConversar(usuarioId: Id): Promise<PermissaoDeConversa> {
    const meuId = await this.meuIdOuErro();
    if (usuarioId === meuId) {
      return {
        permitido: false,
        motivo: 'eu_mesmo',
        descricao: 'Você não pode conversar consigo mesmo.',
      };
    }
    const [{ data: permitido }, bloqueados, perfil] = await Promise.all([
      this.db.rpc('pode_conversar', { p_de: meuId, p_para: usuarioId }),
      this.idsBloqueados(),
      this.db.from('profiles').select('id, apelido').eq('id', usuarioId).maybeSingle(),
    ]);
    if (permitido === true) return { permitido: true };
    const apelido = (perfil.data as { apelido: string } | null)?.apelido ?? 'esse perfil';
    if (!perfil.data || bloqueados.includes(usuarioId)) {
      return {
        permitido: false,
        motivo: 'bloqueado',
        descricao: 'Não é possível conversar com esse perfil.',
      };
    }
    const { count } = await this.db
      .from('follows')
      .select('seguidor_id', { count: 'exact', head: true })
      .or(
        `and(seguidor_id.eq.${meuId},seguido_id.eq.${usuarioId}),and(seguidor_id.eq.${usuarioId},seguido_id.eq.${meuId})`,
      );
    if ((count ?? 0) > 0) {
      return {
        permitido: false,
        motivo: 'nao_aceita',
        descricao: `@${apelido} não está recebendo mensagens no momento.`,
      };
    }
    return {
      permitido: false,
      motivo: 'sem_relacao',
      descricao: `Siga @${apelido} ou espere que te siga para puxar papo.`,
    };
  }

  async abrirConversa(usuarioId: Id): Promise<Conversa> {
    await this.meuIdOuErro();
    const { data, error } = await this.db.rpc('abrir_conversa', { p_outro: usuarioId });
    if (error) {
      const permissao = await this.podeConversar(usuarioId).catch(() => null);
      if (permissao && !permissao.permitido)
        throw new ErroDeAplicacao(permissao.descricao, 'conversa_negada');
      erroDoSupabase(error, 'Falha ao abrir a conversa');
    }
    return this.getConversa(data as string);
  }

  async listMensagens(conversaId: Id): Promise<Mensagem[]> {
    const { data, error } = await this.db
      .from('messages')
      .select('*')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
      .limit(300);
    if (error) erroDoSupabase(error, 'Falha ao carregar mensagens');
    return ((data ?? []) as LinhaMensagem[]).map(paraMensagemDireta);
  }

  async enviarMensagem(conversaId: Id, texto: string): Promise<Mensagem> {
    const meuId = await this.meuIdOuErro();
    const limpo = texto.trim();
    if (!limpo) throw new ErroDeAplicacao('Escreva uma mensagem.', 'mensagem_vazia');
    if (limpo.length > TAMANHO_MAXIMO_MENSAGEM)
      throw new ErroDeAplicacao('Mensagem longa demais.', 'mensagem_longa');
    const { data, error } = await this.db
      .from('messages')
      .insert({ conversa_id: conversaId, remetente_id: meuId, texto: limpo })
      .select('*')
      .single();
    if (error || !data) {
      // a política de RLS barra quando quem recebe não aceita mensagens minhas
      if (error && /row-level security/i.test(error.message)) {
        throw new ErroDeAplicacao(
          'Essa pessoa não está recebendo suas mensagens no momento.',
          'conversa_negada',
        );
      }
      erroDoSupabase(error, 'Falha ao enviar');
    }
    const mensagem = paraMensagemDireta(data as LinhaMensagem);
    // push para o aparelho de quem recebe (não bloqueia o envio)
    this.db.functions
      .invoke('notificar-mensagem', { body: { mensagemId: mensagem.id } })
      .catch(() => {});
    return mensagem;
  }

  async marcarConversaComoLida(conversaId: Id): Promise<void> {
    await this.meuIdOuErro();
    // RPC: marca as mensagens e zera o contador da conversa na mesma transação
    const { error } = await this.db.rpc('marcar_conversa_como_lida', {
      p_conversa_id: conversaId,
    });
    if (error) erroDoSupabase(error, 'Falha ao marcar a conversa como lida');
  }

  assinarConversa(conversaId: Id, aoReceber: (mensagem: Mensagem) => void): CancelarAssinatura {
    const canal = this.db
      .channel(`conversa:${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => aoReceber(paraMensagemDireta(payload.new as LinhaMensagem)),
      )
      .subscribe();
    return () => {
      this.db.removeChannel(canal).catch(() => {});
    };
  }

  async listContatos(): Promise<Usuario[]> {
    const meuId = await this.meuIdOuErro();
    const [seguindo, seguidores, bloqueados] = await Promise.all([
      this.listSeguindo(meuId),
      this.listSeguidores(meuId),
      this.idsBloqueados(),
    ]);
    const mapa = new Map<string, Usuario>();
    for (const u of [...seguindo, ...seguidores]) if (!bloqueados.includes(u.id)) mapa.set(u.id, u);
    return [...mapa.values()].sort((a, c) => a.apelido.localeCompare(c.apelido));
  }

  async obterPreferenciasDeMensagens(): Promise<PreferenciasDeMensagens> {
    const meuId = await this.meuIdOuErro();
    const { data, error } = await this.db
      .from('profiles')
      .select('msg_de_quem_sigo, msg_de_seguidores')
      .eq('id', meuId)
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao carregar preferências');
    const p = data as { msg_de_quem_sigo: boolean; msg_de_seguidores: boolean };
    return { deQuemSigo: p.msg_de_quem_sigo, deSeguidores: p.msg_de_seguidores };
  }

  async atualizarPreferenciasDeMensagens(
    dados: Partial<PreferenciasDeMensagens>,
  ): Promise<PreferenciasDeMensagens> {
    const meuId = await this.meuIdOuErro();
    const patch: Record<string, boolean> = {};
    if (dados.deQuemSigo !== undefined) patch.msg_de_quem_sigo = dados.deQuemSigo;
    if (dados.deSeguidores !== undefined) patch.msg_de_seguidores = dados.deSeguidores;
    if (Object.keys(patch).length > 0) {
      const { error } = await this.db.from('profiles').update(patch).eq('id', meuId);
      if (error) erroDoSupabase(error, 'Falha ao salvar preferências');
    }
    return this.obterPreferenciasDeMensagens();
  }

  // ---------------------------------------------------------------- seguidores e sugestões

  async listNovosSeguidores(): Promise<NovoSeguidor[]> {
    const meuId = await this.meuIdOuErro();
    const [{ data, error }, sigoLinhas, bloqueados] = await Promise.all([
      this.db
        .from('follows')
        .select(
          `criado_em, perfil:profiles!follows_seguidor_id_fkey(id, apelido, nome, avatar_url)`,
        )
        .eq('seguido_id', meuId)
        .order('criado_em', { ascending: false })
        .limit(200),
      this.db.from('follows').select('seguido_id').eq('seguidor_id', meuId),
      this.idsBloqueados(),
    ]);
    if (error) erroDoSupabase(error, 'Falha ao carregar seguidores');
    const sigo = new Set(
      ((sigoLinhas.data ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id),
    );
    return ((data ?? []) as unknown as { criado_em: string; perfil: LinhaPerfilResumo | null }[])
      .filter((l) => l.perfil && !bloqueados.includes(l.perfil.id))
      .map((l) => ({
        usuario: resumo(l.perfil, l.perfil!.id),
        seguiuEm: l.criado_em,
        sigoDeVolta: sigo.has(l.perfil!.id),
      }));
  }

  async sugerirTorcedores(): Promise<Usuario[]> {
    const meuId = await this.meuIdOuErro();
    const [sigoLinhas, bloqueados, { data, error }] = await Promise.all([
      this.db.from('follows').select('seguido_id').eq('seguidor_id', meuId),
      this.idsBloqueados(),
      this.db
        .from('profiles')
        .select(COLUNAS_PERFIL)
        .neq('id', meuId)
        .order('seguidores_count', { ascending: false })
        .limit(60),
    ]);
    if (error) erroDoSupabase(error, 'Falha ao carregar sugestões');
    const sigo = new Set(
      ((sigoLinhas.data ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id),
    );
    return ((data ?? []) as LinhaPerfil[])
      .filter((p) => !sigo.has(p.id) && !bloqueados.includes(p.id))
      .map(paraUsuario)
      .slice(0, 20);
  }

  // ---------------------------------------------------------------- rasantes

  private async decorarRasantes(linhas: LinhaRasante[], meuId: string | null): Promise<Rasante[]> {
    if (linhas.length === 0) return [];
    const vistos = new Set<string>();
    if (meuId) {
      const { data } = await this.db
        .from('rasante_views')
        .select('rasante_id')
        .eq('usuario_id', meuId)
        .in(
          'rasante_id',
          linhas.map((l) => l.id),
        );
      for (const v of (data ?? []) as { rasante_id: string }[]) vistos.add(v.rasante_id);
    }
    const perfis = await this.resumos(linhas.map((l) => l.autor_id));
    return linhas.map((l) => ({
      id: l.id,
      autorId: l.autor_id,
      autor: perfis.get(l.autor_id) ?? resumo(null, l.autor_id),
      url: l.url,
      thumbnailUrl: l.thumbnail_url,
      duracao: l.duracao ?? 0,
      criadoEm: l.criado_em,
      expiraEm: l.expira_em,
      visto: vistos.has(l.id),
    }));
  }

  async listRasantes(): Promise<GrupoDeRasantes[]> {
    const meuId = await this.meuIdOuErro();
    const [sigoLinhas, bloqueados] = await Promise.all([
      this.db.from('follows').select('seguido_id').eq('seguidor_id', meuId),
      this.idsBloqueados(),
    ]);
    const autores = [
      meuId,
      ...((sigoLinhas.data ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id),
    ].filter((id) => !bloqueados.includes(id));
    const { data, error } = await this.db
      .from('rasantes')
      .select('*')
      .in('autor_id', autores)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: true })
      .limit(300);
    if (error) erroDoSupabase(error, 'Falha ao carregar rasantes');
    const rasantes = await this.decorarRasantes((data ?? []) as LinhaRasante[], meuId);
    const grupos = new Map<string, GrupoDeRasantes>();
    for (const r of rasantes) {
      let grupo = grupos.get(r.autorId);
      if (!grupo) {
        grupo = { autor: r.autor, rasantes: [], todosVistos: true, souEu: r.autorId === meuId };
        grupos.set(r.autorId, grupo);
      }
      grupo.rasantes.push(r);
      if (!r.visto) grupo.todosVistos = false;
    }
    const ultimo = (g: GrupoDeRasantes) => g.rasantes[g.rasantes.length - 1].criadoEm;
    return [...grupos.values()].sort((a, c) => {
      if (a.souEu !== c.souEu) return a.souEu ? -1 : 1;
      if (a.todosVistos !== c.todosVistos) return a.todosVistos ? 1 : -1;
      return ultimo(c).localeCompare(ultimo(a));
    });
  }

  async listRasantesDoUsuario(usuarioId: Id): Promise<Rasante[]> {
    const meuId = await this.meuId();
    const { data, error } = await this.db
      .from('rasantes')
      .select('*')
      .eq('autor_id', usuarioId)
      .gt('expira_em', new Date().toISOString())
      .order('criado_em', { ascending: true });
    if (error) erroDoSupabase(error, 'Falha ao carregar rasantes');
    return this.decorarRasantes((data ?? []) as LinhaRasante[], meuId);
  }

  async publicarRasante(novo: NovoRasante, aoProgredir?: ProgressoDeUpload): Promise<Rasante> {
    const meuId = await this.meuIdOuErro();
    if (novo.duracao > DURACAO_MAXIMA_RASANTE_SEGUNDOS + 0.5) {
      throw new ErroDeAplicacao(
        `Rasantes têm até ${DURACAO_MAXIMA_RASANTE_SEGUNDOS} segundos.`,
        'rasante_longo',
      );
    }
    const id = novoId();
    const progresso = (f: number, etapa: string) => aoProgredir?.(Math.min(1, f), etapa);
    progresso(0.02, 'Enviando rasante');
    const url = await this.enviarArquivo(
      'videos',
      `${meuId}/rasantes/${id}.mp4`,
      novo.uriLocal,
      tipoMimeDe(novo.uriLocal, 'video'),
      (f) => progresso(0.02 + f * 0.75, 'Enviando rasante'),
    );
    progresso(0.8, 'Gerando miniatura');
    let thumbnail_url: string | null = null;
    const thumbLocal = novo.thumbnailUriLocal ?? (await gerarThumbnail(novo.uriLocal));
    if (thumbLocal) {
      thumbnail_url = await this.enviarArquivo(
        'thumbnails',
        `${meuId}/rasantes/${id}.jpg`,
        thumbLocal,
        'image/jpeg',
      );
    }
    progresso(0.92, 'Publicando');
    const { data, error } = await this.db
      .from('rasantes')
      .insert({
        id,
        autor_id: meuId,
        url,
        thumbnail_url,
        duracao: Math.max(1, Math.round(novo.duracao)),
        expira_em: new Date(Date.now() + VALIDADE_RASANTE_HORAS * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao publicar o rasante');
    progresso(1, 'Publicado');
    const [rasante] = await this.decorarRasantes([data as LinhaRasante], meuId);
    return rasante;
  }

  async marcarRasanteComoVisto(id: Id): Promise<void> {
    const meuId = await this.meuId();
    if (!meuId) return;
    await this.db
      .from('rasante_views')
      .upsert(
        { rasante_id: id, usuario_id: meuId },
        { onConflict: 'rasante_id,usuario_id', ignoreDuplicates: true },
      );
  }

  async excluirRasante(id: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db.from('rasantes').delete().eq('id', id).eq('autor_id', meuId);
    if (error) erroDoSupabase(error, 'Falha ao apagar o rasante');
    // best-effort: arquivos no storage (Supabase e/ou R2)
    await Promise.all([
      this.removerArquivos('videos', [`${meuId}/rasantes/${id}.mp4`]),
      this.removerArquivos('thumbnails', [`${meuId}/rasantes/${id}.jpg`]),
    ]).catch(() => {});
  }

  // ---------------------------------------------------------------- arquibancada: resenha

  private async decorarPosts(linhas: LinhaPost[]): Promise<Post[]> {
    const meuId = await this.meuId();
    const curtidos = new Set<string>();
    if (meuId && linhas.length > 0) {
      const { data } = await this.db
        .from('post_likes')
        .select('post_id')
        .eq('usuario_id', meuId)
        .in(
          'post_id',
          linhas.map((l) => l.id),
        );
      for (const l of (data ?? []) as { post_id: string }[]) curtidos.add(l.post_id);
    }
    return linhas.map((l) => paraPost(l, curtidos));
  }

  /** Mesmo desenho do feed: ordem e filtros na RPC, linhas buscadas pelos ids. */
  async listPosts(params: ParametrosDaResenha): Promise<Pagina<Post>> {
    const limite = params.limite ?? LIMITE_PADRAO;
    const { data, error } = await this.db.rpc('resenha_ids', {
      p_cursor: params.cursor ?? null,
      p_limite: limite + 1,
      p_hashtag: params.hashtag ? normalizarHashtag(params.hashtag) : null,
      p_partida_id: params.partidaId ?? null,
    });
    if (error) erroDoSupabase(error, 'Falha ao carregar a resenha');
    const refs = (data ?? []) as { id: string; criado_em: string }[];
    const temMais = refs.length > limite;
    const pagina = temMais ? refs.slice(0, limite) : refs;
    if (pagina.length === 0) return { itens: [], proximoCursor: null };

    const ids = pagina.map((r) => r.id);
    const { data: linhasBrutas, error: erroLinhas } = await this.db
      .from('posts')
      .select(SELECAO_POST)
      .in('id', ids);
    if (erroLinhas) erroDoSupabase(erroLinhas, 'Falha ao carregar a resenha');
    const linhas = (linhasBrutas ?? []) as unknown as LinhaPost[];
    const ordem = new Map(ids.map((id, i) => [id, i]));
    linhas.sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
    const itens = await this.decorarPosts(linhas);
    return { itens, proximoCursor: temMais ? pagina[pagina.length - 1].criado_em : null };
  }

  async getPost(id: Id): Promise<Post> {
    const { data, error } = await this.db.from('posts').select(SELECAO_POST).eq('id', id).single();
    if (error || !data) erroDoSupabase(error, 'Post não encontrado');
    const [post] = await this.decorarPosts([data as unknown as LinhaPost]);
    return post;
  }

  async listRespostas(postId: Id): Promise<Post[]> {
    const { data, error } = await this.db
      .from('posts')
      .select(SELECAO_POST)
      .eq('pai_id', postId)
      .order('criado_em', { ascending: true })
      .limit(200);
    if (error) erroDoSupabase(error, 'Falha ao carregar as respostas');
    const bloqueados = new Set(await this.idsBloqueados());
    const linhas = ((data ?? []) as unknown as LinhaPost[]).filter(
      (l) => !bloqueados.has(l.autor_id),
    );
    return this.decorarPosts(linhas);
  }

  /** Caminho do arquivo no bucket "posts" a partir da URL pública (para apagar depois). */
  /**
   * Caminho dentro da pasta "posts" a partir da URL pública, venha ela do Storage da
   * Supabase ou do R2. Sem cobrir os dois, a mídia enviada depois da migração nunca seria
   * apagada e ficaria ocupando bucket pago para sempre.
   */
  private caminhoNoBucketDePosts(url: string | null): string | null {
    const doR2 = chaveDoR2(url);
    if (doR2?.startsWith('posts/')) return doR2.slice('posts/'.length);
    const marca = '/storage/v1/object/public/posts/';
    const i = url ? url.indexOf(marca) : -1;
    return i >= 0 ? url!.slice(i + marca.length) : null;
  }

  /** Sobe imagens e vídeos para posts/<meu id>/; GIFs já estão hospedados no GIPHY. */
  private async enviarMidias(
    meuId: string,
    novas: NovaMidia[],
    enviados: string[],
    aoProgredir?: ProgressoDeUpload,
  ): Promise<MidiaDoPost[]> {
    const midias: MidiaDoPost[] = [];
    const total = novas.length;
    for (const [i, m] of novas.entries()) {
      const etapa = total > 1 ? `Enviando ${i + 1} de ${total}` : 'Enviando';
      const progresso = (f: number) => aoProgredir?.((i + f) / total, etapa);
      progresso(0);
      if (m.tipo === 'gif') {
        midias.push({ ...m, thumbnailUrl: null, duracao: null });
        continue;
      }
      const base = `${meuId}/${novoId()}`;
      if (m.tipo === 'imagem') {
        const url = await this.enviarArquivo(
          'posts',
          `${base}.jpg`,
          m.uriLocal,
          'image/jpeg',
          progresso,
        );
        enviados.push(`${base}.jpg`);
        midias.push({
          tipo: 'imagem',
          url,
          thumbnailUrl: null,
          largura: m.largura,
          altura: m.altura,
          duracao: null,
        });
        continue;
      }
      const url = await this.enviarArquivo(
        'posts',
        `${base}.mp4`,
        m.uriLocal,
        tipoMimeDe(m.uriLocal, 'video'),
        (f) => progresso(f * 0.9),
      );
      enviados.push(`${base}.mp4`);
      const miniaturaLocal = await gerarThumbnail(m.uriLocal);
      let thumbnailUrl: string | null = null;
      if (miniaturaLocal) {
        thumbnailUrl = await this.enviarArquivo(
          'posts',
          `${base}.jpg`,
          miniaturaLocal,
          'image/jpeg',
        );
        enviados.push(`${base}.jpg`);
      }
      midias.push({
        tipo: 'video',
        url,
        thumbnailUrl,
        largura: m.largura,
        altura: m.altura,
        duracao: Math.round(m.duracao),
      });
    }
    return midias;
  }

  async publicarPost(novo: NovoPost, aoProgredir?: ProgressoDeUpload): Promise<Post> {
    const meuId = await this.meuIdOuErro();
    const novas = novo.midias ?? [];
    validarMidiasDoPost(novas);
    const texto = validarTextoDoPost(novo.texto, novas.length > 0);
    let paiId: string | null = null;
    if (novo.paiId) {
      const { data: pai } = await this.db
        .from('posts')
        .select('id, pai_id')
        .eq('id', novo.paiId)
        .maybeSingle();
      const p = pai as { id: string; pai_id: string | null } | null;
      if (!p) throw new ErroDeAplicacao('Post não encontrado.', 'nao_encontrado');
      paiId = p.pai_id ?? p.id;
    }
    const hashtags = extrairHashtags(texto);
    const enviados: string[] = [];
    try {
      const midias = await this.enviarMidias(meuId, novas, enviados, aoProgredir);
      aoProgredir?.(1, 'Publicando');
      const { data, error } = await this.db
        .from('posts')
        .insert({
          autor_id: meuId,
          texto,
          hashtags,
          hashtags_norm: hashtags.map(normalizarHashtag),
          pai_id: paiId,
          partida_id: novo.partida?.id ?? null,
          partida_rotulo: novo.partida?.rotulo ?? null,
          midias,
        })
        .select(SELECAO_POST)
        .single();
      if (error || !data) erroDoSupabase(error, 'Falha ao publicar');
      return paraPost(data as unknown as LinhaPost, new Set());
    } catch (erro) {
      // sem post, os arquivos já enviados só ocupariam espaço
      if (enviados.length > 0) await this.removerArquivos('posts', enviados);
      throw erro;
    }
  }

  async excluirPost(id: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { data: linha } = await this.db
      .from('posts')
      .select('midias')
      .eq('id', id)
      .eq('autor_id', meuId)
      .maybeSingle();
    const { error } = await this.db.from('posts').delete().eq('id', id).eq('autor_id', meuId);
    if (error) erroDoSupabase(error, 'Falha ao excluir o post');
    const arquivos = normalizarMidias((linha as { midias?: unknown } | null)?.midias)
      .flatMap((m) => [m.url, m.thumbnailUrl])
      .map((url) => this.caminhoNoBucketDePosts(url))
      .filter((c): c is string => !!c);
    if (arquivos.length > 0) await this.removerArquivos('posts', arquivos);
  }

  async curtirPost(id: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('post_likes')
      .upsert(
        { usuario_id: meuId, post_id: id },
        { onConflict: 'usuario_id,post_id', ignoreDuplicates: true },
      );
    if (error) erroDoSupabase(error, 'Falha ao curtir');
  }

  async descurtirPost(id: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    const { error } = await this.db
      .from('post_likes')
      .delete()
      .eq('usuario_id', meuId)
      .eq('post_id', id);
    if (error) erroDoSupabase(error, 'Falha ao descurtir');
  }

  // ---------------------------------------------------------------- arquibancada: palpites

  async listMeusPalpites(partidaIds: string[]): Promise<Palpite[]> {
    const meuId = await this.meuId();
    if (!meuId || partidaIds.length === 0) return [];
    const { data, error } = await this.db
      .from('palpites')
      .select('partida_id, gols_mandante, gols_visitante, atualizado_em, pontos, resultado')
      .eq('usuario_id', meuId)
      .in('partida_id', partidaIds);
    if (error) erroDoSupabase(error, 'Falha ao carregar seus palpites');
    return ((data ?? []) as LinhaPalpite[]).map(paraPalpite);
  }

  /**
   * Passa pela RPC `salvar_palpite`, não por um insert direto.
   *
   * O motivo é de segurança, não de estilo: a regra "só antes do apito" era conferida
   * contra uma coluna que o próprio cliente preenchia, então bastava mandar uma data
   * futura para registrar o palpite depois do jogo, com o placar na mão. Na RPC o horário
   * vem de public.partidas e o app não tem mais privilégio de escrita na tabela.
   */
  async salvarPalpite(novo: NovoPalpite): Promise<Palpite> {
    await this.meuIdOuErro();
    // pré-validação local só para o erro aparecer na hora, sem ida ao servidor
    validarPalpite(novo);
    const { data, error } = await this.db.rpc('salvar_palpite', {
      p_partida_id: novo.partidaId,
      p_gols_mandante: novo.golsMandante,
      p_gols_visitante: novo.golsVisitante,
    });
    if (error) {
      if (/bola já rolou|encerrados/i.test(error.message)) {
        throw new ErroDeAplicacao('Palpites encerrados: a bola já rolou.', 'palpite_encerrado');
      }
      erroDoSupabase(error, 'Falha ao salvar o palpite');
    }
    const linha = ((data ?? []) as LinhaPalpite[])[0];
    if (!linha) throw new ErroDeAplicacao('Falha ao salvar o palpite.', 'palpite_invalido');
    return paraPalpite(linha);
  }

  async resumoDosPalpites(partidaId: string): Promise<ResumoDePalpites> {
    const { data, error } = await this.db.rpc('resumo_palpites', { p_partida_id: partidaId });
    if (error) erroDoSupabase(error, 'Falha ao carregar os palpites da torcida');
    const linha = ((data ?? []) as LinhaResumoDePalpites[])[0];
    const n = (v: number | string | null | undefined) => Number(v ?? 0);
    if (!linha) {
      return { total: 0, vitoriaMandante: 0, empate: 0, vitoriaVisitante: 0, placarPopular: null };
    }
    return {
      total: n(linha.total),
      vitoriaMandante: n(linha.vitoria_mandante),
      empate: n(linha.empate),
      vitoriaVisitante: n(linha.vitoria_visitante),
      placarPopular:
        linha.gols_mandante !== null && linha.gols_visitante !== null
          ? {
              golsMandante: linha.gols_mandante,
              golsVisitante: linha.gols_visitante,
              votos: n(linha.votos_placar),
            }
          : null,
    };
  }

  // ---------------------------------------------------------------- arquibancada: ranking

  async periodosDoRanking(): Promise<PeriodoDoRanking[]> {
    const { data, error } = await this.db.rpc('periodos_do_ranking', { p_limite: 12 });
    if (error) erroDoSupabase(error, 'Falha ao carregar os períodos do ranking');
    return ((data ?? []) as { periodo: string; jogos: number; temporada: number }[]).map((p) => ({
      periodo: p.periodo,
      jogos: Number(p.jogos),
      temporada: Number(p.temporada),
    }));
  }

  /**
   * Top N + a faixa em volta do usuário. As duas leituras são lookup de índice: a apuração
   * já congelou a posição de cada um quando o jogo terminou, então aqui não há agregação
   * nenhuma — é o que permite a tela abrir igual com dez ou com um milhão de palpiteiros.
   */
  async rankingDePalpites(periodo: string, limite = 20): Promise<RankingDePalpites> {
    const meuId = await this.meuId();
    const [topo, faixa] = await Promise.all([
      this.db.rpc('top_palpiteiros', { p_periodo: periodo, p_limite: limite }),
      meuId
        ? this.db.rpc('minha_faixa_no_ranking', { p_periodo: periodo, p_vizinhos: 2 })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (topo.error) erroDoSupabase(topo.error, 'Falha ao carregar o ranking');
    const linhasTopo = ((topo.data ?? []) as LinhaDoRanking[]).map(paraPalpiteiro);
    const linhasFaixa = ((faixa.data ?? []) as LinhaDoRanking[]).map(paraPalpiteiro);
    return {
      periodo,
      topo: linhasTopo.map((p) => ({ ...p, souEu: p.usuario.id === meuId })),
      // quem já aparece no topo não precisa da faixa repetida embaixo
      minhaFaixa: linhasFaixa.some((p) => p.souEu && p.posicao <= limite) ? [] : linhasFaixa,
    };
  }

  async podioDaPartida(partidaId: string, limite = 10): Promise<PalpiteiroDaPartida[]> {
    const { data, error } = await this.db.rpc('podio_da_partida', {
      p_partida_id: partidaId,
      p_limite: limite,
    });
    if (error) erroDoSupabase(error, 'Falha ao carregar o pódio do jogo');
    return (
      (data ?? []) as {
        posicao: number;
        usuario_id: string;
        apelido: string;
        nome: string;
        avatar_url: string | null;
        gols_mandante: number;
        gols_visitante: number;
        pontos: number;
        resultado: ResultadoDoPalpite;
      }[]
    ).map((r) => ({
      posicao: Number(r.posicao),
      usuario: { id: r.usuario_id, apelido: r.apelido, nome: r.nome, avatarUrl: r.avatar_url },
      golsMandante: r.gols_mandante,
      golsVisitante: r.gols_visitante,
      pontos: Number(r.pontos),
      resultado: r.resultado,
    }));
  }

  async titulosDoUsuario(usuarioId: Id): Promise<Titulo[]> {
    const { data, error } = await this.db.rpc('titulos_do_usuario', { p_usuario_id: usuarioId });
    if (error) erroDoSupabase(error, 'Falha ao carregar os títulos');
    return ((data ?? []) as { periodo: string; posicao: number; pontos: number }[]).map((t) => ({
      periodo: t.periodo,
      posicao: Number(t.posicao),
      pontos: Number(t.pontos),
    }));
  }

  // ---------------------------------------------------------------- arquibancada: ligas

  async minhasLigas(periodo?: string): Promise<Liga[]> {
    await this.meuIdOuErro();
    const { data, error } = await this.db.rpc('minhas_ligas', { p_periodo: periodo ?? null });
    if (error) erroDoSupabase(error, 'Falha ao carregar suas ligas');
    return ((data ?? []) as LinhaDeLiga[]).map(paraLiga);
  }

  async criarLiga(nome: string): Promise<Liga> {
    await this.meuIdOuErro();
    const { data, error } = await this.db.rpc('criar_liga', { p_nome: nome.trim() });
    if (error) erroDoSupabase(error, 'Falha ao criar a liga');
    const linha = ((data ?? []) as LinhaDeLiga[])[0];
    if (!linha) throw new ErroDeAplicacao('Falha ao criar a liga.', 'liga_invalida');
    return paraLiga(linha);
  }

  async entrarNaLiga(codigo: string): Promise<Liga> {
    await this.meuIdOuErro();
    const { data, error } = await this.db.rpc('entrar_na_liga', {
      p_codigo: codigo.trim().toUpperCase(),
    });
    if (error) erroDoSupabase(error, 'Falha ao entrar na liga');
    const linha = ((data ?? []) as LinhaDeLiga[])[0];
    if (!linha) throw new ErroDeAplicacao('Não existe liga com esse código.', 'liga_invalida');
    return paraLiga(linha);
  }

  async sairDaLiga(ligaId: Id): Promise<void> {
    await this.meuIdOuErro();
    const { error } = await this.db.rpc('sair_da_liga', { p_liga_id: ligaId });
    if (error) erroDoSupabase(error, 'Falha ao sair da liga');
  }

  async rankingDaLiga(ligaId: Id, periodo?: string): Promise<Palpiteiro[]> {
    const { data, error } = await this.db.rpc('ranking_da_liga', {
      p_liga_id: ligaId,
      p_periodo: periodo ?? null,
    });
    if (error) erroDoSupabase(error, 'Falha ao carregar o ranking da liga');
    return ((data ?? []) as LinhaDoRanking[]).map(paraPalpiteiro);
  }

  // ---------------------------------------------------------------- segurança

  async report(denuncia: NovaDenuncia): Promise<Denuncia> {
    const meuId = await this.meuIdOuErro();
    const { data, error } = await this.db
      .from('reports')
      .insert({
        denunciante_id: meuId,
        tipo_alvo: denuncia.tipoAlvo,
        alvo_id: denuncia.alvoId,
        motivo: denuncia.motivo,
        detalhes: denuncia.detalhes?.trim() ?? '',
      })
      .select('*')
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao enviar denúncia');
    const d = data as {
      id: string;
      tipo_alvo: Denuncia['tipoAlvo'];
      alvo_id: string;
      motivo: Denuncia['motivo'];
      detalhes: string;
      criado_em: string;
    };
    return {
      id: d.id,
      tipoAlvo: d.tipo_alvo,
      alvoId: d.alvo_id,
      motivo: d.motivo,
      detalhes: d.detalhes,
      criadoEm: d.criado_em,
    };
  }

  async bloquear(usuarioId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    if (usuarioId === meuId) return;
    const { error } = await this.db
      .from('blocks')
      .upsert(
        { usuario_id: meuId, bloqueado_id: usuarioId },
        { onConflict: 'usuario_id,bloqueado_id', ignoreDuplicates: true },
      );
    if (error) erroDoSupabase(error, 'Falha ao bloquear');
    this.esquecerBloqueados();
    await Promise.all([
      this.db.from('follows').delete().eq('seguidor_id', meuId).eq('seguido_id', usuarioId),
      this.db.from('follows').delete().eq('seguidor_id', usuarioId).eq('seguido_id', meuId),
    ]);
  }

  async desbloquear(usuarioId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    await this.db.from('blocks').delete().eq('usuario_id', meuId).eq('bloqueado_id', usuarioId);
    this.esquecerBloqueados();
  }

  async listBloqueados(): Promise<Usuario[]> {
    const meuId = await this.meuIdOuErro();
    const { data } = await this.db
      .from('blocks')
      .select(`perfil:profiles!blocks_bloqueado_id_fkey(${COLUNAS_PERFIL})`)
      .eq('usuario_id', meuId);
    return ((data ?? []) as unknown as { perfil: LinhaPerfil | null }[])
      .map((l) => l.perfil)
      .filter((p): p is LinhaPerfil => !!p)
      .map(paraUsuario);
  }
}
