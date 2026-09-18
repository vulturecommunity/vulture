export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function senhaValida(senha: string): boolean {
  return senha.length >= 6;
}

/** Apelido: 3 a 20 caracteres, letras, números, ponto e underline. */
export function apelidoValido(apelido: string): boolean {
  return /^[a-z0-9._]{3,20}$/.test(apelido);
}

export function normalizarApelido(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);
}
