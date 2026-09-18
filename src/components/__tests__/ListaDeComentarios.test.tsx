import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ListaDeComentarios } from '@/components/comentarios/ListaDeComentarios';

import { criarServicoDeTeste, renderizar } from './utilitarios-de-teste';

describe('ListaDeComentarios', () => {
  it('lista comentários do vídeo com respostas aninhadas', async () => {
    const servico = criarServicoDeTeste();
    await servico.entrarComoVisitante();
    const existentes = await servico.listComments('v-seed-001');
    await renderizar(<ListaDeComentarios videoId="v-seed-001" meuId="u-visitante" />);
    await waitFor(() => {
      expect(screen.getByTestId(`comentario-${existentes[0].id}`)).toBeTruthy();
    });
    const comResposta = existentes.find((c) => c.respostas.length > 0);
    expect(comResposta).toBeDefined();
    expect(screen.getByTestId(`comentario-${comResposta!.respostas[0].id}`)).toBeTruthy();
  });

  it('envia um comentário novo e limpa o campo', async () => {
    const servico = criarServicoDeTeste();
    await servico.entrarComoVisitante();
    await renderizar(<ListaDeComentarios videoId="v-seed-002" meuId="u-visitante" />);
    await waitFor(() => expect(screen.getByTestId('campo-comentario')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('campo-comentario'), 'Isso é Mengão!');
    await fireEvent.press(screen.getByTestId('botao-enviar-comentario'));
    await waitFor(() => {
      expect(screen.getByText('Isso é Mengão!')).toBeTruthy();
    });
    expect(screen.getByTestId('campo-comentario').props.value).toBe('');
    const lista = await servico.listComments('v-seed-002');
    expect(lista.some((c) => c.texto === 'Isso é Mengão!')).toBe(true);
  });

  it('responde um comentário em 1 nível', async () => {
    const servico = criarServicoDeTeste();
    await servico.entrarComoVisitante();
    const [raiz] = await servico.listComments('v-seed-003');
    await renderizar(<ListaDeComentarios videoId="v-seed-003" meuId="u-visitante" />);
    await waitFor(() => expect(screen.getByTestId(`comentario-${raiz.id}`)).toBeTruthy());
    await fireEvent.press(screen.getAllByText('Responder')[0]);
    expect(screen.getByText(`Respondendo @${raiz.autor.apelido}`)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('campo-comentario'), 'Concordo!');
    await fireEvent.press(screen.getByTestId('botao-enviar-comentario'));
    await waitFor(async () => {
      const lista = await servico.listComments('v-seed-003');
      const pai = lista.find((c) => c.id === raiz.id)!;
      expect(pai.respostas.some((r) => r.texto === 'Concordo!')).toBe(true);
    });
  });

  it('mostra estado vazio quando não há comentários', async () => {
    const servico = criarServicoDeTeste();
    await servico.entrarComoVisitante();
    await renderizar(<ListaDeComentarios videoId="v-seed-120" meuId="u-visitante" />);
    await waitFor(() => expect(screen.getByText('Nenhum comentário ainda')).toBeTruthy());
  });
});
