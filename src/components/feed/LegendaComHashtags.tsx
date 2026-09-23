import { useRouter } from 'expo-router';
import { Text, type TextProps } from 'react-native';

import { cores, tipografia } from '@/theme';
import { dividirLegenda } from '@/utils/hashtags';

export interface LegendaComHashtagsProps extends TextProps {
  texto: string;
  cor?: string;
  /** por padrão abre a tela de vídeos da hashtag; a resenha filtra os próprios posts */
  aoTocarHashtag?: (tag: string) => void;
}

/** Renderiza a legenda com hashtags clicáveis (abre a tela da hashtag). */
export function LegendaComHashtags({
  texto,
  cor = cores.texto,
  aoTocarHashtag,
  style,
  ...resto
}: LegendaComHashtagsProps) {
  const router = useRouter();
  const trechos = dividirLegenda(texto);
  return (
    <Text style={[tipografia.corpo, { color: cor }, style]} {...resto}>
      {trechos.map((trecho, i) =>
        trecho.tipo === 'hashtag' ? (
          <Text
            key={`${trecho.valor}-${i}`}
            style={{ fontWeight: '700', color: cores.vermelhoVivo }}
            accessibilityRole="link"
            onPress={() =>
              aoTocarHashtag
                ? aoTocarHashtag(trecho.valor)
                : router.push({ pathname: '/hashtag/[tag]', params: { tag: trecho.valor } })
            }>
            #{trecho.valor}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{trecho.valor}</Text>
        ),
      )}
    </Text>
  );
}
