import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';

import { Texto } from './Texto';

export interface CarregandoProps {
  mensagem?: string;
  telaCheia?: boolean;
}

export function Carregando({ mensagem, telaCheia = true }: CarregandoProps) {
  return (
    <View
      style={[estilos.container, telaCheia && estilos.telaCheia]}
      accessibilityRole="progressbar"
      testID="carregando">
      <ActivityIndicator size="large" color={cores.vermelho} />
      {mensagem ? (
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          {mensagem}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.sm,
    padding: espacos.lg,
  },
  telaCheia: { flex: 1, backgroundColor: cores.fundo },
});
