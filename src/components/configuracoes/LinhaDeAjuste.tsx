import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icone, Texto, type NomeDeIcone } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';

export interface LinhaDeAjusteProps {
  icone?: NomeDeIcone;
  titulo: string;
  descricao?: string;
  /** estado atual mostrado à direita, antes da seta (ex.: "Ativado") */
  valor?: string;
  aoPressionar?: () => void;
  /** com `aoAlternar`, a linha vira um interruptor em vez de um link */
  ligado?: boolean;
  aoAlternar?: (valor: boolean) => void;
  /** ícone em vermelho: usado nas linhas que abrem algo importante */
  destaque?: boolean;
  cor?: string;
  desabilitada?: boolean;
  testID?: string;
}

/** Uma linha de configuração: ícone, título, estado e seta (ou interruptor). */
export function LinhaDeAjuste({
  icone,
  titulo,
  descricao,
  valor,
  aoPressionar,
  ligado,
  aoAlternar,
  destaque,
  cor = cores.texto,
  desabilitada,
  testID,
}: LinhaDeAjusteProps) {
  const interruptor = !!aoAlternar;
  const corDoIcone = destaque ? cores.vermelhoVivo : cores.textoSecundario;

  const conteudo = (
    <>
      {icone ? (
        <View style={[estilos.icone, destaque && estilos.iconeDestaque]}>
          <Icone nome={icone} tamanho={17} cor={desabilitada ? cores.textoTerciario : corDoIcone} />
        </View>
      ) : null}
      <View style={estilos.textos}>
        <Texto variante="corpoForte" cor={desabilitada ? cores.textoTerciario : cor}>
          {titulo}
        </Texto>
        {descricao ? (
          <Texto variante="pequeno" cor={cores.textoTerciario}>
            {descricao}
          </Texto>
        ) : null}
      </View>
      {interruptor ? (
        <Switch
          value={!!ligado}
          onValueChange={aoAlternar}
          disabled={desabilitada}
          trackColor={{ false: cores.borda, true: cores.vermelho }}
          thumbColor={cores.branco}
          accessibilityLabel={titulo}
          testID={testID ? `${testID}-switch` : undefined}
        />
      ) : (
        <View style={estilos.direita}>
          {valor ? (
            <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
              {valor}
            </Texto>
          ) : null}
          {aoPressionar ? <Icone nome="avancar" tamanho={16} cor={cores.textoTerciario} /> : null}
        </View>
      )}
    </>
  );

  if (interruptor || !aoPressionar) {
    return (
      <View style={estilos.linha} testID={testID}>
        {conteudo}
      </View>
    );
  }

  return (
    <Pressable
      onPress={aoPressionar}
      disabled={desabilitada}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      testID={testID}
      style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}>
      {conteudo}
    </Pressable>
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
  icone: {
    width: 34,
    height: 34,
    borderRadius: raios.sm + 2,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeDestaque: { backgroundColor: cores.vermelhoSuave },
  textos: { flex: 1, gap: 2 },
  direita: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm, maxWidth: '45%' },
});
