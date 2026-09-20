import { Platform, type TextStyle } from 'react-native';

export const fontes = {
  regular: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

export const tipografia = {
  titulo: { fontSize: 28, fontWeight: '900', lineHeight: 34, letterSpacing: -0.6 },
  subtitulo: { fontSize: 20, fontWeight: '800', lineHeight: 26, letterSpacing: -0.3 },
  destaque: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  corpo: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  corpoForte: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  pequeno: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  legenda: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.3 },
  rotulo: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  marca: { fontSize: 15, fontWeight: '900', lineHeight: 18, letterSpacing: 3 },
} as const satisfies Record<string, TextStyle>;

export type VarianteTexto = keyof typeof tipografia;
