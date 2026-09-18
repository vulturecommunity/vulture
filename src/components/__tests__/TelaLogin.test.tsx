import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import TelaLogin from '@/app/(auth)/login';
import { useAuthStore } from '@/stores/authStore';

import { criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

describe('TelaLogin', () => {
  beforeEach(() => {
    criarServicoDeTeste();
    useAuthStore.setState({ sessao: null, carregado: true, ocupado: false, erro: null });
  });

  it('valida e-mail e senha antes de enviar', async () => {
    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'invalido');
    await fireEvent.changeText(screen.getByTestId('campo-senha'), '123');
    await fireEvent.press(screen.getByTestId('botao-entrar'));
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
    expect(screen.getByText('A senha precisa ter pelo menos 6 caracteres.')).toBeTruthy();
    expect(useAuthStore.getState().sessao).toBeNull();
  });

  it('mostra o erro do serviço quando as credenciais estão erradas', async () => {
    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'ninguem@teste.com');
    await fireEvent.changeText(screen.getByTestId('campo-senha'), '123456');
    await fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => {
      expect(screen.getByTestId('erro-login')).toHaveTextContent('E-mail ou senha incorretos.');
    });
  });

  it('entra como visitante (modo demo)', async () => {
    await renderizar(<TelaLogin />);
    await fireEvent.press(screen.getByTestId('botao-visitante'));
    await waitFor(() => {
      expect(useAuthStore.getState().sessao?.visitante).toBe(true);
    });
  });

  it('entra com uma conta cadastrada', async () => {
    const servico = criarServicoDeTeste();
    await servico.cadastrar({ email: 'ana@teste.com', senha: 'segredo1' });
    await servico.sair();
    await renderizar(<TelaLogin />);
    await fireEvent.changeText(screen.getByTestId('campo-email'), 'ana@teste.com');
    await fireEvent.changeText(screen.getByTestId('campo-senha'), 'segredo1');
    await fireEvent.press(screen.getByTestId('botao-entrar'));
    await waitFor(() => {
      expect(useAuthStore.getState().sessao?.usuario.apelido).toBe('ana');
    });
  });
});
