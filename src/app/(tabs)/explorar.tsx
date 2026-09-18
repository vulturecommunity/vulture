import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraDeCanais } from '@/components/explorar/BarraDeCanais';
import { RankingSemanal } from '@/components/explorar/RankingSemanal';
import { GradeDeVideos } from '@/components/perfil/GradeDeVideos';
import { Avatar, Carregando, EstadoVazio, Texto } from '@/components/ui';
import {
  useBuscaDeHashtags,
  useBuscaDeUsuarios,
  useHashtagsEmAlta,
  useTrending,
  useValorAtrasado,
} from '@/hooks/useExplorar';
import { cores, espacos, raios, tipografia } from '@/theme';

/** Explorar: busca por usuário e hashtag, canais temáticos, ranking e grade de trending. */
export default function TelaExplorar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [termo, setTermo] = useState('');
  const termoAtrasado = useValorAtrasado(termo.trim(), 250);
  const buscando = termoAtrasado.length > 0;

  const usuarios = useBuscaDeUsuarios(termoAtrasado);
  const hashtags = useBuscaDeHashtags(termoAtrasado);
  const trending = useTrending();
  const emAlta = useHashtagsEmAlta();

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <View style={estilos.busca}>
        <Ionicons name="search" size={20} color={cores.textoTerciario} />
        <TextInput
          style={estilos.input}
          placeholder="Buscar @usuário ou #hashtag"
          placeholderTextColor={cores.textoTerciario}
          value={termo}
          onChangeText={setTermo}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          testID="campo-busca"
        />
        {termo ? (
          <Pressable onPress={() => setTermo('')} hitSlop={8} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={20} color={cores.textoTerciario} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        testID="explorar-scroll">
        {buscando ? (
          <>
            <Secao titulo="Torcedores">
              {usuarios.isLoading ? (
                <Carregando telaCheia={false} />
              ) : (usuarios.data?.length ?? 0) === 0 ? (
                <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.vazio}>
                  Nenhum torcedor encontrado
                </Texto>
              ) : (
                usuarios.data!.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => router.push({ pathname: '/usuario/[id]', params: { id: u.id } })}
                    style={estilos.linhaUsuario}
                    testID={`resultado-usuario-${u.apelido}`}>
                    <Avatar url={u.avatarUrl} nome={u.nome} tamanho={44} />
                    <View style={{ flex: 1 }}>
                      <Texto variante="corpoForte">@{u.apelido}</Texto>
                      <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
                        {u.nome} · {u.seguidores} seguidores
                      </Texto>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={cores.textoTerciario} />
                  </Pressable>
                ))
              )}
            </Secao>
            <Secao titulo="Hashtags">
              {hashtags.isLoading ? (
                <Carregando telaCheia={false} />
              ) : (hashtags.data?.length ?? 0) === 0 ? (
                <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.vazio}>
                  Nenhuma hashtag encontrada
                </Texto>
              ) : (
                <View style={estilos.chips}>
                  {hashtags.data!.map((h) => (
                    <Pressable
                      key={h.tag}
                      onPress={() =>
                        router.push({ pathname: '/hashtag/[tag]', params: { tag: h.tag } })
                      }
                      style={estilos.chip}
                      testID={`resultado-hashtag-${h.tag}`}>
                      <Texto variante="corpoForte">#{h.tag}</Texto>
                      <Texto variante="legenda" cor={cores.textoSecundario}>
                        {h.totalVideos} vídeo{h.totalVideos === 1 ? '' : 's'}
                      </Texto>
                    </Pressable>
                  ))}
                </View>
              )}
            </Secao>
          </>
        ) : (
          <>
            <BarraDeCanais />
            <RankingSemanal />
            {emAlta.data && emAlta.data.length > 0 ? (
              <Secao titulo="Hashtags em alta">
                <View style={estilos.chips}>
                  {emAlta.data.map((h) => (
                    <Pressable
                      key={h.tag}
                      onPress={() =>
                        router.push({ pathname: '/hashtag/[tag]', params: { tag: h.tag } })
                      }
                      style={estilos.chip}>
                      <Texto variante="corpoForte">#{h.tag}</Texto>
                      <Texto variante="legenda" cor={cores.textoSecundario}>
                        {h.totalVideos}
                      </Texto>
                    </Pressable>
                  ))}
                </View>
              </Secao>
            ) : null}
            <Secao titulo="🔥 Em alta">
              {trending.isLoading ? (
                <Carregando telaCheia={false} />
              ) : (trending.data?.length ?? 0) === 0 ? (
                <EstadoVazio titulo="Nada em alta ainda" />
              ) : (
                <GradeDeVideos videos={trending.data ?? []} origem="trending" />
              )}
            </Secao>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.secao}>
      <Texto variante="destaque" style={estilos.tituloSecao}>
        {titulo}
      </Texto>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginHorizontal: espacos.lg,
    marginVertical: espacos.sm,
    paddingHorizontal: espacos.md,
    height: 44,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  input: { flex: 1, color: cores.texto, ...tipografia.corpo },
  conteudo: { gap: espacos.lg, paddingBottom: espacos.xxxl, paddingTop: espacos.xs },
  secao: { gap: espacos.sm },
  tituloSecao: { paddingHorizontal: espacos.lg },
  vazio: { paddingHorizontal: espacos.lg },
  linhaUsuario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm, paddingHorizontal: espacos.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: espacos.xs,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
});
