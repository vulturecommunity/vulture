import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Icone, Input, Texto } from '@/components/ui';
import { dataService } from '@/services/data';
import { EVENTOS, registrar } from '@/services/telemetria';
import { cores, espacos, raios } from '@/theme';
import { mensagemDeErro } from '@/utils/erros';
import { emailValido } from '@/utils/validacao';

/**
 * Recuperação de senha, alcançável **sem estar logado**.
 *
 * A tela de troca de senha em Configurações já mandava o link de redefinição, mas só
 * depois de entrar — o que não serve a quem esqueceu a senha, que é justamente quem não
 * consegue entrar. Sem esta tela a conta vira perda total: não há suporte, não há outro
 * caminho, e a pessoa só pode criar outra conta e abandonar o histórico.
 *
 * A confirmação é deliberadamente neutra ("se existe uma conta..."). Dizer "esse e-mail
 * não está cadastrado" transforma a tela num verificador de quem tem conta no app, que é
 * exatamente o que um raspador de e-mails procura.
 */
export default function TelaRecuperarSenha() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email: emailInicial } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(emailInicial ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function aoEnviar() {
    if (!emailValido(email)) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await dataService().enviarRedefinicaoDeSenha(email);
      registrar(EVENTOS.SENHA_RECUPERACAO_PEDIDA);
      setEnviado(true);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <Cabecalho titulo="Esqueci minha senha" aoVoltar={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + espacos.xl }]}
        keyboardShouldPersistTaps="handled">
        {enviado ? (
          <View style={estilos.cartao} testID="recuperar-enviado">
            <View style={estilos.selo}>
              <Icone nome="ok" tamanho={28} cor={cores.sucesso} />
            </View>
            <Texto variante="corpoForte" centralizado>
              Confira seu e-mail
            </Texto>
            <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
              Se existe uma conta com {email.trim()}, o link para escolher uma nova senha já está
              a caminho. Ele vale por uma hora.
            </Texto>
            <Texto variante="legenda" cor={cores.textoTerciario} centralizado>
              Não chegou? Veja o spam antes de pedir outro.
            </Texto>
            <Botao
              titulo="Voltar para o login"
              largo
              onPress={() => router.replace('/(auth)/login')}
              testID="botao-voltar-login"
            />
            <Botao
              titulo="Enviar de novo"
              variante="fantasma"
              largo
              onPress={() => setEnviado(false)}
            />
          </View>
        ) : (
          <View style={estilos.cartao}>
            <Texto variante="pequeno" cor={cores.textoSecundario}>
              Digite o e-mail da sua conta. Mandamos um link para você escolher outra senha — não
              precisa lembrar a atual.
            </Texto>
            <Input
              rotulo="E-mail"
              icone="perfil"
              placeholder="voce@exemplo.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              autoFocus
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErro(null);
              }}
              erro={erro}
              onSubmitEditing={aoEnviar}
              testID="campo-email-recuperar"
            />
            <Botao
              titulo="Enviar link"
              largo
              tamanho="grande"
              carregando={enviando}
              onPress={aoEnviar}
              testID="botao-enviar-recuperacao"
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, paddingTop: espacos.lg },
  cartao: {
    gap: espacos.md,
    padding: espacos.lg,
    borderRadius: raios.lg,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  selo: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
});
