import { ImageManipulator } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

import {
  LADO_DA_MINIATURA,
  LADO_DO_AVATAR,
  comprimirImagem,
  gerarThumbnail,
} from '@/services/midia/arquivos';

const manipular = ImageManipulator.manipulate as jest.Mock;

/** O contexto do mock global: `resize` devolve ele mesmo, `renderAsync` resolve. */
function contextoDoMock() {
  return manipular.mock.results[manipular.mock.results.length - 1].value as {
    resize: jest.Mock;
  };
}

describe('compressão de imagem', () => {
  it('encolhe pelo lado maior quando a imagem passa do limite', async () => {
    await comprimirImagem('file:///grande.jpg', 540, 0.6, { largura: 1280, altura: 720 });
    expect(contextoDoMock().resize).toHaveBeenCalledWith({ width: 540 });
  });

  it('imagem em pé encolhe pela altura', async () => {
    await comprimirImagem('file:///retrato.jpg', 540, 0.6, { largura: 720, altura: 1280 });
    expect(contextoDoMock().resize).toHaveBeenCalledWith({ height: 540 });
  });

  it('não amplia imagem menor que o limite — só recomprime', async () => {
    await comprimirImagem('file:///pequena.jpg', 1080, 0.8, { largura: 400, altura: 300 });
    expect(contextoDoMock().resize).not.toHaveBeenCalled();
  });

  it('sem as medidas originais, encolhe pelo lado maior por segurança', async () => {
    await comprimirImagem('file:///desconhecida.jpg', LADO_DO_AVATAR);
    expect(contextoDoMock().resize).toHaveBeenCalledWith({ width: LADO_DO_AVATAR });
  });
});

describe('miniatura de vídeo', () => {
  const gerarFrame = VideoThumbnails.getThumbnailAsync as jest.Mock;

  it('frame de vídeo 720p sai redimensionado, e não no tamanho original', async () => {
    // é este o caso real que gerou a miniatura de 1,9 MB no projeto
    gerarFrame.mockResolvedValueOnce({ uri: 'file:///frame.jpg', width: 720, height: 1280 });
    const uri = await gerarThumbnail('file:///clipe.mp4');
    // o mock do manipulador devolve sempre file:///comprimida.jpg — receber esse caminho
    // prova que o frame passou pela compressão em vez de subir cru
    expect(uri).toBe('file:///comprimida.jpg');
    expect(contextoDoMock().resize).toHaveBeenCalledWith({ height: LADO_DA_MINIATURA });
  });

  it('frame já pequeno não é ampliado', async () => {
    gerarFrame.mockResolvedValueOnce({ uri: 'file:///frame.jpg', width: 100, height: 100 });
    await gerarThumbnail('file:///clipe.mp4');
    expect(contextoDoMock().resize).not.toHaveBeenCalled();
  });

  it('se o manipulador falhar, devolve a miniatura original em vez de nenhuma', async () => {
    gerarFrame.mockResolvedValueOnce({ uri: 'file:///frame.jpg', width: 720, height: 1280 });
    manipular.mockImplementationOnce(() => {
      throw new Error('sem módulo nativo');
    });
    expect(await gerarThumbnail('file:///clipe.mp4')).toBe('file:///frame.jpg');
  });

  it('sem o gerador de frame, não quebra a publicação', async () => {
    gerarFrame.mockRejectedValueOnce(new Error('sem módulo nativo'));
    expect(await gerarThumbnail('file:///clipe.mp4')).toBeNull();
  });
});
