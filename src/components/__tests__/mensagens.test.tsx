import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import TelaConfiguracoesDeMensagens from '@/app/configuracoes/mensagens';
import TelaConversa from '@/app/mensagens/[id]';
import TelaMensagens from '@/app/mensagens/index';
import TelaNovaConversa from '@/app/mensagens/nova';
import TelaNovosSeguidores from '@/app/mensagens/seguidores';
import TelaEncontrarTorcedores from '@/app/perfil/encontrar';
import { useAuthStore } from '@/stores/authStore';

import { criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

async function entrarComoVisitante() {
  const servico = criarServicoDeTeste();
  await useAuthStore.getState().entrarComoVisitante();
  return servico;
}

describe('mensagens', () => {
  afterEach(() => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  it('caixa de mensagens: rasantes, atalhos com badge e a conversa de boas-vindas', async () => {
    await entrarComoVisitante();
    await renderizar(<TelaMensagens />);

    expect(screen.getByText('Mensagens')).toBeTruthy();
    expect(await screen.findByTestId('fileira-rasantes')).toBeTruthy();
    expect(screen.getByTestId('rasante-eu')).toBeTruthy();
    // quem sigo e postou rasante aparece na fileira
    expect(await screen.findByTestId('rasante-u-nacao')).toBeTruthy();

    expect(screen.getByText('Novos seguidores')).toBeTruthy();
    expect(screen.getByText('Atividade')).toBeTruthy();
    expect(screen.getByText('Avisos do Vulture')).toBeTruthy();
    // 4 seguidores de demonstração não lidos
    expect(await screen.findByTestId('atalho-seguidores-badge')).toBeTruthy();

    // conversa de boas-vindas com 1 não lida
    expect(await screen.findByText('Nação Rubro-Negra')).toBeTruthy();
    expect(screen.getByText(/Fala, @visitante! Bem-vindo/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('atalho-seguidores'));
    expect(router.push).toHaveBeenCalledWith('/mensagens/seguidores');
    await fireEvent.press(screen.getByTestId('botao-nova-conversa'));
    expect(router.push).toHaveBeenCalledWith('/mensagens/nova');
  });

  it('conversa: mostra o histórico, envia e some com as não lidas', async () => {
    const servico = await entrarComoVisitante();
    const [conversa] = await servico.listConversas();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: conversa.id });

    await renderizar(<TelaConversa />);
    expect(await screen.findByText(/Bem-vindo ao Vulture/)).toBeTruthy();
    expect(screen.getByText('@nacao_rubro')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('campo-mensagem'), 'Salve, nação!');
    await fireEvent.press(screen.getByTestId('botao-enviar-mensagem'));
    expect(await screen.findByText('Salve, nação!')).toBeTruthy();

    await waitFor(async () => {
      const mensagens = await servico.listMensagens(conversa.id);
      expect(mensagens.map((m) => m.texto)).toContain('Salve, nação!');
    });
    // abrir a conversa marcou a mensagem recebida como lida
    await waitFor(async () => {
      const [atual] = await servico.listConversas();
      expect(atual.naoLidas).toBe(0);
    });
  });

  it('conversa: erro de permissão aparece na tela e a mensagem otimista some', async () => {
    const servico = await entrarComoVisitante();
    const [conversa] = await servico.listConversas();
    // bloqueio corta a conversa
    await servico.bloquear(conversa.outro.id);
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: conversa.id });

    await renderizar(<TelaConversa />);
    await screen.findByText(/Bem-vindo ao Vulture/);
    await fireEvent.changeText(screen.getByTestId('campo-mensagem'), 'oi?');
    await fireEvent.press(screen.getByTestId('botao-enviar-mensagem'));
    expect(await screen.findByTestId('erro-envio')).toBeTruthy();
    expect(screen.getByText(/Não é possível conversar/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('oi?')).toBeNull());
  });

  it('nova conversa: lista contatos, filtra e abre a conversa', async () => {
    await entrarComoVisitante();
    await renderizar(<TelaNovaConversa />);
    expect(await screen.findByTestId('contato-u-golaco')).toBeTruthy();
    expect(screen.getByTestId('contato-u-maraca')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('campo-busca-contato'), 'golaco');
    expect(screen.queryByTestId('contato-u-maraca')).toBeNull();

    await fireEvent.press(screen.getByTestId('contato-u-golaco'));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/mensagens/[id]' }),
      ),
    );
  });

  it('configurações: os interruptores salvam a preferência', async () => {
    const servico = await entrarComoVisitante();
    await renderizar(<TelaConfiguracoesDeMensagens />);
    const interruptor = await screen.findByTestId('switch-deSeguidores');
    expect(interruptor.props.value).toBe(true);

    await fireEvent(interruptor, 'valueChange', false);
    await waitFor(async () => {
      expect((await servico.obterPreferenciasDeMensagens()).deSeguidores).toBe(false);
    });
    await waitFor(() =>
      expect(screen.getByTestId('switch-deSeguidores')).toHaveProp('value', false),
    );

    await fireEvent(screen.getByTestId('switch-deQuemSigo'), 'valueChange', false);
    expect(await screen.findByText(/ninguém consegue iniciar conversa/)).toBeTruthy();
  });

  it('novos seguidores: mostra Hoje, dias e data completa, e segue de volta', async () => {
    const servico = await entrarComoVisitante();
    await renderizar(<TelaNovosSeguidores />);
    expect(await screen.findByTestId('seguidor-u-nacao')).toBeTruthy();
    expect(screen.getByTestId('quando-u-nacao').props.children).toBe('Hoje');
    expect(screen.getByTestId('quando-u-memes').props.children).toBe('Há 3 dias');
    expect(screen.getByTestId('quando-u-resenha').props.children).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    await fireEvent.press(screen.getByTestId('seguir-de-volta-u-memes'));
    await waitFor(async () => {
      const lista = await servico.listNovosSeguidores();
      expect(lista.find((s) => s.usuario.id === 'u-memes')?.sigoDeVolta).toBe(true);
    });
    await waitFor(() =>
      expect(within(screen.getByTestId('seguidor-u-memes')).getByText('Seguindo')).toBeTruthy(),
    );
  });

  it('encontrar torcedores: sugere quem não sigo e segue com um toque', async () => {
    const servico = await entrarComoVisitante();
    await renderizar(<TelaEncontrarTorcedores />);
    expect(await screen.findByText('Sugestões para você')).toBeTruthy();
    // visitante já segue u-nacao e u-golaco: não podem aparecer
    expect(screen.queryByTestId('sugestao-u-nacao')).toBeNull();
    expect(screen.queryByTestId('sugestao-u-golaco')).toBeNull();
    const sugestao = await screen.findByTestId('sugestao-u-taticas');
    expect(sugestao).toBeTruthy();

    await fireEvent.press(screen.getByTestId('seguir-u-taticas'));
    await waitFor(async () => {
      const perfil = await servico.getProfile('u-taticas');
      expect(perfil.estouSeguindo).toBe(true);
    });

    await fireEvent.changeText(screen.getByTestId('campo-busca-torcedor'), 'memes');
    expect(await screen.findByText('Resultados')).toBeTruthy();
    expect(await screen.findByTestId('sugestao-u-memes')).toBeTruthy();
  });
});
