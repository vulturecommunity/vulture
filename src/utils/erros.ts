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

/**
 * Código do erro quando ele é um `ErroDeAplicacao`; `null` para qualquer outra coisa.
 *
 * A tela precisa distinguir "senha errada" de "e-mail ainda não confirmado" para oferecer
 * a ação certa — e a mensagem em texto é o lugar errado para decidir isso, porque ela muda
 * com a tradução e com o humor de quem escreveu.
 */
export function codigoDoErro(erro: unknown): string | null {
  return erro instanceof ErroDeAplicacao ? erro.codigo : null;
}
