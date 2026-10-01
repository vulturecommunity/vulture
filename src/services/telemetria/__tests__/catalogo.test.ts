import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EVENTOS } from '../eventos';

/**
 * O catálogo e o código precisam contar a mesma história.
 *
 * POR QUE ESTE TESTE EXISTE
 *
 * Sete dos dezesseis eventos do catálogo original nunca eram emitidos. Isso é pior do que
 * não medir: o painel mostra `post_publicado = 0` e a conclusão natural é "ninguém posta",
 * quando a verdade é "ninguém mediu". Uma métrica ausente se percebe; uma métrica que
 * mente, não.
 *
 * O caminho inverso também importa: `registrar('string_solta')` não compila por causa do
 * tipo, mas um evento removido do catálogo e esquecido no código viraria chamada morta.
 */

const RAIZ = join(__dirname, '..', '..', '..');

/**
 * Ocorrências de `EVENTOS.X` no código do app, **fora dos testes**.
 *
 * Excluir `__tests__` não é detalhe: sem isso, um evento citado apenas neste arquivo
 * contaria como emitido e o teste passaria sozinho — exatamente o falso verde que ele
 * existe para impedir.
 */
function usosNoCodigo(): string {
  return execSync(
    `grep -rhoE "EVENTOS\\.[A-Z_]+" ${RAIZ} --include="*.ts" --include="*.tsx" ` +
      `--exclude-dir=__tests__ | sort -u || true`,
    { encoding: 'utf8' },
  );
}

describe('catálogo de eventos', () => {
  const usos = usosNoCodigo();

  it.each(Object.keys(EVENTOS))('%s é emitido em algum lugar do app', (chave) => {
    expect(usos).toContain(`EVENTOS.${chave}`);
  });

  it('os nomes enviados são snake_case, como o PostHog espera', () => {
    for (const nome of Object.values(EVENTOS)) {
      expect(nome).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('nenhum nome se repete — dois eventos no mesmo balde não se separam depois', () => {
    const nomes = Object.values(EVENTOS);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('publicar e comprimir são eventos diferentes', () => {
    // foram o mesmo evento por um commit: a compressão disparava `video_publicado` antes
    // do upload terminar, e foto nunca contava
    expect(EVENTOS.VIDEO_PUBLICADO).not.toBe(EVENTOS.VIDEO_COMPRIMIDO);

    const serviço = readFileSync(
      join(RAIZ, 'services', 'data', 'supabase', 'SupabaseDataService.ts'),
      'utf8',
    );
    // o evento de publicação precisa vir DEPOIS do insert no banco
    const posInsert = serviço.indexOf("from('videos')\n      .insert(");
    const posEvento = serviço.indexOf('EVENTOS.VIDEO_PUBLICADO');
    expect(posInsert).toBeGreaterThan(-1);
    expect(posEvento).toBeGreaterThan(posInsert);
  });
});
