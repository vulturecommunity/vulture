import { File } from 'expo-file-system';

import { DURACAO_FOTO_SEGUNDOS, type Interesse, type Reacao } from '@/constants/interesses';
import { gerarThumbnail, tipoMimeDe } from '@/services/midia/arquivos';
import type {
  Comentario,
  Denuncia,
  HashtagTrending,
  Id,
  Live,
  MensagemLive,
  Notificacao,
  Pagina,
  Perfil,
  RankingTorcedor,
  Sessao,
  Usuario,
  Video,
} from '@/types';
import { ErroDeAplicacao } from '@/utils/erros';
import { normalizarHashtag } from '@/utils/hashtags';
import { novoId } from '@/utils/ids';
import { apelidoValido, normalizarApelido } from '@/utils/validacao';

import type {
  AtualizacaoDePerfil,
  CancelarAssinatura,
  DadosDeCadastro,
  DataService,
  EventoDaLive,
  NovaDenuncia,
  NovoVideo,
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
  tipo: 'curtida' | 'comentario' | 'seguiu' | 'sistema';
  de_id: string | null;
  video_id: string | null;
  texto: string;
  lida: boolean;
  criado_em: string;
  de?: LinhaPerfilResumo | null;
}

// profiles tem privilégio por coluna no Postgres (email fica fora): nunca usar '*' nessa tabela.
const COLUNAS_PERFIL =
  'id, apelido, nome, avatar_url, bio, interesses, seguidores_count, seguindo_count, curtidas_recebidas, videos_count, criado_em';
const SELECAO_AUTOR = 'autor:profiles!videos_autor_id_fkey(id, apelido, nome, avatar_url)';
const SELECAO_VIDEO = `*, ${SELECAO_AUTOR}`;
const LIMITE_PADRAO = 10;

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

  private async montarSessao(usuarioId: string, visitante: boolean): Promise<Sessao> {
    // o perfil é criado por trigger logo após o cadastro; tenta algumas vezes
    let linha: LinhaPerfil | null = null;
    for (let tentativa = 0; tentativa < 5 && !linha; tentativa++) {
      const { data } = await this.db
        .from('profiles')
        .select(COLUNAS_PERFIL)
        .eq('id', usuarioId)
        .maybeSingle();
      linha = (data as LinhaPerfil | null) ?? null;
      if (!linha) await new Promise((r) => setTimeout(r, 300));
    }
    if (!linha)
      throw new ErroDeAplicacao('Perfil ainda não criado. Tente novamente.', 'perfil_ausente');
    const usuario = paraUsuario(linha);
    return { usuario, visitante, onboardingConcluido: visitante || usuario.interesses.length > 0 };
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

  private async idsBloqueados(): Promise<string[]> {
    const meuId = await this.meuId();
    if (!meuId) return [];
    const { data } = await this.db.from('blocks').select('bloqueado_id').eq('usuario_id', meuId);
    return ((data ?? []) as { bloqueado_id: string }[]).map((b) => b.bloqueado_id);
  }

  private async enviarArquivo(
    bucket: 'videos' | 'thumbnails' | 'avatars',
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
    return this.montarSessao(data.user.id, false);
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
    return this.montarSessao(data.user.id, false);
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

  async sair(): Promise<void> {
    await this.db.auth.signOut();
  }

  async sessaoAtual(): Promise<Sessao | null> {
    const { data } = await this.db.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) return null;
    try {
      return await this.montarSessao(usuario.id, !!usuario.is_anonymous);
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
    return this.montarSessao(meuId, !!data.session?.user.is_anonymous);
  }

  // ---------------------------------------------------------------- feed e vídeos

  async listFeed(params: ParametrosDoFeed): Promise<Pagina<Video>> {
    const limite = params.limite ?? LIMITE_PADRAO;
    let consulta = this.db
      .from('videos')
      .select(SELECAO_VIDEO)
      .order('criado_em', { ascending: false })
      .limit(limite + 1);
    if (params.cursor) consulta = consulta.lt('criado_em', params.cursor);
    if (params.hashtag)
      consulta = consulta.contains('hashtags_norm', [normalizarHashtag(params.hashtag)]);
    if (params.categoria) consulta = consulta.eq('categoria', params.categoria);
    if (params.aba === 'seguindo') {
      const meuId = await this.meuId();
      if (!meuId) return { itens: [], proximoCursor: null };
      const { data: seguindo } = await this.db
        .from('follows')
        .select('seguido_id')
        .eq('seguidor_id', meuId);
      const ids = ((seguindo ?? []) as { seguido_id: string }[]).map((s) => s.seguido_id);
      if (ids.length === 0) return { itens: [], proximoCursor: null };
      consulta = consulta.in('autor_id', ids);
    }
    const bloqueados = await this.idsBloqueados();
    if (bloqueados.length > 0)
      consulta = consulta.not('autor_id', 'in', `(${bloqueados.join(',')})`);

    const { data, error } = await consulta;
    if (error) erroDoSupabase(error, 'Falha ao carregar o feed');
    const linhas = (data ?? []) as unknown as LinhaVideo[];
    const temMais = linhas.length > limite;
    const pagina = temMais ? linhas.slice(0, limite) : linhas;
    const itens = await this.decorarVideos(pagina);
    return { itens, proximoCursor: temMais ? pagina[pagina.length - 1].criado_em : null };
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
      this.db.storage.from('videos').remove([`${meuId}/${id}.mp4`]),
      this.db.storage.from('thumbnails').remove([`${meuId}/${id}.jpg`]),
    ]);
  }

  async registrarVisualizacao(id: Id): Promise<void> {
    await this.db.rpc('incrementar_visualizacao', { p_video_id: id });
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
        espectadores: 1,
      })
      .select(this.selecaoLive)
      .single();
    if (error || !data) erroDoSupabase(error, 'Falha ao iniciar a live');
    return paraLive(data as unknown as LinhaLive);
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

  assinarLive(liveId: Id, aoReceber: (evento: EventoDaLive) => void): CancelarAssinatura {
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
          if (!linha.ativa) aoReceber({ tipo: 'encerrada' });
          else aoReceber({ tipo: 'espectadores', total: linha.espectadores ?? 0 });
        },
      )
      .subscribe();
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
      texto: n.texto,
      lida: n.lida,
      criadoEm: n.criado_em,
    }));
  }

  async marcarNotificacoesComoLidas(): Promise<void> {
    const meuId = await this.meuIdOuErro();
    await this.db
      .from('notifications')
      .update({ lida: true })
      .eq('para_id', meuId)
      .eq('lida', false);
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
    await Promise.all([
      this.db.from('follows').delete().eq('seguidor_id', meuId).eq('seguido_id', usuarioId),
      this.db.from('follows').delete().eq('seguidor_id', usuarioId).eq('seguido_id', meuId),
    ]);
  }

  async desbloquear(usuarioId: Id): Promise<void> {
    const meuId = await this.meuIdOuErro();
    await this.db.from('blocks').delete().eq('usuario_id', meuId).eq('bloqueado_id', usuarioId);
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
