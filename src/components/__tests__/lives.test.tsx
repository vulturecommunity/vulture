import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ChatDaLive } from '@/components/lives/ChatDaLive';
import { ReacoesFlutuantes } from '@/components/lives/ReacoesFlutuantes';
import { SalaDaLive } from '@/components/lives/SalaDaLive';
import { SheetDeDenuncia } from '@/components/seguranca/SheetDeDenuncia';
import { modoDeLive, motivoDoModoSimulado } from '@/services/live';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { MensagemLive } from '@/types';

import { criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

const mensagem = (id: string, texto: string): MensagemLive => ({
  id,
  liveId: 'l-1',
  autorId: 'u-a',
  autor: { id: 'u-a', apelido: 'alguem', avatarUrl: null },
  tipo: 'texto',
  texto,
  reacao: null,
  criadoEm: new Date().toISOString(),
});

describe('lives', () => {
  it('no ambiente de teste (sem módulo nativo) o modo é simulado', () => {
    expect(modoDeLive()).toBe('simulado');
    expect(motivoDoModoSimulado()).toMatch(/Expo Go/);
  });

  it('ChatDaLive lista mensagens, envia texto e reação', async () => {
    const aoEnviar = jest.fn(() => Promise.resolve());
    const aoReagir = jest.fn(() => Promise.resolve());
    await renderizar(
      <ChatDaLive
        mensagens={[mensagem('1', 'Salve!'), mensagem('2', 'Mengo!')]}
        aoEnviar={aoEnviar}
        aoReagir={aoReagir}
      />,
    );
    expect(screen.getByText(/Salve!/)).toBeTruthy();
    expect(screen.getByText(/Mengo!/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('campo-chat'), 'Oi nação');
    await fireEvent.press(screen.getByTestId('botao-enviar-chat'));
    await waitFor(() => expect(aoEnviar).toHaveBeenCalledWith('Oi nação'));
    await fireEvent.press(screen.getByTestId('reacao-🦅'));
    expect(aoReagir).toHaveBeenCalledWith('🦅');
  });

  it('ReacoesFlutuantes renderiza um emoji por reação', async () => {
    await renderizar(
      <ReacoesFlutuantes
        reacoes={[
          { id: 'a', emoji: '🔴' },
          { id: 'b', emoji: '🏆' },
        ]}
      />,
    );
    expect(screen.getByText('🔴', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('🏆', { includeHiddenElements: true })).toBeTruthy();
  });

  it('SalaDaLive em modo simulado mostra capa, aviso, chat e espectadores', async () => {
    const servico = criarServicoDeTeste();
    const sessao = await servico.entrarComoVisitante();
    useAuthStore.setState({ sessao, carregado: true });
    const live = await servico.getLive('l-seed-2');
    await renderizar(<SalaDaLive live={live} anfitriao={false} aoSair={() => {}} />);
    expect(screen.getByTestId('capa-simulada')).toBeTruthy();
    expect(screen.getByText(/Modo simulado/)).toBeTruthy();
    expect(screen.getByText('AO VIVO')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('chat-live')).toBeTruthy());
    expect(screen.getByTestId('total-espectadores')).toHaveTextContent(String(live.espectadores));
    await fireEvent.changeText(screen.getByTestId('campo-chat'), 'Chegueeei');
    await fireEvent.press(screen.getByTestId('botao-enviar-chat'));
    await waitFor(() => expect(screen.getByText(/Chegueeei/)).toBeTruthy());
  });

  it('SheetDeDenuncia permite denunciar com motivo', async () => {
    const servico = criarServicoDeTeste();
    const sessao = await servico.entrarComoVisitante();
    useAuthStore.setState({ sessao, carregado: true });
    useUiStore.getState().abrirDenuncia({
      tipo: 'video',
      id: 'v-seed-001',
      autorId: 'u-nacao',
      autorApelido: 'nacao_rubro',
    });
    await renderizar(<SheetDeDenuncia />);
    await fireEvent.press(screen.getByTestId('opcao-denunciar'));
    expect(screen.getByText('Motivo da denúncia')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('motivo-Spam ou golpe'));
    await fireEvent.press(screen.getByTestId('botao-enviar-denuncia'));
    await waitFor(() => expect(screen.getByText('Denúncia recebida')).toBeTruthy());
  });

  it('SheetDeDenuncia bloqueia o autor e fecha', async () => {
    const servico = criarServicoDeTeste();
    const sessao = await servico.entrarComoVisitante();
    useAuthStore.setState({ sessao, carregado: true });
    useUiStore.getState().abrirDenuncia({
      tipo: 'video',
      id: 'v-seed-001',
      autorId: 'u-nacao',
      autorApelido: 'nacao_rubro',
    });
    await renderizar(<SheetDeDenuncia />);
    await fireEvent.press(screen.getByTestId('opcao-bloquear'));
    await waitFor(() => expect(useUiStore.getState().alvoParaDenuncia).toBeNull());
    expect((await servico.listBloqueados()).map((u) => u.id)).toEqual(['u-nacao']);
    expect(useUiStore.getState().aviso?.texto).toMatch(/bloqueado/);
  });
});
