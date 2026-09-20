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
import { Avatar, Botao, Icone, Input, Listras, Texto } from '@/components/ui';
import type { Interesse } from '@/constants/interesses';
import { useEscolherImagem } from '@/hooks/useEscolherImagem';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos, raios } from '@/theme';
import { apelidoValido, normalizarApelido } from '@/utils/validacao';

function Passo({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <View style={estilos.passo}>
      <View style={estilos.numero}>
        <Texto variante="legenda" style={estilos.numeroTexto}>
          {numero}
        </Texto>
      </View>
      <Texto variante="destaque">{titulo}</Texto>
    </View>
  );
}

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
      <Listras altura={6} style={[estilos.faixaTopo, { marginTop: insets.top }]} />
      <ScrollView
        contentContainerStyle={[
          estilos.conteudo,
          { paddingTop: espacos.xl, paddingBottom: insets.bottom + espacos.xl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Texto variante="rotulo" cor={cores.vermelhoVivo}>
            Bem-vindo à nação
          </Texto>
          <Texto variante="titulo">Monte seu perfil em 3 passos</Texto>
          <Texto variante="corpo" cor={cores.textoSecundario}>
            Leva menos de um minuto.
          </Texto>
        </View>

        <View style={estilos.bloco}>
          <Passo numero={1} titulo="Sua foto" />
          <View style={estilos.linhaFoto}>
            <Pressable
              onPress={aoEscolherFoto}
              style={estilos.areaFoto}
              accessibilityLabel="Escolher foto de perfil"
              disabled={escolhendo}>
              <Avatar url={foto} nome={nome || 'V'} tamanho={92} borda />
              <View style={estilos.iconeCamera}>
                <Icone nome="camera" tamanho={14} cor={cores.branco} />
              </View>
            </Pressable>
            <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.flex}>
              Opcional — toque para escolher da galeria.
            </Texto>
          </View>
        </View>

        <View style={estilos.bloco}>
          <Passo numero={2} titulo="Seu apelido" />
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
          <Passo numero={3} titulo="Seus interesses (até 3)" />
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
  faixaTopo: { borderRadius: 0 },
  flex: { flex: 1 },
  conteudo: { flexGrow: 1, paddingHorizontal: espacos.xl, gap: espacos.xl },
  cabecalho: { gap: espacos.xs },
  bloco: { gap: espacos.md },
  passo: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  numero: {
    width: 24,
    height: 24,
    borderRadius: raios.sm,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: { fontWeight: '800' },
  linhaFoto: { flexDirection: 'row', alignItems: 'center', gap: espacos.lg },
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
