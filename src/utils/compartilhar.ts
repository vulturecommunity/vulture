import { Share } from 'react-native';

import { configuracaoSupabase } from '@/services/data/supabase/cliente';

/**
 * Textos e links de compartilhamento.
 *
 * O QUE ESTAVA ERRADO ANTES
 *
 * As mensagens levavam links `vulture://video/<id>`. No WhatsApp e no Gmail isso não vira
 * link clicável, não gera prévia e não abre nada para quem não tem o app — o destinatário
 * recebia uma frase seguida de um texto estranho. Era isso que fazia o compartilhamento
 * parecer amador ao lado de TikTok e Kwai.
 *
 * O QUE MUDOU
 *
 * Agora o link é https e aponta para a Edge Function `abrir`, que devolve uma página com
 * Open Graph. Consequência prática: o WhatsApp mostra um CARD com miniatura, título e
 * descrição, e o link abre o app em quem já tem o Vulture. É a mesma mecânica que as
 * plataformas grandes usam — a diferença é o conteúdo, que aqui é rubro-negro.
 *
 * FORMATO DA MENSAGEM
 *
 * Três partes, na ordem em que o olho lê: um gancho curto, o conteúdo entre aspas quando
 * existe, e o link sozinho na última linha (link no meio de parágrafo atrapalha a prévia
 * em vários aplicativos).
 */

/** Base https dos links compartilháveis; null quando o backend não está configurado. */
function baseDeLinks(): string | null {
  const cfg = configuracaoSupabase();
  return cfg ? `${cfg.url}/functions/v1/abrir` : null;
}

export function linkDoVideo(id: string): string {
  return `${baseDeLinks() ?? 'vulture://video'}/v/${id}`;
}

export function linkDoPost(id: string): string {
  return `${baseDeLinks() ?? 'vulture://arquibancada/post'}/p/${id}`;
}

export function linkDoPerfil(apelido: string): string {
  return `${baseDeLinks() ?? 'vulture://usuario'}/u/${apelido}`;
}

export function linkDaLiga(codigo: string): string {
  return `${baseDeLinks() ?? 'vulture://arquibancada'}/liga/${codigo}`;
}

/** Corta um texto longo sem quebrar palavra no meio. */
function resumir(texto: string, limite = 110): string {
  const limpo = texto.trim().replace(/\s+/g, ' ');
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return `${corte.slice(0, ultimoEspaco > 60 ? ultimoEspaco : limite).trimEnd()}…`;
}

/** Monta a mensagem final: gancho, conteúdo e link em linhas separadas. */
function montar(partes: (string | null)[]): string {
  return partes.filter(Boolean).join('\n\n');
}

export interface ConteudoCompartilhavel {
  mensagem: string;
  titulo: string;
  url: string;
}

export function compartilharVideo(dados: {
  id: string;
  legenda: string;
  apelido: string;
}): ConteudoCompartilhavel {
  const url = linkDoVideo(dados.id);
  const legenda = dados.legenda.trim();
  return {
    titulo: `Vídeo de @${dados.apelido} no Vulture`,
    url,
    mensagem: montar([
      '🔴⚫ Olha esse vídeo da nação no Vulture',
      legenda ? `"${resumir(legenda)}"\n— @${dados.apelido}` : `Postado por @${dados.apelido}`,
      url,
    ]),
  };
}

export function compartilharPost(dados: {
  id: string;
  texto: string;
  apelido: string;
}): ConteudoCompartilhavel {
  const url = linkDoPost(dados.id);
  const texto = dados.texto.trim();
  return {
    titulo: `Resenha de @${dados.apelido} no Vulture`,
    url,
    mensagem: montar([
      '🦅 Resenha na Arquibancada do Vulture',
      texto ? `"${resumir(texto, 160)}"\n— @${dados.apelido}` : `De @${dados.apelido}`,
      url,
    ]),
  };
}

export function compartilharPerfil(dados: { apelido: string }): ConteudoCompartilhavel {
  const url = linkDoPerfil(dados.apelido);
  return {
    titulo: 'Cola comigo no Vulture',
    url,
    mensagem: montar([
      '🔴⚫ Tô no Vulture, o app da nação rubro-negra',
      `Me acha por lá: @${dados.apelido}\nTem resenha, vídeo da torcida, live e ranking de palpites do Mengão.`,
      url,
    ]),
  };
}

export function compartilharLiga(dados: { nome: string; codigo: string }): ConteudoCompartilhavel {
  const url = linkDaLiga(dados.codigo);
  return {
    titulo: `Liga ${dados.nome} no Vulture`,
    url,
    mensagem: montar([
      `🏆 Criei a liga "${dados.nome}" no Vulture — bora ver quem entende de Mengão`,
      `Código de entrada: ${dados.codigo}\n\nCravar o placar vale 10 pontos, acertar o saldo vale 5. No fim do mês, o pódio fica registrado no perfil.`,
      url,
    ]),
  };
}

/**
 * Abre a folha nativa de compartilhamento.
 *
 * `url` vai separado de `message` de propósito: no iOS a folha usa esse campo para gerar
 * a prévia rica; no Android ele é ignorado, e por isso o link também aparece dentro da
 * mensagem. Sem os dois, um dos sistemas fica sem link.
 */
export async function abrirCompartilhamento(
  conteudo: ConteudoCompartilhavel,
): Promise<boolean> {
  try {
    const resultado = await Share.share(
      { message: conteudo.mensagem, url: conteudo.url, title: conteudo.titulo },
      { subject: conteudo.titulo, dialogTitle: conteudo.titulo },
    );
    return resultado.action === Share.sharedAction;
  } catch {
    // usuário fechou a folha, ou a plataforma não suporta
    return false;
  }
}
