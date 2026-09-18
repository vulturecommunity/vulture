import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Texto } from '@/components/ui';
import { cores, espacos } from '@/theme';
import type { Video } from '@/types';
import { formatarContador } from '@/utils/formatadores';

import { BotaoCurtir } from './BotaoCurtir';

export interface AcoesLateraisProps {
  video: Video;
  souOAutor: boolean;
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
  testID,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  aoPressionar: () => void;
  cor?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={8}
      style={estilos.acao}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      testID={testID}>
      <Ionicons name={icone} size={32} color={cor} />
      <Texto variante="legenda" style={estilos.rotulo}>
        {rotulo}
      </Texto>
    </Pressable>
  );
}

/** Coluna de botões à direita do vídeo: perfil, curtir, comentar, salvar, compartilhar, mais. */
export function AcoesLaterais({
  video,
  souOAutor,
  aoCurtir,
  aoComentar,
  aoSalvar,
  aoCompartilhar,
  aoMais,
}: AcoesLateraisProps) {
  const router = useRouter();
  return (
    <View style={estilos.coluna} testID="acoes-laterais">
      <Pressable
        onPress={() =>
          souOAutor
            ? router.push('/(tabs)/perfil')
            : router.push({ pathname: '/usuario/[id]', params: { id: video.autorId } })
        }
        accessibilityRole="button"
        accessibilityLabel={`Perfil de @${video.autor.apelido}`}
        style={estilos.avatar}>
        <Avatar url={video.autor.avatarUrl} nome={video.autor.nome} tamanho={46} borda />
      </Pressable>
      <BotaoCurtir curtido={video.curtido} total={video.curtidas} aoPressionar={aoCurtir} />
      <Acao
        icone="chatbubble-ellipses"
        rotulo={formatarContador(video.comentarios)}
        aoPressionar={aoComentar}
        testID="botao-comentar"
      />
      <Acao
        icone={video.salvo ? 'bookmark' : 'bookmark-outline'}
        rotulo={formatarContador(video.salvos)}
        aoPressionar={aoSalvar}
        cor={video.salvo ? cores.aviso : cores.branco}
        testID="botao-salvar"
      />
      <Acao
        icone="arrow-redo"
        rotulo={formatarContador(video.compartilhamentos)}
        aoPressionar={aoCompartilhar}
        testID="botao-compartilhar"
      />
      <Acao icone="ellipsis-horizontal" rotulo="Mais" aoPressionar={aoMais} testID="botao-mais" />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { alignItems: 'center', gap: espacos.lg },
  avatar: { marginBottom: espacos.xs },
  acao: { alignItems: 'center', gap: espacos.xxs },
  rotulo: { textShadowColor: cores.sombra, textShadowRadius: 4 },
});
