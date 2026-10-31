import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// o script é CommonJS e vive fora de src/ de propósito: roda com `node`, sem build
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { conferir, OBRIGATORIAS } = require('../../../../scripts/conferir-ambiente.js');

const RAIZ = join(__dirname, '..', '..', '..', '..');

interface Pendencia {
  perfil: string;
  nome: string | null;
  porque: string;
}

function easCompleto() {
  // um objeto novo por perfil: compartilhar a mesma referência faria mexer num perfil
  // mexer no outro, e o teste mediria outra coisa
  const env = () =>
    Object.fromEntries((OBRIGATORIAS as { nome: string }[]).map((v) => [v.nome, 'valor']));
  return { build: { preview: { env: env() }, production: { env: env() } } };
}

/**
 * O build que sai sem chave de telemetria não quebra — e é esse o problema.
 *
 * Um APK sem Sentry e sem PostHog abre, funciona e não conta nada a ninguém. A falha só
 * aparece semanas depois, quando alguém pergunta quantas pessoas terminaram o cadastro e
 * a resposta é que não dá para saber. Este teste existe para que a regra que transforma
 * isso em erro de build não seja afrouxada por engano.
 */
describe('conferir-ambiente', () => {
  it('aprova um perfil com tudo preenchido', () => {
    const { pendencias } = conferir(easCompleto(), ['preview', 'production']);
    expect(pendencias).toEqual([]);
  });

  it('reprova string vazia e string só com espaço', () => {
    const eas = easCompleto();
    eas.build.preview.env.EXPO_PUBLIC_POSTHOG_KEY = '';
    eas.build.production.env.EXPO_PUBLIC_SENTRY_DSN = '   ';

    const { pendencias } = conferir(eas, ['preview', 'production']) as {
      pendencias: Pendencia[];
    };
    expect(pendencias.map((p) => `${p.perfil}:${p.nome}`)).toEqual([
      'preview:EXPO_PUBLIC_POSTHOG_KEY',
      'production:EXPO_PUBLIC_SENTRY_DSN',
    ]);
  });

  it('reprova perfil inexistente em vez de ignorar em silêncio', () => {
    const { pendencias } = conferir(easCompleto(), ['nao-existe']) as { pendencias: Pendencia[] };
    expect(pendencias).toHaveLength(1);
    expect(pendencias[0].nome).toBeNull();
  });

  it('a telemetria é exigida: trocá-la por opcional precisa ser uma decisão, não um descuido', () => {
    const nomes = (OBRIGATORIAS as { nome: string }[]).map((v) => v.nome);
    expect(nomes).toContain('EXPO_PUBLIC_SENTRY_DSN');
    expect(nomes).toContain('EXPO_PUBLIC_POSTHOG_KEY');
  });

  it('os perfis de build do projeto existem com o nome que os npm scripts usam', () => {
    const eas = JSON.parse(readFileSync(join(RAIZ, 'eas.json'), 'utf8'));
    expect(Object.keys(eas.build)).toEqual(expect.arrayContaining(['preview', 'production']));

    const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    expect(pkg.scripts['build:preview']).toContain('conferir-ambiente.js preview');
    expect(pkg.scripts['build:producao']).toContain('conferir-ambiente.js production');
  });
});
