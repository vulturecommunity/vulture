const REGEX_HASHTAG = /#([\p{L}\p{N}_]+)/gu;

/** Extrai hashtags únicas de um texto, sem o "#", preservando maiúsculas/minúsculas originais. */
export function extrairHashtags(texto: string): string[] {
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const m of texto.matchAll(REGEX_HASHTAG)) {
    const tag = m[1];
    const chave = tag.toLowerCase();
    if (!vistas.has(chave)) {
      vistas.add(chave);
      resultado.push(tag);
    }
  }
  return resultado;
}

/** Normaliza uma hashtag para busca/armazenamento: "#Maracanã " → "maracanã". */
export function normalizarHashtag(tag: string): string {
  return tag.trim().replace(/^#+/, '').toLowerCase();
}

/**
 * O texto chama esse apelido? Compara sem diferenciar maiúsculas e exige que o
 * apelido termine ali, para "@fla" não casar com "@flamengo".
 */
export function mencionaApelido(texto: string, apelido: string): boolean {
  const limpo = apelido.trim().replace(/^@+/, '');
  if (!limpo) return false;
  const escapado = limpo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`@${escapado}(?![\\p{L}\\p{N}_.])`, 'iu').test(texto);
}

export type TrechoDeLegenda = { tipo: 'texto'; valor: string } | { tipo: 'hashtag'; valor: string };

/** Divide uma legenda em trechos de texto e hashtags para renderização clicável. */
export function dividirLegenda(texto: string): TrechoDeLegenda[] {
  const trechos: TrechoDeLegenda[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(REGEX_HASHTAG)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimo) trechos.push({ tipo: 'texto', valor: texto.slice(ultimo, inicio) });
    trechos.push({ tipo: 'hashtag', valor: m[1] });
    ultimo = inicio + m[0].length;
  }
  if (ultimo < texto.length) trechos.push({ tipo: 'texto', valor: texto.slice(ultimo) });
  return trechos;
}
