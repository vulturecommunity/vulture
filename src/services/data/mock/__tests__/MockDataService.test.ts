import AsyncStorage from '@react-native-async-storage/async-storage';

import { ArmazenamentoMock } from '../banco';
import { MockDataService } from '../MockDataService';

let contador = 0;
function criarServico() {
  contador = 0;
  return new MockDataService({
    armazenamento: new ArmazenamentoMock('teste.banco'),
    latenciaMs: 0,
    botsNaLive: false,
    gerarId: () => `id-${++contador}`,
  });
}

describe('MockDataService', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
  });

  describe('autenticação', () => {
    it('cadastra, persiste a sessão e faz logout', async () => {
      const sessao = await servico.cadastrar({
        email: 'ana@teste.com',
        senha: '123456',
        nome: 'Ana',
      });
      expect(sessao.usuario.nome).toBe('Ana');
      expect(sessao.onboardingConcluido).toBe(false);
      expect(await servico.sessaoAtual()).not.toBeNull();

      await servico.sair();
      expect(await servico.sessaoAtual()).toBeNull();
    });

    it('rejeita e-mail inválido, senha curta e e-mail duplicado', async () => {
      await expect(servico.cadastrar({ email: 'x', senha: '123456' })).rejects.toThrow(
        'e-mail válido',
      );
      await expect(servico.cadastrar({ email: 'a@b.com', senha: '123' })).rejects.toThrow(
        '6 caracteres',
      );
      await servico.cadastrar({ email: 'a@b.com', senha: '123456' });
      await servico.sair();
      await expect(servico.cadastrar({ email: 'A@B.com', senha: '123456' })).rejects.toThrow(
        'Já existe',
      );
    });

    it('entra com e-mail/senha e rejeita credenciais erradas', async () => {
      await servico.cadastrar({ email: 'ana@teste.com', senha: '123456' });
      await servico.sair();
      await expect(servico.entrar('ana@teste.com', 'errada')).rejects.toThrow('incorretos');
      const sessao = await servico.entrar('ana@teste.com', '123456');
      expect(sessao.usuario.apelido).toBe('ana');
    });

    it('entra como visitante com onboarding concluído e já seguindo perfis', async () => {
      const sessao = await servico.entrarComoVisitante();
      expect(sessao.visitante).toBe(true);
      expect(sessao.onboardingConcluido).toBe(true);
      const seguindo = await servico.listSeguindo(sessao.usuario.id);
      expect(seguindo.length).toBeGreaterThan(0);
    });

    it('conclui o onboarding com apelido e interesses', async () => {
      await servico.cadastrar({ email: 'ana@teste.com', senha: '123456' });
      await expect(
        servico.concluirOnboarding({ apelido: 'ab', interesses: ['Jogos'] }),
      ).rejects.toThrow('Apelido inválido');
      await expect(
        servico.concluirOnboarding({ apelido: 'ana_rn', interesses: [] }),
      ).rejects.toThrow('pelo menos um interesse');
      const sessao = await servico.concluirOnboarding({
        apelido: 'Ana_RN',
        interesses: ['Jogos', 'Memes'],
      });
      expect(sessao.usuario.apelido).toBe('ana_rn');
      expect(sessao.onboardingConcluido).toBe(true);
    });

    it('a sessão sobrevive a uma nova instância (persistência)', async () => {
      await servico.entrarComoVisitante();
      const outro = new MockDataService({
        armazenamento: new ArmazenamentoMock('teste.banco'),
        latenciaMs: 0,
      });
      const sessao = await outro.sessaoAtual();
      expect(sessao?.usuario.apelido).toBe('visitante');
    });
  });

  describe('feed e vídeos', () => {
    beforeEach(async () => {
      await servico.entrarComoVisitante();
    });

    it('lista o feed "Para Você" paginado com 120 vídeos de exemplo', async () => {
      const p1 = await servico.listFeed({ aba: 'paraVoce', limite: 10 });
      expect(p1.itens).toHaveLength(10);
      expect(p1.proximoCursor).toBe('10');
      const p2 = await servico.listFeed({ aba: 'paraVoce', limite: 10, cursor: p1.proximoCursor });
      expect(p2.itens[0].id).not.toBe(p1.itens[0].id);

      let total = 0;
      let cursor: string | null = null;
      do {
        const pagina = await servico.listFeed({ aba: 'paraVoce', limite: 50, cursor });
        total += pagina.itens.length;
        cursor = pagina.proximoCursor;
      } while (cursor);
      expect(total).toBe(120);
    });

    it('feed "Seguindo" traz só vídeos de quem eu sigo', async () => {
      const pagina = await servico.listFeed({ aba: 'seguindo', limite: 50 });
      expect(pagina.itens.length).toBeGreaterThan(0);
      expect(pagina.itens.every((v) => ['u-nacao', 'u-golaco'].includes(v.autorId))).toBe(true);
    });

    it('filtra por hashtag e categoria', async () => {
      const porTag = await servico.listFeed({ aba: 'paraVoce', hashtag: '#maracanã', limite: 100 });
      expect(porTag.itens.length).toBeGreaterThan(0);
      expect(
        porTag.itens.every((v) => v.hashtags.some((h) => h.toLowerCase() === 'maracanã')),
      ).toBe(true);
      const porCategoria = await servico.listFeed({
        aba: 'paraVoce',
        categoria: 'Memes',
        limite: 100,
      });
      expect(porCategoria.itens.every((v) => v.categoria === 'Memes')).toBe(true);
    });

    it('publica um vídeo com progresso e ele aparece no feed e no perfil', async () => {
      const etapas: number[] = [];
      const video = await servico.uploadVideo(
        {
          uriLocal: 'file:///tmp/gravacao.mp4',
          tipo: 'video',
          legenda: 'Meu primeiro vídeo #Torcida #Maracanã',
          hashtags: ['Torcida', 'Maracanã'],
          categoria: 'Torcida',
          duracao: 12.6,
        },
        (fracao) => etapas.push(fracao),
      );
      expect(etapas[etapas.length - 1]).toBe(1);
      expect(etapas).toEqual([...etapas].sort((a, b) => a - b));
      expect(video.url).toContain('file:///');
      expect(video.duracao).toBe(13);

      const feed = await servico.listFeed({ aba: 'paraVoce', limite: 1 });
      expect(feed.itens[0].id).toBe(video.id);
      const meus = await servico.listVideosDoUsuario(video.autorId);
      expect(meus[0].id).toBe(video.id);
      const perfil = await servico.getProfile('eu');
      expect(perfil.totalVideos).toBe(1);
    });

    it('foto vira post de 5 segundos', async () => {
      const foto = await servico.uploadVideo({
        uriLocal: 'file:///tmp/foto.jpg',
        tipo: 'foto',
        legenda: 'Foto',
        hashtags: [],
        categoria: 'Torcida',
        duracao: 0,
      });
      expect(foto.tipo).toBe('foto');
      expect(foto.duracao).toBe(5);
      expect(foto.thumbnailUrl).toBe(foto.url);
    });

    it('só o dono exclui o vídeo', async () => {
      await expect(servico.excluirVideo('v-seed-001')).rejects.toThrow('seus vídeos');
      const meu = await servico.uploadVideo({
        uriLocal: 'file:///a.mp4',
        tipo: 'video',
        legenda: '',
        hashtags: [],
        categoria: 'Jogos',
        duracao: 3,
      });
      await servico.excluirVideo(meu.id);
      await expect(servico.getVideo(meu.id)).rejects.toThrow('não encontrado');
    });

    it('registra visualizações e compartilhamentos', async () => {
      const antes = await servico.getVideo('v-seed-001');
      await servico.registrarVisualizacao('v-seed-001');
      await servico.registrarCompartilhamento('v-seed-001');
      const depois = await servico.getVideo('v-seed-001');
      expect(depois.visualizacoes).toBe(antes.visualizacoes + 1);
      expect(depois.compartilhamentos).toBe(antes.compartilhamentos + 1);
    });
  });

  describe('interações', () => {
    beforeEach(async () => {
      await servico.entrarComoVisitante();
    });

    it('curtir e descurtir é idempotente e atualiza contadores', async () => {
      const antes = await servico.getVideo('v-seed-002');
      await servico.like('v-seed-002');
      await servico.like('v-seed-002');
      let v = await servico.getVideo('v-seed-002');
      expect(v.curtido).toBe(true);
      expect(v.curtidas).toBe(antes.curtidas + 1);
      const curtidos = await servico.listVideosCurtidos((await servico.getProfile('eu')).id);
      expect(curtidos.map((x) => x.id)).toContain('v-seed-002');

      await servico.unlike('v-seed-002');
      await servico.unlike('v-seed-002');
      v = await servico.getVideo('v-seed-002');
      expect(v.curtido).toBe(false);
      expect(v.curtidas).toBe(antes.curtidas);
    });

    it('salvar e remover dos salvos', async () => {
      await servico.salvar('v-seed-003');
      expect((await servico.listVideosSalvos()).map((v) => v.id)).toEqual(['v-seed-003']);
      expect((await servico.getVideo('v-seed-003')).salvo).toBe(true);
      await servico.removerSalvo('v-seed-003');
      expect(await servico.listVideosSalvos()).toEqual([]);
    });

    it('comenta, responde em 1 nível e exclui', async () => {
      const antes = (await servico.listComments('v-seed-001')).length;
      const c = await servico.addComment('v-seed-001', 'Mengo!');
      const r = await servico.addComment('v-seed-001', 'Isso!', c.id);
      // resposta de resposta cai no comentário raiz
      const r2 = await servico.addComment('v-seed-001', 'Também!', r.id);
      expect(r.paiId).toBe(c.id);
      expect(r2.paiId).toBe(c.id);

      const lista = await servico.listComments('v-seed-001');
      expect(lista).toHaveLength(antes + 1);
      const raiz = lista.find((x) => x.id === c.id)!;
      expect(raiz.respostas.map((x) => x.texto)).toEqual(['Isso!', 'Também!']);
      expect((await servico.getVideo('v-seed-001')).comentarios).toBeGreaterThanOrEqual(3);

      await expect(servico.addComment('v-seed-001', '   ')).rejects.toThrow('Escreva');
      await servico.excluirComentario(c.id);
      const depois = await servico.listComments('v-seed-001');
      expect(depois.find((x) => x.id === c.id)).toBeUndefined();
    });

    it('seguir e deixar de seguir atualiza contadores e notifica', async () => {
      const antes = await servico.getProfile('u-memes');
      expect(antes.estouSeguindo).toBe(false);
      await servico.follow('u-memes');
      await servico.follow('u-memes');
      const depois = await servico.getProfile('u-memes');
      expect(depois.estouSeguindo).toBe(true);
      expect(depois.seguidores).toBe(antes.seguidores + 1);
      await servico.unfollow('u-memes');
      expect((await servico.getProfile('u-memes')).seguidores).toBe(antes.seguidores);
      await expect(servico.follow((await servico.getProfile('eu')).id)).rejects.toThrow('si mesmo');
    });
  });

  describe('perfil', () => {
    it('atualiza apelido, nome, bio e interesses', async () => {
      await servico.entrarComoVisitante();
      const u = await servico.updateProfile({
        apelido: 'Novo.Apelido',
        nome: 'Novo Nome',
        bio: 'Oi',
        interesses: ['Jogos'],
      });
      expect(u.apelido).toBe('novo.apelido');
      expect(u.nome).toBe('Novo Nome');
      expect(u.bio).toBe('Oi');
      await expect(servico.updateProfile({ apelido: 'nacao_rubro' })).rejects.toThrow('em uso');
    });

    it('exige sessão para ações de escrita', async () => {
      await expect(servico.like('v-seed-001')).rejects.toThrow('precisa entrar');
      await expect(servico.getProfile('eu')).rejects.toThrow('precisa entrar');
    });
  });

  describe('explorar', () => {
    beforeEach(async () => {
      await servico.entrarComoVisitante();
    });

    it('busca usuários por apelido ou nome', async () => {
      expect((await servico.buscarUsuarios('@nacao')).map((u) => u.apelido)).toContain(
        'nacao_rubro',
      );
      expect((await servico.buscarUsuarios('Prancheta')).length).toBe(1);
      expect(await servico.buscarUsuarios('')).toEqual([]);
    });

    it('busca hashtags e lista as em alta', async () => {
      const resultado = await servico.buscarHashtags('#mara');
      expect(resultado[0].tag.toLowerCase()).toBe('maracanã');
      expect(resultado[0].totalVideos).toBeGreaterThan(0);
      const emAlta = await servico.listHashtagsEmAlta();
      expect(emAlta.length).toBeGreaterThan(3);
    });

    it('trending e ranking semanal', async () => {
      const trending = await servico.listTrending();
      expect(trending.length).toBeGreaterThan(0);
      const ranking = await servico.rankingSemanal();
      expect(ranking[0].posicao).toBe(1);
      expect(ranking[0].curtidasNaSemana).toBeGreaterThanOrEqual(
        ranking[ranking.length - 1].curtidasNaSemana,
      );
    });
  });

  describe('lives', () => {
    beforeEach(async () => {
      await servico.entrarComoVisitante();
    });

    it('lista lives ativas, cria e encerra a própria live', async () => {
      const antes = await servico.listLives();
      expect(antes.length).toBe(3);
      const live = await servico.createLive('Minha live');
      expect(live.ativa).toBe(true);
      expect((await servico.listLives()).length).toBe(4);
      await servico.encerrarLive(live.id);
      expect((await servico.listLives()).length).toBe(3);
      await expect(servico.createLive('  ')).rejects.toThrow('título');
    });

    it('chat: envia mensagem e reação, assinantes recebem em tempo real', async () => {
      const eventos: string[] = [];
      const cancelar = servico.assinarLive('l-seed-1', (e) => eventos.push(e.tipo));
      await new Promise((r) => setTimeout(r, 0));
      await servico.enviarMensagemNaLive('l-seed-1', 'Olá!');
      await servico.enviarReacaoNaLive('l-seed-1', '🦅');
      expect(eventos).toEqual(['mensagem', 'reacao']);
      const mensagens = await servico.listMensagensDaLive('l-seed-1');
      expect(mensagens[mensagens.length - 1].reacao).toBe('🦅');
      expect(mensagens[mensagens.length - 2].texto).toBe('Olá!');
      cancelar();
      await servico.enviarMensagemNaLive('l-seed-1', 'depois de sair');
      expect(eventos).toHaveLength(2);
    });

    it('espectadores entram e saem', async () => {
      const antes = (await servico.getLive('l-seed-2')).espectadores;
      await servico.entrarNaLive('l-seed-2');
      expect((await servico.getLive('l-seed-2')).espectadores).toBe(antes + 1);
      await servico.sairDaLive('l-seed-2');
      expect((await servico.getLive('l-seed-2')).espectadores).toBe(antes);
    });
  });

  describe('notificações e segurança', () => {
    it('gera notificações para o dono do vídeo e marca como lidas', async () => {
      await servico.cadastrar({ email: 'dono@teste.com', senha: '123456', apelido: 'dono' });
      await servico.concluirOnboarding({ apelido: 'dono', interesses: ['Jogos'] });
      const video = await servico.uploadVideo({
        uriLocal: 'file:///v.mp4',
        tipo: 'video',
        legenda: 'x',
        hashtags: [],
        categoria: 'Jogos',
        duracao: 5,
      });
      const donoId = (await servico.getProfile('eu')).id;
      await servico.sair();

      await servico.entrarComoVisitante();
      await servico.like(video.id);
      await servico.addComment(video.id, 'Show!');
      await servico.follow(donoId);
      await servico.sair();

      await servico.entrar('dono@teste.com', '123456');
      const notificacoes = await servico.listNotificacoes();
      const tipos = notificacoes.map((n) => n.tipo);
      expect(tipos).toEqual(expect.arrayContaining(['curtida', 'comentario', 'seguiu']));
      expect(notificacoes.some((n) => !n.lida)).toBe(true);
      await servico.marcarNotificacoesComoLidas();
      expect((await servico.listNotificacoes()).every((n) => n.lida)).toBe(true);
    });

    it('denuncia conteúdo e bloqueia usuário (some do feed e da busca)', async () => {
      await servico.entrarComoVisitante();
      const denuncia = await servico.report({
        tipoAlvo: 'video',
        alvoId: 'v-seed-001',
        motivo: 'Spam ou golpe',
        detalhes: 'teste',
      });
      expect(denuncia.id).toBeTruthy();

      await servico.bloquear('u-nacao');
      const feed = await servico.listFeed({ aba: 'paraVoce', limite: 200 });
      expect(feed.itens.some((v) => v.autorId === 'u-nacao')).toBe(false);
      expect((await servico.buscarUsuarios('nacao')).length).toBe(0);
      expect((await servico.listBloqueados()).map((u) => u.id)).toEqual(['u-nacao']);
      expect((await servico.getProfile('u-nacao')).bloqueado).toBe(true);

      await servico.desbloquear('u-nacao');
      expect(await servico.listBloqueados()).toEqual([]);
    });
  });
});

