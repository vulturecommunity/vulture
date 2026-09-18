import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Avatar, Botao, Carregando, Erro, EstadoVazio, Input, Sheet, Texto } from '@/components/ui';
import { Aviso } from '@/components/ui/Aviso';
import { useUiStore } from '@/stores/uiStore';

describe('componentes base', () => {
  it('Botao chama onPress, mostra carregando e desabilita', async () => {
    const onPress = jest.fn();
    await render(<Botao titulo="Entrar" onPress={onPress} testID="b" />);
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('Entrar')).toBeTruthy();

    const { rerender } = await render(<Botao titulo="Entrar" carregando testID="b2" />);
    expect(screen.queryByText('Entrar')).toBeNull();
    await rerender(<Botao titulo="Entrar" disabled onPress={onPress} testID="b2" />);
    await fireEvent.press(screen.getByTestId('b2'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('Avatar mostra iniciais sem foto e imagem com foto', async () => {
    await render(<Avatar nome="Maria Silva" />);
    expect(screen.getByText('MS')).toBeTruthy();
    await render(<Avatar nome="Ana" url="https://exemplo.com/a.jpg" />);
    expect(screen.getByLabelText('Foto de Ana')).toBeTruthy();
  });

  it('Input exibe rótulo, prefixo, erro e ajuda', async () => {
    const { rerender } = await render(
      <Input rotulo="Apelido" prefixo="@" ajuda="Dica" value="" onChangeText={() => {}} />,
    );
    expect(screen.getByText('Apelido')).toBeTruthy();
    expect(screen.getByText('@')).toBeTruthy();
    expect(screen.getByText('Dica')).toBeTruthy();
    await rerender(<Input rotulo="Apelido" erro="Inválido" value="" onChangeText={() => {}} />);
    expect(screen.getByText('Inválido')).toBeTruthy();
    expect(screen.queryByText('Dica')).toBeNull();
  });

  it('EstadoVazio, Carregando e Erro renderizam textos e ações', async () => {
    const acao = jest.fn();
    await render(
      <EstadoVazio
        titulo="Nada aqui"
        descricao="Desc"
        acao={{ titulo: 'Agir', aoPressionar: acao }}
      />,
    );
    expect(screen.getByText('Nada aqui')).toBeTruthy();
    await fireEvent.press(screen.getByText('Agir'));
    expect(acao).toHaveBeenCalled();

    await render(<Carregando mensagem="Carregando..." />);
    expect(screen.getByText('Carregando...')).toBeTruthy();

    const tentar = jest.fn();
    await render(<Erro erro={new Error('Falhou feio')} aoTentarNovamente={tentar} />);
    expect(screen.getByText('Falhou feio')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar novamente'));
    expect(tentar).toHaveBeenCalled();
  });

  it('Sheet mostra título e conteúdo quando visível e fecha pelo botão', async () => {
    const fechar = jest.fn();
    await render(
      <Sheet visivel aoFechar={fechar} titulo="Painel">
        <Text>Conteúdo</Text>
      </Sheet>,
    );
    expect(screen.getByText('Painel')).toBeTruthy();
    expect(screen.getByText('Conteúdo')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(fechar).toHaveBeenCalled();
  });

  it('Texto aplica variante e cor', async () => {
    await render(
      <Texto variante="titulo" cor="#123456" centralizado>
        Olá
      </Texto>,
    );
    const el = screen.getByText('Olá');
    expect(el).toHaveStyle({ color: '#123456', textAlign: 'center', fontSize: 28 });
  });

  it('Aviso aparece com o texto do uiStore e some ao tocar', async () => {
    useUiStore.getState().mostrarAviso('Publicado!', 'sucesso');
    await render(<Aviso />);
    expect(screen.getByText('Publicado!')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('aviso'));
    expect(useUiStore.getState().aviso).toBeNull();
  });
});
