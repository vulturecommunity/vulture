import * as Sharing from 'expo-sharing';

import { EVENTOS, registrar, registrarErro } from '@/services/telemetria';

/**
 * Compartilhar uma imagem gerada no aparelho.
 *
 * POR QUE NÃO É O `Share` DO REACT NATIVE
 *
 * O `Share.share` só manda texto e URL. Para entregar um arquivo ao Instagram Stories ou
 * ao X é preciso a folha de compartilhamento do sistema com UTI/mimetype, que é o que o
 * `expo-sharing` expõe.
 *
 * DEGRADAÇÃO
 *
 * Quando a captura ou a folha não estão disponíveis (web, ou aparelho sem app que receba
 * imagem), devolve `false` e quem chamou cai no compartilhamento por link, que funciona
 * em qualquer lugar. Nunca lança: compartilhar é um extra, não pode quebrar a tela.
 */
/**
 * O que precisamos de um alvo de captura: só o método `capture`.
 *
 * Tipar pelo uso, e não pela classe `ViewShot` inteira, mantém esta função testável sem
 * montar um componente nativo.
 */
export interface AlvoDeCaptura {
  capture?: () => Promise<string>;
}

export interface ResultadoDoCompartilhamento {
  compartilhou: boolean;
  /** por que não deu, quando não deu — para a tela decidir se avisa ou cai no link */
  motivo?: 'sem-suporte' | 'falha-na-captura' | 'cancelado';
}

export async function compartilharImagemDoPalpite(
  alvo: AlvoDeCaptura | null,
  dialogo = 'Compartilhar palpite',
): Promise<ResultadoDoCompartilhamento> {
  if (!alvo?.capture) return { compartilhou: false, motivo: 'sem-suporte' };

  let arquivo: string;
  try {
    arquivo = await alvo.capture();
    if (!arquivo) return { compartilhou: false, motivo: 'falha-na-captura' };
  } catch (erro) {
    registrarErro(erro, { onde: 'capturarCardDoPalpite' });
    return { compartilhou: false, motivo: 'falha-na-captura' };
  }

  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { compartilhou: false, motivo: 'sem-suporte' };
    }
    await Sharing.shareAsync(arquivo, {
      mimeType: 'image/png',
      dialogTitle: dialogo,
      // UTI é o que o iOS usa para decidir quais apps aparecem na folha
      UTI: 'public.png',
    });
    registrar(EVENTOS.COMPARTILHOU, { tipo: 'palpite', formato: 'imagem' });
    return { compartilhou: true };
  } catch {
    // a folha foi fechada, ou nenhum app aceita imagem
    return { compartilhou: false, motivo: 'cancelado' };
  }
}
