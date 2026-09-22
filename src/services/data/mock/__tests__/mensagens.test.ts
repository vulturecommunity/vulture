import AsyncStorage from '@react-native-async-storage/async-storage';

import { ArmazenamentoMock } from '../banco';
import { MockDataService } from '../MockDataService';

let contador = 0;
function criarServico() {
  contador = 0;
  return new MockDataService({
    armazenamento: new ArmazenamentoMock('teste.mensagens'),
    latenciaMs: 0,
    botsNaLive: false,
    gerarId: () => `id-${++contador}`,
  });
}

/** Cadastra duas contas e devolve os ids; termina logado como B. */
async function duasContas(servico: MockDataService) {
  const a = await servico.cadastrar({ email: 'a@teste.com', senha: '123456', apelido: 'ana_rn' });
  await servico.sair();
  const b = await servico.cadastrar({ email: 'b@teste.com', senha: '123456', apelido: 'beto_rn' });
  return { a: a.usuario.id, b: b.usuario.id };
}

describe('MockDataService — mensagens diretas', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
  });

  it('toda conta nova chega com seguidores de demonstração e uma mensagem de boas-vindas', async () => {
    await servico.cadastrar({ email: 'x@teste.com', senha: '123456' });
    const seguidores = await servico.listNovosSeguidores();
    expect(seguidores.length).toBeGreaterThanOrEqual(3);
    // do mais recente para o mais antigo
    for (let i = 1; i < seguidores.length; i++) {
      expect(seguidores[i - 1].seguiuEm >= seguidores[i].seguiuEm).toBe(true);
    }
    expect(seguidores.every((s) => s.sigoDeVolta === false)).toBe(true);

    const conversas = await servico.listConversas();
    expect(conversas).toHaveLength(1);
    expect(conversas[0].outro.apelido).toBe('nacao_rubro');
    expect(conversas[0].naoLidas).toBe(1);
    expect(conversas[0].ultimaMensagem?.texto).toMatch(/Bem-vindo/);
  });

  it('sem relação entre as pessoas ninguém pode puxar papo', async () => {
    const { a } = await duasContas(servico);
    const permissao = await servico.podeConversar(a);
    expect(permissao.permitido).toBe(false);
    if (!permissao.permitido) expect(permissao.motivo).toBe('sem_relacao');
    await expect(servico.abrirConversa(a)).rejects.toThrow(/Siga @ana_rn/);
  });

  it('quem eu sigo pode ser chamado quando aceita mensagens dos seguidores', async () => {
    const { a } = await duasContas(servico);
    await servico.follow(a); // B segue A
    expect(await servico.podeConversar(a)).toEqual({ permitido: true });
    const conversa = await servico.abrirConversa(a);
    expect(conversa.outro.id).toBe(a);
    // abrir de novo reaproveita a mesma conversa
    expect((await servico.abrirConversa(a)).id).toBe(conversa.id);
  });

  it('respeita a preferência "meus seguidores" de quem recebe', async () => {
    const { a, b } = await duasContas(servico);
    // A desliga mensagens dos seguidores
    await servico.sair();
    await servico.entrar('a@teste.com', '123456');
    await servico.atualizarPreferenciasDeMensagens({ deSeguidores: false });
    expect(await servico.obterPreferenciasDeMensagens()).toEqual({
      deQuemSigo: true,
      deSeguidores: false,
    });
    await servico.sair();
    await servico.entrar('b@teste.com', '123456');
    await servico.follow(a);
    const permissao = await servico.podeConversar(a);
    expect(permissao).toMatchObject({ permitido: false, motivo: 'nao_aceita' });
    // mas se A segue B, vale a regra "quem eu sigo" (ligada)
    await servico.sair();
    await servico.entrar('a@teste.com', '123456');
    await servico.follow(b);
    await servico.sair();
    await servico.entrar('b@teste.com', '123456');
    expect(await servico.podeConversar(a)).toEqual({ permitido: true });
  });

  it('respeita a preferência "quem eu sigo" de quem recebe', async () => {
    const { a, b } = await duasContas(servico);
    await servico.sair();
    await servico.entrar('a@teste.com', '123456');
    await servico.follow(b); // A segue B
    await servico.atualizarPreferenciasDeMensagens({ deQuemSigo: false });
    await servico.sair();
    await servico.entrar('b@teste.com', '123456');
    expect(await servico.podeConversar(a)).toMatchObject({
      permitido: false,
      motivo: 'nao_aceita',
    });
  });

  it('envia, lista, marca como lida e avisa assinantes', async () => {
    const { a } = await duasContas(servico);
    await servico.follow(a);
    const conversa = await servico.abrirConversa(a);
    const recebidas: string[] = [];
    const cancelar = servico.assinarConversa(conversa.id, (m) => recebidas.push(m.texto));

    await expect(servico.enviarMensagem(conversa.id, '   ')).rejects.toThrow('Escreva');
    const enviada = await servico.enviarMensagem(conversa.id, 'Fala, Ana!');
    expect(enviada.remetenteId).not.toBe(a);
    expect(recebidas).toEqual(['Fala, Ana!']);
    cancelar();
    await servico.enviarMensagem(conversa.id, 'Segunda');
    expect(recebidas).toHaveLength(1);

    const mensagens = await servico.listMensagens(conversa.id);
    expect(mensagens.map((m) => m.texto)).toEqual(['Fala, Ana!', 'Segunda']);

    // do lado de A: duas não lidas, depois zero
    await servico.sair();
    await servico.entrar('a@teste.com', '123456');
    let conversas = await servico.listConversas();
    const daAna = conversas.find((c) => c.id === conversa.id)!;
    expect(daAna.naoLidas).toBe(2);
    expect(daAna.ultimaMensagem?.texto).toBe('Segunda');
    await servico.marcarConversaComoLida(conversa.id);
    conversas = await servico.listConversas();
    expect(conversas.find((c) => c.id === conversa.id)!.naoLidas).toBe(0);
  });

  it('bloquear corta a conversa nos dois sentidos e some da lista', async () => {
    const { a } = await duasContas(servico);
    await servico.follow(a);
    const conversa = await servico.abrirConversa(a);
    await servico.enviarMensagem(conversa.id, 'oi');
    await servico.bloquear(a);
    expect(await servico.listConversas()).toHaveLength(1); // só a de boas-vindas
    await expect(servico.enviarMensagem(conversa.id, 'ainda aí?')).rejects.toThrow(
      /Não é possível conversar/,
    );
  });

  it('contatos são quem sigo + quem me segue, sem bloqueados', async () => {
    const { a } = await duasContas(servico);
    await servico.follow(a);
    const contatos = await servico.listContatos();
    expect(contatos.map((u) => u.apelido)).toEqual(
      expect.arrayContaining(['ana_rn', 'nacao_rubro', 'maraca_vibes']),
    );
    await servico.bloquear(a);
    expect((await servico.listContatos()).some((u) => u.id === a)).toBe(false);
  });

  it('marca notificações como lidas por tipo', async () => {
    await servico.cadastrar({ email: 'x@teste.com', senha: '123456' });
    await servico.marcarNotificacoesComoLidas(['seguiu']);
    const notas = await servico.listNotificacoes();
    expect(notas.filter((n) => n.tipo === 'seguiu').every((n) => n.lida)).toBe(true);
    expect(notas.some((n) => n.tipo === 'sistema' && !n.lida)).toBe(true);
  });
});

