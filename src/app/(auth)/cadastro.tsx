import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Input, Listras, Texto } from '@/components/ui';
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
      style={[estilos.tela, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Cabecalho titulo="Criar conta" aoVoltar={() => router.back()} />
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + espacos.xl }]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Texto variante="titulo">Entre para a nação</Texto>
          <Listras altura={4} faixas={8} style={estilos.sublinhado} />
          <Texto variante="corpo" cor={cores.textoSecundario}>
            É rápido e grátis. Só precisa de um e-mail.
          </Texto>
        </View>

        <View style={estilos.formulario}>
          <Input
            rotulo="Nome"
            icone="perfil"
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
            icone="cadeado"
            placeholder="mínimo 6 caracteres"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
            erro={erros.senha}
            testID="campo-senha"
          />
          <Input
            rotulo="Confirmar senha"
            icone="cadeado"
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
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, paddingTop: espacos.md, gap: espacos.xl },
  cabecalho: { gap: espacos.sm },
  sublinhado: { width: 48 },
  formulario: { gap: espacos.md },
});
