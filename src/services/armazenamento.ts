import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';
import { Image } from 'expo-image';

export interface UsoDoArmazenamento {
  /** miniaturas e vídeos que o app baixou e pode baixar de novo */
  cacheBytes: number;
  /** vídeos e fotos que este aparelho publicou (modo demonstração) */
  midiaBytes: number;
  /** o banco local: contas, curtidas, conversas */
  dadosBytes: number;
  /** espaço ainda livre no aparelho */
  livreBytes: number;
}

function tamanhoDe(pasta: Directory): number {
  try {
    return pasta.exists ? (pasta.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/** Quanto o Vulture ocupa neste aparelho, separado por tipo. */
export async function medirArmazenamento(): Promise<UsoDoArmazenamento> {
  const cacheBytes = tamanhoDe(Paths.cache);
  // tudo que o aparelho publicou fica em document/vulture (ver services/midia)
  const midiaBytes = tamanhoDe(new Directory(Paths.document, 'vulture'));

  let dadosBytes = 0;
  try {
    const chaves = await AsyncStorage.getAllKeys();
    const pares = await AsyncStorage.multiGet(chaves.filter((c) => c.startsWith('vulture.')));
    dadosBytes = pares.reduce((total, [, valor]) => total + (valor?.length ?? 0), 0);
  } catch {
    dadosBytes = 0;
  }

  let livreBytes = 0;
  try {
    livreBytes = Paths.availableDiskSpace ?? 0;
  } catch {
    livreBytes = 0;
  }

  return { cacheBytes, midiaBytes, dadosBytes, livreBytes };
}

/**
 * Apaga o cache: miniaturas e arquivos temporários. Nada publicado se perde —
 * o app baixa de novo quando precisar.
 */
export async function limparCache(): Promise<void> {
  await Promise.all([
    Image.clearDiskCache().catch(() => false),
    Image.clearMemoryCache().catch(() => false),
  ]);
  try {
    for (const item of Paths.cache.list()) {
      try {
        item.delete();
      } catch {
        // arquivo em uso por um upload ou player: fica para a próxima
      }
    }
  } catch {
    // sem acesso à pasta de cache neste ambiente
  }
}

/** Formata bytes em KB/MB/GB, com vírgula decimal. */
export function formatarBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  const casas = valor >= 100 || i === 0 ? 0 : 1;
  const texto = valor.toFixed(casas).replace(/\.0$/, '').replace('.', ',');
  return `${texto} ${unidades[i]}`;
}
