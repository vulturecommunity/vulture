// O plugin roda no build (Node), não no app; o teste protege a regra que corta 60% do APK.
import { injetarAbiFilters } from '../../../plugins/tamanho-do-android';

const gradle = `android {
    defaultConfig {
        applicationId 'app.vulture.torcida'
        versionCode 1
    }
}`;

describe('plugin de tamanho do Android', () => {
  it('empacota só as arquiteturas pedidas', () => {
    const saida = injetarAbiFilters(gradle, 'arm64-v8a');
    expect(saida).toContain('abiFilters "arm64-v8a"');
    // o que sobrou continua lá
    expect(saida).toContain("applicationId 'app.vulture.torcida'");
  });

  it('aceita mais de uma arquitetura', () => {
    expect(injetarAbiFilters(gradle, 'arm64-v8a, armeabi-v7a')).toContain(
      'abiFilters "arm64-v8a", "armeabi-v7a"',
    );
  });

  it('sem lista, não mexe em nada: é assim que o .aab da loja leva todas', () => {
    expect(injetarAbiFilters(gradle, '')).toBe(gradle);
    expect(injetarAbiFilters(gradle, undefined)).toBe(gradle);
    expect(injetarAbiFilters(gradle, '  ,  ')).toBe(gradle);
  });

  it('não duplica o filtro se o prebuild rodar de novo', () => {
    const uma = injetarAbiFilters(gradle, 'arm64-v8a');
    expect(injetarAbiFilters(uma, 'arm64-v8a')).toBe(uma);
  });

  it('não quebra um gradle fora do formato esperado', () => {
    expect(injetarAbiFilters('android { }', 'arm64-v8a')).toBe('android { }');
  });
});
