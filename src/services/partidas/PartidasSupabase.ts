import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/services/data/supabase/cliente';
import { ErroDeAplicacao } from '@/utils/erros';

import type { LinhaDePartida } from '../../../supabase/functions/_shared/highlightly';
import type { CalendarioService, MatchService, Partida } from './types';

const CHAVE_CACHE = 'vulture.calendario.v2';
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
  private canal: RealtimeChannel | null = null;
  private readonly ouvintes = new Set<(p: Partida) => void>();

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
   * Placar ao vivo: o Realtime empurra cada atualização que a Edge Function grava.
   * Um canal só no app inteiro, compartilhado por quem estiver ouvindo.
   */
  assinar(aoMudar: (partida: Partida) => void): () => void {
    this.ouvintes.add(aoMudar);
    if (!this.canal) {
      this.canal = supabase()
        .channel('partidas-ao-vivo')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas' }, (evento) => {
          const linha = evento.new as LinhaLida | undefined;
          if (!linha?.id) return;
          const partida = paraPartida(linha);
          for (const ouvinte of this.ouvintes) ouvinte(partida);
        })
        .subscribe();
    }
    return () => {
      this.ouvintes.delete(aoMudar);
      if (this.ouvintes.size === 0 && this.canal) {
        supabase()
          .removeChannel(this.canal)
          .catch(() => {});
        this.canal = null;
      }
    };
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
