import {
  formatarContador,
  formatarData,
  formatarDataHora,
  formatarDuracao,
  formatarHora,
  formatarQuandoSeguiu,
  iniciais,
  rotuloDoDia,
  tempoRelativo,
} from '../formatadores';

describe('formatarContador', () => {
  it('mostra números pequenos inteiros', () => {
    expect(formatarContador(0)).toBe('0');
    expect(formatarContador(999)).toBe('999');
  });
  it('abrevia milhares e milhões em pt-BR', () => {
    expect(formatarContador(1000)).toBe('1 mil');
    expect(formatarContador(1234)).toBe('1,2 mil');
    expect(formatarContador(120_500)).toBe('120 mil');
    expect(formatarContador(3_400_000)).toBe('3,4 mi');
  });
  it('trata valores inválidos', () => {
    expect(formatarContador(-5)).toBe('0');
    expect(formatarContador(Number.NaN)).toBe('0');
  });
});

describe('formatarDuracao', () => {
  it('formata m:ss', () => {
    expect(formatarDuracao(0)).toBe('0:00');
    expect(formatarDuracao(65)).toBe('1:05');
    expect(formatarDuracao(59.9)).toBe('0:59');
  });
});

describe('tempoRelativo', () => {
  const agora = new Date('2026-09-18T12:00:00Z');
  const ha = (ms: number) => new Date(agora.getTime() - ms).toISOString();
  it('cobre segundos, minutos, horas, dias, semanas e meses', () => {
    expect(tempoRelativo(ha(10_000), agora)).toBe('agora');
    expect(tempoRelativo(ha(5 * 60_000), agora)).toBe('5 min');
    expect(tempoRelativo(ha(3 * 3_600_000), agora)).toBe('3 h');
    expect(tempoRelativo(ha(2 * 86_400_000), agora)).toBe('2 d');
    expect(tempoRelativo(ha(15 * 86_400_000), agora)).toBe('2 sem');
    expect(tempoRelativo(ha(70 * 86_400_000), agora)).toBe('2 meses');
    expect(tempoRelativo(ha(400 * 86_400_000), agora)).toBe('1 a');
  });
});

describe('formatarDataHora', () => {
  it('formata dd/mm hh:mm', () => {
    const d = new Date(2026, 8, 18, 20, 5);
    expect(formatarDataHora(d.toISOString())).toBe('18/09 20:05');
  });
});

describe('iniciais', () => {
  it('extrai iniciais de nomes e apelidos', () => {
    expect(iniciais('Maria Silva')).toBe('MS');
    expect(iniciais('@urubu')).toBe('UR');
    expect(iniciais('  ')).toBe('?');
  });
});

describe('formatarQuandoSeguiu', () => {
  const agora = new Date('2026-09-22T15:00:00');
  const diasAtras = (d: number) => new Date(agora.getTime() - d * 86_400_000).toISOString();

  it('mostra Hoje, Ontem e "Há N dias" até 15 dias', () => {
    expect(formatarQuandoSeguiu(agora.toISOString(), agora)).toBe('Hoje');
    expect(formatarQuandoSeguiu(diasAtras(1), agora)).toBe('Ontem');
    expect(formatarQuandoSeguiu(diasAtras(3), agora)).toBe('Há 3 dias');
    expect(formatarQuandoSeguiu(diasAtras(15), agora)).toBe('Há 15 dias');
  });

  it('passados 15 dias mostra a data completa com ano', () => {
    expect(formatarQuandoSeguiu(diasAtras(16), agora)).toBe('06/09/2026');
    expect(formatarQuandoSeguiu(diasAtras(400), agora)).toBe('18/08/2025');
  });

  it('formatarData e rotuloDoDia', () => {
    expect(formatarData('2026-09-22T15:00:00')).toBe('22/09/2026');
    expect(rotuloDoDia(agora.toISOString(), agora)).toBe('Hoje');
    expect(rotuloDoDia(diasAtras(1), agora)).toBe('Ontem');
    expect(rotuloDoDia(diasAtras(3), agora)).toBe('19/09/2026');
  });

  it('formatarHora mostra hh:mm', () => {
    expect(formatarHora('2026-09-22T08:05:00')).toBe('08:05');
  });
});
