import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';

import { Icone, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';

/**
 * O card do palpite, desenhado para virar imagem.
 *
 * POR QUE UMA IMAGEM, SE JÁ EXISTE O LINK
 *
 * O link com Open Graph resolve WhatsApp e Telegram, que renderizam prévia. Instagram
 * Stories e X não renderizam: lá, link é texto cinza que ninguém toca. Uma imagem é o
 * único formato que funciona nos quatro — e Stories é onde a torcida posta.
 *
 * DIMENSÕES
 *
 * 1080×1920 é o formato nativo de Stories. Capturar em 9:16 evita que o Instagram corte
 * o placar ou a marca ao encaixar numa tela que não é a do aparelho de quem gerou.
 *
 * O QUE ESTÁ NO CARD, E POR QUÊ
 *
 * Placar grande (é a provocação), as siglas dos times (quem vê precisa saber do que se
 * trata sem ler legenda), o apelido (a autoria é o que dá graça) e a marca no rodapé
 * (sem ela a imagem circula sem dizer de onde veio, que é o ponto de compartilhar).
 */

export const LARGURA_DO_CARD = 1080;
export const ALTURA_DO_CARD = 1920;

/** Escala em que o card é desenhado na tela antes da captura (ele fica fora de vista). */
const ESCALA = 0.25;

export interface CardDoPalpiteProps {
  readonly mandante: string;
  readonly visitante: string;
  readonly golsMandante: number;
  readonly golsVisitante: number;
  readonly apelido: string;
  readonly competicao?: string | null;
  readonly quando?: string | null;
}

export const CardDoPalpite = forwardRef<ViewShotRef, CardDoPalpiteProps>(function CardDoPalpite(
  { mandante, visitante, golsMandante, golsVisitante, apelido, competicao, quando },
  ref,
) {
  return (
    <ViewShot
      ref={ref}
      options={{ format: 'png', quality: 1, width: LARGURA_DO_CARD, height: ALTURA_DO_CARD }}
      style={estilos.captura}>
      <View style={estilos.card}>
        <View style={estilos.topo}>
          <Icone nome="escudo" tamanho={34} cor={cores.vermelho} />
          <Texto variante="rotulo" cor={cores.textoSecundario} style={estilos.espacado}>
            MEU PALPITE
          </Texto>
        </View>

        {competicao ? (
          <Texto variante="corpo" cor={cores.textoTerciario} centralizado>
            {competicao}
            {quando ? ` · ${quando}` : ''}
          </Texto>
        ) : null}

        <View style={estilos.placar}>
          <View style={estilos.time}>
            <Texto style={estilos.sigla}>{mandante}</Texto>
            <Texto style={estilos.gols}>{golsMandante}</Texto>
          </View>
          <Texto style={estilos.x}>×</Texto>
          <View style={estilos.time}>
            <Texto style={estilos.sigla}>{visitante}</Texto>
            <Texto style={estilos.gols}>{golsVisitante}</Texto>
          </View>
        </View>

        <View style={estilos.assinatura}>
          <Texto variante="subtitulo" centralizado>
            @{apelido}
          </Texto>
          <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
            E você, acha que dá quanto?
          </Texto>
        </View>

        <View style={estilos.rodape}>
          <Texto variante="rotulo" style={estilos.marca}>
            VULTURE
          </Texto>
          <Texto variante="legenda" cor={cores.textoTerciario} centralizado>
            o app da nação rubro-negra
          </Texto>
        </View>
      </View>
    </ViewShot>
  );
});

const estilos = StyleSheet.create({
  // fora da área visível: o card existe só para ser fotografado
  captura: { position: 'absolute', left: -9999, top: -9999 },
  card: {
    width: LARGURA_DO_CARD * ESCALA,
    height: ALTURA_DO_CARD * ESCALA,
    backgroundColor: cores.pretoPuro,
    borderWidth: 6,
    borderColor: cores.vermelho,
    borderRadius: raios.lg,
    padding: espacos.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topo: { alignItems: 'center', gap: espacos.xs },
  espacado: { letterSpacing: 2 },
  placar: { flexDirection: 'row', alignItems: 'center', gap: espacos.md },
  time: { alignItems: 'center', gap: espacos.xs, minWidth: 90 },
  sigla: { fontSize: 26, fontWeight: '700', color: cores.textoSecundario, letterSpacing: 1 },
  gols: { fontSize: 86, fontWeight: '800', color: cores.texto, lineHeight: 92 },
  x: { fontSize: 32, color: cores.textoTerciario, marginTop: 28 },
  assinatura: { alignItems: 'center', gap: espacos.xs },
  rodape: { alignItems: 'center', gap: 2 },
  marca: { color: cores.vermelho, letterSpacing: 4, fontSize: 15, fontWeight: '800' },
});
