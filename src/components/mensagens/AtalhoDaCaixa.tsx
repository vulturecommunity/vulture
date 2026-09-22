import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto, type NomeDeIcone } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';

export interface AtalhoDaCaixaProps {
  icone: NomeDeIcone;
  cor: string;
  titulo: string;
  descricao: string;
  naoLidas?: number;
  aoPressionar: () => void;
  testID?: string;
}

/** Atalho fixo da caixa de mensagens (novos seguidores, atividade, avisos do Vulture). */
export function AtalhoDaCaixa({
  icone,
  cor,
  titulo,
  descricao,
  naoLidas = 0,
  aoPressionar,
  testID,
}: AtalhoDaCaixaProps) {
  return (
    <Pressable
      onPress={aoPressionar}
      style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      testID={testID}>
      <View style={[estilos.circulo, { backgroundColor: cor }]}>
        <Icone nome={icone} tamanho={22} cor={cores.branco} />
      </View>
      <View style={estilos.textos}>
        <Texto variante="corpoForte">{titulo}</Texto>
        <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
          {descricao}
        </Texto>
      </View>
      {naoLidas > 0 ? (
        <View style={estilos.badge} testID={testID ? `${testID}-badge` : undefined}>
          <Texto variante="legenda" style={estilos.badgeTexto}>
            {naoLidas > 99 ? '99+' : naoLidas}
          </Texto>
        </View>
      ) : (
        <Icone nome="avancar" tamanho={16} cor={cores.textoTerciario} />
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
  },
  pressionada: { backgroundColor: cores.fundoElevado },
  circulo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: raios.redondo,
    paddingHorizontal: 6,
    backgroundColor: cores.vermelhoVivo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexto: { fontSize: 10, lineHeight: 12 },
});
