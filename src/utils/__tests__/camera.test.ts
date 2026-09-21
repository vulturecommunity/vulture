import { escolherTamanhoDeFoto } from '../camera';

describe('escolherTamanhoDeFoto', () => {
  it('escolhe o maior tamanho com lado maior dentro do limite', () => {
    const tamanhos = ['4000x3000', '3264x2448', '1920x1080', '1600x1200', '1280x720', '640x480'];
    expect(escolherTamanhoDeFoto(tamanhos)).toBe('1920x1080');
    expect(escolherTamanhoDeFoto(tamanhos, 1600)).toBe('1600x1200');
  });

  it('devolve undefined sem candidatos válidos', () => {
    expect(escolherTamanhoDeFoto([])).toBeUndefined();
    expect(escolherTamanhoDeFoto(['4000x3000', 'abc'])).toBeUndefined();
  });
});
