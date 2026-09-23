/**
 * Tradução dos jogos da Highlightly (soccer.highlightly.net) para a tabela public.partidas.
 * Arquivo sem dependências de Deno nem de React Native: a Edge Function e os testes do app
 * usam exatamente o mesmo código.
 *
 * O payload traz logos de clubes e ligas, que o Vulture ignora de propósito (app não oficial).
 */

/** Flamengo na Highlightly (GET /teams?name=Flamengo). */
export const ID_FLAMENGO_HIGHLIGHTLY = '108861';

export interface PartidaHighlightly {
  id: number;
  date: string;
  round?: string | null;
  country?: { code?: string | null } | null;
  league?: { id?: number; name?: string | null; season?: number | null } | null;
  homeTeam?: { id?: number; name?: string | null } | null;
  awayTeam?: { id?: number; name?: string | null } | null;
  venue?: { name?: string | null; city?: string | null } | null;
  state?: {
    clock?: number | null;
    description?: string | null;
    score?: { current?: string | null; penalties?: string | null } | null;
  } | null;
}

export type StatusDaPartida = 'agendada' | 'ao_vivo' | 'encerrada';

/** Linha de public.partidas (snake_case, como no banco). */
export interface LinhaDePartida {
  id: string;
  temporada: number;
  competicao: string;
  fase: string | null;
  mandante: string;
  visitante: string;
  sigla_mandante: string;
  sigla_visitante: string;
  data_hora: string;
  estadio: string | null;
  gols_mandante: number | null;
  gols_visitante: number | null;
  status: StatusDaPartida;
  minuto: number | null;
  nota: string | null;
}

function chave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Nome como o torcedor escreve e a sigla oficial dos adversários mais comuns. */
const CLUBES: Record<string, [nome: string, sigla: string]> = {
  flamengo: ['Flamengo', 'FLA'],
  fluminense: ['Fluminense', 'FLU'],
  vascodagama: ['Vasco da Gama', 'VAS'],
  botafogo: ['Botafogo', 'BOT'],
  palmeiras: ['Palmeiras', 'PAL'],
  corinthians: ['Corinthians', 'COR'],
  saopaulo: ['São Paulo', 'SAO'],
  saopaulofc: ['São Paulo', 'SAO'],
  santos: ['Santos', 'SAN'],
  gremio: ['Grêmio', 'GRE'],
  internacional: ['Internacional', 'INT'],
  atleticomg: ['Atlético-MG', 'CAM'],
  athleticoparanaense: ['Athletico-PR', 'CAP'],
  cruzeiro: ['Cruzeiro', 'CRU'],
  bahia: ['Bahia', 'BAH'],
  vitoria: ['Vitória', 'VIT'],
  fortaleza: ['Fortaleza', 'FOR'],
  ceara: ['Ceará', 'CEA'],
  sport: ['Sport', 'SPT'],
  sportrecife: ['Sport', 'SPT'],
  rbbragantino: ['Bragantino', 'BRA'],
  coritiba: ['Coritiba', 'CFC'],
  chapecoense: ['Chapecoense', 'CHA'],
  mirassol: ['Mirassol', 'MIR'],
  remo: ['Remo', 'REM'],
  juventude: ['Juventude', 'JUV'],
  goias: ['Goiás', 'GOI'],
  cuiaba: ['Cuiabá', 'CUI'],
  americamg: ['América-MG', 'AME'],
  bangu: ['Bangu', 'BAN'],
  madureiraec: ['Madureira', 'MAD'],
  portuguesarj: ['Portuguesa-RJ', 'POR'],
  voltaredonda: ['Volta Redonda', 'VRE'],
  sampaiocorrea: ['Sampaio Corrêa', 'SAM'],
  estudiantesdelaplata: ['Estudiantes', 'EST'],
  independientedelvalle: ['Independiente del Valle', 'IDV'],
  independientemedellin: ['Independiente Medellín', 'DIM'],
  riverplate: ['River Plate', 'RIV'],
  bocajuniors: ['Boca Juniors', 'BOC'],
  racingclub: ['Racing', 'RAC'],
  lanus: ['Lanús', 'LAN'],
  olimpia: ['Olimpia', 'OLI'],
  penarol: ['Peñarol', 'PEN'],
  nacional: ['Nacional', 'NAC'],
  cusco: ['Cusco', 'CUS'],
};

/** Clube fora da lista: 3 primeiras letras do primeiro nome significativo. */
function siglaGenerica(nome: string): string {
  const partes = nome.split(/[\s-]+/).filter((p) => p.length >= 3 && !/^(fc|ec|sc|ac)$/i.test(p));
  const base = partes[0] ?? nome;
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 3)
    .toUpperCase();
}

