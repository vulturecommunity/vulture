import { fireEvent, render, screen } from '@testing-library/react-native';

import { BotaoCurtir } from '@/components/feed/BotaoCurtir';

describe('BotaoCurtir', () => {
  it('mostra o contador formatado e chama aoPressionar', async () => {
    const aoPressionar = jest.fn();
    await render(<BotaoCurtir curtido={false} total={1234} aoPressionar={aoPressionar} />);
    expect(screen.getByTestId('total-curtidas')).toHaveTextContent('1,2 mil');
    await fireEvent.press(screen.getByTestId('botao-curtir'));
    expect(aoPressionar).toHaveBeenCalledTimes(1);
  });

  it('expõe o estado de curtido para acessibilidade', async () => {
    await render(<BotaoCurtir curtido total={10} aoPressionar={() => {}} />);
    expect(screen.getByLabelText('Descurtir')).toBeTruthy();
    expect(screen.getByTestId('botao-curtir').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});
