import { MatchServiceMock } from '../MatchServiceMock';

describe('MatchServiceMock', () => {
  const agora = () => new Date('2026-09-18T12:00:00.000Z');
  const servico = new MatchServiceMock(agora);

  it('lista as partidas ordenadas por data', async () => {
    const partidas = await servico.listarPartidas();
    expect(partidas.length).toBeGreaterThan(3);
    const datas = partidas.map((p) => p.dataHora);
    expect(datas).toEqual([...datas].sort());
  });

  it('próximo jogo é a primeira partida futura', async () => {
    const proximo = await servico.proximoJogo();
    expect(proximo).not.toBeNull();
    expect(proximo!.status).toBe('agendada');
    expect(new Date(proximo!.dataHora).getTime()).toBeGreaterThan(agora().getTime());
    expect([proximo!.mandante, proximo!.visitante]).toContain('Flamengo');
  });

  it('último resultado é a partida encerrada mais recente com placar', async () => {
    const ultimo = await servico.ultimoResultado();
    expect(ultimo).not.toBeNull();
    expect(ultimo!.status).toBe('encerrada');
    expect(ultimo!.placar).not.toBeNull();
    expect(new Date(ultimo!.dataHora).getTime()).toBeLessThan(agora().getTime());
  });
});
