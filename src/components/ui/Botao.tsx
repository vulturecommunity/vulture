import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { cores, espacos, raios } from '@/theme';

import { Texto } from './Texto';

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';
export type TamanhoBotao = 'pequeno' | 'medio' | 'grande';

export interface BotaoProps extends Omit<PressableProps, 'style' | 'children'> {
  titulo: string;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  carregando?: boolean;
  largo?: boolean;
  icone?: ReactNode;
  style?: StyleProp<ViewStyle>;
  semVibracao?: boolean;
}

const fundoPorVariante: Record<VarianteBotao, string> = {
  primario: cores.vermelho,
  secundario: cores.fundoCartao,
  fantasma: cores.transparente,
  perigo: cores.erro,
};

const textoPorVariante: Record<VarianteBotao, string> = {
  primario: cores.branco,
  secundario: cores.texto,
  fantasma: cores.textoSecundario,
  perigo: cores.branco,
};

const alturaPorTamanho: Record<TamanhoBotao, number> = { pequeno: 36, medio: 46, grande: 54 };

/** Botão padrão do app, com vibração leve ao tocar. */
export function Botao({
  titulo,
  variante = 'primario',
  tamanho = 'medio',
  carregando = false,
  largo = false,
  icone,
  style,
  disabled,
  onPress,
  semVibracao,
  ...resto
}: BotaoProps) {
  const inativo = disabled || carregando;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo, busy: carregando }}
      disabled={inativo}
      onPress={(e) => {
        if (!semVibracao) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        estilos.base,
        { backgroundColor: fundoPorVariante[variante], height: alturaPorTamanho[tamanho] },
        variante === 'fantasma' && estilos.fantasma,
        largo && estilos.largo,
        pressed && estilos.pressionado,
        inativo && estilos.inativo,
        style,
      ]}
      {...resto}>
      {carregando ? (
        <ActivityIndicator color={textoPorVariante[variante]} />
      ) : (
        <>
          {icone}
          <Texto
            variante={tamanho === 'pequeno' ? 'pequeno' : 'corpoForte'}
            cor={textoPorVariante[variante]}>
            {titulo}
          </Texto>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.lg,
    borderRadius: raios.md,
  },
  fantasma: { borderWidth: 1, borderColor: cores.borda },
  largo: { alignSelf: 'stretch' },
  pressionado: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  inativo: { opacity: 0.5 },
});
