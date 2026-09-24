import { dividirLegenda, extrairHashtags, mencionaApelido, normalizarHashtag } from '../hashtags';

describe('mencionaApelido', () => {
  it('encontra a menção sem diferenciar maiúsculas', () => {
    expect(mencionaApelido('boa demais @Nacao10!', 'nacao10')).toBe(true);
    expect(mencionaApelido('@nacao10 chegou', 'nacao10')).toBe(true);
  });
  it('não casa com apelido que só começa igual', () => {
    expect(mencionaApelido('fala @nacao10x', 'nacao10')).toBe(false);
    expect(mencionaApelido('fala @nacao10.oficial', 'nacao10')).toBe(false);
  });
  it('ignora o texto sem arroba e o apelido vazio', () => {
    expect(mencionaApelido('nacao10 é bom', 'nacao10')).toBe(false);
    expect(mencionaApelido('@ qualquer', '  ')).toBe(false);
  });
  it('aceita o apelido com ou sem @ na chamada', () => {
    expect(mencionaApelido('salve @golaco', '@golaco')).toBe(true);
  });
});

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
