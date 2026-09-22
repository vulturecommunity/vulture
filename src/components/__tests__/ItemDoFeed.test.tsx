import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ItemDoFeed } from '@/components/feed/ItemDoFeed';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';

import { criarServicoDeTeste, renderizar, videoDeTeste } from './utilitarios-de-teste';

describe('ItemDoFeed', () => {
  beforeEach(() => {
    usePlayerStore.setState({ mudo: false, feedEmFoco: true });
    useUiStore.setState({ videoParaComentar: null, alvoParaDenuncia: null });
  });

  it('renderiza autor, legenda com hashtag, áudio e contadores', async () => {
    const video = videoDeTeste();
    await renderizar(<ItemDoFeed video={video} altura={800} ativo proximo={false} meuId="u-eu" />);
    expect(screen.getByText('@nacao_rubro')).toBeTruthy();
    expect(screen.getByText('#Maracanã')).toBeTruthy();
    expect(screen.getByText('Som original')).toBeTruthy();
    expect(screen.getByTestId('total-curtidas')).toHaveTextContent('1,2 mil');
    expect(screen.getByTestId('player-v-teste')).toBeTruthy();
  });

  it('esconde o nome quando ele só repete o apelido (menos poluição)', async () => {
    const igual = videoDeTeste({
      autor: { id: 'u-1', apelido: 'lucao', nome: 'LUCAO', avatarUrl: null },
    });
    await renderizar(<ItemDoFeed video={igual} altura={800} ativo proximo={false} meuId={null} />);
    expect(screen.getByText('@lucao')).toBeTruthy();
    expect(screen.queryByText('LUCAO')).toBeNull();

    const diferente = videoDeTeste({
      id: 'v-2',
      autor: { id: 'u-2', apelido: 'gavea.insider', nome: 'Gávea Insider', avatarUrl: null },
    });
    await renderizar(
      <ItemDoFeed video={diferente} altura={800} ativo proximo={false} meuId={null} />,
    );
    expect(screen.getByText('Gávea Insider')).toBeTruthy();
  });

  it('só monta o player para o item ativo ou vizinho', async () => {
    const video = videoDeTeste();
    await renderizar(
      <ItemDoFeed video={video} altura={800} ativo={false} proximo={false} meuId={null} />,
    );
    expect(screen.queryByTestId('player-v-teste')).toBeNull();
  });

  it('foto é só a imagem, sem barra de progresso', async () => {
    const foto = videoDeTeste({ id: 'f-1', tipo: 'foto', url: 'file:///foto.jpg' });
    await renderizar(<ItemDoFeed video={foto} altura={800} ativo proximo={false} meuId={null} />);
    expect(screen.getByTestId('foto-f-1')).toBeTruthy();
    expect(screen.queryByTestId('player-f-1')).toBeNull();
    // nada corre numa foto: barra ali só pareceria carregamento
    expect(screen.queryByTestId('barra-progresso')).toBeNull();
    expect(screen.queryByTestId('marcador-progresso')).toBeNull();
  });

  it('abre os comentários e o painel "mais" pelo uiStore', async () => {
    const video = videoDeTeste();
    await renderizar(<ItemDoFeed video={video} altura={800} ativo proximo={false} meuId={null} />);
    await fireEvent.press(screen.getByTestId('botao-comentar'));
    expect(useUiStore.getState().videoParaComentar).toBe('v-teste');
    await fireEvent.press(screen.getByTestId('botao-mais'));
    expect(useUiStore.getState().alvoParaDenuncia).toMatchObject({ tipo: 'video', id: 'v-teste' });
  });

  it('curtir pelo botão lateral atualiza o serviço de dados', async () => {
    const servico = criarServicoDeTeste();
    await servico.entrarComoVisitante();
    const video = videoDeTeste({ id: 'v-seed-001', curtidas: 5 });
    await renderizar(
      <ItemDoFeed video={video} altura={800} ativo proximo={false} meuId="u-visitante" />,
    );
    await fireEvent.press(screen.getByTestId('botao-curtir'));
    await waitFor(async () => {
      expect((await servico.getVideo('v-seed-001')).curtido).toBe(true);
    });
  });
});

describe('ItemDoFeed — controles do player', () => {
  beforeEach(() => {
    usePlayerStore.setState({ mudo: false, feedEmFoco: true });
  });

  it('mostra a barra de progresso só no item ativo', async () => {
    const video = videoDeTeste();
    await renderizar(<ItemDoFeed video={video} altura={800} ativo proximo={false} meuId={null} />);
    expect(screen.getByTestId('barra-progresso')).toBeTruthy();
    await renderizar(<ItemDoFeed video={video} altura={800} ativo={false} proximo meuId={null} />);
    expect(screen.queryByTestId('barra-progresso')).toBeNull();
  });

  it('o marcador do progresso aparece sem precisar arrastar', async () => {
    const video = videoDeTeste();
    await renderizar(<ItemDoFeed video={video} altura={800} ativo proximo={false} meuId={null} />);
    // antes ele só surgia durante o arrasto e a linha sumia no rodapé
    expect(screen.getByTestId('marcador-progresso')).toBeTruthy();
  });

  it('o botão de som alterna o mudo global sem pausar', async () => {
    const video = videoDeTeste();
    await renderizar(<ItemDoFeed video={video} altura={800} ativo proximo={false} meuId={null} />);
    expect(screen.getByLabelText('Silenciar')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('botao-mudo'));
    expect(usePlayerStore.getState().mudo).toBe(true);
    expect(screen.getByLabelText('Ativar som')).toBeTruthy();
    expect(screen.queryByTestId('pausado-v-teste')).toBeNull();
  });

  it('foto não tem botão de som nem barra de progresso', async () => {
    const foto = videoDeTeste({ id: 'f-2', tipo: 'foto', url: 'file:///foto.jpg' });
    await renderizar(<ItemDoFeed video={foto} altura={800} ativo proximo={false} meuId={null} />);
    expect(screen.queryByTestId('botao-mudo')).toBeNull();
    expect(screen.queryByTestId('barra-progresso')).toBeNull();
  });
});
