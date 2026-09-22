/** Formata números grandes de forma compacta: 950, 1,2 mil, 3,4 mi. */
export function formatarContador(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return '0';
  if (valor < 1000) return String(Math.floor(valor));
  if (valor < 1_000_000) return `${trocarPonto(valor / 1000)} mil`;
  return `${trocarPonto(valor / 1_000_000)} mi`;
}

function trocarPonto(n: number): string {
  const texto = n >= 100 ? String(Math.floor(n)) : (Math.floor(n * 10) / 10).toString();
  return texto.replace('.', ',');
}

/** Formata segundos como m:ss (ex.: 65 → 1:05). */
export function formatarDuracao(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

/** Tempo relativo curto em pt-BR: agora, 5 min, 3 h, 2 d, 4 sem. */
export function tempoRelativo(dataIso: string, agora: Date = new Date()): string {
  const data = new Date(dataIso);
  const diffSeg = Math.max(0, Math.floor((agora.getTime() - data.getTime()) / 1000));
  if (diffSeg < 60) return 'agora';
  const min = Math.floor(diffSeg / 60);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `${dias} d`;
  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return `${semanas} sem`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `${meses} ${meses > 1 ? 'meses' : 'mês'}`;
  return `${Math.floor(dias / 365)} a`;
}

/** Data/hora curta: 18/09 20:30 */
export function formatarDataHora(dataIso: string): string {
  const d = new Date(dataIso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes} ${h}:${m}`;
}

/** Iniciais para avatar sem foto: "Maria Silva" → "MS". */
export function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/^@/, ''));
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * Quando alguém começou a seguir: "Hoje", "Ontem", "Há N dias" até 15 dias;
 * depois disso a data completa com ano (22/09/2026).
 */
export function formatarQuandoSeguiu(dataIso: string, agora: Date = new Date()): string {
  const data = new Date(dataIso);
  const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.max(0, Math.round((inicioDoDia(agora) - inicioDoDia(data)) / 86_400_000));
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias <= 15) return `Há ${dias} dias`;
  return formatarData(dataIso);
}

/** Data completa: 22/09/2026 */
export function formatarData(dataIso: string): string {
  const d = new Date(dataIso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

/** Hora curta para o chat: 20:30 */
export function formatarHora(dataIso: string): string {
  const d = new Date(dataIso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Separador de dia no chat: "Hoje", "Ontem" ou 22/09/2026. */
export function rotuloDoDia(dataIso: string, agora: Date = new Date()): string {
  const texto = formatarQuandoSeguiu(dataIso, agora);
  return texto.startsWith('Há ') ? formatarData(dataIso) : texto;
}

/** Abrevia o nome de um time para a faixa de placar: "Flamengo" → "FLA". */
export function abreviarTime(nome: string): string {
  const limpo = nome.trim();
  if (!limpo) return '???';
  const partes = limpo.split(/[\s-]+/).filter(Boolean);
  // nomes compostos curtos viram iniciais: "São Paulo" → "SPA"? não: mantém o primeiro termo
  const base = partes[0].length >= 3 ? partes[0] : partes.join('');
  return base.slice(0, 3).toUpperCase();
}

/** Dia e mês, para a faixa de placar: 20/09 */
export function formatarDiaEMes(dataIso: string): string {
  const d = new Date(dataIso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}
