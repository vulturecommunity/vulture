import { screen } from '@testing-library/react-native';
import { useVideoPlayer } from 'expo-video';

import { PlayerDeVideo } from '@/components/feed/PlayerDeVideo';

import { renderizar, videoDeTeste } from './utilitarios-de-teste';

const ultimoPlayer = () => {
  const chamadas = (useVideoPlayer as jest.Mock).mock.results;
  return chamadas[chamadas.length - 1].value as { play: jest.Mock; pause: jest.Mock };
};

describe('PlayerDeVideo', () => {
  it('toca quando visível e não pausado', async () => {
    await renderizar(<PlayerDeVideo video={videoDeTeste()} tocando pausado={false} mudo={false} />);
    expect(ultimoPlayer().play).toHaveBeenCalled();
    expect(screen.queryByTestId('pausado-v-teste')).toBeNull();
  });

  it('pausa e mostra o ícone de play quando o usuário pausa', async () => {
    await renderizar(<PlayerDeVideo video={videoDeTeste()} tocando pausado mudo={false} />);
    const player = ultimoPlayer();
    expect(player.pause).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(screen.getByTestId('pausado-v-teste')).toBeTruthy();
  });

  it('pré-carregado (não visível) fica pausado, sem barra nem ícone', async () => {
    await renderizar(
      <PlayerDeVideo video={videoDeTeste()} tocando={false} pausado={false} mudo={false} />,
    );
    expect(ultimoPlayer().pause).toHaveBeenCalled();
    expect(screen.queryByTestId('barra-progresso')).toBeNull();
    expect(screen.queryByTestId('pausado-v-teste')).toBeNull();
  });
});
