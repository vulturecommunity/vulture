import type { Interesse } from '@/constants/interesses';

/**
 * Ranking da aba "Para você" — espelho em TypeScript da fórmula que vive no Postgres.
 *
 * A conta de verdade, para o driver Supabase, está em `recalcular_feed_scores()` na
 * migration `20261004130000_ranking_do_feed.sql`. Este arquivo existe porque o modo
 * demonstração não tem banco: sem ele o mock continuaria cronológico e a tela que o
 * desenvolvedor vê no Expo Go seria outro produto, com outro comportamento, do que o
 * APK entrega. As duas implementações precisam mudar juntas — por isso os números
 * aparecem como constantes nomeadas aqui e comentadas lá.
 */

/** Peso de cada interação no engajamento bruto. */
const PESOS = { curtida: 3, comentario: 5, compartilhamento: 8, visualizacao: 0.1 } as const;

/** Meia-vida do frescor, em horas: em 24 h o vídeo conserva ~37% do peso. */
const HORAS_DE_DECAIMENTO = 24;

/** Piso de quem acabou de publicar e ainda não tem engajamento nenhum. */
const PISO = 0.5;

/** Peso do n-ésimo vídeo do mesmo autor: 1 · 0,7 · 0,49 … */
const RODIZIO_POR_AUTOR = 0.7;

/** Quanto um vídeo da categoria que a pessoa escolheu no onboarding sobe. */
const IMPULSO_DE_INTERESSE = 1.25;

/** Fora desta janela o vídeo sai do ranking e volta para o fim, em ordem cronológica. */
const DIAS_NA_JANELA = 30;

/**
 * O vídeo que a própria pessoa acabou de publicar vai para o topo do feed DELA.
 *
 * Não é favorecimento: é confirmação. Quem grava, edita a legenda e publica abre o feed
 * para ver se deu certo. Num ranking honesto o vídeo recém-nascido não tem engajamento e
 * perde de qualquer vídeo estabelecido — então a pessoa conclui que o app perdeu o que ela
 * fez, e é a última vez que ela publica. O multiplicador é alto o bastante para não
 * depender do acervo, e dura poucas horas.
 */
const IMPULSO_DE_ESTREIA = 100;
const HORAS_DE_ESTREIA = 2;

export interface VideoPontuavel {
  id: string;
  autorId: string;
  categoria: string;
  criadoEm: string;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  visualizacoes: number;
}

/** Qualidade × frescor, antes do rodízio de autor e do interesse. */
export function pontuacaoBase(video: VideoPontuavel, agora: number): number {
  const engajamento =
    video.curtidas * PESOS.curtida +
    video.comentarios * PESOS.comentario +
    video.compartilhamentos * PESOS.compartilhamento +
    video.visualizacoes * PESOS.visualizacao;

  // O log comprime a cauda: 1.000 curtidas valem ~3x o peso de 10, não 100x. Sem isso o
  // feed vira um pódio congelado dos mesmos cinco vídeos.
  const qualidade = Math.log(1 + Math.max(0, engajamento));

  const horas = (agora - Date.parse(video.criadoEm)) / 3_600_000;
  const frescor = Math.exp(-Math.max(0, horas) / HORAS_DE_DECAIMENTO);

  return (PISO + qualidade) * frescor;
}

export interface OpcoesDeRanking {
  interesses?: readonly Interesse[] | readonly string[];
  /** Quem está vendo o feed; usado para o impulso de estreia do próprio vídeo. */
  meuId?: string | null;
  agora?: number;
}

/**
 * Ordena por relevância, aplicando rodízio de autor e o impulso de interesse.
 *
 * O rodízio não esconde ninguém: só impede que uma conta que publicou seis vezes hoje
 * ocupe as seis primeiras posições. Vídeos fora da janela de 30 dias vão para o fim, em
 * ordem cronológica, em vez de sumirem — num app novo o acervo inteiro cabe nessa cauda.
 */
export function ordenarPorRelevancia<T extends VideoPontuavel>(
  videos: readonly T[],
  opcoes: OpcoesDeRanking = {},
): T[] {
  const agora = opcoes.agora ?? Date.now();
  const interesses = new Set<string>(opcoes.interesses ?? []);
  const limiteDaJanela = agora - DIAS_NA_JANELA * 24 * 3_600_000;

  const dentro: T[] = [];
  const fora: T[] = [];
  for (const v of videos) {
    (Date.parse(v.criadoEm) > limiteDaJanela ? dentro : fora).push(v);
  }

  // O rodízio precisa saber a posição do vídeo entre os do mesmo autor, e essa posição é
  // definida pela pontuação base — por isso ordena antes de penalizar.
  const base = new Map<string, number>();
  for (const v of dentro) base.set(v.id, pontuacaoBase(v, agora));

  const porAutor = new Map<string, T[]>();
  for (const v of dentro) {
    const lista = porAutor.get(v.autorId);
    if (lista) lista.push(v);
    else porAutor.set(v.autorId, [v]);
  }

  const final = new Map<string, number>();
  for (const [, doAutor] of porAutor) {
    const ordenados = [...doAutor].sort(
      (a, c) =>
        (base.get(c.id) ?? 0) - (base.get(a.id) ?? 0) || c.criadoEm.localeCompare(a.criadoEm),
    );
    ordenados.forEach((v, indice) => {
      const impulso = interesses.has(v.categoria) ? IMPULSO_DE_INTERESSE : 1;
      const horas = (agora - Date.parse(v.criadoEm)) / 3_600_000;
      const estreia =
        opcoes.meuId && v.autorId === opcoes.meuId && horas < HORAS_DE_ESTREIA
          ? IMPULSO_DE_ESTREIA
          : 1;
      final.set(v.id, (base.get(v.id) ?? 0) * RODIZIO_POR_AUTOR ** indice * impulso * estreia);
    });
  }

  const ranqueados = [...dentro].sort(
    (a, c) => (final.get(c.id) ?? 0) - (final.get(a.id) ?? 0) || c.criadoEm.localeCompare(a.criadoEm),
  );
  const antigos = [...fora].sort((a, c) => c.criadoEm.localeCompare(a.criadoEm));

  return [...ranqueados, ...antigos];
}
