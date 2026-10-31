#!/usr/bin/env node
/*
 * Confere se os perfis de build do eas.json estão prontos para gerar um APK/AAB útil.
 * Uso: node scripts/conferir-ambiente.js [perfil ...]      (padrão: preview e production)
 *
 * POR QUE ISTO EXISTE
 *
 * `EXPO_PUBLIC_SENTRY_DSN` e `EXPO_PUBLIC_POSTHOG_KEY` estavam como string vazia nos três
 * perfis. Isso não quebra nada: o app abre, funciona e não envia nada. É exatamente o
 * problema — o build sai cego, e ninguém descobre no dia do build, descobre três semanas
 * depois, quando alguém pergunta quantas pessoas terminaram o cadastro e a resposta é que
 * não dá para saber.
 *
 * A telemetria é opcional por design (ver services/telemetria): sem chave, silêncio. Essa
 * decisão está certa para o dia a dia e errada para um build de loja, e a única maneira de
 * ter as duas coisas é alguém conferir na hora de buildar. Este script é esse alguém.
 *
 * Não lê nem imprime o valor das chaves: só diz se estão presentes.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PERFIS_PADRAO = ['preview', 'production'];

/** Variáveis sem as quais o build não cumpre o que promete. */
const OBRIGATORIAS = [
  { nome: 'EXPO_PUBLIC_SUPABASE_URL', porque: 'sem ela o APK abre no modo demonstração' },
  { nome: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', porque: 'sem ela nenhuma consulta sai do aparelho' },
  { nome: 'EXPO_PUBLIC_SENTRY_DSN', porque: 'sem ela nenhum crash do campo chega até você' },
  {
    nome: 'EXPO_PUBLIC_POSTHOG_KEY',
    porque: 'sem ela o funil de cadastro do beta fechado não existe',
  },
];

/** Variáveis cuja ausência degrada o app, mas não cega quem o acompanha. */
const RECOMENDADAS = [
  { nome: 'EXPO_PUBLIC_LIVEKIT_URL', porque: 'as lives caem no modo simulado' },
  { nome: 'EXPO_PUBLIC_MIDIA_URL', porque: 'a mídia volta para o Storage da Supabase (egress pago)' },
];

/**
 * Confere os perfis pedidos e devolve as pendências, sem imprimir nada.
 * Separado do `main` para que o teste possa exercitar a regra sem rodar um processo.
 */
function conferir(eas, perfis) {
  const pendencias = [];
  const avisos = [];

  for (const perfil of perfis) {
    const config = eas.build?.[perfil];
    if (!config) {
      pendencias.push({ perfil, nome: null, porque: 'perfil não existe no eas.json' });
      continue;
    }
    const env = config.env ?? {};
    const vazia = (v) => !String(env[v.nome] ?? '').trim();
    for (const v of OBRIGATORIAS.filter(vazia)) pendencias.push({ perfil, ...v });
    for (const v of RECOMENDADAS.filter(vazia)) avisos.push({ perfil, ...v });
  }
  return { pendencias, avisos };
}

function main() {
  const pedidos = process.argv.slice(2);
  const perfis = pedidos.length > 0 ? pedidos : PERFIS_PADRAO;
  const eas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'eas.json'), 'utf8'));
  const { pendencias, avisos } = conferir(eas, perfis);

  for (const perfil of perfis) {
    const doPerfil = pendencias.filter((p) => p.perfil === perfil);
    if (doPerfil.length === 0) {
      console.log(`✓ ${perfil}: as ${OBRIGATORIAS.length} variáveis obrigatórias estão preenchidas`);
    } else {
      console.error(`✗ ${perfil}: ${doPerfil.length} pendência(s)`);
      for (const p of doPerfil) console.error(`    ${p.nome ?? '(perfil)'} — ${p.porque}`);
    }
  }
  for (const a of avisos) console.warn(`  ! ${a.perfil}: ${a.nome} em branco — ${a.porque}`);

  if (pendencias.length > 0) {
    console.error(
      `\n${pendencias.length} pendência(s). Preencha no eas.json (e no .env, para o Expo Go) ` +
        'antes de buildar.',
    );
    process.exit(1);
  }
  console.log('\nTudo certo para buildar.');
}

module.exports = { conferir, OBRIGATORIAS, RECOMENDADAS };

if (require.main === module) main();
