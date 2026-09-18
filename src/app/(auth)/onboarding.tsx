import { Ionicons } from '@expo/vector-icons';
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
import { Avatar, Botao, Input, Texto } from '@/components/ui';
import type { Interesse } from '@/constants/interesses';
import { useEscolherImagem } from '@/hooks/useEscolherImagem';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';
import { apelidoValido, normalizarApelido } from '@/utils/validacao';

export default function TelaOnboarding() {
  const insets = useSafeAreaInsets();
  const sessao = useAuthStore((s) => s.sessao);
  const concluir = useAuthStore((s) => s.concluirOnboarding);
  const sair = useAuthStore((s) => s.sair);
  const ocupado = useAuthStore((s) => s.ocupado);
  const erroGlobal = useAuthStore((s) => s.erro);
  const { escolher, ocupado: escolhendo } = useEscolherImagem();

  const [apelido, setApelido] = useState(sessao?.usuario.apelido ?? '');
  const [foto, setFoto] = useState<string | null>(null);
  const [interesses, setInteresses] = useState<Interesse[]>([]);
  const [erroApelido, setErroApelido] = useState<string | null>(null);

  async function aoEscolherFoto() {
    const imagem = await escolher();
    if (imagem) setFoto(imagem.uri);
  }

  async function aoConcluir() {
    const normalizado = normalizarApelido(apelido);
    if (!apelidoValido(normalizado)) {
      setErroApelido('Use de 3 a 20 caracteres: letras, números, ponto ou _.');
      return;
    }
    setErroApelido(null);
    try {
      await concluir({ apelido: normalizado, interesses, avatarUriLocal: foto });
    } catch {
      // erroGlobal
    }
  }

  const nome = sessao?.usuario.nome ?? apelido;

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          { paddingTop: insets.top + espacos.xl, paddingBottom: insets.bottom + espacos.xl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Texto variante="titulo">Bem-vindo à nação 🔴⚫</Texto>
          <Texto variante="corpo" cor={cores.textoSecundario}>
            Monte seu perfil em 3 passos rápidos.
          </Texto>
        </View>

        <View style={estilos.bloco}>
          <Texto variante="destaque">1. Sua foto</Texto>
          <Pressable
            onPress={aoEscolherFoto}
            style={estilos.areaFoto}
            accessibilityLabel="Escolher foto de perfil"
            disabled={escolhendo}>
            <Avatar url={foto} nome={nome || 'V'} tamanho={96} borda />
            <View style={estilos.iconeCamera}>
              <Ionicons name="camera" size={16} color={cores.branco} />
            </View>
          </Pressable>
          <Texto variante="pequeno" cor={cores.textoTerciario}>
            Opcional — toque para escolher da galeria.
          </Texto>
        </View>

        <View style={estilos.bloco}>
          <Texto variante="destaque">2. Seu apelido</Texto>
          <Input
            prefixo="@"
            placeholder="seu_apelido"
            autoCapitalize="none"
            autoCorrect={false}
            value={apelido}
            onChangeText={(t) => setApelido(normalizarApelido(t))}
            erro={erroApelido}
            ajuda="É assim que a torcida vai te encontrar."
            testID="campo-apelido"
          />
        </View>

        <View style={estilos.bloco}>
          <Texto variante="destaque">3. Seus interesses (até 3)</Texto>
          <SeletorDeInteresses selecionados={interesses} aoMudar={setInteresses} maximo={3} />
        </View>

        {erroGlobal ? (
          <Texto variante="pequeno" cor={cores.erro} centralizado>
            {erroGlobal}
          </Texto>
        ) : null}

        <View style={estilos.rodape}>
          <Botao
            titulo="Começar"
            onPress={aoConcluir}
            carregando={ocupado}
            disabled={interesses.length === 0}
            largo
            tamanho="grande"
            testID="botao-concluir"
          />
          <Botao
            titulo="Sair"
            variante="fantasma"
            onPress={() => sair()}
            disabled={ocupado}
            largo
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, gap: espacos.xl },
  cabecalho: { gap: espacos.xs },
  bloco: { gap: espacos.sm },
  areaFoto: { alignSelf: 'flex-start' },
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
  rodape: { marginTop: 'auto', gap: espacos.sm },
});
