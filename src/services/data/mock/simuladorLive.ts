import { REACOES } from '@/constants/interesses';
import type { MensagemLive } from '@/types';

import type { CancelarAssinatura, EventoDaLive } from '../types';
import { USUARIOS_SEED } from './seed';

type Ouvinte = (evento: EventoDaLive) => void;

const FRASES_DOS_BOTS = [
  'Vamos Mengão! 🔴⚫',
  'Que live boa!',
  'Chegando agora, o que perdi?',
  'Mengo!!!',
  'Salve nação 🦅',
  'Alguém viu o gol de ontem?',
  'Maior do mundo 🏆',
  'Torcida cantando demais',
  'Isso aqui é Flamengo!',
  'kkkkkk',
];

/**
 * Simula o "tempo real" da live no driver mock: distribui mensagens locais para os
 * assinantes e gera mensagens de outros torcedores (bots) para a demonstração ficar viva.
 */
export class SimuladorDeLive {
  private ouvintes = new Map<string, Set<Ouvinte>>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private contadores = new Map<string, number>();

  constructor(
    private readonly gerarId: () => string,
    private readonly bots = true,
  ) {}

  assinar(
    liveId: string,
    ouvinte: Ouvinte,
    espectadoresIniciais: number,
    aoGerarMensagem: (m: MensagemLive) => void,
  ): CancelarAssinatura {
    if (!this.ouvintes.has(liveId)) this.ouvintes.set(liveId, new Set());
    const conjunto = this.ouvintes.get(liveId)!;
    conjunto.add(ouvinte);
    if (!this.contadores.has(liveId)) this.contadores.set(liveId, espectadoresIniciais);

    if (this.bots && !this.timers.has(liveId)) {
      const timer = setInterval(() => {
        const mensagem = this.mensagemDeBot(liveId);
        aoGerarMensagem(mensagem);
        this.emitir(liveId, {
          tipo: mensagem.tipo === 'reacao' ? 'reacao' : 'mensagem',
          mensagem,
        });
        const atual = this.contadores.get(liveId) ?? espectadoresIniciais;
        const novo = Math.max(1, atual + Math.round((Math.random() - 0.45) * 12));
        this.contadores.set(liveId, novo);
        this.emitir(liveId, { tipo: 'espectadores', total: novo });
      }, 3500);
      this.timers.set(liveId, timer);
    }

    return () => {
      conjunto.delete(ouvinte);
      if (conjunto.size === 0) {
        this.ouvintes.delete(liveId);
        const timer = this.timers.get(liveId);
        if (timer) clearInterval(timer);
        this.timers.delete(liveId);
      }
    };
  }

  emitir(liveId: string, evento: EventoDaLive): void {
    const conjunto = this.ouvintes.get(liveId);
    if (!conjunto) return;
    for (const ouvinte of Array.from(conjunto)) ouvinte(evento);
  }

  espectadores(liveId: string): number | undefined {
    return this.contadores.get(liveId);
  }

  encerrar(liveId: string): void {
    this.emitir(liveId, { tipo: 'encerrada' });
    const timer = this.timers.get(liveId);
    if (timer) clearInterval(timer);
    this.timers.delete(liveId);
    this.ouvintes.delete(liveId);
    this.contadores.delete(liveId);
  }

  private mensagemDeBot(liveId: string): MensagemLive {
    const autor = USUARIOS_SEED[Math.floor(Math.random() * USUARIOS_SEED.length)];
    const ehReacao = Math.random() < 0.35;
    const reacao = REACOES[Math.floor(Math.random() * REACOES.length)];
    return {
      id: this.gerarId(),
      liveId,
      autorId: autor.id,
      autor: { id: autor.id, apelido: autor.apelido, avatarUrl: autor.avatarUrl },
      tipo: ehReacao ? 'reacao' : 'texto',
      texto: ehReacao
        ? reacao
        : FRASES_DOS_BOTS[Math.floor(Math.random() * FRASES_DOS_BOTS.length)],
      reacao: ehReacao ? reacao : null,
      criadoEm: new Date().toISOString(),
    };
  }
}
