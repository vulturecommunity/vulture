import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import TelaArquibancada from '@/app/arquibancada/index';
import TelaNovoPost from '@/app/arquibancada/novo';
import TelaDoPost from '@/app/arquibancada/post/[id]';
import { CalendarioDeJogos } from '@/components/arquibancada/CalendarioDeJogos';
import { ListaDaResenha } from '@/components/arquibancada/ListaDaResenha';
import { MidiasDoPost } from '@/components/arquibancada/MidiasDoPost';
import { SheetDeDenuncia } from '@/components/seguranca/SheetDeDenuncia';
import { definirCalendarioService, type Partida } from '@/services/partidas';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

import { congelarORelogio, criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

async function entrarComoVisitante() {
  const servico = criarServicoDeTeste();
  await useAuthStore.getState().entrarComoVisitante();
  return servico;
}

const HORA = 60 * 60 * 1000;

congelarORelogio();

/** Um jogo encerrado e um futuro no mesmo mês, e um no mês seguinte. */
function temporadaDeTeste(): Partida[] {
  const encerrado = new Date(Date.now() - 24 * HORA);
  const futuro = new Date(Date.now() + 3 * 24 * HORA);
  const agora = new Date();
  const proximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 12, 19, 0);
  return [
    {
      id: 'espn-a',
      competicao: 'Brasileirão',
      mandante: 'Remo',
      visitante: 'Flamengo',
      siglas: { mandante: 'REM', visitante: 'FLA' },
      dataHora: encerrado.toISOString(),
      estadio: 'Mangueirão',
      placar: { mandante: 0, visitante: 1 },
      status: 'encerrada',
    },
    {
      id: 'espn-b',
      competicao: 'Libertadores',
      fase: 'Semifinal',
      mandante: 'Flamengo',
      visitante: 'Estudiantes',
      siglas: { mandante: 'FLA', visitante: 'EST' },
      dataHora: futuro.toISOString(),
      estadio: 'Maracanã',
      placar: null,
      status: 'agendada',
    },
    {
      id: 'espn-c',
      competicao: 'Brasileirão',
      mandante: 'Flamengo',
      visitante: 'Fluminense',
      siglas: { mandante: 'FLA', visitante: 'FLU' },
      dataHora: proximoMes.toISOString(),
      estadio: 'Maracanã',
      placar: null,
      status: 'agendada',
    },
  ].sort((a, b) => a.dataHora.localeCompare(b.dataHora)) as Partida[];
}

