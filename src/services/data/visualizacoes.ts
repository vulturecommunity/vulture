import { AppState } from 'react-native';

import { dataService } from './index';

/**
 * Fila de visualizações do aparelho.
 *
 * Um vídeo assistido gerava uma gravação no banco na hora. Parece pouco: com 100 mil
 * usuários vendo 30 vídeos por dia são 3 milhões de escritas diárias, e todas as do vídeo
 * em alta caem na MESMA linha — que é exatamente o registro que o Postgres tranca enquanto
 * atualiza. O contador de um número que ninguém confere ao segundo virava o maior gargalo
 * de escrita do app.
 *
 * Aqui os ids se acumulam por alguns segundos e vão de uma vez só. O envio também acontece
 * quando o app vai para segundo plano, para não perder o que estava na fila.
 */
const INTERVALO_MS = 5000;
const MAXIMO_NA_FILA = 50;

const pendentes = new Set<string>();
let temporizador: ReturnType<typeof setTimeout> | null = null;
let ouvindoAppState = false;

async function enviar(): Promise<void> {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  if (pendentes.size === 0) return;
  const lote = [...pendentes];
  pendentes.clear();
  try {
    await dataService().registrarVisualizacoes(lote);
  } catch {
    // visualização é métrica, não conteúdo: perder um lote na queda de rede não quebra nada
  }
}

function garantirOuvinteDeAppState() {
  if (ouvindoAppState) return;
  ouvindoAppState = true;
  AppState.addEventListener('change', (estado) => {
    if (estado !== 'active') void enviar();
  });
}

/** Marca um vídeo como assistido; o envio é agrupado. */
export function registrarVisualizacao(videoId: string): void {
  garantirOuvinteDeAppState();
  pendentes.add(videoId);
  if (pendentes.size >= MAXIMO_NA_FILA) {
    void enviar();
    return;
  }
  temporizador ??= setTimeout(() => void enviar(), INTERVALO_MS);
}

/** Força o envio do que está na fila (usado ao sair da conta e nos testes). */
export function enviarVisualizacoesPendentes(): Promise<void> {
  return enviar();
}
