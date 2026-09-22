import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  BASE,
  ID_FLAMENGO,
  paraPartida,
  type CacheDePartidas,
  type EventoDaApi,
} from './mapeamento';
import type { MatchService, Partida } from './types';

/**
 * Partidas reais do Flamengo pela TheSportsDB (chave de teste pública, sem cadastro).
 * O último resultado e o próximo jogo ficam guardados no aparelho: se a rede cair,
 * o torcedor continua vendo a informação verdadeira mais recente em vez de nada.
 */
const CHAVE_CACHE = 'vulture.partidas.v1';
const TEMPO_LIMITE_MS = 8000;

export class MatchServiceTheSportsDB implements MatchService {
  constructor(
    private readonly idTime: string = ID_FLAMENGO,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  private cacheEmMemoria: CacheDePartidas | null = null;
  private buscaEmAndamento: Promise<CacheDePartidas> | null = null;

  private async buscarJson(caminho: string): Promise<EventoDaApi[]> {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
    try {
      const resposta = await fetch(`${BASE}/${caminho}`, { signal: controle.signal });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const corpo = (await resposta.json()) as { events?: EventoDaApi[]; results?: EventoDaApi[] };
      return corpo.events ?? corpo.results ?? [];
    } finally {
      clearTimeout(relogio);
    }
  }

  private async lerCache(): Promise<CacheDePartidas | null> {
    if (this.cacheEmMemoria) return this.cacheEmMemoria;
    try {
      const bruto = await AsyncStorage.getItem(CHAVE_CACHE);
      if (!bruto) return null;
      this.cacheEmMemoria = JSON.parse(bruto) as CacheDePartidas;
      return this.cacheEmMemoria;
    } catch {
      return null;
    }
  }

  private async guardar(dados: CacheDePartidas): Promise<void> {
    this.cacheEmMemoria = dados;
    try {
      await AsyncStorage.setItem(CHAVE_CACHE, JSON.stringify(dados));
    } catch {
      // sem espaço ou storage indisponível: o cache em memória já resolve a sessão
    }
  }

  /** Busca as duas pontas de uma vez; chamadas simultâneas compartilham a mesma ida à rede. */
  private async carregar(): Promise<CacheDePartidas> {
    if (this.buscaEmAndamento) return this.buscaEmAndamento;
    this.buscaEmAndamento = (async () => {
      try {
        const agora = this.agora();
        const [ultimos, proximos] = await Promise.all([
          this.buscarJson(`eventslast.php?id=${this.idTime}`),
          this.buscarJson(`eventsnext.php?id=${this.idTime}`),
        ]);
        const mapear = (lista: EventoDaApi[]) =>
          lista
            .map((e) => paraPartida(e, agora))
            .filter((p): p is Partida => p !== null)
            .sort((a, b) => a.dataHora.localeCompare(b.dataHora));

        const passadas = mapear(ultimos);
        const futuras = mapear(proximos);
        // um jogo em andamento pode chegar por qualquer uma das pontas
        const aoVivo = [...passadas, ...futuras].find((p) => p.status === 'ao_vivo') ?? null;

        const resultado: CacheDePartidas = {
          ultimo: [...passadas].reverse().find((p) => p.status === 'encerrada') ?? null,
          proximo: aoVivo ?? futuras.find((p) => p.status === 'agendada') ?? null,
          salvoEm: agora.toISOString(),
        };
        await this.guardar(resultado);
        return resultado;
      } catch (erro) {
        // rede fora: devolve a última informação real que o aparelho viu
        const cache = await this.lerCache();
        if (cache) return cache;
        throw erro;
      } finally {
        this.buscaEmAndamento = null;
      }
    })();
    return this.buscaEmAndamento;
  }

  async listarPartidas(): Promise<Partida[]> {
    const { ultimo, proximo } = await this.carregar();
    return [ultimo, proximo].filter((p): p is Partida => p !== null);
  }

  async proximoJogo(): Promise<Partida | null> {
    return (await this.carregar()).proximo;
  }

  async ultimoResultado(): Promise<Partida | null> {
    return (await this.carregar()).ultimo;
  }
}
