import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';
import { mensagemDeErro } from '@/utils/erros';

import { Botao } from './Botao';
import { Texto } from './Texto';

export interface ErroProps {
  erro: unknown;
  aoTentarNovamente?: () => void;
  telaCheia?: boolean;
}

export function Erro({ erro, aoTentarNovamente, telaCheia = true }: ErroProps) {
  return (
    <View style={[estilos.container, telaCheia && estilos.telaCheia]}>
      <Ionicons name="alert-circle-outline" size={40} color={cores.erro} />
      <Texto variante="destaque" centralizado>
        Ops, algo deu errado
      </Texto>
      <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
        {mensagemDeErro(erro)}
      </Texto>
      {aoTentarNovamente ? (
        <Botao titulo="Tentar novamente" variante="secundario" onPress={aoTentarNovamente} />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.sm,
    padding: espacos.xl,
  },
  telaCheia: { flex: 1, backgroundColor: cores.fundo },
});
