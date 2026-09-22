import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto, type NomeDeIcone } from '@/components/ui';
import { cores, espacos } from '@/theme';
import type { Video } from '@/types';
import { formatarContador } from '@/utils/formatadores';

import { BotaoCurtir } from './BotaoCurtir';

export interface BarraDeAcoesProps {
  video: Video;
  aoCurtir: () => void;
  aoComentar: () => void;
  aoSalvar: () => void;
  aoCompartilhar: () => void;
  aoMais: () => void;
}

function Acao({
  icone,
  rotulo,
  aoPressionar,
  cor = cores.branco,
  acessibilidade,
  testID,
}: {
  icone: NomeDeIcone;
  rotulo?: string;
  aoPressionar: () => void;
  cor?: string;
  acessibilidade: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={10}
      style={({ pressed }) => [estilos.acao, pressed && estilos.pressionado]}
      accessibilityRole="button"
      accessibilityLabel={acessibilidade}
      testID={testID}>
      <Icone nome={icone} tamanho={24} cor={cor} style={estilos.sombraIcone} />
      {rotulo ? (
        <Texto variante="legenda" cor={cores.branco} style={estilos.contador}>
          {rotulo}
        </Texto>
      ) : null}
    </Pressable>
  );
}

/**
 * Ações do vídeo em linha, sem pílulas: ícone + contador direto sobre o degradê.
 * Menos caixas = mais vídeo à mostra.
 */
export function BarraDeAcoes({
  video,
  aoCurtir,
  aoComentar,
  aoSalvar,
  aoCompartilhar,
  aoMais,
}: BarraDeAcoesProps) {
  return (
    <View style={estilos.linha} testID="barra-de-acoes">
      <BotaoCurtir curtido={video.curtido} total={video.curtidas} aoPressionar={aoCurtir} />
      <Acao
        icone="comentar"
        rotulo={formatarContador(video.comentarios)}
        aoPressionar={aoComentar}
        acessibilidade="Comentários"
        testID="botao-comentar"
      />
      <Acao
        icone={video.salvo ? 'salvo' : 'salvar'}
        rotulo={formatarContador(video.salvos)}
        aoPressionar={aoSalvar}
        cor={video.salvo ? cores.dourado : cores.branco}
        acessibilidade={video.salvo ? 'Remover dos salvos' : 'Salvar'}
        testID="botao-salvar"
      />
      <Acao
        icone="compartilhar"
        rotulo={formatarContador(video.compartilhamentos)}
        aoPressionar={aoCompartilhar}
        acessibilidade="Compartilhar"
        testID="botao-compartilhar"
      />
      <View style={estilos.espaco} />
      <Acao icone="mais" aoPressionar={aoMais} acessibilidade="Mais opções" testID="botao-mais" />
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.lg },
  espaco: { flex: 1 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs + 2 },
  pressionado: { opacity: 0.6 },
  sombraIcone: { textShadowColor: cores.sombra, textShadowRadius: 6 },
  contador: { textShadowColor: cores.sombra, textShadowRadius: 5 },
});
