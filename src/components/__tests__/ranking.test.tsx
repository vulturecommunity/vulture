import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import TelaArquibancada from '@/app/arquibancada/index';
import { LinhaDoRanking } from '@/components/arquibancada/LinhaDoRanking';
import { RankingDePalpiteiros } from '@/components/arquibancada/RankingDePalpiteiros';
import { definirCalendarioService, type Partida } from '@/services/partidas';
import { useAuthStore } from '@/stores/authStore';
import type { Palpiteiro } from '@/types';

import { congelarORelogio, criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

const HORA = 60 * 60 * 1000;

congelarORelogio();

/** Dois jogos encerrados no mês corrente, para ter o que pontuar. */
function temporadaDeTeste(): Partida[] {
  const base = new Date();
  const noMes = (dia: number) =>
    new Date(base.getFullYear(), base.getMonth(), dia, 19, 0).toISOString();
  return [
    {
      id: 'jogo-1',
      competicao: 'Brasileirão',
      mandante: 'Flamengo',
      visitante: 'Cuiabá',
      siglas: { mandante: 'FLA', visitante: 'CUI' },
      dataHora: noMes(1),
      estadio: 'Maracanã',
      placar: { mandante: 3, visitante: 1 },
      status: 'encerrada',
    },
    {
      id: 'jogo-2',
      competicao: 'Brasileirão',
      mandante: 'Santos',
      visitante: 'Flamengo',
      siglas: { mandante: 'SAN', visitante: 'FLA' },
      dataHora: new Date(Date.now() + 3 * 24 * HORA).toISOString(),
      estadio: 'Vila Belmiro',
      placar: null,
      status: 'agendada',
    },
  ];
}

function palpiteiro(parcial: Partial<Palpiteiro> = {}): Palpiteiro {
  return {
    posicao: 1,
    usuario: { id: 'u1', apelido: 'zico', nome: 'Zico', avatarUrl: null },
    pontos: 42,
    palpites: 6,
    cravadas: 3,
    sequencia: 0,
    variacao: 0,
    souEu: false,
    ...parcial,
  };
}

describe('LinhaDoRanking', () => {
  it('mostra posição, apelido, aproveitamento e pontos', async () => {
    await renderizar(<LinhaDoRanking palpiteiro={palpiteiro()} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('@zico')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText(/3 cravadas · 6 palpites/)).toBeTruthy();
  });

  it('a própria linha aparece como "Você", não como @apelido', async () => {
    await renderizar(<LinhaDoRanking palpiteiro={palpiteiro({ souEu: true })} />);
    expect(screen.getByText('Você')).toBeTruthy();
    expect(screen.queryByText('@zico')).toBeNull();
  });

  it('a sequência só aparece a partir de 3 jogos pontuando', async () => {
    const { rerender } = await renderizar(
      <LinhaDoRanking palpiteiro={palpiteiro({ sequencia: 2 })} />,
    );
    expect(screen.queryByText('2')).toBeNull();
    await rerender(<LinhaDoRanking palpiteiro={palpiteiro({ sequencia: 4 })} />);
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('singular quando é uma cravada só', async () => {
    await renderizar(
      <LinhaDoRanking palpiteiro={palpiteiro({ cravadas: 1, palpites: 1 })} />,
    );
    expect(screen.getByText(/1 cravada · 1 palpite$/)).toBeTruthy();
  });
});

describe('RankingDePalpiteiros', () => {
  beforeEach(async () => {
    criarServicoDeTeste();
    definirCalendarioService({ listarTemporada: async () => temporadaDeTeste() });
    await useAuthStore.getState().entrarComoVisitante();
  });

  it('abre no mês corrente com o pódio e a régua de pontos', async () => {
    await renderizar(<RankingDePalpiteiros />);
    await waitFor(() => expect(screen.getByTestId('lista-ranking')).toBeTruthy());
    expect(screen.getByTestId('podio-do-ranking')).toBeTruthy();
    expect(screen.getByTestId('podio-1')).toBeTruthy();
    expect(screen.getByText(/Cravou 10 · Saldo 5 · Vencedor 3/)).toBeTruthy();
  });

  it('a aba de ligas oferece criar ou entrar com código', async () => {
    await renderizar(<RankingDePalpiteiros />);
    await waitFor(() => expect(screen.getByTestId('aba-ranking-ligas')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-ranking-ligas'));
    await waitFor(() => expect(screen.getByTestId('abrir-ligas')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('abrir-ligas'));
    expect(await screen.findByTestId('input-nome-da-liga')).toBeTruthy();
  });

  it('criar a liga entrega o código de convite, que é o produto do fluxo', async () => {
    await renderizar(<RankingDePalpiteiros />);
    await waitFor(() => expect(screen.getByTestId('aba-ranking-ligas')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-ranking-ligas'));
    await fireEvent.press(await screen.findByTestId('abrir-ligas'));
    await fireEvent.changeText(
      await screen.findByTestId('input-nome-da-liga'),
      'Resenha do trabalho',
    );
    await fireEvent.press(screen.getByTestId('confirmar-liga'));

    const caixa = await screen.findByTestId('codigo-da-liga');
    expect(caixa).toHaveTextContent(/^[A-Z0-9]{6}$/);
  });

  it('nome curto demais mantém o botão de criar desligado', async () => {
    await renderizar(<RankingDePalpiteiros />);
    await waitFor(() => expect(screen.getByTestId('aba-ranking-ligas')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-ranking-ligas'));
    await fireEvent.press(await screen.findByTestId('abrir-ligas'));
    expect(screen.getByTestId('confirmar-liga')).toBeDisabled();
    await fireEvent.changeText(await screen.findByTestId('input-nome-da-liga'), 'ab');
    expect(screen.getByTestId('confirmar-liga')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('input-nome-da-liga'), 'Bonde do Mengão');
    expect(screen.getByTestId('confirmar-liga')).not.toBeDisabled();
  });
});

describe('Arquibancada com a aba Ranking', () => {
  beforeEach(async () => {
    criarServicoDeTeste();
    definirCalendarioService({ listarTemporada: async () => temporadaDeTeste() });
    await useAuthStore.getState().entrarComoVisitante();
  });

  it('a terceira aba leva ao pódio', async () => {
    await renderizar(<TelaArquibancada />);
    await waitFor(() => expect(screen.getByTestId('aba-arquibancada-ranking')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-arquibancada-ranking'));
    await waitFor(() => expect(screen.getByTestId('lista-ranking')).toBeTruthy());
  });
});
