import { ErroDeAplicacao, mensagemDeErro } from '../erros';

describe('mensagemDeErro', () => {
  it('extrai mensagens de Error, string e objetos', () => {
    expect(mensagemDeErro(new Error('falhou'))).toBe('falhou');
    expect(mensagemDeErro('texto')).toBe('texto');
    expect(mensagemDeErro({ message: 'obj' })).toBe('obj');
    expect(mensagemDeErro(null)).toBe('Algo deu errado. Tente novamente.');
    expect(mensagemDeErro(undefined, 'padrão')).toBe('padrão');
  });
  it('ErroDeAplicacao carrega código', () => {
    const e = new ErroDeAplicacao('x', 'cod');
    expect(e.codigo).toBe('cod');
    expect(e.name).toBe('ErroDeAplicacao');
    expect(new ErroDeAplicacao('y').codigo).toBe('desconhecido');
  });
});
