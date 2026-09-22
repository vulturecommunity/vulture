import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export interface DegradeProps {
  /** altura total do degradê */
  altura: number;
  /** opacidade máxima (na borda escura) */
  intensidade?: number;
  /** de onde vem o escuro */
  origem?: 'baixo' | 'cima';
  /** número de faixas: mais faixas = transição mais suave */
  faixas?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Véu escuro em degradê para dar contraste ao texto sobre vídeo, montado com
 * faixas sobrepostas (o projeto não usa expo-linear-gradient).
 * A curva é quadrática: quase invisível no começo e firme na borda.
 */
export function Degrade({
  altura,
  intensidade = 0.8,
  origem = 'baixo',
  faixas = 14,
  style,
}: DegradeProps) {
  const camadas = useMemo(() => {
    const alturaDaFaixa = altura / faixas;
    return Array.from({ length: faixas }, (_, i) => {
      const t = (i + 1) / faixas;
      return {
        chave: i,
        opacidade: Number((intensidade * t * t).toFixed(3)),
        altura: alturaDaFaixa,
      };
    });
  }, [altura, faixas, intensidade]);

  const camadasOrdenadas = origem === 'baixo' ? camadas : [...camadas].reverse();

  return (
    <View
      style={[
        estilos.container,
        { height: altura },
        origem === 'baixo' ? estilos.baixo : estilos.cima,
        style,
      ]}
      pointerEvents="none">
      {camadasOrdenadas.map((c) => (
        <View
          key={c.chave}
          style={{ height: c.altura, backgroundColor: `rgba(0,0,0,${c.opacidade})` }}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0 },
  baixo: { bottom: 0 },
  cima: { top: 0 },
});
