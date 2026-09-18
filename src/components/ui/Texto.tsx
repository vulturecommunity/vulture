import { Text, type TextProps } from 'react-native';

import { cores, tipografia, type VarianteTexto } from '@/theme';

export interface TextoProps extends TextProps {
  variante?: VarianteTexto;
  cor?: string;
  centralizado?: boolean;
}

/** Texto com as variantes tipográficas do tema. */
export function Texto({
  variante = 'corpo',
  cor = cores.texto,
  centralizado,
  style,
  ...resto
}: TextoProps) {
  return (
    <Text
      {...resto}
      style={[tipografia[variante], { color: cor }, centralizado && { textAlign: 'center' }, style]}
    />
  );
}
