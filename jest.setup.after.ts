// Roda depois do ambiente de teste estar pronto (matchers, timers, etc).
// Os matchers do Testing Library já vêm embutidos na v13+.

// Silencia avisos ruidosos e conhecidos do React Native em ambiente de teste.
const avisosIgnorados = [/act\(\.\.\.\)/, /useNativeDriver/];
const consoleErrorOriginal = console.error;
console.error = (...args: unknown[]) => {
  const texto = String(args[0] ?? '');
  if (avisosIgnorados.some((r) => r.test(texto))) return;
  consoleErrorOriginal(...args);
};
