import { configuracaoSupabase } from '@/services/data/supabase/cliente';
import { driverDeDados } from '@/utils/ambiente';
import { ErroDeAplicacao } from '@/utils/erros';

export interface CredenciaisLiveKit {
  url: string;
  token: string;
}

export function configuracaoLiveKit(): { url: string; endpointToken: string } | null {
  const url = process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim();
  const endpointToken = process.env.EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT?.trim();
  if (!url || !endpointToken || url.includes('SEU-PROJETO')) return null;
  return { url, endpointToken };
}

/**
 * Pede um token de acesso ao endpoint configurado (Supabase Edge Function `livekit-token`
 * ou qualquer servidor seu). Tokens LiveKit nunca são gerados no app: exigem a API Secret.
 */
export async function obterCredenciaisLiveKit(params: {
  sala: string;
  identidade: string;
  nome: string;
  podePublicar: boolean;
}): Promise<CredenciaisLiveKit> {
  const cfg = configuracaoLiveKit();
  if (!cfg) {
    throw new ErroDeAplicacao(
      'LiveKit não configurado: preencha EXPO_PUBLIC_LIVEKIT_URL e EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT (veja SETUP_LIVEKIT.md).',
      'livekit_nao_configurado',
    );
  }
  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (driverDeDados() === 'supabase' && configuracaoSupabase()) {
    // envia o JWT do usuário para a Edge Function validar quem está pedindo o token
    const { supabase } = await import('@/services/data/supabase/cliente');
    const { data } = await supabase().auth.getSession();
    if (data.session?.access_token)
      cabecalhos.Authorization = `Bearer ${data.session.access_token}`;
    cabecalhos.apikey = configuracaoSupabase()!.chave;
  }
  const resposta = await fetch(cfg.endpointToken, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify({
      room: params.sala,
      identity: params.identidade,
      name: params.nome,
      canPublish: params.podePublicar,
    }),
  });
  if (!resposta.ok) {
    throw new ErroDeAplicacao(`Falha ao obter token da live (${resposta.status}).`, 'token_live');
  }
  const corpo = (await resposta.json()) as { token?: string; url?: string };
  if (!corpo.token) throw new ErroDeAplicacao('Resposta sem token.', 'token_live');
  return { token: corpo.token, url: corpo.url ?? cfg.url };
}
