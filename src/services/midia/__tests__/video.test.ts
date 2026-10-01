import * as FileSystem from 'expo-file-system/legacy';

import { comprimirVideo, economiaEmPorcento } from '../video';

jest.mock('react-native-compressor', () => ({ Video: { compress: jest.fn() } }), {
  virtual: true,
});

const { Video } = jest.requireMock('react-native-compressor') as {
  Video: { compress: jest.Mock };
};
const getInfo = FileSystem.getInfoAsync as jest.Mock;

/** Encadeia os tamanhos que `getInfoAsync` devolve, na ordem em que o código pergunta. */
function tamanhos(...bytes: number[]) {
  getInfo.mockReset();
  bytes.forEach((size) => {
    getInfo.mockResolvedValueOnce({ exists: true, isDirectory: false, size });
  });
}

const MB = 1024 * 1024;

describe('compressão de vídeo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Video.compress.mockReset();
  });

  it('comprime e devolve o arquivo menor', async () => {
    tamanhos(20 * MB, 7 * MB);
    Video.compress.mockResolvedValue('file:///comprimido.mp4');

    const r = await comprimirVideo('file:///original.mp4');

    expect(r.comprimido).toBe(true);
    expect(r.uri).toBe('file:///comprimido.mp4');
    expect(economiaEmPorcento(r)).toBe(65);
  });

  it('limita a 720p: num app de vídeo, qualidade visível é o produto', async () => {
    tamanhos(20 * MB, 7 * MB);
    Video.compress.mockResolvedValue('file:///c.mp4');

    await comprimirVideo('file:///o.mp4');

    const opcoes = Video.compress.mock.calls[0][1];
    expect(opcoes.maxSize).toBe(1280);
    expect(opcoes.bitrate).toBe(2_000_000);
  });

  it('não mexe em arquivo pequeno: gasta bateria para economizar quase nada', async () => {
    tamanhos(900 * 1024);

    const r = await comprimirVideo('file:///curto.mp4');

    expect(Video.compress).not.toHaveBeenCalled();
    expect(r.comprimido).toBe(false);
    expect(r.uri).toBe('file:///curto.mp4');
  });

  it('fica com o original quando a compressão engorda o arquivo', async () => {
    tamanhos(10 * MB, 14 * MB);
    Video.compress.mockResolvedValue('file:///maior.mp4');

    const r = await comprimirVideo('file:///ja-otimizado.mp4');

    expect(r.comprimido).toBe(false);
    expect(r.uri).toBe('file:///ja-otimizado.mp4');
    expect(economiaEmPorcento(r)).toBe(0);
  });

  it('falha de compressão não impede publicar', async () => {
    tamanhos(20 * MB);
    Video.compress.mockRejectedValue(new Error('codec indisponível'));

    const r = await comprimirVideo('file:///original.mp4');

    expect(r.comprimido).toBe(false);
    expect(r.uri).toBe('file:///original.mp4');
  });

  it('informa o progresso para a barra de upload', async () => {
    tamanhos(20 * MB, 8 * MB);
    Video.compress.mockImplementation(
      async (_uri: string, _o: unknown, aoProgredir: (p: number) => void) => {
        aoProgredir(0.5);
        return 'file:///c.mp4';
      },
    );

    const vistos: number[] = [];
    await comprimirVideo('file:///o.mp4', (f) => vistos.push(f));

    expect(vistos).toContain(0.5);
  });
});
