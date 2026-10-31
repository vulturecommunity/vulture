import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TelaLogin from '@/app/(auth)/login';
import TelaRecuperarSenha from '@/app/(auth)/recuperar';
import { dataService } from '@/services/data';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { ErroDeAplicacao } from '@/utils/erros';

import { criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

/** Parâmetros de rota do mock global de expo-router (ver jest.setup.ts). */
function comParametros(params: Record<string, string>) {
  (useLocalSearchParams as unknown as jest.Mock).mockReturnValue(params);
}

describe('recuperação de senha', () => {
  beforeEach(() => {
    criarServicoDeTeste();
    jest.clearAllMocks();
    comParametros({});
    useAuthStore.setState({ sessao: null, carregado: true, ocupado: false, erro: null });
    useUiStore.setState({ aviso: null });
  });

  it('o login oferece a saída para quem esqueceu a senha, levando o e-mail digitado junto', async () => {
    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'ana@teste.com');
    await fireEvent.press(screen.getByTestId('botao-esqueci-senha'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/recuperar',
      params: { email: 'ana@teste.com' },
    });
  });

  it('recusa e-mail inválido sem chamar o serviço', async () => {
    const servico = criarServicoDeTeste();
    const espiao = jest.spyOn(servico, 'enviarRedefinicaoDeSenha');
    await renderizar(<TelaRecuperarSenha />);

    await fireEvent.changeText(screen.getByTestId('campo-email-recuperar'), 'nao-e-email');
    await fireEvent.press(screen.getByTestId('botao-enviar-recuperacao'));

    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
    expect(espiao).not.toHaveBeenCalled();
  });

  it('confirma o envio sem revelar se a conta existe', async () => {
    const servico = criarServicoDeTeste();
    jest.spyOn(servico, 'enviarRedefinicaoDeSenha').mockResolvedValue(undefined);
    await renderizar(<TelaRecuperarSenha />);

    await fireEvent.changeText(screen.getByTestId('campo-email-recuperar'), 'ana@teste.com');
    await fireEvent.press(screen.getByTestId('botao-enviar-recuperacao'));

    await waitFor(() => expect(screen.getByTestId('recuperar-enviado')).toBeTruthy());
    // a tela nunca diz "essa conta existe" nem "não existe": isso a transformaria num
    // verificador de e-mails cadastrados
    expect(screen.getByText(/Se existe uma conta com/)).toBeTruthy();
  });

  it('parte do e-mail que veio do login já preenchido', async () => {
    comParametros({ email: 'ja@digitado.com' });
    await renderizar(<TelaRecuperarSenha />);
    expect(screen.getByTestId('campo-email-recuperar').props.value).toBe('ja@digitado.com');
  });

  it('mostra o motivo quando o serviço recusa', async () => {
    const servico = criarServicoDeTeste();
    jest
      .spyOn(servico, 'enviarRedefinicaoDeSenha')
      .mockRejectedValue(new ErroDeAplicacao('Serviço fora do ar.', 'indisponivel'));
    await renderizar(<TelaRecuperarSenha />);

    await fireEvent.changeText(screen.getByTestId('campo-email-recuperar'), 'ana@teste.com');
    await fireEvent.press(screen.getByTestId('botao-enviar-recuperacao'));

    await waitFor(() => expect(screen.getByText('Serviço fora do ar.')).toBeTruthy());
    expect(screen.queryByTestId('recuperar-enviado')).toBeNull();
  });
});

describe('e-mail não confirmado', () => {
  beforeEach(() => {
    criarServicoDeTeste();
    jest.clearAllMocks();
    comParametros({});
    useAuthStore.setState({ sessao: null, carregado: true, ocupado: false, erro: null });
    useUiStore.setState({ aviso: null });
  });

  it('oferece o reenvio só quando o motivo da recusa é a confirmação pendente', async () => {
    const servico = criarServicoDeTeste();
    jest
      .spyOn(servico, 'entrar')
      .mockRejectedValue(new ErroDeAplicacao('Seu e-mail ainda não foi confirmado.', 'email_nao_confirmado'));

    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'ana@teste.com');
    await fireEvent.changeText(screen.getByTestId('campo-senha'), 'segredo1');

    expect(screen.queryByTestId('botao-reenviar-confirmacao')).toBeNull();

    await fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => expect(screen.getByTestId('botao-reenviar-confirmacao')).toBeTruthy());
  });

  it('não oferece o reenvio quando a senha é que está errada', async () => {
    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'ninguem@teste.com');
    await fireEvent.changeText(screen.getByTestId('campo-senha'), '123456');
    await fireEvent.press(screen.getByTestId('botao-entrar'));

    await waitFor(() => expect(screen.getByTestId('erro-login')).toBeTruthy());
    expect(screen.queryByTestId('botao-reenviar-confirmacao')).toBeNull();
  });

  it('avisa quando o reenvio é aceito', async () => {
    const servico = criarServicoDeTeste();
    jest
      .spyOn(servico, 'entrar')
      .mockRejectedValue(new ErroDeAplicacao('Não confirmado.', 'email_nao_confirmado'));
    const reenvio = jest
      .spyOn(servico, 'reenviarConfirmacaoDeEmail')
      .mockResolvedValue(undefined);

    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'ana@teste.com');
    await fireEvent.changeText(screen.getByTestId('campo-senha'), 'segredo1');
    await fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => expect(screen.getByTestId('botao-reenviar-confirmacao')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('botao-reenviar-confirmacao'));

    await waitFor(() => {
      expect(reenvio).toHaveBeenCalledWith('ana@teste.com');
      expect(useUiStore.getState().aviso?.tipo).toBe('sucesso');
    });
  });
});

describe('driver mock', () => {
  it('explica que a demonstração não manda e-mail, em vez de falhar em silêncio', async () => {
    const servico = criarServicoDeTeste();
    await servico.cadastrar({ email: 'ana@teste.com', senha: 'segredo1' });

    await expect(dataService().enviarRedefinicaoDeSenha('ana@teste.com')).rejects.toThrow(
      /demonstração/i,
    );
    await expect(dataService().reenviarConfirmacaoDeEmail('ana@teste.com')).rejects.toThrow(
      /demonstração/i,
    );
    await expect(dataService().reenviarConfirmacaoDeEmail('ninguem@teste.com')).rejects.toThrow(
      /Não existe conta/i,
    );
  });
});
