import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto, type NomeDeIcone } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
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
  ativo = false,
  corAtivo = cores.vermelho,
  acessibilidade,
  testID,
}: {
  icone: NomeDeIcone;
  rotulo?: string;
  aoPressionar: () => void;
  ativo?: boolean;
  corAtivo?: string;
  acessibilidade: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={6}
      style={({ pressed }) => [
        estilos.pilula,
        !rotulo && estilos.pilulaSoIcone,
        ativo && { backgroundColor: corAtivo, borderColor: corAtivo },
        pressed && estilos.pressionado,
      ]}
      accessibilityRole="button"
      accessibilityLabel={acessibilidade}
      testID={testID}>
      <Icone nome={icone} tamanho={20} cor={cores.branco} />
      {rotulo ? <Texto variante="legenda">{rotulo}</Texto> : null}
    </Pressable>
  );
}

/** Barra horizontal de ações do vídeo: curtir, comentar, salvar, compartilhar e mais opções. */
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
        ativo={video.salvo}
        corAtivo={cores.dourado}
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
  linha: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm, flexWrap: 'wrap' },
  espaco: { flex: 1 },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    height: 38,
    paddingHorizontal: espacos.md,
    borderRadius: raios.redondo,
    backgroundColor: cores.vidroClaro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
  },
  pilulaSoIcone: { width: 38, paddingHorizontal: 0, justifyContent: 'center' },
  pressionado: { opacity: 0.8 },
});
