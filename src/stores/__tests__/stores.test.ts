import { useCriacaoStore } from '../criacaoStore';
import { usePlayerStore } from '../playerStore';
import { useUiStore } from '../uiStore';

describe('playerStore', () => {
  it('controla vídeo ativo, mudo e foco', () => {
    const s = usePlayerStore.getState();
    s.definirAtivo('feed-paraVoce', 'v-1');
    expect(usePlayerStore.getState().videoAtivoId).toBe('v-1');
    expect(usePlayerStore.getState().listaAtiva).toBe('feed-paraVoce');
    s.alternarMudo();
    expect(usePlayerStore.getState().mudo).toBe(true);
    s.definirMudo(false);
    expect(usePlayerStore.getState().mudo).toBe(false);
    s.definirFoco(false);
    expect(usePlayerStore.getState().feedEmFoco).toBe(false);
  });
});

describe('uiStore', () => {
  it('abre e fecha painéis globais e avisos', () => {
    const s = useUiStore.getState();
    s.abrirComentarios('v-9');
    expect(useUiStore.getState().videoParaComentar).toBe('v-9');
    s.fecharComentarios();
    expect(useUiStore.getState().videoParaComentar).toBeNull();
    s.abrirDenuncia({ tipo: 'video', id: 'v-1', autorId: 'u-1', autorApelido: 'x' });
    expect(useUiStore.getState().alvoParaDenuncia?.id).toBe('v-1');
    s.fecharDenuncia();
    s.mostrarAviso('Feito', 'sucesso');
    expect(useUiStore.getState().aviso).toEqual({ texto: 'Feito', tipo: 'sucesso' });
    s.limparAviso();
    expect(useUiStore.getState().aviso).toBeNull();
  });
});

describe('criacaoStore', () => {
  it('guarda a mídia, legenda, progresso e limpa', () => {
    const s = useCriacaoStore.getState();
    s.definirMidia({
      uri: 'file:///a.mp4',
      tipo: 'video',
      duracao: 10,
      largura: 1,
      altura: 2,
      origem: 'camera',
    });
    s.definirLegenda('oi #Mengo');
    s.definirCategoria('Memes');
    s.definirProgresso(0.5, 'Enviando');
    const estado = useCriacaoStore.getState();
    expect(estado.midia?.uri).toBe('file:///a.mp4');
    expect(estado.legenda).toBe('oi #Mengo');
    expect(estado.categoria).toBe('Memes');
    expect(estado.progresso).toBe(0.5);
    s.limpar();
    expect(useCriacaoStore.getState().midia).toBeNull();
    expect(useCriacaoStore.getState().progresso).toBe(0);
  });
});