describe('MockDataService — seguidores e sugestões', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
  });

  it('novos seguidores trazem a data e se sigo de volta', async () => {
    const { a } = await duasContas(servico);
    await servico.sair();
    await servico.entrar('a@teste.com', '123456');
    // B segue A
    await servico.sair();
    await servico.entrar('b@teste.com', '123456');
    await servico.follow(a);
    await servico.sair();
    await servico.entrar('a@teste.com', '123456');
    const lista = await servico.listNovosSeguidores();
    expect(lista[0].usuario.apelido).toBe('beto_rn');
    expect(lista[0].sigoDeVolta).toBe(false);
    await servico.follow(lista[0].usuario.id);
    expect((await servico.listNovosSeguidores())[0].sigoDeVolta).toBe(true);
  });

  it('sugere quem ainda não sigo, priorizando interesses em comum', async () => {
    await servico.cadastrar({ email: 'x@teste.com', senha: '123456' });
    await servico.concluirOnboarding({ apelido: 'xis_rn', interesses: ['Análises'] });
    const sugestoes = await servico.sugerirTorcedores();
    expect(sugestoes.length).toBeGreaterThan(0);
    expect(sugestoes[0].interesses).toContain('Análises');
    await servico.follow(sugestoes[0].id);
    expect((await servico.sugerirTorcedores()).some((u) => u.id === sugestoes[0].id)).toBe(false);
  });
});