describe('arquibancada', () => {
  afterEach(() => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    definirCalendarioService(null);
    useUiStore.setState({ alvoParaDenuncia: null });
  });

  it('resenha: lista os posts, curte, filtra por hashtag e abre a thread', async () => {
    await entrarComoVisitante();
    const aoMudarFiltro = jest.fn();
    await renderizar(<ListaDaResenha filtro={null} aoMudarFiltro={aoMudarFiltro} />);

    expect(await screen.findByText(/Quem vai estar no Maracanã/)).toBeTruthy();
    expect(screen.getByText('O que tá rolando, torcedor?')).toBeTruthy();

    // curtir atualiza o contador na hora (otimista)
    expect(screen.getByText('214')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('curtir-post-post-seed-1'));
    expect(await screen.findByText('215')).toBeTruthy();

    await fireEvent.press(screen.getByText('#VamosFlamengo'));
    expect(aoMudarFiltro).toHaveBeenCalledWith({ tipo: 'hashtag', tag: 'VamosFlamengo' });

    await fireEvent.press(screen.getByTestId('responder-post-post-seed-1'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/arquibancada/post/[id]',
      params: { id: 'post-seed-1' },
    });
    await fireEvent.press(screen.getByTestId('botao-novo-post'));
    expect(router.push).toHaveBeenCalledWith('/arquibancada/novo');
  });

  it('resenha filtrada pelo jogo mostra o filtro e deixa limpar', async () => {
    const servico = await entrarComoVisitante();
    await servico.publicarPost({
      texto: 'Vai dar Mengão',
      partida: { id: 'espn-b', rotulo: 'FLA x EST' },
    });
    const aoMudarFiltro = jest.fn();
    await renderizar(
      <ListaDaResenha
        filtro={{ tipo: 'partida', id: 'espn-b', rotulo: 'FLA x EST' }}
        aoMudarFiltro={aoMudarFiltro}
      />,
    );
    expect(await screen.findByText('Vai dar Mengão')).toBeTruthy();
    expect(screen.getByText('Resenha do jogo FLA x EST')).toBeTruthy();
    expect(screen.queryByText(/Quem vai estar no Maracanã/)).toBeNull();
    await fireEvent.press(screen.getByTestId('limpar-filtro'));
    expect(aoMudarFiltro).toHaveBeenCalledWith(null);
  });

  it('escrever: conta caracteres, marca o jogo e publica', async () => {
    const servico = await entrarComoVisitante();
    definirCalendarioService({ listarTemporada: async () => temporadaDeTeste() });
    await renderizar(<TelaNovoPost />);

    expect(screen.getByTestId('botao-publicar-post')).toBeDisabled();
    await fireEvent.changeText(
      screen.getByTestId('campo-post'),
      'Semifinal chegando #Libertadores',
    );
    expect(screen.getByTestId('contador-post')).toHaveTextContent('248');

    await fireEvent.press(await screen.findByText('Marcar FLA x EST'));
    expect(screen.getByText('Sobre FLA x EST')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('botao-publicar-post'));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const { itens } = await servico.listPosts({ partidaId: 'espn-b' });
    expect(itens[0]).toMatchObject({
      texto: 'Semifinal chegando #Libertadores',
      hashtags: ['Libertadores'],
      partida: { id: 'espn-b', rotulo: 'FLA x EST' },
    });
  });

  it('thread: mostra o post, as respostas e responde', async () => {
    await entrarComoVisitante();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'post-seed-1' });
    await renderizar(<TelaDoPost />);

    expect(await screen.findByText(/Quem vai estar no Maracanã/)).toBeTruthy();
    expect(await screen.findByText('Presente! Setor norte como sempre 🙌')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('campo-resposta'), 'Tô dentro!');
    await fireEvent.press(screen.getByTestId('botao-enviar-resposta'));
    expect(await screen.findByText('Tô dentro!')).toBeTruthy();
    expect(screen.getByTestId('campo-resposta').props.value).toBe('');
  });

  it('meu post oferece "Excluir meu post"; o de outra pessoa, denunciar e bloquear', async () => {
    const servico = await entrarComoVisitante();
    const meu = await servico.publicarPost({ texto: 'Post meu' });
    await renderizar(<SheetDeDenuncia />);

    useUiStore.getState().abrirDenuncia({ tipo: 'post', id: meu.id, autorId: meu.autorId });
    expect(await screen.findByText('Excluir meu post')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('opcao-excluir'));
    await waitFor(() => expect(useUiStore.getState().alvoParaDenuncia).toBeNull());
    await expect(servico.getPost(meu.id)).rejects.toThrow('não encontrado');

    useUiStore.getState().abrirDenuncia({
      tipo: 'post',
      id: 'post-seed-1',
      autorId: 'u-nacao',
      autorApelido: 'nacao_rubro',
    });
    expect(await screen.findByTestId('opcao-denunciar')).toBeTruthy();
    expect(screen.getByText('Bloquear @nacao_rubro')).toBeTruthy();
    expect(screen.queryByText('Excluir meu post')).toBeNull();
  });

  it('jogos: destaque com contagem, resultado V/E/D, palpite e resumo da torcida', async () => {
    await entrarComoVisitante();
    definirCalendarioService({ listarTemporada: async () => temporadaDeTeste() });
    const aoVerResenha = jest.fn();
    await renderizar(<CalendarioDeJogos aoVerResenha={aoVerResenha} />);

    expect(await screen.findByTestId('destaque-jogo')).toBeTruthy();
    expect(screen.getByTestId('contagem-regressiva')).toHaveTextContent(/Faltam/);
    expect(screen.getByTestId('resultado-espn-a')).toHaveTextContent('V');
    expect(screen.getByTestId('resumo-do-mes')).toHaveTextContent(/1-0-0/);

    // o palpite abre sem mostrar a aposta da torcida (para não influenciar)
    await fireEvent.press(screen.getByTestId('destaque-palpitar'));
    expect(await screen.findByText('Confirmar palpite')).toBeTruthy();
    expect(screen.queryByTestId('resumo-palpites')).toBeNull();
    await fireEvent.press(screen.getByTestId('gols-mandante-mais'));
    await fireEvent.press(screen.getByTestId('gols-mandante-mais'));
    await fireEvent.press(screen.getByTestId('gols-visitante-mais'));
    expect(screen.getByTestId('gols-mandante')).toHaveTextContent('2');
    await fireEvent.press(screen.getByTestId('botao-salvar-palpite'));

    expect(await screen.findByTestId('palpite-registrado')).toBeTruthy();
    expect(await screen.findByTestId('resumo-palpites')).toBeTruthy();
    expect(screen.getByText('Trocar palpite')).toBeTruthy();
    expect(screen.getAllByText('Seu palpite: 2 x 1').length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByTestId('resenha-espn-a'));
    expect(aoVerResenha).toHaveBeenCalledWith(expect.objectContaining({ id: 'espn-a' }));
  });

  it('jogos: navega entre os meses que têm jogo', async () => {
    await entrarComoVisitante();
    definirCalendarioService({ listarTemporada: async () => temporadaDeTeste() });
    await renderizar(<CalendarioDeJogos aoVerResenha={jest.fn()} />);

    expect(await screen.findByTestId('jogo-espn-b')).toBeTruthy();
    expect(screen.queryByTestId('jogo-espn-c')).toBeNull();
    await fireEvent.press(screen.getByTestId('mes-seguinte'));
    expect(await screen.findByTestId('jogo-espn-c')).toBeTruthy();
    expect(screen.queryByTestId('jogo-espn-b')).toBeNull();
    expect(screen.getByTestId('mes-seguinte')).toBeDisabled();
  });

  it('tela: "ver resenha" de um jogo troca para a aba Resenha já filtrada', async () => {
    await entrarComoVisitante();
    definirCalendarioService({ listarTemporada: async () => temporadaDeTeste() });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ aba: 'jogos' });
    await renderizar(<TelaArquibancada />);

    await fireEvent.press(await screen.findByTestId('resenha-espn-b'));
    expect(await screen.findByText('Resenha do jogo FLA x EST')).toBeTruthy();
    expect(screen.getByTestId('aba-arquibancada-resenha')).toBeSelected();
  });
  describe('anexos', () => {
    const escolher = ImagePicker.launchImageLibraryAsync as jest.Mock;
    afterEach(() => {
      escolher.mockReset();
      escolher.mockResolvedValue({ canceled: true, assets: [] });
      delete process.env.EXPO_PUBLIC_GIPHY_KEY;
    });

    it('grade de fotos abre em tela cheia na foto tocada', async () => {
      const foto = (n: number) => ({
        tipo: 'imagem' as const,
        url: `https://x.supabase.co/storage/v1/object/public/posts/u/${n}.jpg`,
        thumbnailUrl: null,
        largura: 1080,
        altura: 720,
        duracao: null,
      });
      await renderizar(<MidiasDoPost midias={[foto(1), foto(2), foto(3)]} />);
      expect(screen.getByTestId('imagem-do-post-2')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('imagem-do-post-1'));
      expect(await screen.findByText('2 / 3')).toBeTruthy();
    });

    it('vídeo mostra a miniatura e só monta o player depois do play', async () => {
      await renderizar(
        <MidiasDoPost
          midias={[
            {
              tipo: 'video',
              url: 'https://x/v.mp4',
              thumbnailUrl: 'https://x/v.jpg',
              largura: 720,
              altura: 1280,
              duracao: 24,
            },
          ]}
        />,
      );
      expect(screen.getByText('0:24')).toBeTruthy();
      expect(screen.queryByTestId('video-view')).toBeNull();
      await fireEvent.press(screen.getByTestId('play-video-do-post'));
      expect(screen.getByTestId('video-view')).toBeTruthy();
    });

    it('anexa foto da galeria já reduzida para 1080 px e publica sem texto', async () => {
      const servico = await entrarComoVisitante();
      definirCalendarioService({ listarTemporada: async () => [] });
      escolher.mockResolvedValue({
        canceled: false,
        assets: [{ type: 'image', uri: 'file:///foto-12mp.jpg', width: 4000, height: 3000 }],
      });
      await renderizar(<TelaNovoPost />);

      await fireEvent.press(screen.getByTestId('anexar-galeria'));
      expect(await screen.findByTestId('previa-anexos')).toBeTruthy();
      expect(escolher).toHaveBeenCalledWith(
        expect.objectContaining({ mediaTypes: ['images', 'videos'], selectionLimit: 4 }),
      );
      await fireEvent.press(screen.getByTestId('botao-publicar-post'));
      await waitFor(() => expect(router.back).toHaveBeenCalled());

      const [post] = (await servico.listPosts({ limite: 1 })).itens;
      expect(post.texto).toBe('');
      expect(post.midias).toEqual([
        expect.objectContaining({ tipo: 'imagem', largura: 1080, altura: 810 }),
      ]);
    });

    it('recusa vídeo acima de 30 s na hora de escolher', async () => {
      await entrarComoVisitante();
      definirCalendarioService({ listarTemporada: async () => [] });
      escolher.mockResolvedValue({
        canceled: false,
        assets: [
          {
            type: 'video',
            uri: 'file:///longo.mp4',
            width: 720,
            height: 1280,
            duration: 95_000,
            fileSize: 9_000_000,
          },
        ],
      });
      await renderizar(<TelaNovoPost />);
      await fireEvent.press(screen.getByTestId('anexar-galeria'));
      expect(await screen.findByTestId('erro-anexo')).toHaveTextContent(/até 30 segundos/);
      expect(screen.queryByTestId('previa-anexos')).toBeNull();
    });

    it('busca GIF no GIPHY e publica com ele', async () => {
      const servico = await entrarComoVisitante();
      definirCalendarioService({ listarTemporada: async () => [] });
      process.env.EXPO_PUBLIC_GIPHY_KEY = 'chave-teste';
      const fetchOriginal = globalThis.fetch;
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'g1',
                  title: 'Gol',
                  images: {
                    fixed_height: {
                      webp: 'https://media2.giphy.com/media/g1/200.webp',
                      width: '356',
                      height: '200',
                    },
                    fixed_width_small: { webp: 'https://media2.giphy.com/media/g1/100w.webp' },
                  },
                },
              ],
            }),
        } as Response),
      ) as unknown as typeof fetch;
      try {
        await renderizar(<TelaNovoPost />);
        await fireEvent.press(screen.getByTestId('anexar-gif'));
        expect(screen.getByText('Powered by GIPHY')).toBeTruthy();
        await fireEvent.press(await screen.findByTestId('gif-g1'));
        expect(await screen.findByTestId('previa-anexos')).toBeTruthy();
        // com GIF, não dá para somar fotos
        expect(screen.getByTestId('anexar-galeria')).toBeDisabled();
        await fireEvent.changeText(screen.getByTestId('campo-post'), 'GOLAÇO');
        await fireEvent.press(screen.getByTestId('botao-publicar-post'));
        await waitFor(() => expect(router.back).toHaveBeenCalled());
        const [post] = (await servico.listPosts({ limite: 1 })).itens;
        expect(post.midias[0]).toMatchObject({
          tipo: 'gif',
          url: 'https://media2.giphy.com/media/g1/200.webp',
        });
      } finally {
        globalThis.fetch = fetchOriginal;
      }
    });

    it('sem chave do GIPHY, o botão de GIF não aparece', async () => {
      await entrarComoVisitante();
      definirCalendarioService({ listarTemporada: async () => [] });
      await renderizar(<TelaNovoPost />);
      expect(screen.getByTestId('anexar-galeria')).toBeTruthy();
      expect(screen.queryByTestId('anexar-gif')).toBeNull();
    });
  });
});
