/** Extrai uma mensagem legível de qualquer erro. */
export function mensagemDeErro(
  erro: unknown,
  padrao = 'Algo deu errado. Tente novamente.',
): string {
  if (erro instanceof Error && erro.message) return erro.message;
  if (typeof erro === 'string' && erro) return erro;
  if (erro && typeof erro === 'object' && 'message' in erro) {
    const m = (erro as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return padrao;
}

export class ErroDeAplicacao extends Error {
  constructor(
    mensagem: string,
    public readonly codigo: string = 'desconhecido',
  ) {
    super(mensagem);
    this.name = 'ErroDeAplicacao';
  }
}
