import dados from './partidas.json';
import type { CalendarioService, MatchService, Partida } from './types';

interface PartidaBruta {
  id: string;
  competicao: string;
  mandante: string;
  visitante: string;
  /** dias em relação a hoje (negativo = passado) para a demo nunca ficar "velha" */
  diasRelativos: number;
  hora: string;
  estadio: string;
  placar: { mandante: number; visitante: number } | null;
}

function dataDe(diasRelativos: number, hora: string, agora: Date): string {
  const [h, m] = hora.split(':').map(Number);
  const d = new Date(agora);
  d.setDate(d.getDate() + diasRelativos);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Partidas a partir de um JSON local, com datas relativas a "hoje". */
export class MatchServiceMock implements MatchService, CalendarioService {
  constructor(private readonly agora: () => Date = () => new Date()) {}

  async listarPartidas(): Promise<Partida[]> {
    const agora = this.agora();
    return (dados.partidas as PartidaBruta[])
      .map<Partida>((p) => {
        const dataHora = dataDe(p.diasRelativos, p.hora, agora);
        const passou = new Date(dataHora).getTime() < agora.getTime();
        return {
          id: p.id,
          competicao: p.competicao,
          mandante: p.mandante,
          visitante: p.visitante,
          dataHora,
          estadio: p.estadio,
          placar: p.placar,
          status: passou ? 'encerrada' : 'agendada',
        };
      })
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  }

  listarTemporada(): Promise<Partida[]> {
    return this.listarPartidas();
  }

  async proximoJogo(): Promise<Partida | null> {
    const partidas = await this.listarPartidas();
    return partidas.find((p) => p.status !== 'encerrada') ?? null;
  }

  async ultimoResultado(): Promise<Partida | null> {
    const partidas = await this.listarPartidas();
    return [...partidas].reverse().find((p) => p.status === 'encerrada' && p.placar) ?? null;
  }
}
