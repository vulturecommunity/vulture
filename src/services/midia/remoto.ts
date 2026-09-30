import { File } from 'expo-file-system';

import { ErroDeAplicacao } from '@/utils/erros';

/**
 * Onde a mídia do app mora.
 *
 * O Storage da Supabase cobra egress, e egress é ~85% do custo de um app de vídeo: o
 * piloto foi bloqueado com 27 GB servidos a partir de 65 MB de arquivos, porque o mesmo
 * vídeo é rebaixado toda vez que reaparece no feed. O Cloudflare R2 não cobra saída —
 * nenhuma, sem teto — então é para lá que a mídia nova vai.
 *
 * A troca é gradual de propósito:
 *   * sem `EXPO_PUBLIC_MIDIA_URL` no .env, tudo continua no Storage da Supabase;
 *   * com a variável preenchida, os uploads NOVOS vão para o R2;
 *   * os arquivos antigos continuam onde estão e seguem sendo servidos — as URLs estão
 *     gravadas no banco e não precisam mudar.
 *
 * Nenhum arquivo é migrado. Um app de mídia não pode depender de um "grande dia da
 * migração": o caminho seguro é parar de crescer de um lado e deixar o outro escoar.
 */

export type PastaDeMidia = 'videos' | 'thumbnails' | 'avatars' | 'posts';

/**
 * Um ano, imutável. Vale para CDN e para o aparelho.
 *
 * É o mesmo valor que o upload para o Storage da Supabase usava e que se perdeu na
 * migração para o R2 — sem ele, o arquivo é rebaixado de novo a cada exibição.
 */
export const CACHE_DE_MIDIA = 'public, max-age=31536000, immutable';

export interface ConfiguracaoDeMidia {
  /** base pública do bucket, sem barra no fim (ex.: https://midia.seuapp.com) */
  basePublica: string;
}

export function configuracaoDoR2(): ConfiguracaoDeMidia | null {
  const base = process.env.EXPO_PUBLIC_MIDIA_URL?.trim();
  if (!base || base.includes('SEU-') || !base.startsWith('http')) return null;
  return { basePublica: base.replace(/\/+$/, '') };
}

/** true quando os uploads novos devem ir para o R2. */
export function usandoR2(): boolean {
  return configuracaoDoR2() !== null;
}

export function urlPublicaNoR2(pasta: PastaDeMidia, caminho: string): string | null {
  const cfg = configuracaoDoR2();
  return cfg ? `${cfg.basePublica}/${pasta}/${caminho}` : null;
}

export function ehUrlDoR2(url: string | null | undefined): boolean {
  const cfg = configuracaoDoR2();
  return !!cfg && !!url && url.startsWith(`${cfg.basePublica}/`);
}

/** "videos/<usuario>/<id>.mp4" a partir da URL pública; null se não for do R2. */
export function chaveDoR2(url: string | null | undefined): string | null {
  const cfg = configuracaoDoR2();
  if (!cfg || !url || !url.startsWith(`${cfg.basePublica}/`)) return null;
  const chave = url.slice(cfg.basePublica.length + 1).split('?')[0];
  return chave || null;
}

export interface DestinoAssinado {
  metodo: 'PUT';
  urlDeUpload: string;
  urlPublica: string;
}

export interface ChamadaDeFuncao {
  /** invoca uma Edge Function do Supabase com o JWT do usuário */
  invocar: <T>(nome: string, corpo: Record<string, unknown>) => Promise<T>;
}

function tamanhoDe(uriLocal: string): number | undefined {
  try {
    return new File(uriLocal).size ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Envia um arquivo para o R2 e devolve a URL pública.
 *
 * O arquivo nunca passa pela Edge Function: ela só assina a URL, e o `UploadTask` do
 * expo-file-system sobe direto para o R2 — o que mantém o progresso real da barra e não
 * gasta tempo de execução da função com megabytes de vídeo.
 */
export async function enviarParaR2(
  funcoes: ChamadaDeFuncao,
  pasta: PastaDeMidia,
  caminho: string,
  uriLocal: string,
  tipoMime: string,
  aoProgredir?: (fracao: number) => void,
): Promise<string> {
  const destino = await funcoes.invocar<DestinoAssinado>('midia-assinar', {
    pasta,
    caminho,
    tipoMime,
    bytes: tamanhoDe(uriLocal),
  });
  if (!destino?.urlDeUpload || !destino?.urlPublica) {
    throw new ErroDeAplicacao('Falha ao preparar o envio da mídia.', 'midia_sem_assinatura');
  }

  const arquivo = new File(uriLocal);
  const tarefa = arquivo.createUploadTask(destino.urlDeUpload, {
    httpMethod: 'PUT',
    headers: {
      // a assinatura vai na querystring, então estes cabeçalhos são só metadados que o
      // R2 guarda no objeto e devolve em toda leitura
      'Content-Type': tipoMime,
      // Sem isto, o arquivo volta sem instrução de cache: o CDN não guarda na borda, o
      // aparelho rebaixa tudo de novo a cada rolagem do feed, e cada visualização vira
      // uma operação de leitura cobrada. Mídia aqui é imutável (cada arquivo tem um id
      // único e nunca é sobrescrito), então cache de um ano com `immutable` é seguro —
      // e é o que faz o segundo play sair do aparelho, sem rede e sem custo.
      'Cache-Control': CACHE_DE_MIDIA,
    },
    mimeType: tipoMime,
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) aoProgredir?.(bytesSent / totalBytes);
    },
  });
  const resposta = await tarefa.uploadAsync();
  if (resposta.status < 200 || resposta.status >= 300) {
    throw new ErroDeAplicacao(
      `Falha no upload da mídia (${resposta.status}).`,
      'upload',
    );
  }
  return destino.urlPublica;
}

/**
 * Apaga chaves no R2 pelo servidor. Melhor esforço: arquivo órfão custa armazenamento,
 * não integridade, e nunca vale derrubar a exclusão do post por causa disso.
 */
export async function apagarNoR2(funcoes: ChamadaDeFuncao, chaves: string[]): Promise<void> {
  const validas = chaves.filter(Boolean);
  if (validas.length === 0 || !usandoR2()) return;
  try {
    await funcoes.invocar('midia-apagar', { chaves: validas });
  } catch {
    // sem rede ou função fora do ar: o arquivo fica, o registro já foi
  }
}