export function clube(nome: string): { nome: string; sigla: string } {
  const conhecido = CLUBES[chave(nome)];
  return conhecido
    ? { nome: conhecido[0], sigla: conhecido[1] }
    : { nome: nome.trim(), sigla: siglaGenerica(nome) };
}

const COMPETICOES: Record<string, string> = {
  'CONMEBOL Libertadores': 'Libertadores',
  'CONMEBOL Sudamericana': 'Sul-Americana',
  'CONMEBOL Recopa': 'Recopa',
  'Copa do Brasil': 'Copa do Brasil',
  'Supercopa do Brasil': 'Supercopa',
  'Friendlies Clubs': 'Amistoso',
  'FIFA Club World Cup': 'Mundial de Clubes',
  'FIFA Intercontinental Cup': 'Intercontinental',
};

export function nomeDaCompeticao(liga: string, pais: string | null | undefined): string {
  const limpo = liga.trim();
  // "Serie A" também é o italiano: só vira Brasileirão quando o jogo é no Brasil
  if (/^serie a$/i.test(limpo) && pais === 'BR') return 'Brasileirão';
  if (/^serie b$/i.test(limpo) && pais === 'BR') return 'Série B';
  if (/^carioca/i.test(limpo)) return 'Carioca';
  return COMPETICOES[limpo] ?? limpo;
}

/** "Regular Season - 38" → "38ª rodada"; "Semi-finals" → "Semifinal". */
export function traduzirFase(rodada: string | null | undefined): string | null {
  const r = (rodada ?? '').trim();
  if (!r || /friendl/i.test(r)) return null;
  const numero = /^regular season\s*-\s*(\d+)$/i.exec(r);
  if (numero) return `${numero[1]}ª rodada`;
  const grupos = /^group stage\s*-\s*(\d+)$/i.exec(r);
  if (grupos) return `Fase de grupos · ${grupos[1]}ª rodada`;
  const fases: [RegExp, string][] = [
    [/^group stage$/i, 'Fase de grupos'],
    [/^round of 32$/i, '16 avos de final'],
    [/^round of 16$/i, 'Oitavas'],
    [/^quarter-?finals?$/i, 'Quartas'],
    [/^semi-?finals?$/i, 'Semifinal'],
    [/^final$/i, 'Final'],
  ];
  return fases.find(([regex]) => regex.test(r))?.[1] ?? r;
}

/** Status do jogo; `null` para adiado/cancelado/abandonado (sai do calendário). */
export function statusDe(descricao: string | null | undefined): StatusDaPartida | null {
  const d = (descricao ?? '').trim().toLowerCase();
  if (!d || d === 'not started' || d.includes('to be announced') || d.includes('to be defined')) {
    return 'agendada';
  }
  if (d.startsWith('finished') || d === 'awarded') return 'encerrada';
  if (['postponed', 'cancelled', 'canceled', 'abandoned'].includes(d)) return null;
  return 'ao_vivo';
}

/** "2 - 1" → [2, 1] */
export function lerPlacar(texto: string | null | undefined): [number, number] | null {
  const m = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(texto ?? '');
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function paraLinhaDePartida(p: PartidaHighlightly): LinhaDePartida | null {
  const data = new Date(p.date);
  const status = statusDe(p.state?.description);
  const casa = p.homeTeam?.name?.trim();
  const fora = p.awayTeam?.name?.trim();
  if (!p.id || Number.isNaN(data.getTime()) || !status || !casa || !fora) return null;

  const placar = status === 'agendada' ? null : lerPlacar(p.state?.score?.current);
  const penaltis = lerPlacar(p.state?.score?.penalties);
  const descricao = (p.state?.description ?? '').toLowerCase();
  let nota: string | null = null;
  if (status === 'encerrada' && penaltis) nota = `pênaltis ${penaltis[0]}–${penaltis[1]}`;
  else if (status === 'encerrada' && descricao.includes('extra time')) nota = 'prorrogação';

  const mandante = clube(casa);
  const visitante = clube(fora);
  return {
    id: `hl-${p.id}`,
    temporada: p.league?.season ?? data.getUTCFullYear(),
    competicao: nomeDaCompeticao(p.league?.name ?? '', p.country?.code),
    fase: traduzirFase(p.round),
    mandante: mandante.nome,
    visitante: visitante.nome,
    sigla_mandante: mandante.sigla,
    sigla_visitante: visitante.sigla,
    data_hora: data.toISOString(),
    estadio: p.venue?.name?.trim() || null,
    gols_mandante: placar ? placar[0] : null,
    gols_visitante: placar ? placar[1] : null,
    status,
    minuto: status === 'ao_vivo' ? (p.state?.clock ?? null) : null,
    nota,
  };
}
