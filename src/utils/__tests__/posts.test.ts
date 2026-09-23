import type { NovaMidia } from '@/services/data/types';

import {
  normalizarMidias,
  validarMidiasDoPost,
  validarTextoDoPost,
  validarVideoDoPost,
} from '../posts';

const MB = 1024 * 1024;
const imagem: NovaMidia = { tipo: 'imagem', uriLocal: 'file:///a.jpg', largura: 1080, altura: 720 };
const gif: NovaMidia = {
  tipo: 'gif',
  url: 'https://media1.giphy.com/x.webp',
  largura: 356,
  altura: 200,
};
const video = (duracao = 20, tamanhoBytes = 8 * MB): NovaMidia => ({
  tipo: 'video',
  uriLocal: 'file:///v.mp4',
  largura: 720,
  altura: 1280,
  duracao,
  tamanhoBytes,
});

describe('anexos de post', () => {
  it('aceita até 4 imagens, ou 1 vídeo, ou 1 GIF', () => {
    expect(() => validarMidiasDoPost([imagem, imagem, imagem, imagem])).not.toThrow();
    expect(() => validarMidiasDoPost([video()])).not.toThrow();
    expect(() => validarMidiasDoPost([gif])).not.toThrow();
    expect(() => validarMidiasDoPost([])).not.toThrow();
  });

  it('recusa 5 imagens e vídeo ou GIF acompanhados', () => {
    expect(() => validarMidiasDoPost([imagem, imagem, imagem, imagem, imagem])).toThrow('até 4');
    expect(() => validarMidiasDoPost([video(), imagem])).toThrow('sozinhos');
    expect(() => validarMidiasDoPost([gif, gif])).toThrow('sozinhos');
  });

  it('vídeo até 30 s e 15 MB, com a medida no erro', () => {
    expect(() => validarVideoDoPost(30.3, 15 * MB)).not.toThrow();
    expect(() => validarVideoDoPost(45, 5 * MB)).toThrow('Esse tem 45 s');
    expect(() => validarVideoDoPost(10, 22 * MB)).toThrow('Esse tem 22 MB');
    expect(() => validarMidiasDoPost([video(60)])).toThrow('30 segundos');
  });

  it('texto vazio só vale quando há mídia', () => {
    expect(() => validarTextoDoPost('  ')).toThrow('Escreva alguma coisa');
    expect(validarTextoDoPost('  ', true)).toBe('');
  });

  it('normaliza o jsonb do banco e descarta o que não for anexo', () => {
    expect(
      normalizarMidias([
        { tipo: 'imagem', url: 'https://x/a.jpg', largura: 1080, altura: 720 },
        { tipo: 'video', url: 'https://x/v.mp4', thumbnailUrl: 'https://x/v.jpg', duracao: 12 },
        { tipo: 'pdf', url: 'https://x/a.pdf' },
        { tipo: 'gif' },
        null,
      ]),
    ).toEqual([
      {
        tipo: 'imagem',
        url: 'https://x/a.jpg',
        thumbnailUrl: null,
        largura: 1080,
        altura: 720,
        duracao: null,
      },
      {
        tipo: 'video',
        url: 'https://x/v.mp4',
        thumbnailUrl: 'https://x/v.jpg',
        largura: null,
        altura: null,
        duracao: 12,
      },
    ]);
    expect(normalizarMidias(null)).toEqual([]);
  });
});
