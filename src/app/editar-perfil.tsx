import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorDeInteresses } from '@/components/perfil/SeletorDeInteresses';
import { Avatar, Botao, Cabecalho, Icone, Input, Texto } from '@/components/ui';
import type { Interesse } from '@/constants/interesses';
import { useEscolherImagem } from '@/hooks/useEscolherImagem';
import { useAtualizarPerfil } from '@/hooks/usePerfil';
import { useVoltar } from '@/hooks/useVoltar';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos } from '@/theme';
import { apelidoValido, normalizarApelido } from '@/utils/validacao';

/** Edição do meu perfil: foto, apelido, nome, bio e interesses. */
export default function TelaEditarPerfil() {
  const voltar = useVoltar('/(tabs)/perfil');
  const insets = useSafeAreaInsets();
  const usuario = useAuthStore((s) => s.sessao?.usuario);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const atualizar = useAtualizarPerfil();
  const { escolher, ocupado: escolhendo } = useEscolherImagem();

  const [apelido, setApelido] = useState(usuario?.apelido ?? '');
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [bio, setBio] = useState(usuario?.bio ?? '');
  const [interesses, setInteresses] = useState<Interesse[]>(usuario?.interesses ?? []);
  const [novaFoto, setNovaFoto] = useState<string | null>(null);
  const [erroApelido, setErroApelido] = useState<string | null>(null);

  if (!usuario) return null;

  async function salvar() {
    const normalizado = normalizarApelido(apelido);
    if (!apelidoValido(normalizado)) {
      setErroApelido('Use de 3 a 20 caracteres: letras, números, ponto ou _.');
      return;
    }
    setErroApelido(null);
    try {
      await atualizar.mutateAsync({
        apelido: normalizado,
        nome,
        bio,
        interesses,
        avatarUriLocal: novaFoto ?? undefined,
      });
      mostrarAviso('Perfil atualizado!', 'sucesso');
      voltar();
    } catch (erro) {
      mostrarAviso(erro instanceof Error ? erro.message : 'Falha ao salvar', 'erro');
    }
  }

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Cabecalho titulo="Editar perfil" aoVoltar={voltar} />
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + espacos.xl }]}
        keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={async () => {
            const imagem = await escolher();
            if (imagem) setNovaFoto(imagem.uri);
          }}
          disabled={escolhendo}
          style={estilos.areaFoto}
          accessibilityLabel="Trocar foto">
          <Avatar url={novaFoto ?? usuario.avatarUrl} nome={usuario.nome} tamanho={100} borda />
          <View style={estilos.iconeCamera}>
            <Icone nome="camera" tamanho={14} cor={cores.branco} />
          </View>
        </Pressable>
        <Texto variante="pequeno" cor={cores.textoTerciario} centralizado>
          Toque na foto para trocar
        </Texto>

        <Input
          rotulo="Apelido"
          prefixo="@"
          value={apelido}
          onChangeText={(t) => setApelido(normalizarApelido(t))}
          autoCapitalize="none"
          autoCorrect={false}
          erro={erroApelido}
          testID="campo-apelido"
        />
        <Input
          rotulo="Nome"
          value={nome}
          onChangeText={setNome}
          maxLength={40}
          testID="campo-nome"
        />
        <Input
          rotulo="Bio"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={160}
          ajuda={bio.length + '/160'}
          style={estilos.bio}
          testID="campo-bio"
        />
        <View style={estilos.bloco}>
          <Texto variante="rotulo" cor={cores.textoSecundario}>
            Interesses (até 3)
          </Texto>
          <SeletorDeInteresses selecionados={interesses} aoMudar={setInteresses} maximo={3} />
        </View>

        <Botao
          titulo="Salvar"
          onPress={salvar}
          carregando={atualizar.isPending}
          largo
          tamanho="grande"
          testID="botao-salvar-perfil"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: espacos.xl, paddingTop: espacos.sm, gap: espacos.lg },
  areaFoto: { alignSelf: 'center' },
  iconeCamera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: cores.fundo,
  },
  bio: { minHeight: 70, textAlignVertical: 'top' },
  bloco: { gap: espacos.sm },
});
