import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedVertical } from '@/components/feed/FeedVertical';
import { Erro, Icone } from '@/components/ui';
import { useListaDeVideos, type OrigemDaLista } from '@/hooks/useListasDeVideos';
import { useAuthStore } from '@/stores/authStore';
import { usePlayerStore } from '@/stores/playerStore';
import { cores, espacos } from '@/theme';

/**
 * Abre um vídeo em tela cheia. Se vier de uma lista (perfil, curtidos, salvos, em alta),
 * permite continuar rolando pela mesma lista a partir do item tocado.
 */
export default function TelaVideo() {
  const params = useLocalSearchParams<{ id: string; origem?: OrigemDaLista; usuarioId?: string }>();
  const origem: OrigemDaLista = params.origem ?? 'video';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const definirFoco = usePlayerStore((s) => s.definirFoco);
  const lista = useListaDeVideos(origem, origem === 'video' ? params.id : params.usuarioId);

  useFocusEffect(
    useCallback(() => {
      definirFoco(true);
      return () => definirFoco(false);
    }, [definirFoco]),
  );

  const indiceInicial = useMemo(() => {
    const i = lista.data?.findIndex((v) => v.id === params.id) ?? 0;
    return i < 0 ? 0 : i;
  }, [lista.data, params.id]);

  if (lista.isError) return <Erro erro={lista.error} aoTentarNovamente={() => lista.refetch()} />;

  return (
    <View style={estilos.tela}>
      <FeedVertical
        listaId={`video-${origem}-${params.usuarioId ?? params.id}`}
        videos={lista.data ?? []}
        meuId={meuId}
        carregando={lista.isLoading}
        indiceInicial={indiceInicial}
        recuoInferior={insets.bottom}
        vazio={{ titulo: 'Vídeo não encontrado', descricao: 'Ele pode ter sido removido.' }}
      />
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityLabel="Voltar"
        style={[estilos.voltar, { top: insets.top + espacos.sm }]}>
        <Icone nome="voltar" tamanho={20} cor={cores.branco} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  voltar: {
    position: 'absolute',
    left: espacos.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