describe('MockDataService › notificações de live e tokens de push', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
  });

  it('avisa os seguidores quando o anfitrião entra ao vivo', async () => {
    await servico.cadastrar({ email: 'anfitriao@t.com', senha: '123456', apelido: 'anfitriao' });
    await servico.concluirOnboarding({ apelido: 'anfitriao', interesses: ['Jogos'] });
    const anfitriaoId = (await servico.getProfile('eu')).id;
    await servico.sair();

    await servico.entrarComoVisitante();
    await servico.follow(anfitriaoId);
    await servico.registrarTokenPush({
      token: 'ExponentPushToken[seguidor]',
      plataforma: 'android',
    });
    await servico.sair();

    await servico.entrar('anfitriao@t.com', '123456');
    const live = await servico.createLive('Resenha ao vivo');
    expect(await servico.tokensDosSeguidores(anfitriaoId)).toEqual([
      { token: 'ExponentPushToken[seguidor]', plataforma: 'android' },
    ]);
    await servico.sair();

    await servico.entrarComoVisitante();
    const notificacoes = await servico.listNotificacoes();
    const aviso = notificacoes.find((n) => n.tipo === 'live');
    expect(aviso).toMatchObject({ liveId: live.id, deId: anfitriaoId, lida: false });
    expect(aviso?.texto).toBe('está ao vivo: Resenha ao vivo');
  });

  it('o token troca de dono e some ao ser removido', async () => {
    await servico.entrarComoVisitante();
    await servico.registrarTokenPush({ token: 'tok', plataforma: 'android' });
    await servico.sair();
    await servico.cadastrar({ email: 'b@t.com', senha: '123456', apelido: 'beltrano' });
    await servico.registrarTokenPush({ token: 'tok', plataforma: 'android' });
    const meuId = (await servico.getProfile('eu')).id;
    // quem seguia... ninguém; mas o token deve pertencer só ao usuário atual
    await servico.follow('u-nacao');
    expect(await servico.tokensDosSeguidores('u-nacao')).toEqual([
      { token: 'tok', plataforma: 'android' },
    ]);
    expect(meuId).toBeTruthy();
    await servico.removerTokenPush('tok');
    expect(await servico.tokensDosSeguidores('u-nacao')).toEqual([]);
  });
});
