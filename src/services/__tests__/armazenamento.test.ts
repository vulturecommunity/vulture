import { formatarBytes, medirArmazenamento } from '../armazenamento';

describe('formatarBytes', () => {
  it('escolhe a unidade e usa vírgula decimal', () => {
    expect(formatarBytes(2048)).toBe('2 KB');
    expect(formatarBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatarBytes(3 * 1024 * 1024 * 1024)).toBe('3 GB');
  });

  it('arredonda sem casas a partir de 100', () => {
    expect(formatarBytes(120 * 1024 * 1024)).toBe('120 MB');
  });

  it('trata valores inválidos como zero', () => {
    expect(formatarBytes(0)).toBe('0 KB');
    expect(formatarBytes(-10)).toBe('0 KB');
    expect(formatarBytes(Number.NaN)).toBe('0 KB');
  });
});

describe('medirArmazenamento', () => {
  it('devolve os quatro totais do aparelho', async () => {
    const uso = await medirArmazenamento();
    expect(uso.cacheBytes).toBeGreaterThan(0);
    expect(uso.midiaBytes).toBeGreaterThan(0);
    expect(uso.livreBytes).toBeGreaterThan(0);
    expect(uso.dadosBytes).toBeGreaterThanOrEqual(0);
  });
});
