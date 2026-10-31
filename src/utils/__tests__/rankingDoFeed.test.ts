import { ordenarPorRelevancia, pontuacaoBase, type VideoPontuavel } from '../rankingDoFeed';

const AGORA = new Date('2026-03-15T18:00:00Z').getTime();

function video(parcial: Partial<VideoPontuavel> & { id: string }): VideoPontuavel {
  return {
    autorId: 'autor-1',
    categoria: 'Torcida',
    criadoEm: new Date(AGORA).toISOString(),
    curtidas: 0,
    comentarios: 0,
    compartilhamentos: 0,
    visualizacoes: 0,
    ...parcial,
  };
}

/** Atalho: vídeo publicado há N horas. */
function hAtras(horas: number): string {
  return new Date(AGORA - horas * 3_600_000).toISOString();
}

const ids = (lista: VideoPontuavel[]) => lista.map((v) => v.id);

describe('pontuacaoBase', () => {
  it('um vídeo recém-publicado sem engajamento ainda vale alguma coisa', () => {
    // sem o piso, criador novo multiplicaria zero por qualquer coisa e nunca apareceria
    expect(pontuacaoBase(video({ id: 'a' }), AGORA)).toBeGreaterThan(0);
  });

  it('engajamento maior pontua mais, com a mesma idade', () => {
    const pouco = pontuacaoBase(video({ id: 'a', curtidas: 10 }), AGORA);
    const muito = pontuacaoBase(video({ id: 'b', curtidas: 1000 }), AGORA);
    expect(muito).toBeGreaterThan(pouco);
  });

  it('comprime a cauda: 100x mais curtidas não vale 100x mais score', () => {
    const dez = pontuacaoBase(video({ id: 'a', curtidas: 10 }), AGORA);
    const mil = pontuacaoBase(video({ id: 'b', curtidas: 1000 }), AGORA);
    // sem o logaritmo o feed vira um pódio congelado dos mesmos cinco vídeos
    expect(mil / dez).toBeLessThan(5);
  });

  it('o mesmo vídeo vale menos conforme envelhece', () => {
    const agora = pontuacaoBase(video({ id: 'a', curtidas: 100 }), AGORA);
    const ontem = pontuacaoBase(video({ id: 'b', curtidas: 100, criadoEm: hAtras(24) }), AGORA);
    const semana = pontuacaoBase(video({ id: 'c', curtidas: 100, criadoEm: hAtras(24 * 7) }), AGORA);
    expect(agora).toBeGreaterThan(ontem);
    expect(ontem).toBeGreaterThan(semana);
    // meia-vida de 24 h: em um dia sobra cerca de 37% do peso
    expect(ontem / agora).toBeCloseTo(Math.exp(-1), 2);
  });
});

describe('ordenarPorRelevancia', () => {
  it('põe o vídeo bom na frente do vídeo vazio da mesma hora', () => {
    const lista = [
      video({ id: 'vazio', autorId: 'a' }),
      video({ id: 'bom', autorId: 'b', curtidas: 500, comentarios: 30 }),
    ];
    expect(ids(ordenarPorRelevancia(lista, { agora: AGORA }))[0]).toBe('bom');
  });

  it('não deixa um autor só ocupar as primeiras posições', () => {
    // quatro vídeos iguais do mesmo autor contra um, mais fraco, de outro
    const lista = [
      ...[1, 2, 3, 4].map((n) =>
        video({ id: `prolifico-${n}`, autorId: 'prolifico', curtidas: 100 }),
      ),
      video({ id: 'outro', autorId: 'outro', curtidas: 60 }),
    ];
    const ordem = ids(ordenarPorRelevancia(lista, { agora: AGORA }));
    // sem rodízio o autor prolífico levaria as quatro primeiras e o 'outro' seria o 5º
    expect(ordem.indexOf('outro')).toBeLessThan(4);
  });

  it('sobe o vídeo da categoria que a pessoa escolheu no onboarding', () => {
    const lista = [
      video({ id: 'generico', autorId: 'a', categoria: 'Torcida', curtidas: 100 }),
      video({ id: 'do-interesse', autorId: 'b', categoria: 'Golaço', curtidas: 90 }),
    ];
    expect(ids(ordenarPorRelevancia(lista, { agora: AGORA }))[0]).toBe('generico');
    expect(
      ids(ordenarPorRelevancia(lista, { agora: AGORA, interesses: ['Golaço'] }))[0],
    ).toBe('do-interesse');
  });

  it('o vídeo que eu acabei de publicar vem primeiro no MEU feed', () => {
    const lista = [
      video({ id: 'campeao', autorId: 'outro', curtidas: 5000, comentarios: 400 }),
      video({ id: 'meu', autorId: 'eu' }),
    ];
    // sem o impulso de estreia a pessoa conclui que o app perdeu o vídeo dela
    expect(ids(ordenarPorRelevancia(lista, { agora: AGORA, meuId: 'eu' }))[0]).toBe('meu');
    // e isso vale só para quem publicou: para os outros o ranking é o normal
    expect(ids(ordenarPorRelevancia(lista, { agora: AGORA, meuId: 'terceiro' }))[0]).toBe(
      'campeao',
    );
  });

  it('o impulso de estreia expira em poucas horas', () => {
    const lista = [
      video({ id: 'campeao', autorId: 'outro', curtidas: 5000, comentarios: 400 }),
      video({ id: 'meu', autorId: 'eu', criadoEm: hAtras(5) }),
    ];
    expect(ids(ordenarPorRelevancia(lista, { agora: AGORA, meuId: 'eu' }))[0]).toBe('campeao');
  });

  it('o acervo fora da janela vai para o fim, em ordem cronológica, sem sumir', () => {
    const lista = [
      video({ id: 'antigo-a', autorId: 'a', curtidas: 9000, criadoEm: hAtras(24 * 40) }),
      video({ id: 'antigo-b', autorId: 'b', curtidas: 9000, criadoEm: hAtras(24 * 35) }),
      video({ id: 'recente', autorId: 'c' }),
    ];
    const ordem = ids(ordenarPorRelevancia(lista, { agora: AGORA }));
    expect(ordem[0]).toBe('recente');
    // nada é descartado, e entre os antigos o mais novo vem antes
    expect(ordem.slice(1)).toEqual(['antigo-b', 'antigo-a']);
  });

  it('não perde nem duplica vídeo', () => {
    const lista = [1, 2, 3, 4, 5, 6].map((n) =>
      video({ id: `v${n}`, autorId: `a${n % 2}`, curtidas: n * 10, criadoEm: hAtras(n) }),
    );
    const ordem = ids(ordenarPorRelevancia(lista, { agora: AGORA }));
    expect(ordem).toHaveLength(6);
    expect(new Set(ordem).size).toBe(6);
  });

  it('é determinístico: a mesma entrada dá a mesma ordem', () => {
    const lista = [1, 2, 3, 4].map((n) =>
      video({ id: `v${n}`, autorId: `a${n}`, curtidas: 50, criadoEm: hAtras(n) }),
    );
    const primeira = ids(ordenarPorRelevancia(lista, { agora: AGORA }));
    const segunda = ids(ordenarPorRelevancia(lista, { agora: AGORA }));
    expect(segunda).toEqual(primeira);
  });
});
