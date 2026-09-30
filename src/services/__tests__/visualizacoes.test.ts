import { dataService } from '@/services/data';
import {
  enviarVisualizacoesPendentes,
  registrarVisualizacao,
} from '@/services/data/visualizacoes';

jest.mock('@/services/data', () => ({ dataService: jest.fn() }));

const registrarVisualizacoes = jest.fn().mockResolvedValue(undefined);
(dataService as jest.Mock).mockReturnValue({ registrarVisualizacoes });

describe('fila de visualizações', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    registrarVisualizacoes.mockClear();
  });

  afterEach(async () => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    await enviarVisualizacoesPendentes();
    registrarVisualizacoes.mockClear();
  });

  it('não vai ao servidor a cada vídeo: junta e manda de uma vez', async () => {
    registrarVisualizacao('v1');
    registrarVisualizacao('v2');
    registrarVisualizacao('v3');
    expect(registrarVisualizacoes).not.toHaveBeenCalled();

    await enviarVisualizacoesPendentes();
    expect(registrarVisualizacoes).toHaveBeenCalledTimes(1);
    expect(registrarVisualizacoes).toHaveBeenCalledWith(['v1', 'v2', 'v3']);
  });

  it('o mesmo vídeo visto duas vezes na mesma janela conta uma', async () => {
    registrarVisualizacao('v1');
    registrarVisualizacao('v1');
    await enviarVisualizacoesPendentes();
    expect(registrarVisualizacoes).toHaveBeenCalledWith(['v1']);
  });

  it('envia sozinho quando o tempo passa', async () => {
    registrarVisualizacao('v9');
    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    expect(registrarVisualizacoes).toHaveBeenCalledWith(['v9']);
  });

  it('fila vazia não gera chamada', async () => {
    await enviarVisualizacoesPendentes();
    expect(registrarVisualizacoes).not.toHaveBeenCalled();
  });

  it('falha de rede não propaga: visualização é métrica, não conteúdo', async () => {
    registrarVisualizacoes.mockRejectedValueOnce(new Error('sem rede'));
    registrarVisualizacao('v7');
    await expect(enviarVisualizacoesPendentes()).resolves.toBeUndefined();
  });
});
