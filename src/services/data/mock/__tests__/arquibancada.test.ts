import AsyncStorage from '@react-native-async-storage/async-storage';

import { ArmazenamentoMock } from '../banco';
import { MockDataService } from '../MockDataService';

let contador = 0;
function criarServico() {
  contador = 0;
  return new MockDataService({
    armazenamento: new ArmazenamentoMock('teste.arquibancada'),
    latenciaMs: 0,
    botsNaLive: false,
    gerarId: () => `id-${++contador}`,
  });
}

const daqui = (horas: number) => new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();

describe('Arquibancada no MockDataService', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
    await servico.cadastrar({ email: 'ana@teste.com', senha: '123456', nome: 'Ana' });
  });

  describe('resenha', () => {
    it('abre com a resenha de demonstração, só posts raiz e do mais novo ao mais antigo', async () => {
      const { itens } = await servico.listPosts({ limite: 50 });
      expect(itens.length).toBeGreaterThan(3);
      expect(itens.every((p) => p.paiId === null)).toBe(true);
      const datas = itens.map((p) => p.criadoEm);
      expect([...datas].sort().reverse()).toEqual(datas);
    });

    it('publica post com hashtags e jogo marcado; recusa vazio e longo', async () => {
      const post = await servico.publicarPost({
        texto: '  Bora, Mengão! #VamosFlamengo #Maracanã ',
        partida: { id: 'espn-1', rotulo: 'FLA x FLU' },
      });
      expect(post.texto).toBe('Bora, Mengão! #VamosFlamengo #Maracanã');
      expect(post.hashtags).toEqual(['VamosFlamengo', 'Maracanã']);
      expect(post.autor.nome).toBe('Ana');
      expect((await servico.listPosts({})).itens[0].id).toBe(post.id);

      await expect(servico.publicarPost({ texto: '   ' })).rejects.toThrow('Escreva alguma coisa');
      await expect(servico.publicarPost({ texto: 'x'.repeat(281) })).rejects.toThrow('280');
    });

    it('filtra por hashtag (sem diferenciar maiúsculas) e por jogo', async () => {
      await servico.publicarPost({
        texto: 'Que jogo! #Golaço',
        partida: { id: 'espn-9', rotulo: 'FLA x SAN' },
      });
      const porTag = await servico.listPosts({ hashtag: 'golaço' });
      expect(porTag.itens.length).toBeGreaterThanOrEqual(1);
      expect(porTag.itens.every((p) => p.hashtags.some((h) => h.toLowerCase() === 'golaço'))).toBe(
        true,
      );
      const porJogo = await servico.listPosts({ partidaId: 'espn-9' });
      expect(porJogo.itens.map((p) => p.texto)).toEqual(['Que jogo! #Golaço']);
    });

    it('pagina pelo cursor', async () => {
      const primeira = await servico.listPosts({ limite: 3 });
      expect(primeira.itens).toHaveLength(3);
      expect(primeira.proximoCursor).not.toBeNull();
      const segunda = await servico.listPosts({ limite: 3, cursor: primeira.proximoCursor });
      expect(segunda.itens[0].id).not.toBe(primeira.itens[0].id);
    });

    it('respostas ficam na thread, contam no post raiz e responder uma resposta cai no raiz', async () => {
      const raiz = await servico.publicarPost({ texto: 'Quem vai no jogo?' });
      const r1 = await servico.publicarPost({ texto: 'Eu!', paiId: raiz.id });
      const r2 = await servico.publicarPost({ texto: 'Eu também', paiId: r1.id });
      expect(r2.paiId).toBe(raiz.id);
      expect((await servico.getPost(raiz.id)).respostas).toBe(2);
      expect((await servico.listRespostas(raiz.id)).map((p) => p.texto)).toEqual([
        'Eu!',
        'Eu também',
      ]);
      expect((await servico.listPosts({ limite: 100 })).itens.some((p) => p.id === r1.id)).toBe(
        false,
      );
    });

    it('curtir e descurtir mexem no contador uma vez só', async () => {
      const { itens } = await servico.listPosts({ limite: 1 });
      const antes = itens[0].curtidas;
      await servico.curtirPost(itens[0].id);
      await servico.curtirPost(itens[0].id);
      let post = await servico.getPost(itens[0].id);
      expect(post.curtidas).toBe(antes + 1);
      expect(post.curtido).toBe(true);
      await servico.descurtirPost(itens[0].id);
      await servico.descurtirPost(itens[0].id);
      post = await servico.getPost(itens[0].id);
      expect(post.curtidas).toBe(antes);
      expect(post.curtido).toBe(false);
    });

    it('resposta e curtida viram notificação para o autor, abrindo a thread', async () => {
      const raiz = await servico.publicarPost({ texto: 'Meu primeiro post' });
      await servico.sair();
      await servico.cadastrar({ email: 'bia@teste.com', senha: '123456', nome: 'Bia' });
      await servico.publicarPost({ texto: 'Bem-vinda!', paiId: raiz.id });
      await servico.curtirPost(raiz.id);
      await servico.sair();
      await servico.entrar('ana@teste.com', '123456');
      const notificacoes = (await servico.listNotificacoes()).filter((n) => n.postId);
      expect(notificacoes.map((n) => n.texto)).toEqual(
        expect.arrayContaining([
          'curtiu seu post na Arquibancada',
          'respondeu seu post: "Bem-vinda!"',
        ]),
      );
      expect(notificacoes.every((n) => n.postId === raiz.id)).toBe(true);
    });

    it('só o autor exclui; excluir o raiz leva as respostas junto', async () => {
      const raiz = await servico.publicarPost({ texto: 'Vou apagar' });
      const resposta = await servico.publicarPost({ texto: 'resposta', paiId: raiz.id });
      const alheio = (await servico.listPosts({ limite: 50 })).itens.find(
        (p) => p.autorId !== raiz.autorId,
      )!;
      await expect(servico.excluirPost(alheio.id)).rejects.toThrow('seus posts');

      await servico.excluirPost(resposta.id);
      expect((await servico.getPost(raiz.id)).respostas).toBe(0);
      const outra = await servico.publicarPost({ texto: 'outra', paiId: raiz.id });
      await servico.excluirPost(raiz.id);
      await expect(servico.getPost(raiz.id)).rejects.toThrow('não encontrado');
      await expect(servico.getPost(outra.id)).rejects.toThrow('não encontrado');
    });

    it('publica com fotos (acompanhando o envio), só com GIF e resposta só com mídia', async () => {
      const etapas: string[] = [];
      const comFotos = await servico.publicarPost(
        {
          texto: 'Maracanã lotado',
          midias: [
            { tipo: 'imagem', uriLocal: 'file:///a.jpg', largura: 1080, altura: 720 },
            { tipo: 'imagem', uriLocal: 'file:///b.jpg', largura: 720, altura: 1080 },
          ],
        },
        (_f, etapa) => etapas.push(etapa),
      );
      expect(comFotos.midias).toHaveLength(2);
      expect(comFotos.midias[0]).toMatchObject({ tipo: 'imagem', largura: 1080, altura: 720 });
      expect(etapas).toEqual(['Enviando 1 de 2', 'Enviando 2 de 2', 'Publicado']);

      const soGif = await servico.publicarPost({
        texto: '',
        midias: [
          { tipo: 'gif', url: 'https://media1.giphy.com/x.webp', largura: 356, altura: 200 },
        ],
      });
      expect(soGif.texto).toBe('');
      expect(soGif.midias[0]).toMatchObject({
        tipo: 'gif',
        url: 'https://media1.giphy.com/x.webp',
      });

      const video = await servico.publicarPost({
        texto: '',
        paiId: comFotos.id,
        midias: [
          {
            tipo: 'video',
            uriLocal: 'file:///v.mp4',
            largura: 720,
            altura: 1280,
            duracao: 12.4,
            tamanhoBytes: 4_000_000,
          },
        ],
      });
      expect(video.paiId).toBe(comFotos.id);
      expect(video.midias[0]).toMatchObject({ tipo: 'video', duracao: 12 });
      expect(video.midias[0].thumbnailUrl).not.toBeNull();
    });

    it('recusa post vazio sem mídia e combinações proibidas', async () => {
      await expect(servico.publicarPost({ texto: '', midias: [] })).rejects.toThrow(
        'Escreva alguma coisa',
      );
      await expect(
        servico.publicarPost({
          texto: 'vídeo + foto',
          midias: [
            { tipo: 'imagem', uriLocal: 'file:///a.jpg', largura: 10, altura: 10 },
            {
              tipo: 'video',
              uriLocal: 'file:///v.mp4',
              largura: null,
              altura: null,
              duracao: 5,
              tamanhoBytes: 1000,
            },
          ],
        }),
      ).rejects.toThrow('sozinhos');
    });

    it('posts de quem eu bloqueei somem da resenha e da thread', async () => {
      const { itens } = await servico.listPosts({ limite: 50 });
      const autor = itens[0].autorId;
      await servico.bloquear(autor);
      const depois = await servico.listPosts({ limite: 50 });
      expect(depois.itens.some((p) => p.autorId === autor)).toBe(false);
    });
  });

  describe('palpites', () => {
    it('salva, troca e lista só os meus', async () => {
      await servico.salvarPalpite({
        partidaId: 'espn-1',
        inicioDaPartida: daqui(24),
        golsMandante: 2,
        golsVisitante: 1,
      });
      await servico.salvarPalpite({
        partidaId: 'espn-1',
        inicioDaPartida: daqui(24),
        golsMandante: 3,
        golsVisitante: 0,
      });
      const meus = await servico.listMeusPalpites(['espn-1', 'espn-2']);
      expect(meus).toHaveLength(1);
      expect(meus[0]).toMatchObject({ partidaId: 'espn-1', golsMandante: 3, golsVisitante: 0 });
    });

    it('recusa depois do apito e placar inválido', async () => {
      await expect(
        servico.salvarPalpite({
          partidaId: 'espn-1',
          inicioDaPartida: daqui(-1),
          golsMandante: 1,
          golsVisitante: 0,
        }),
      ).rejects.toThrow('a bola já rolou');
      await expect(
        servico.salvarPalpite({
          partidaId: 'espn-1',
          inicioDaPartida: daqui(1),
          golsMandante: 21,
          golsVisitante: 0,
        }),
      ).rejects.toThrow('0 a 20');
    });

    it('o resumo junta os perfis da demo com o meu palpite e não muda entre aberturas', async () => {
      const antes = await servico.resumoDosPalpites('espn-77');
      expect(antes.total).toBeGreaterThan(0);
      expect(await servico.resumoDosPalpites('espn-77')).toEqual(antes);
      await servico.salvarPalpite({
        partidaId: 'espn-77',
        inicioDaPartida: daqui(5),
        golsMandante: 4,
        golsVisitante: 4,
      });
      const depois = await servico.resumoDosPalpites('espn-77');
      expect(depois.total).toBe(antes.total + 1);
      expect(depois.empate).toBe(antes.empate + 1);
    });
  });
});
