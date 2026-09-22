import { dataService } from '@/services/data';

/** Token registrado nesta sessão do app (para remover ao sair da conta). */
let tokenRegistrado: string | null = null;

export function lembrarTokenRegistrado(token: string): void {
  tokenRegistrado = token;
}

/** Remove o token deste aparelho no servidor (chamado no logout). */
export async function esquecerTokenPush(): Promise<void> {
  const token = tokenRegistrado;
  tokenRegistrado = null;
  if (!token) return;
  try {
    await dataService().removerTokenPush(token);
  } catch {
    // servidor indisponível: o token expira sozinho
  }
}
