import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TelaCentroDeAtividade from '@/app/configuracoes/atividade';
import TelaDeConfiguracoes from '@/app/configuracoes/index';
import TelaDeHistorico from '@/app/configuracoes/historico/[tipo]';
import TelaDeInteracoes from '@/app/configuracoes/interacoes';
import TelaDePrivacidade from '@/app/configuracoes/privacidade';
import TelaDeSenha from '@/app/configuracoes/conta/senha';
import { useAjustesStore } from '@/stores/ajustesStore';
import { useAuthStore } from '@/stores/authStore';
import { useHistoricoStore } from '@/stores/historicoStore';

import { criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

beforeEach(() => {
  useAjustesStore.getState().restaurarPadroes();
  useHistoricoStore.setState({ donoId: null });
  useHistoricoStore.getState().limparTudo();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
});

describe('configurações', () => {
  it('reúne os atalhos e mostra o estado atual de cada preferência', async () => {
    criarServicoDeTeste();
    await useAuthStore.getState().entrarComoVisitante();
    useAjustesStore.getState().definir('contaPrivada', true);
    useAjustesStore.getState().definir('economizarDados', true);

    await renderizar(<TelaDeConfiguracoes />);

    expect(screen.getByText('Configurações e privacidade')).toBeTruthy();
    expect(screen.getByText('Ativada')).toBeTruthy(); // conta privada
    expect(screen.getByText('Ativado')).toBeTruthy(); // economizador
    expect(screen.getByText('Somente você')).toBeTruthy(); // vídeos curtidos

    await fireEvent.press(screen.getByTestId('link-atividade'));
    expect(router.push).toHaveBeenCalledWith('/configuracoes/atividade');
    await fireEvent.press(screen.getByTestId('link-espaco'));
    expect(router.push).toHaveBeenCalledWith('/configuracoes/espaco');
  });

  it('a conta privada troca o texto de apoio e fica guardada', async () => {
    await renderizar(<TelaDePrivacidade />);

    await fireEvent(screen.getByTestId('switch-conta-privada-switch'), 'valueChange', true);
    expect(useAjustesStore.getState().contaPrivada).toBe(true);
    expect(screen.getByText(/passam pela sua aprovação/)).toBeTruthy();
    // a mudança entra no histórico da conta
    expect(useHistoricoStore.getState().conta[0].descricao).toBe('Conta privada ativada');
  });

  it('interações: escolhe o público e monta a lista de palavras filtradas', async () => {
    await renderizar(<TelaDeInteracoes />);

    await fireEvent.press(screen.getByTestId('opcao-comentarios-seguidores'));
    expect(useAjustesStore.getState().comentariosDe).toBe('seguidores');

    await fireEvent.press(screen.getByTestId('opcao-mencoes-ninguem'));
    expect(useAjustesStore.getState().mencoesDe).toBe('ninguem');

    const campo = screen.getByTestId('campo-palavra-filtrada');
    await fireEvent.changeText(campo, 'Vexame');
    await fireEvent(campo, 'submitEditing');
    expect(useAjustesStore.getState().palavrasFiltradas).toEqual(['vexame']);
    expect(screen.getByText('vexame')).toBeTruthy();
  });

  it('centro de atividade conta o que foi registrado e abre cada lista', async () => {
    useHistoricoStore.getState().registrarPesquisa('flamengo');
    await renderizar(<TelaCentroDeAtividade />);

    expect(screen.getByText('1 busca')).toBeTruthy();
    // assistidos, comentários e registros da conta ainda vazios
    expect(screen.getAllByText('Nada por aqui')).toHaveLength(3);

    await fireEvent.press(screen.getByTestId('link-historico-pesquisas'));
    expect(router.push).toHaveBeenCalledWith('/configuracoes/historico/pesquisas');
  });

  it('histórico de pesquisa devolve o termo para o Explorar', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ tipo: 'pesquisas' });
    useHistoricoStore.getState().registrarPesquisa('maracanã');

    await renderizar(<TelaDeHistorico />);
    expect(screen.getByText('Hoje')).toBeTruthy();

    await fireEvent.press(screen.getByText('maracanã'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/explorar',
      params: { termo: 'maracanã' },
    });
  });

  it('histórico desconhecido não quebra a tela', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ tipo: 'inexistente' });
    await renderizar(<TelaDeHistorico />);
    expect(screen.getByText('Histórico desconhecido')).toBeTruthy();
  });

  it('senha: o visitante não tem o que trocar', async () => {
    criarServicoDeTeste();
    await useAuthStore.getState().entrarComoVisitante();

    await renderizar(<TelaDeSenha />);
    expect(screen.getByText(/sem e-mail e sem senha/)).toBeTruthy();
    expect(screen.queryByTestId('botao-salvar-senha')).toBeNull();
  });

  it('senha: só libera o botão com a atual preenchida e a nova forte e confirmada', async () => {
    criarServicoDeTeste();
    await useAuthStore.getState().cadastrar({ email: 'ana@teste.com', senha: '123456' });

    await renderizar(<TelaDeSenha />);
    const botao = screen.getByTestId('botao-salvar-senha');
    expect(botao.props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('campo-senha-atual'), '123456');
    await fireEvent.changeText(screen.getByTestId('campo-senha-nova'), 'Maracana1!');
    await fireEvent.changeText(screen.getByTestId('campo-senha-confirmacao'), 'Maracana2!');
    expect(screen.getByText('As senhas não batem.')).toBeTruthy();
    expect(screen.getByTestId('botao-salvar-senha').props.accessibilityState.disabled).toBe(true);

    await fireEvent.changeText(screen.getByTestId('campo-senha-confirmacao'), 'Maracana1!');
    expect(screen.getByTestId('botao-salvar-senha').props.accessibilityState.disabled).toBe(false);
  });
});
