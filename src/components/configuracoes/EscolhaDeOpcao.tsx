import { Pressable, StyleSheet, View } from 'react-native';

import { Texto } from '@/components/ui';
import { cores, espacos } from '@/theme';

export interface OpcaoDeEscolha<V extends string> {
  valor: V;
  titulo: string;
  descricao?: string;
}

export interface EscolhaDeOpcaoProps<V extends string> {
  opcoes: OpcaoDeEscolha<V>[];
  selecionada: V;
  aoEscolher: (valor: V) => void;
  testID?: string;
}

/** Lista de escolha única (rádio), no formato das linhas de configuração. */
export function EscolhaDeOpcao<V extends string>({
  opcoes,
  selecionada,
  aoEscolher,
  testID,
}: EscolhaDeOpcaoProps<V>) {
  return (
    <View>
      {opcoes.map((opcao, i) => {
        const ativa = opcao.valor === selecionada;
        return (
          <View key={opcao.valor}>
            {i > 0 ? <View style={estilos.separador} /> : null}
            <Pressable
              onPress={() => aoEscolher(opcao.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={opcao.titulo}
              testID={testID ? `${testID}-${opcao.valor}` : undefined}
              style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}>
              <View style={estilos.textos}>
                <Texto variante="corpoForte">{opcao.titulo}</Texto>
                {opcao.descricao ? (
                  <Texto variante="pequeno" cor={cores.textoTerciario}>
                    {opcao.descricao}
                  </Texto>
                ) : null}
              </View>
              <View style={[estilos.marca, ativa && estilos.marcaAtiva]}>
                {ativa ? <View style={estilos.ponto} /> : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.md,
    minHeight: 58,
  },
  pressionada: { backgroundColor: cores.fundoCartao },
  separador: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: cores.borda,
    marginLeft: espacos.md,
  },
  textos: { flex: 1, gap: 2 },
  marca: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaAtiva: { borderColor: cores.vermelhoVivo },
  ponto: { width: 11, height: 11, borderRadius: 6, backgroundColor: cores.vermelhoVivo },
});
