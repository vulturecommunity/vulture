import * as Sharing from 'expo-sharing';

import { compartilharImagemDoPalpite } from '../compartilharImagem';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

const disponivel = Sharing.isAvailableAsync as jest.Mock;
const compartilhar = Sharing.shareAsync as jest.Mock;

describe('compartilhar o card do palpite como imagem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disponivel.mockResolvedValue(true);
    compartilhar.mockResolvedValue(undefined);
  });

  it('captura o card e abre a folha com a imagem', async () => {
    const alvo = { capture: jest.fn().mockResolvedValue('file:///palpite.png') };

    const r = await compartilharImagemDoPalpite(alvo);

    expect(r.compartilhou).toBe(true);
    expect(compartilhar).toHaveBeenCalledWith(
      'file:///palpite.png',
      expect.objectContaining({ mimeType: 'image/png' }),
    );
  });

  it('sem alvo de captura, avisa para cair no link', async () => {
    const r = await compartilharImagemDoPalpite(null);
    expect(r).toEqual({ compartilhou: false, motivo: 'sem-suporte' });
    expect(compartilhar).not.toHaveBeenCalled();
  });

  it('onde a folha não existe (web), avisa para cair no link', async () => {
    disponivel.mockResolvedValue(false);
    const alvo = { capture: jest.fn().mockResolvedValue('file:///x.png') };

    const r = await compartilharImagemDoPalpite(alvo);

    expect(r).toEqual({ compartilhou: false, motivo: 'sem-suporte' });
    expect(compartilhar).not.toHaveBeenCalled();
  });

  it('falha de captura não lança: o palpite já foi salvo, compartilhar é extra', async () => {
    const alvo = { capture: jest.fn().mockRejectedValue(new Error('sem GPU')) };

    const r = await compartilharImagemDoPalpite(alvo);

    expect(r.compartilhou).toBe(false);
    expect(r.motivo).toBe('falha-na-captura');
  });

  it('distingue cancelar de falhar — cancelar não deve cair no link', async () => {
    // quem fechou a folha não quer ver outra folha abrindo em seguida
    compartilhar.mockRejectedValue(new Error('cancelado pelo usuário'));
    const alvo = { capture: jest.fn().mockResolvedValue('file:///x.png') };

    const r = await compartilharImagemDoPalpite(alvo);

    expect(r).toEqual({ compartilhou: false, motivo: 'cancelado' });
  });
});
