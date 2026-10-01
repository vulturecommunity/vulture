/**
 * Catálogo dos eventos de produto.
 *
 * POR QUE UM CATÁLOGO FECHADO, E NÃO STRING SOLTA
 *
 * Telemetria apodrece por divergência de nome: alguém manda `video_publicado`, outro
 * `publicou_video`, e seis meses depois o funil não fecha porque metade dos eventos está
 * num balde e metade no outro. O tipo abaixo obriga a decidir o nome uma vez.
 *
 * O QUE ESTÁ AQUI E O QUE NÃO ESTÁ
 *
 * Só o que responde a uma pergunta que muda decisão. Hoje as perguntas são:
 *
 *   1. As pessoas terminam o cadastro? (onde elas desistem)
 *   2. Quem entra volta? (push registrado é a única forma de trazer de volta)
 *   3. O palpite pega? — a aposta de produto que vale testar antes de investir em vídeo
 *   4. Alguém de fato assiste os vídeos, ou só rola o feed?
 *
 * Métrica de vaidade (total de telas abertas, cliques em botão) fica de fora de propósito:
 * enche o painel e não muda nada.
 */

export const EVENTOS = {
  // ---- funil de entrada: onde a pessoa desiste ----
  CADASTRO_INICIADO: 'cadastro_iniciado',
  CADASTRO_CONCLUIDO: 'cadastro_concluido',
  ONBOARDING_CONCLUIDO: 'onboarding_concluido',
  LOGIN: 'login',

  /**
   * O evento mais importante do app hoje. `push_tokens` está em zero, e sem token não há
   * como trazer ninguém de volta — nenhuma outra métrica importa se esta for zero.
   */
  PUSH_REGISTRADO: 'push_registrado',
  PUSH_RECUSADO: 'push_recusado',

  // ---- consumo ----
  VIDEO_ASSISTIDO: 'video_assistido',
  LIVE_ASSISTIDA: 'live_assistida',

  // ---- criação: o lado escasso de todo app social ----
  VIDEO_PUBLICADO: 'video_publicado',
  /** Economia da compressão. Separado de VIDEO_PUBLICADO de propósito: nem todo vídeo é
   *  comprimido (foto não é, Expo Go não é), e misturar os dois faria a contagem de
   *  publicações depender de um detalhe de infraestrutura. */
  VIDEO_COMPRIMIDO: 'video_comprimido',
  POST_PUBLICADO: 'post_publicado',
  LIVE_INICIADA: 'live_iniciada',

  // ---- palpite: a aposta de produto ----
  PALPITE_CRAVADO: 'palpite_cravado',
  LIGA_CRIADA: 'liga_criada',
  LIGA_ENTROU: 'liga_entrou',

  // ---- laço viral ----
  COMPARTILHOU: 'compartilhou',

  // ---- saída: tão informativo quanto a entrada ----
  CONTA_EXCLUIDA: 'conta_excluida',
} as const;

export type NomeDeEvento = (typeof EVENTOS)[keyof typeof EVENTOS];

/** Propriedades aceitas por evento. Valores simples: o PostHog não indexa objeto aninhado. */
export type PropriedadesDeEvento = Record<string, string | number | boolean | null>;