describe('MockDataService — rasantes', () => {
  let servico: MockDataService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    servico = criarServico();
  });

  it('lista os rasantes de quem sigo, agrupados, com os não vistos primeiro', async () => {
    await servico.entrarComoVisitante(); // já segue u-nacao e u-golaco
    const grupos = await servico.listRasantes();
    const autores = grupos.map((g) => g.autor.id);
    expect(autores).toEqual(expect.arrayContaining(['u-nacao', 'u-golaco']));
    expect(autores).not.toContain('u-memes'); // não sigo
    const nacao = grupos.find((g) => g.autor.id === 'u-nacao')!;
    expect(nacao.rasantes.length).toBe(2);
    expect(nacao.todosVistos).toBe(false);

    for (const r of nacao.rasantes) await servico.marcarRasanteComoVisto(r.id);
    const depois = await servico.listRasantes();
    expect(depois.find((g) => g.autor.id === 'u-nacao')!.todosVistos).toBe(true);
    // grupo todo visto vai para o fim
    expect(depois[depois.length - 1].autor.id).toBe('u-nacao');
  });

  it('publica um rasante meu (aparece primeiro), limita a 15 s e permite apagar', async () => {
    const sessao = await servico.entrarComoVisitante();
    await expect(
      servico.publicarRasante({ uriLocal: 'file:///longo.mp4', duracao: 40 }),
    ).rejects.toThrow('15 segundos');
    const rasante = await servico.publicarRasante({ uriLocal: 'file:///curto.mp4', duracao: 9 });
    expect(rasante.autorId).toBe(sessao.usuario.id);
    expect(new Date(rasante.expiraEm).getTime() - new Date(rasante.criadoEm).getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
    const grupos = await servico.listRasantes();
    expect(grupos[0].souEu).toBe(true);
    expect(grupos[0].rasantes[0].id).toBe(rasante.id);
    expect(await servico.listRasantesDoUsuario(sessao.usuario.id)).toHaveLength(1);

    await servico.excluirRasante(rasante.id);
    expect(await servico.listRasantesDoUsuario(sessao.usuario.id)).toHaveLength(0);
  });

  it('rasantes expirados não aparecem', async () => {
    await servico.entrarComoVisitante();
    const daqui = Date.now() + 25 * 60 * 60 * 1000;
    const antes = jest.spyOn(Date, 'now').mockReturnValue(daqui);
    try {
      // os do seed renascem (demo), mas com criadoEm novo: nenhum com mais de 24 h
      const grupos = await servico.listRasantes();
      for (const g of grupos)
        for (const r of g.rasantes) expect(new Date(r.expiraEm).getTime()).toBeGreaterThan(daqui);
    } finally {
      antes.mockRestore();
    }
  });
});
