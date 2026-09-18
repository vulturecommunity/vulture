import { dividirLegenda, extrairHashtags, normalizarHashtag } from '../hashtags';

describe('extrairHashtags', () => {
  it('extrai tags únicas com acentos e ignora duplicadas', () => {
    expect(extrairHashtags('Festa no #Maracanã com a #torcida #Torcida #golaço!')).toEqual([
      'Maracanã',
      'torcida',
      'golaço',
    ]);
  });
  it('retorna vazio sem hashtags', () => {
    expect(extrairHashtags('sem tags aqui')).toEqual([]);
  });
});

describe('normalizarHashtag', () => {
  it('remove # e espaços, deixa minúsculo', () => {
    expect(normalizarHashtag('  #Maracanã ')).toBe('maracanã');
    expect(normalizarHashtag('##Base')).toBe('base');
  });
});

describe('dividirLegenda', () => {
  it('separa texto e hashtags na ordem', () => {
    expect(dividirLegenda('Vai #Mengo hoje #Maraca')).toEqual([
      { tipo: 'texto', valor: 'Vai ' },
      { tipo: 'hashtag', valor: 'Mengo' },
      { tipo: 'texto', valor: ' hoje ' },
      { tipo: 'hashtag', valor: 'Maraca' },
    ]);
  });
  it('legenda sem hashtag vira um único trecho', () => {
    expect(dividirLegenda('oi')).toEqual([{ tipo: 'texto', valor: 'oi' }]);
  });
});
