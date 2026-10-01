import {
  compartilharLiga,
  compartilharLive,
  compartilharPerfil,
  compartilharPost,
  compartilharVideo,
  linkDoVideo,
} from '../compartilhar';

jest.mock('@/services/data/supabase/cliente', () => ({
  configuracaoSupabase: () => ({ url: 'https://projeto.supabase.co', chave: 'anon' }),
}));

const BASE = 'https://projeto.supabase.co/functions/v1/abrir';

describe('links de compartilhamento', () => {
  it('usa https, e não o esquema vulture:// que morre no WhatsApp', () => {
    const url = linkDoVideo('v1');
    expect(url).toBe(`${BASE}/v/v1`);
    expect(url.startsWith('https://')).toBe(true);
    expect(url).not.toContain('vulture://');
  });
});

describe('mensagem de vídeo', () => {
  const base = { id: 'v1', legenda: 'Que festa no Maracanã', apelido: 'zico' };

  it('tem gancho, conteúdo entre aspas e o link isolado na última linha', () => {
    const { mensagem, url } = compartilharVideo(base);
    const linhas = mensagem.split('\n\n');
    expect(linhas[0]).toMatch(/Vulture/);
    expect(linhas[1]).toContain('"Que festa no Maracanã"');
    expect(linhas[1]).toContain('@zico');
    // o link sozinho no fim: link no meio de parágrafo atrapalha a prévia
    expect(linhas.at(-1)).toBe(url);
  });

  it('vídeo sem legenda não gera aspas vazias', () => {
    const { mensagem } = compartilharVideo({ ...base, legenda: '   ' });
    expect(mensagem).not.toContain('""');
    expect(mensagem).toContain('@zico');
  });

  it('legenda longa é resumida sem cortar palavra no meio', () => {
    const legenda = 'gol '.repeat(80);
    const { mensagem } = compartilharVideo({ ...base, legenda });
    const citacao = /"([^"]*)"/.exec(mensagem)?.[1] ?? '';
    expect(citacao.length).toBeLessThanOrEqual(115);
    expect(citacao.endsWith('…')).toBe(true);
    expect(citacao).not.toMatch(/\sg…$/); // não terminou no meio de "gol"
  });
});

describe('mensagem de post, perfil e liga', () => {
  it('post cita o texto e credita o autor', () => {
    const { mensagem, url } = compartilharPost({
      id: 'p1',
      texto: 'Mengão joga demais',
      apelido: 'arrascaeta',
    });
    expect(mensagem).toContain('"Mengão joga demais"');
    expect(mensagem).toContain('@arrascaeta');
    expect(url).toBe(`${BASE}/p/p1`);
  });

  it('convite de perfil leva o apelido e o link do perfil', () => {
    const { mensagem, url } = compartilharPerfil({ apelido: 'zico' });
    expect(mensagem).toContain('@zico');
    expect(url).toBe(`${BASE}/u/zico`);
  });

  it('convite de liga destaca o código e explica a pontuação', () => {
    const { mensagem, url } = compartilharLiga({ nome: 'Resenha da firma', codigo: 'ABC234' });
    expect(mensagem).toContain('Resenha da firma');
    expect(mensagem).toContain('ABC234');
    // o convite precisa dizer por que vale entrar, não só "entre na liga"
    expect(mensagem).toMatch(/10 pontos/);
    expect(url).toBe(`${BASE}/liga/ABC234`);
  });
});

describe('convite de live', () => {
  const base = { id: 'l1', titulo: 'Esquenta pro clássico', apelido: 'zico' };

  it('leva o link https da live e o assunto da transmissão', () => {
    const { mensagem, url } = compartilharLive(base);
    expect(url).toBe(`${BASE}/live/l1`);
    expect(mensagem).toContain('"Esquenta pro clássico"');
    expect(mensagem.split('\n\n').at(-1)).toBe(url);
  });

  it('diz que é agora e que não fica gravada — live expira, os outros links não', () => {
    const { mensagem } = compartilharLive(base);
    expect(mensagem).toMatch(/agora/i);
    expect(mensagem).toMatch(/não fica gravada/i);
  });

  it('o anfitrião chama para a própria live; o espectador credita quem transmite', () => {
    const doAnfitriao = compartilharLive({ ...base, souOAnfitriao: true });
    expect(doAnfitriao.mensagem).toMatch(/Tô AO VIVO/);
    expect(doAnfitriao.mensagem).not.toContain('@zico');

    const doEspectador = compartilharLive(base);
    expect(doEspectador.mensagem).toContain('@zico');
  });

  it('live sem título não gera aspas vazias', () => {
    const { mensagem } = compartilharLive({ ...base, titulo: '   ' });
    expect(mensagem).not.toContain('""');
    expect(mensagem).toMatch(/não fica gravada/i);
  });
});
