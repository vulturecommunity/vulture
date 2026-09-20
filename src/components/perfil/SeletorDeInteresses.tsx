import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import { ICONE_INTERESSE, INTERESSES, type Interesse } from '@/constants/interesses';
import { cores, espacos, raios } from '@/theme';

export interface SeletorDeInteressesProps {
  selecionados: Interesse[];
  aoMudar: (novos: Interesse[]) => void;
  maximo?: number;
}

/** Chips de interesses (Jogos, Bastidores, Torcida, Memes, Análises). */
export function SeletorDeInteresses({
  selecionados,
  aoMudar,
  maximo = 3,
}: SeletorDeInteressesProps) {
  function alternar(interesse: Interesse) {
    Haptics.selectionAsync().catch(() => {});
    if (selecionados.includes(interesse)) {
      aoMudar(selecionados.filter((i) => i !== interesse));
    } else if (selecionados.length < maximo) {
      aoMudar([...selecionados, interesse]);
    }
  }

  return (
    <View style={estilos.linha}>
      {INTERESSES.map((interesse) => {
        const ativo = selecionados.includes(interesse);
        const bloqueado = !ativo && selecionados.length >= maximo;
        return (
          <Pressable
            key={interesse}
            onPress={() => alternar(interesse)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ativo, disabled: bloqueado }}
            testID={`interesse-${interesse}`}
            style={[estilos.chip, ativo && estilos.chipAtivo, bloqueado && estilos.chipBloqueado]}>
            <Icone
              nome={ICONE_INTERESSE[interesse]}
              tamanho={15}
              cor={ativo ? cores.branco : cores.vermelhoVivo}
            />
            <Texto variante="corpoForte" cor={ativo ? cores.branco : cores.textoSecundario}>
              {interesse}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm + 2,
    borderRadius: raios.md,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundoElevado,
  },
  chipAtivo: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  chipBloqueado: { opacity: 0.4 },
});
