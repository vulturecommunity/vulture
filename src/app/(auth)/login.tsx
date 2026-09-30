import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Icone, Input, Listras, Texto } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos, raios } from '@/theme';
import { emailValido, senhaValida } from '@/utils/validacao';

export default function TelaLogin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const entrar = useAuthStore((s) => s.entrar);
  const entrarComoVisitante = useAuthStore((s) => s.entrarComoVisitante);
  const entrarComGoogle = useAuthStore((s) => s.entrarComGoogle);
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

  async function aoEntrarComGoogle() {
    setErros({});
    try {
      await entrarComGoogle();
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
      <Listras altura={6} style={[estilos.faixaTopo, { marginTop: insets.top }]} />
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          { paddingTop: espacos.xxl, paddingBottom: insets.bottom + espacos.xl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <View style={estilos.logoAro}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={estilos.logo}
              contentFit="contain"
              accessibilityLabel="Logo do Vulture"
            />
          </View>
          <Texto variante="titulo" style={estilos.marca}>
            VULTURE
          </Texto>
          <Listras altura={4} faixas={8} style={estilos.sublinhado} />
          <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
            A rede da torcida. Vídeos, lives e resenha rubro-negra.
          </Texto>
        </View>

        <View style={estilos.cartao}>
          <Texto variante="rotulo" cor={cores.textoSecundario}>
            Entrar na sua conta
          </Texto>
          <Input
            rotulo="E-mail"
            icone="perfil"
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
            icone="cadeado"
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
            variante="contorno"
            onPress={() => router.push('/(auth)/cadastro')}
            disabled={ocupado}
            largo
          />

          <View style={estilos.separador}>
            <View style={estilos.linha} />
            <Texto variante="legenda" cor={cores.textoTerciario}>
              ou
            </Texto>
            <View style={estilos.linha} />
          </View>

          {/* Entrar com Google cria a conta na primeira vez, como o cadastro por e-mail */}
          <Botao
            titulo="Continuar com Google"
            variante="secundario"
            onPress={aoEntrarComGoogle}
            disabled={ocupado}
            largo
            icone={<Icone nome="google" tamanho={18} cor={cores.texto} />}
            testID="botao-google"
          />
        </View>

        <View style={estilos.rodape}>
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
  separador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    marginVertical: espacos.xs,
  },
  linha: { flex: 1, height: 1, backgroundColor: cores.borda },
  faixaTopo: { borderRadius: 0 },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, gap: espacos.xl },
  cabecalho: { alignItems: 'center', gap: espacos.sm },
  logoAro: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: cores.vermelho,
    backgroundColor: cores.fundoElevado,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: espacos.xs,
  },
  logo: { width: 84, height: 84 },
  marca: { letterSpacing: 6 },
  sublinhado: { width: 56, marginBottom: espacos.xs },
  cartao: {
    gap: espacos.md,
    padding: espacos.lg,
    borderRadius: raios.lg,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  rodape: { marginTop: 'auto', gap: espacos.md },
});
