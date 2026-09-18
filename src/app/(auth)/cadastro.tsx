import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import { Botao, Input, Texto } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';
import { emailValido, normalizarApelido, senhaValida } from '@/utils/validacao';

export default function TelaCadastro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cadastrar = useAuthStore((s) => s.cadastrar);
  const ocupado = useAuthStore((s) => s.ocupado);
  const erroGlobal = useAuthStore((s) => s.erro);
  const limparErro = useAuthStore((s) => s.limparErro);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<{ email?: string; senha?: string; confirmacao?: string }>({});

  async function aoCadastrar() {
    const novosErros: typeof erros = {};
    if (!emailValido(email)) novosErros.email = 'Informe um e-mail válido.';
    if (!senhaValida(senha)) novosErros.senha = 'A senha precisa ter pelo menos 6 caracteres.';
    if (senha !== confirmacao) novosErros.confirmacao = 'As senhas não conferem.';
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;
    try {
      await cadastrar({
        email,
        senha,
        nome,
        apelido: normalizarApelido(nome || email.split('@')[0]),
      });
    } catch {
      // erro exibido via erroGlobal
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          { paddingTop: insets.top + espacos.md, paddingBottom: insets.bottom + espacos.xl },
        ]}
        keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={estilos.voltar}
          accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={26} color={cores.texto} />
        </Pressable>
        <View style={estilos.cabecalho}>
          <Texto variante="titulo">Criar conta</Texto>
          <Texto variante="corpo" cor={cores.textoSecundario}>
            Entre para a nação. É rápido e grátis.
          </Texto>
        </View>

        <View style={estilos.formulario}>
          <Input
            rotulo="Nome"
            placeholder="Como quer ser chamado"
            value={nome}
            onChangeText={setNome}
            autoComplete="name"
          />
          <Input
            rotulo="E-mail"
            placeholder="voce@exemplo.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (erroGlobal) limparErro();
            }}
            erro={erros.email}
            testID="campo-email"
          />
          <Input
            rotulo="Senha"
            placeholder="mínimo 6 caracteres"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            erro={erros.senha}
            testID="campo-senha"
          />
          <Input
            rotulo="Confirmar senha"
            placeholder="repita a senha"
            secureTextEntry
            value={confirmacao}
            onChangeText={setConfirmacao}
            erro={erros.confirmacao}
            onSubmitEditing={aoCadastrar}
            testID="campo-confirmacao"
          />
          {erroGlobal ? (
            <Texto variante="pequeno" cor={cores.erro} centralizado testID="erro-cadastro">
              {erroGlobal}
            </Texto>
          ) : null}
          <Botao
            titulo="Criar conta"
            onPress={aoCadastrar}
            carregando={ocupado}
            largo
            tamanho="grande"
            testID="botao-cadastrar"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, gap: espacos.xl },
  voltar: { alignSelf: 'flex-start', padding: espacos.xs },
  cabecalho: { gap: espacos.xs },
  formulario: { gap: espacos.md },
});
