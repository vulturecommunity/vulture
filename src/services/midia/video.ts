import * as FileSystem from 'expo-file-system/legacy';

/**
 * Compressão de vídeo no aparelho, antes do upload.
 *
 * POR QUE ISTO É O MAIOR GANHO DE CUSTO DISPONÍVEL
 *
 * O arquivo gravado sobe como sai da câmera: ~25 MB por minuto, sem recompressão. Vídeo é
 * o item dominante da conta a partir de alguns milhares de usuários, e cada megabyte
 * aparece duas vezes — no armazenamento do R2, para sempre, e no dado móvel de cada
 * pessoa que assistir.
 *
 * Comprimir aqui, e não no servidor, tem uma vantagem que transcodificação em nuvem não
 * dá: o byte economizado nunca chega a subir. O upload fica mais rápido em rede ruim, que
 * é a rede de quem está no estádio.
 *
 * O QUE NÃO FUNCIONA NO EXPO GO
 *
 * A compressão é um módulo nativo. No Expo Go ele não existe, e `comprimirVideo` devolve
 * o arquivo original sem reclamar — exatamente como o LiveKit cai no modo simulado. O
 * comportamento do app não muda; só a conta no fim do mês.
 */

/**
 * Teto de qualidade. 720p a ~2 Mbps é o ponto onde a perda deixa de ser visível num
 * celular e o arquivo ainda cai à metade.
 *
 * Gravar em 480p economizaria mais e foi descartado em CUSTOS.md: num app cujo produto é
 * vídeo, a qualidade visível é o produto.
 */
export const LARGURA_MAXIMA = 1280;
export const ALTURA_MAXIMA = 720;
export const BITRATE_ALVO = 2_000_000;

/** Abaixo disto, comprimir gasta bateria e tempo para economizar quase nada. */
const MINIMO_PARA_COMPRIMIR = 2 * 1024 * 1024;

export interface ResultadoDaCompressao {
  uri: string;
  /** bytes antes e depois; iguais quando nada foi feito */
  antes: number;
  depois: number;
  comprimido: boolean;
}

/** O módulo nativo existe neste binário? (false no Expo Go e na web) */
function moduloDisponivel(): boolean {
  try {
    // require tardio: no Expo Go o import de topo derrubaria o bundle inteiro
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-compressor') as { Video?: { compress?: unknown } };
    return typeof mod?.Video?.compress === 'function';
  } catch {
    return false;
  }
}

async function tamanhoDe(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory ? (info.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Comprime o vídeo quando dá, devolve o original quando não dá.
 *
 * Nunca lança: falha de compressão não pode impedir alguém de publicar. O pior caso é
 * subir o arquivo como estava, que é exatamente o que acontecia antes.
 */
export async function comprimirVideo(
  uri: string,
  aoProgredir?: (fracao: number) => void,
): Promise<ResultadoDaCompressao> {
  const antes = await tamanhoDe(uri);

  if (!moduloDisponivel() || antes < MINIMO_PARA_COMPRIMIR) {
    return { uri, antes, depois: antes, comprimido: false };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Video } = require('react-native-compressor') as {
      Video: {
        compress: (
          uri: string,
          opcoes: Record<string, unknown>,
          aoProgredir?: (p: number) => void,
        ) => Promise<string>;
      };
    };

    const saida = await Video.compress(
      uri,
      {
        compressionMethod: 'manual',
        maxSize: LARGURA_MAXIMA,
        bitrate: BITRATE_ALVO,
        // o áudio da torcida importa; 128 kbps mono já é generoso para voz e cantoria
        minimumFileSizeForCompress: MINIMO_PARA_COMPRIMIR / (1024 * 1024),
      },
      (p) => aoProgredir?.(Math.min(1, Math.max(0, p))),
    );

    const depois = await tamanhoDe(saida);

    // Compressão que engorda o arquivo acontece com vídeo já otimizado. Ficar com o
    // original é mais barato e mais fiel.
    if (depois === 0 || depois >= antes) {
      return { uri, antes, depois: antes, comprimido: false };
    }

    return { uri: saida, antes, depois, comprimido: true };
  } catch {
    return { uri, antes, depois: antes, comprimido: false };
  }
}

/** Quanto foi economizado, em porcentagem (0 quando nada mudou). Para log e telemetria. */
export function economiaEmPorcento(r: ResultadoDaCompressao): number {
  if (!r.comprimido || r.antes <= 0) return 0;
  return Math.round(((r.antes - r.depois) / r.antes) * 100);
}
