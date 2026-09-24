import type { Publico, PublicoDosCurtidos } from '@/stores/ajustesStore';

export const ROTULO_PUBLICO: Record<Publico, string> = {
  todos: 'Todos',
  seguidores: 'Seguidores',
  ninguem: 'Ninguém',
};

export const ROTULO_CURTIDOS: Record<PublicoDosCurtidos, string> = {
  seguidores: 'Seguidores',
  somenteEu: 'Somente você',
};

export function ligadoOuDesligado(valor: boolean): string {
  return valor ? 'Ativado' : 'Desativado';
}
