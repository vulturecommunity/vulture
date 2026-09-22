const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Empacota só as arquiteturas que valem a pena.
 *
 * O APK de 177 MB era 80% biblioteca nativa, e 82 MB disso eram x86 e x86_64 —
 * arquiteturas que só existem em emulador. Todo celular Android vendido desde
 * 2019 é arm64 (a Play Store exige 64 bits), então o APK de teste leva só arm64.
 *
 * VULTURE_ABIS define a lista (separada por vírgula):
 *   - "arm64-v8a"  → APK enxuto para distribuir por link (perfil preview)
 *   - vazia        → todas as arquiteturas, o certo para o .aab da loja, que a
 *                    Play Store fatia por aparelho sozinha (perfil production)
 */

/** Insere o filtro de arquiteturas no defaultConfig do app. Idempotente. */
function injetarAbiFilters(conteudo, abis) {
  const lista = (abis ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (lista.length === 0) return conteudo;
  if (conteudo.includes('abiFilters')) return conteudo;
  if (!conteudo.includes('defaultConfig {')) return conteudo;
  const filtros = lista.map((a) => `"${a}"`).join(', ');
  return conteudo.replace(
    'defaultConfig {',
    `defaultConfig {
        // só as arquiteturas de celular de verdade (ver DECISOES.md)
        ndk {
            abiFilters ${filtros}
        }`,
  );
}

const comTamanhoReduzido = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = injetarAbiFilters(
        cfg.modResults.contents,
        process.env.VULTURE_ABIS ?? '',
      );
    }
    return cfg;
  });

module.exports = comTamanhoReduzido;
module.exports.injetarAbiFilters = injetarAbiFilters;
