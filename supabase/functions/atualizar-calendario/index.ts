// Supabase Edge Function: mantém public.partidas com os jogos do Flamengo (Highlightly).
// Deploy:  npx supabase functions deploy atualizar-calendario
// Segredo: npx supabase secrets set HIGHLIGHTLY_KEY=...
//
// O pg_cron chama esta função a cada 3 minutos (supabase/cron-calendario.sql). Ela decide
// sozinha se vale gastar consulta na Highlightly, porque o plano gratuito tem 100 por dia:
//   * temporada inteira a cada 3 h (2 consultas: jogos em casa e fora);
//   * com jogo rolando (ou prestes a começar), só aquele jogo a cada ~3 min (1 consulta);
//   * nunca passa de LIMITE_DIARIO, mesmo que seja chamada mais vezes.
// O app nunca fala com a Highlightly: 1 torcedor ou 100 mil gastam a mesma cota.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  ID_FLAMENGO_HIGHLIGHTLY,
  paraLinhaDePartida,
  type LinhaDePartida,
  type PartidaHighlightly,
} from '../_shared/highlightly.ts';

const BASE = 'https://soccer.highlightly.net';
const LIMITE_DIARIO = 95;
const MINUTO = 60 * 1000;
const INTERVALO_COMPLETO_MS = 3 * 60 * MINUTO;
const INTERVALO_AO_VIVO_MS = 2.8 * MINUTO;
/** janela do "jogo acontecendo": 15 min antes do apito até 3 h depois */
const ANTES_DO_JOGO_MS = 15 * MINUTO;
const DEPOIS_DO_JOGO_MS = 3 * 60 * MINUTO;

interface Estado {
  dia: string;
  consultas: number;
  ultima_completa: string | null;
  ultima_ao_vivo: string | null;
}

Deno.serve(async () => {
  const chave = Deno.env.get('HIGHLIGHTLY_KEY');
  if (!chave) return responder({ error: 'HIGHLIGHTLY_KEY não configurada' }, 500);
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const idTime = Deno.env.get('HIGHLIGHTLY_TEAM_ID') ?? ID_FLAMENGO_HIGHLIGHTLY;
  const agora = new Date();
  const hoje = agora.toISOString().slice(0, 10);

  const { data: salvo } = await admin
    .from('calendario_estado')
    .select('dia, consultas, ultima_completa, ultima_ao_vivo')
    .eq('id', 1)
    .maybeSingle();
  const estado: Estado = {
    dia: hoje,
    consultas: salvo?.dia === hoje ? salvo.consultas : 0,
    ultima_completa: salvo?.ultima_completa ?? null,
    ultima_ao_vivo: salvo?.ultima_ao_vivo ?? null,
  };
  const passou = (quando: string | null, ms: number) =>
    !quando || agora.getTime() - new Date(quando).getTime() >= ms;

  async function buscar(caminho: string): Promise<PartidaHighlightly[]> {
    estado.consultas += 1;
    const resposta = await fetch(`${BASE}${caminho}`, { headers: { 'x-rapidapi-key': chave! } });
    if (!resposta.ok) throw new Error(`Highlightly respondeu ${resposta.status}`);
    const corpo = await resposta.json();
    return (Array.isArray(corpo) ? corpo : (corpo.data ?? [])) as PartidaHighlightly[];
  }

  const feito: string[] = [];
  try {
    // 1) jogo acontecendo agora: atualiza só ele
    const { data: janela } = await admin
      .from('partidas')
      .select('id, status')
      .gte('data_hora', new Date(agora.getTime() - DEPOIS_DO_JOGO_MS).toISOString())
      .lte('data_hora', new Date(agora.getTime() + ANTES_DO_JOGO_MS).toISOString())
      .neq('status', 'encerrada');
    const emJogo = (janela ?? []) as { id: string }[];
    if (
      emJogo.length > 0 &&
      passou(estado.ultima_ao_vivo, INTERVALO_AO_VIVO_MS) &&
      estado.consultas + emJogo.length <= LIMITE_DIARIO
    ) {
      const linhas: LinhaDePartida[] = [];
      for (const { id } of emJogo) {
        const [detalhe] = await buscar(`/matches/${id.replace(/^hl-/, '')}`);
        const linha = detalhe ? paraLinhaDePartida(detalhe) : null;
        if (linha) linhas.push(linha);
      }
      if (linhas.length > 0) {
        const { error } = await admin.from('partidas').upsert(
          linhas.map((l) => ({ ...l, atualizado_em: agora.toISOString() })),
          { onConflict: 'id' },
        );
        if (error) throw error;
      }
      estado.ultima_ao_vivo = agora.toISOString();
      feito.push(`ao vivo: ${linhas.length}`);
    }

    // 2) temporada inteira, de tempos em tempos
    if (
      passou(estado.ultima_completa, INTERVALO_COMPLETO_MS) &&
      estado.consultas + 2 <= LIMITE_DIARIO
    ) {
      const temporada = agora.getUTCFullYear();
      const [emCasa, fora] = await Promise.all([
        buscar(`/matches?homeTeamId=${idTime}&season=${temporada}&limit=100`),
        buscar(`/matches?awayTeamId=${idTime}&season=${temporada}&limit=100`),
      ]);
      const recebidos = emCasa.length + fora.length;
      // resposta vazia não é "temporada sem jogos": não apaga nada e tenta de novo na próxima
      if (recebidos === 0) {
        throw new Error('Highlightly devolveu 0 jogos para a temporada');
      }
      // a lista não traz o estádio: sem a coluna, o upsert mantém o que o "ao vivo" gravou
      const linhas = [...emCasa, ...fora]
        .map(paraLinhaDePartida)
        .filter((l): l is LinhaDePartida => l !== null)
        .map(({ estadio: _estadio, ...resto }) => ({
          ...resto,
          atualizado_em: agora.toISOString(),
        }));
      const { error } = await admin.from('partidas').upsert(linhas, { onConflict: 'id' });
      if (error) throw error;
      // jogo adiado/cancelado some da lista: tira do calendário também
      const { error: erroLimpeza } = await admin
        .from('partidas')
        .delete()
        .eq('temporada', temporada)
        .not('id', 'in', `(${linhas.map((l) => l.id).join(',')})`);
      if (erroLimpeza) throw erroLimpeza;
      const { count } = await admin.from('partidas').select('id', { count: 'exact', head: true });
      estado.ultima_completa = agora.toISOString();
      feito.push(
        `temporada: ${recebidos} recebidos, ${linhas.length} gravados, ${count ?? '?'} na tabela`,
      );
    }
  } catch (erro) {
    await salvarEstado(admin, estado);
    const mensagem = erro instanceof Error ? erro.message : JSON.stringify(erro);
    return responder({ error: mensagem, consultasHoje: estado.consultas }, 502);
  }

  await salvarEstado(admin, estado);
  return responder({ ok: true, feito, consultasHoje: estado.consultas });
});

async function salvarEstado(admin: ReturnType<typeof createClient>, estado: Estado) {
  await admin.from('calendario_estado').upsert({ id: 1, ...estado }, { onConflict: 'id' });
}

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
