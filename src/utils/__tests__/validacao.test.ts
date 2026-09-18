import { apelidoValido, emailValido, normalizarApelido, senhaValida } from '../validacao';

describe('validação', () => {
  it('valida e-mails', () => {
    expect(emailValido('ana@teste.com')).toBe(true);
    expect(emailValido('ana@teste')).toBe(false);
    expect(emailValido('')).toBe(false);
  });
  it('valida senha com 6+ caracteres', () => {
    expect(senhaValida('12345')).toBe(false);
    expect(senhaValida('123456')).toBe(true);
  });
  it('valida e normaliza apelidos', () => {
    expect(apelidoValido('ana_rn')).toBe(true);
    expect(apelidoValido('ab')).toBe(false);
    expect(apelidoValido('Ana')).toBe(false);
    expect(normalizarApelido('Ana Çélia!!')).toBe('anacelia');
    expect(normalizarApelido('a'.repeat(30))).toHaveLength(20);
  });
});
