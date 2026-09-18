import { Platform, type TextStyle } from 'react-native';

export const fontes = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

export const tipografia = {
  titulo: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  subtitulo: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  destaque: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  corpo: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  corpoForte: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  pequeno: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  legenda: { fontSize: 11, fontWeight: '500', lineHeight: 14 },
} as const satisfies Record<string, TextStyle>;

export type VarianteTexto = keyof typeof tipografia;
