/** Lado maior máximo da foto. 12 MP em resolução nativa estoura a memória em Android médio. */
const LADO_MAXIMO_FOTO = 1920;

/**
 * Escolhe, entre os tamanhos que a câmera oferece ("LxA"), o maior com lado ≤ LADO_MAXIMO_FOTO.
 * Sem candidatos (ou lista vazia) devolve undefined e a câmera usa o padrão.
 */
export function escolherTamanhoDeFoto(
  tamanhos: string[],
  ladoMaximo = LADO_MAXIMO_FOTO,
): string | undefined {
  let melhor: { texto: string; area: number } | null = null;
  for (const texto of tamanhos) {
    const m = /^(\d+)x(\d+)$/.exec(texto.trim());
    if (!m) continue;
    const l = Number(m[1]);
    const a = Number(m[2]);
    if (Math.max(l, a) > ladoMaximo) continue;
    const area = l * a;
    if (!melhor || area > melhor.area) melhor = { texto: texto.trim(), area };
  }
  return melhor?.texto;
}
