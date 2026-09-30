import AsyncStorage from '@react-native-async-storage/async-storage';

import { configuracaoSupabase, supabase } from '@/services/data/supabase/cliente';
import { ErroDeAplicacao } from '@/utils/erros';

import type { LinhaDePartida } from '../../../supabase/functions/_shared/highlightly';
import type { CalendarioService, MatchService, Partida } from './types';

const CHAVE_CACHE = 'vulture.calendario.v2';
/** o cache da Edge Function é de 20 s; sondar mais rápido só gastaria bateria */
const INTERVALO_DE_SONDAGEM_MS = 25_000;
const COLUNAS =
  'id, competicao, fase, mandante, visitante, sigla_mandante, sigla_visitante, data_hora, estadio, gols_mandante, gols_visitante, status, minuto, nota';

type LinhaLida = Omit<LinhaDePartida, 'temporada'>;

export function paraPartida(l: LinhaLida): Partida {
  return {
    id: l.id,
    competicao: l.competicao,
    fase: l.fase,
    mandante: l.mandante,
    visitante: l.visitante,
    siglas: { mandante: l.sigla_mandante, visitante: l.sigla_visitante },
    dataHora: new Date(l.data_hora).toISOString(),
    estadio: l.estadio ?? '',
    placar:
      l.gols_mandante !== null && l.gols_visitante !== null
        ? { mandante: l.gols_mandante, visitante: l.gols_visitante }
        : null,
    status: l.status,
    minuto: l.minuto,
    nota: l.nota,
  };
}

/**
 * Jogos do Flamengo lidos de public.partidas, o cache que a Edge Function
 * atualizar-calendario mantém com a Highlightly. O app nunca fala com a API de jogos.
 */
export class PartidasSupabase implements MatchService, CalendarioService {
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private readonly ouvintes = new Set<(p: Partida) => void>();
  /** última versão vista de cada jogo, para só avisar quando algo realmente muda */
  private readonly ultimoPlacar = new Map<string, string>();

  async listarTemporada(): Promise<Partida[]> {
    const { data, error } = await supabase()
      .from('partidas')
      .select(COLUNAS)
      .order('data_hora', { ascending: true });
    if (error) {
      // sem rede: mostra a última temporada que o aparelho viu
      const guardada = await this.lerCache();
      if (guardada) return guardada;
      throw new ErroDeAplicacao(`Falha ao carregar os jogos: ${error.message}`, 'partidas');
    }
    const partidas = ((data ?? []) as LinhaLida[]).map(paraPartida);
    AsyncStorage.setItem(CHAVE_CACHE, JSON.stringify(partidas)).catch(() => {});
    return partidas;
  }

  listarPartidas(): Promise<Partida[]> {
    return this.listarTemporada();
  }

  /** O que está rolando ou o próximo — uma linha só, para a faixa do feed gastar pouco. */
  async proximoJogo(): Promise<Partida | null> {
    const tresHorasAtras = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase()
      .from('partidas')
      .select(COLUNAS)
      .neq('status', 'encerrada')
      .gte('data_hora', tresHorasAtras)
      .order('data_hora', { ascending: true })
      .limit(1);
    if (error)
      throw new ErroDeAplicacao(`Falha ao carregar o próximo jogo: ${error.message}`, 'partidas');
    const linha = (data ?? [])[0] as LinhaLida | undefined;
    return linha ? paraPartida(linha) : null;
  }

  async ultimoResultado(): Promise<Partida | null> {
    const { data, error } = await supabase()
      .from('partidas')
      .select(COLUNAS)
      .eq('status', 'encerrada')
      .order('data_hora', { ascending: false })
      .limit(1);
    if (error)
      throw new ErroDeAplicacao(`Falha ao carregar o último jogo: ${error.message}`, 'partidas');
    const linha = (data ?? [])[0] as LinhaLida | undefined;
    return linha ? paraPartida(linha) : null;
  }

  /**
   * Placar ao vivo por leitura curta na Edge Function `placar`, que responde com
   * Cache-Control de 20 s.
   *
   * Antes isto era um canal Realtime — ou seja, um websocket por aparelho com o app aberto
   * durante o jogo. No pico de um clássico seriam centenas de milhares de conexões
   * simultâneas, exatamente quando o app não pode falhar. Com o cache de CDN a mesma
   * resposta serve todo mundo e o banco recebe ~3 consultas por minuto, com mil ou com um
   * milhão de torcedores.
   *
   * Um temporizador só no app inteiro, compartilhado por quem estiver ouvindo.
   */
  assinar(aoMudar: (partida: Partida) => void): () => void {
    this.ouvintes.add(aoMudar);
    this.ligarSondagem();
    return () => {
      this.ouvintes.delete(aoMudar);
      if (this.ouvintes.size === 0) this.desligarSondagem();
    };
  }

  private ligarSondagem() {
    if (this.temporizador) return;
    const consultar = async () => {
      try {
        const partidas = await this.buscarPlacar();
        for (const partida of partidas) {
          const anterior = this.ultimoPlacar.get(partida.id);
          const agora = JSON.stringify([partida.placar, partida.status, partida.minuto]);
          if (anterior === agora) continue;
          this.ultimoPlacar.set(partida.id, agora);
          for (const ouvinte of this.ouvintes) ouvinte(partida);
        }
      } catch {
        // rede instável no estádio é a regra: a próxima passada resolve
      }
    };
    void consultar();
    this.temporizador = setInterval(() => void consultar(), INTERVALO_DE_SONDAGEM_MS);
  }

  private desligarSondagem() {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
    this.ultimoPlacar.clear();
  }

  /** Jogos da janela quente (últimas 6 h e próximos 7 dias), pela CDN. */
  private async buscarPlacar(): Promise<Partida[]> {
    const cfg = configuracaoSupabase();
    if (!cfg) return [];
    const resposta = await fetch(`${cfg.url}/functions/v1/placar`, {
      headers: { apikey: cfg.chave, Authorization: `Bearer ${cfg.chave}` },
    });
    if (!resposta.ok) throw new Error(`placar: HTTP ${resposta.status}`);
    const corpo = (await resposta.json()) as { partidas?: LinhaLida[] };
    return (corpo.partidas ?? []).map(paraPartida);
  }

  private async lerCache(): Promise<Partida[] | null> {
    try {
      const bruto = await AsyncStorage.getItem(CHAVE_CACHE);
      return bruto ? (JSON.parse(bruto) as Partida[]) : null;
    } catch {
      return null;
    }
  }
}
