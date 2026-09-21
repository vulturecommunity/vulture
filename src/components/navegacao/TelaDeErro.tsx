import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Icone, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';

export interface TelaDeErroProps {
  error: Error;
  retry: () => Promise<void> | void;
}

/**
 * ErrorBoundary das rotas (Expo Router). Sem isso, um erro de renderização em produção
 * fecha o app inteiro; com isso o usuário vê o que houve e tenta de novo.
 */
export function TelaDeErro({ error, retry }: TelaDeErroProps) {
  const insets = useSafeAreaInsets();
  const [tentando, setTentando] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

  async function tentarNovamente() {
    setTentando(true);
    try {
      await retry();
    } finally {
      setTentando(false);
    }
  }

  return (
    <View
      style={[
        estilos.tela,
        { paddingTop: insets.top + espacos.xl, paddingBottom: insets.bottom + espacos.xl },
      ]}>
      <View style={estilos.icone}>
        <Icone nome="alerta" tamanho={36} cor={cores.vermelhoVivo} />
      </View>
      <Texto variante="subtitulo" centralizado>
        Deu ruim por aqui
      </Texto>
      <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
        Algo inesperado aconteceu nesta tela. Toque em tentar novamente; se continuar, feche e abra
        o app.
      </Texto>
      <Botao titulo="Tentar novamente" onPress={tentarNovamente} carregando={tentando} largo />
      <Botao
        titulo={mostrarDetalhes ? 'Ocultar detalhes' : 'Ver detalhes técnicos'}
        variante="fantasma"
        onPress={() => setMostrarDetalhes((v) => !v)}
      />
      {mostrarDetalhes ? (
        <ScrollView style={estilos.detalhes} contentContainerStyle={estilos.detalhesConteudo}>
          <Texto variante="legenda" cor={cores.textoSecundario} selectable>
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack.split('\n').slice(0, 12).join('\n')}` : ''}
          </Texto>
        </ScrollView>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.xl,
  },
  icone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: cores.fundoElevado,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacos.sm,
  },
  detalhes: {
    alignSelf: 'stretch',
    maxHeight: 220,
    backgroundColor: cores.fundoElevado,
    borderRadius: raios.md,
  },
  detalhesConteudo: { padding: espacos.md },
});
