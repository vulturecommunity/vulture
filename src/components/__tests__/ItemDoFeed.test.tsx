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

  it('só monta o player para o item ativo ou vizinho', async () => {
    const video = videoDeTeste();
    await renderizar(
      <ItemDoFeed video={video} altura={800} ativo={false} proximo={false} meuId={null} />,
    );
    expect(screen.queryByTestId('player-v-teste')).toBeNull();
  });

  it('foto usa o post estático com barra de 5 segundos', async () => {
    const foto = videoDeTeste({ id: 'f-1', tipo: 'foto', url: 'file:///foto.jpg' });
    await renderizar(<ItemDoFeed video={foto} altura={800} ativo proximo={false} meuId={null} />);
    expect(screen.getByTestId('foto-f-1')).toBeTruthy();
    expect(screen.queryByTestId('player-f-1')).toBeNull();
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
