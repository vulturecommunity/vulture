import { StyleSheet, View } from 'react-native';

import { cores, espacos } from '@/theme';
import { mensagemDeErro } from '@/utils/erros';

import { Botao } from './Botao';
import { Icone } from './Icone';
import { Texto } from './Texto';

export interface ErroProps {
  erro: unknown;
  aoTentarNovamente?: () => void;
  telaCheia?: boolean;
}

export function Erro({ erro, aoTentarNovamente, telaCheia = true }: ErroProps) {
  return (
    <View style={[estilos.container, telaCheia && estilos.telaCheia]}>
      <View style={estilos.circulo}>
        <Icone nome="alerta" tamanho={26} cor={cores.erro} />
      </View>
      <Texto variante="destaque" centralizado>
        Ops, algo deu errado
      </Texto>
      <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
        {mensagemDeErro(erro)}
      </Texto>
      {aoTentarNovamente ? (
        <Botao titulo="Tentar novamente" variante="contorno" onPress={aoTentarNovamente} />
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
  circulo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,77,90,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacos.xs,
  },
});
