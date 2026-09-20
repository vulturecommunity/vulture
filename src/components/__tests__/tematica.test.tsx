import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { BarraDeCanais } from '@/components/explorar/BarraDeCanais';
import { RankingSemanal } from '@/components/explorar/RankingSemanal';
import { CardsDePartida } from '@/components/partidas/CardsDePartida';
import { CabecalhoDePerfil } from '@/components/perfil/CabecalhoDePerfil';
import { GradeDeVideos } from '@/components/perfil/GradeDeVideos';
import { CANAIS } from '@/constants/interesses';
import type { Perfil } from '@/types';

import { criarServicoDeTeste, renderizar, videoDeTeste } from './utilitarios-de-teste';

const perfilBase: Perfil = {
  id: 'u-x',
  apelido: 'torcedor_x',
  nome: 'Torcedor X',
  avatarUrl: null,
  bio: 'Bio curta',
  interesses: ['Jogos'],
  seguidores: 1500,
  seguindo: 20,
  curtidasRecebidas: 9000,
  totalVideos: 3,
  criadoEm: new Date().toISOString(),
  souEu: false,
  estouSeguindo: false,
  bloqueado: false,
};

describe('camada temática e perfil', () => {
  it('BarraDeCanais lista os 6 canais e navega para a hashtag', async () => {
    await renderizar(<BarraDeCanais />);
    for (const canal of CANAIS) expect(screen.getByText(`#${canal}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('canal-Maracanã'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/hashtag/[tag]',
      params: { tag: 'Maracanã' },
    });
  });

  it('CardsDePartida mostra próximo jogo e último resultado', async () => {
    await renderizar(<CardsDePartida />);
    await waitFor(() => expect(screen.getByTestId('card-Próximo jogo')).toBeTruthy());
    expect(screen.getByTestId('card-Último resultado')).toBeTruthy();
    expect(screen.getAllByText(/Flamengo/).length).toBeGreaterThan(0);
  });

  it('RankingSemanal lista os melhores torcedores da semana', async () => {
    const servico = criarServicoDeTeste();
    await servico.entrarComoVisitante();
    await renderizar(<RankingSemanal />);
    await waitFor(() => expect(screen.getByTestId('ranking-1')).toBeTruthy());
    expect(screen.getByText('Torcedores da semana')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('ranking-1'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/usuario/[id]' }),
    );
  });

  it('CabecalhoDePerfil mostra contadores e alterna entre Seguir/Editar', async () => {
    const seguir = jest.fn();
    const { rerender } = await renderizar(
      <CabecalhoDePerfil perfil={perfilBase} aoSeguir={seguir} aoMais={() => {}} />,
    );
    expect(screen.getByTestId('total-seguidores')).toHaveTextContent('1,5 mil');
    await fireEvent.press(screen.getByTestId('botao-seguir'));
    expect(seguir).toHaveBeenCalled();
    await rerender(<CabecalhoDePerfil perfil={{ ...perfilBase, estouSeguindo: true }} />);
    expect(screen.getByTestId('botao-seguir')).toHaveTextContent('Seguindo');
    await rerender(
      <CabecalhoDePerfil perfil={{ ...perfilBase, souEu: true }} aoEditar={() => {}} />,
    );
    expect(screen.getByTestId('botao-editar-perfil')).toBeTruthy();
  });

  it('GradeDeVideos abre o vídeo continuando pela mesma lista', async () => {
    const videos = [videoDeTeste({ id: 'a' }), videoDeTeste({ id: 'b', tipo: 'foto' })];
    await renderizar(<GradeDeVideos videos={videos} origem="usuario" usuarioId="u-x" />);
    await fireEvent.press(screen.getByTestId('celula-b'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/video/[id]',
      params: { id: 'b', origem: 'usuario', usuarioId: 'u-x' },
    });
  });
});
