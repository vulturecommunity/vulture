import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Cabecalho, Carregando, EstadoVazio, Icone, Texto } from '@/components/ui';
import { useAbrirConversa, useContatos } from '@/hooks/useMensagens';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios, tipografia } from '@/theme';
import type { Usuario } from '@/types';

/** Escolher com quem conversar: quem eu sigo e quem me segue, com busca. */
export default function TelaNovaConversa() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const contatos = useContatos();
  const abrir = useAbrirConversa();
  const [termo, setTermo] = useState('');

  const filtrados = useMemo(() => {
    const t = termo.trim().toLowerCase().replace(/^@/, '');
    const lista = contatos.data ?? [];
    if (!t) return lista;
    return lista.filter(
      (u) => u.apelido.toLowerCase().includes(t) || u.nome.toLowerCase().includes(t),
    );
  }, [contatos.data, termo]);

  async function escolher(usuario: Usuario) {
    try {
      const conversa = await abrir.mutateAsync(usuario.id);
      router.replace({ pathname: '/mensagens/[id]', params: { id: conversa.id } });
    } catch (erro) {
      mostrarAviso(
        erro instanceof Error ? erro.message : 'Não foi possível abrir a conversa.',
        'erro',
      );
    }
  }

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho
        titulo="Nova conversa"
        subtitulo="Quem você segue e quem te segue"
        aoVoltar={() => router.back()}
      />
      <View style={estilos.busca}>
        <Icone nome="buscar" tamanho={18} cor={cores.textoTerciario} />
        <TextInput
          style={estilos.input}
          placeholder="Buscar torcedor"
          placeholderTextColor={cores.textoTerciario}
          value={termo}
          onChangeText={setTermo}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={cores.vermelho}
          testID="campo-busca-contato"
        />
      </View>
      {contatos.isLoading ? (
        <Carregando />
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(u) => u.id}
          contentContainerStyle={estilos.lista}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EstadoVazio
              icone="torcida"
              titulo={termo ? 'Ninguém com esse nome' : 'Você ainda não tem contatos'}
              descricao={
                termo
                  ? 'Só aparecem aqui pessoas que você segue ou que te seguem.'
                  : 'Siga torcedores no Explorar para poder chamar no privado.'
              }
              acao={
                termo
                  ? undefined
                  : {
                      titulo: 'Encontrar torcedores',
                      aoPressionar: () => router.push('/perfil/encontrar'),
                    }
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => escolher(item)}
              disabled={abrir.isPending}
              style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
              accessibilityRole="button"
              testID={`contato-${item.id}`}>
              <Avatar url={item.avatarUrl} nome={item.nome} tamanho={46} />
              <View style={estilos.textos}>
                <Texto variante="corpoForte" numberOfLines={1}>
                  {item.nome}
                </Texto>
                <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
                  @{item.apelido}
                </Texto>
              </View>
              <Icone nome="mensagens" tamanho={18} cor={cores.textoTerciario} />
            </Pressable>
          )}
        />
      )}
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
    marginBottom: espacos.sm,
    paddingHorizontal: espacos.md,
    height: 44,
    borderRadius: raios.md,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  input: { flex: 1, color: cores.texto, ...tipografia.corpo, paddingVertical: 0 },
  lista: { flexGrow: 1, paddingBottom: espacos.xl },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm + 2,
  },
  pressionada: { backgroundColor: cores.fundoElevado },
  textos: { flex: 1, gap: 2 },
});
