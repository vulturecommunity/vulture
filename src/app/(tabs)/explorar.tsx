import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarraDeCanais } from '@/components/explorar/BarraDeCanais';
import { RankingSemanal } from '@/components/explorar/RankingSemanal';
import { GradeDeVideos } from '@/components/perfil/GradeDeVideos';
import { Avatar, Carregando, EstadoVazio, Icone, Texto, TituloDeSecao } from '@/components/ui';
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
  const [focado, setFocado] = useState(false);
  const termoAtrasado = useValorAtrasado(termo.trim(), 250);
  const buscando = termoAtrasado.length > 0;

  const usuarios = useBuscaDeUsuarios(termoAtrasado);
  const hashtags = useBuscaDeHashtags(termoAtrasado);
  const trending = useTrending();
  const emAlta = useHashtagsEmAlta();

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <View style={estilos.topo}>
        <Texto variante="titulo">Explorar</Texto>
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          Canais, torcedores e o que está bombando na nação.
        </Texto>
      </View>

      <View style={[estilos.busca, focado && estilos.buscaFocada]}>
        <Icone nome="buscar" tamanho={18} cor={focado ? cores.texto : cores.textoTerciario} />
        <TextInput
          style={estilos.input}
          placeholder="Buscar @usuário ou #hashtag"
          placeholderTextColor={cores.textoTerciario}
          value={termo}
          onChangeText={setTermo}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          selectionColor={cores.vermelho}
          testID="campo-busca"
        />
        {termo ? (
          <Pressable onPress={() => setTermo('')} hitSlop={8} accessibilityLabel="Limpar busca">
            <Icone nome="limpar" tamanho={18} cor={cores.textoTerciario} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        testID="explorar-scroll">
        {buscando ? (
          <>
            <View style={estilos.secao}>
              <TituloDeSecao titulo="Torcedores" icone="torcida" />
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
                    <View style={estilos.flex}>
                      <Texto variante="corpoForte">@{u.apelido}</Texto>
                      <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
                        {u.nome} · {u.seguidores} seguidores
                      </Texto>
                    </View>
                    <Icone nome="avancar" tamanho={18} cor={cores.textoTerciario} />
                  </Pressable>
                ))
              )}
            </View>
            <View style={estilos.secao}>
              <TituloDeSecao titulo="Hashtags" icone="hashtag" />
              {hashtags.isLoading ? (
                <Carregando telaCheia={false} />
              ) : (hashtags.data?.length ?? 0) === 0 ? (
                <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.vazio}>
                  Nenhuma hashtag encontrada
                </Texto>
              ) : (
                <View style={estilos.chips}>
                  {hashtags.data!.map((h) => (
                    <ChipDeHashtag
                      key={h.tag}
                      tag={h.tag}
                      contagem={`${h.totalVideos} vídeo${h.totalVideos === 1 ? '' : 's'}`}
                      aoPressionar={() =>
                        router.push({ pathname: '/hashtag/[tag]', params: { tag: h.tag } })
                      }
                      testID={`resultado-hashtag-${h.tag}`}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            <View style={estilos.secao}>
              <TituloDeSecao titulo="Canais da torcida" icone="estadio" />
              <BarraDeCanais />
            </View>
            <RankingSemanal />
            {emAlta.data && emAlta.data.length > 0 ? (
              <View style={estilos.secao}>
                <TituloDeSecao titulo="Hashtags em alta" icone="tendencia" />
                <View style={estilos.chips}>
                  {emAlta.data.map((h) => (
                    <ChipDeHashtag
                      key={h.tag}
                      tag={h.tag}
                      contagem={String(h.totalVideos)}
                      aoPressionar={() =>
                        router.push({ pathname: '/hashtag/[tag]', params: { tag: h.tag } })
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={estilos.secao}>
              <TituloDeSecao titulo="Em alta" subtitulo="os vídeos mais vistos" icone="emAlta" />
              {trending.isLoading ? (
                <Carregando telaCheia={false} />
              ) : (trending.data?.length ?? 0) === 0 ? (
                <EstadoVazio titulo="Nada em alta ainda" />
              ) : (
                <GradeDeVideos videos={trending.data ?? []} origem="trending" />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ChipDeHashtag({
  tag,
  contagem,
  aoPressionar,
  testID,
}: {
  tag: string;
  contagem: string;
  aoPressionar: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={aoPressionar} style={estilos.chip} testID={testID}>
      <Texto variante="corpoForte">
        <Texto variante="corpoForte" cor={cores.vermelhoVivo}>
          #
        </Texto>
        {tag}
      </Texto>
      <Texto variante="legenda" cor={cores.textoSecundario}>
        {contagem}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { paddingHorizontal: espacos.lg, paddingTop: espacos.md, gap: 2 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginHorizontal: espacos.lg,
    marginVertical: espacos.md,
    paddingHorizontal: espacos.md,
    height: 46,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  buscaFocada: { borderColor: cores.vermelho },
  input: { flex: 1, color: cores.texto, ...tipografia.corpo },
  conteudo: { gap: espacos.xl, paddingBottom: espacos.xxxl },
  secao: { gap: espacos.md },
  flex: { flex: 1 },
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
    gap: espacos.xs + 2,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
});
