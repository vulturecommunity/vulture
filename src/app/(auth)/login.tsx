import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Input, Texto } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';
import { emailValido, senhaValida } from '@/utils/validacao';

export default function TelaLogin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entrar = useAuthStore((s) => s.entrar);
  const entrarComoVisitante = useAuthStore((s) => s.entrarComoVisitante);
  const ocupado = useAuthStore((s) => s.ocupado);
  const erroGlobal = useAuthStore((s) => s.erro);
  const limparErro = useAuthStore((s) => s.limparErro);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({});

  async function aoEntrar() {
    const novosErros: typeof erros = {};
    if (!emailValido(email)) novosErros.email = 'Informe um e-mail válido.';
    if (!senhaValida(senha)) novosErros.senha = 'A senha precisa ter pelo menos 6 caracteres.';
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;
    try {
      await entrar(email, senha);
    } catch {
      // o erro já fica disponível em erroGlobal
    }
  }

  async function aoVisitar() {
    try {
      await entrarComoVisitante();
    } catch {
      // idem
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          { paddingTop: insets.top + espacos.xxl, paddingBottom: insets.bottom + espacos.xl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={estilos.logo}
            contentFit="contain"
            accessibilityLabel="Logo do Vulture"
          />
          <Texto variante="titulo">VULTURE</Texto>
          <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
            A rede da torcida. Vídeos, lives e resenha rubro-negra.
          </Texto>
        </View>

        <View style={estilos.formulario}>
          <Input
            rotulo="E-mail"
            placeholder="voce@exemplo.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
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
            autoComplete="password"
            value={senha}
            onChangeText={(t) => {
              setSenha(t);
              if (erroGlobal) limparErro();
            }}
            erro={erros.senha}
            onSubmitEditing={aoEntrar}
            testID="campo-senha"
          />
          {erroGlobal ? (
            <Texto variante="pequeno" cor={cores.erro} centralizado testID="erro-login">
              {erroGlobal}
            </Texto>
          ) : null}
          <Botao
            titulo="Entrar"
            onPress={aoEntrar}
            carregando={ocupado}
            largo
            tamanho="grande"
            testID="botao-entrar"
          />
          <Botao
            titulo="Criar conta"
            variante="secundario"
            onPress={() => router.push('/(auth)/cadastro')}
            disabled={ocupado}
            largo
          />
        </View>

        <View style={estilos.rodape}>
          <View style={estilos.divisor} />
          <Botao
            titulo="Entrar como visitante (modo demo)"
            variante="fantasma"
            onPress={aoVisitar}
            disabled={ocupado}
            largo
            testID="botao-visitante"
          />
          <Texto variante="legenda" cor={cores.textoTerciario} centralizado>
            App não oficial feito por torcedores. Sem vínculo com o clube.
          </Texto>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, gap: espacos.xxl },
  cabecalho: { alignItems: 'center', gap: espacos.sm },
  logo: { width: 96, height: 96, marginBottom: espacos.sm },
  formulario: { gap: espacos.md },
  rodape: { marginTop: 'auto', gap: espacos.md },
  divisor: { height: StyleSheet.hairlineWidth, backgroundColor: cores.borda },
});
