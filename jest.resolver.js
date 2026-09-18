/*
 * Resolver do Jest: combina o resolver padrão do React Native com o ajuste do
 * react-native-worklets (que precisa ignorar os arquivos ".native.js" nos testes).
 */
const resolverRN = require('@react-native/jest-preset/jest/resolver.js');

module.exports = (request, options) => {
  if (
    options.basedir.includes('react-native-worklets') ||
    request.includes('react-native-worklets')
  ) {
    const semNativo = { ...options };
    semNativo.extensions = semNativo.extensions?.filter((ext) => !ext.includes('native'));
    return resolverRN(request, semNativo);
  }
  return resolverRN(request, options);
};
