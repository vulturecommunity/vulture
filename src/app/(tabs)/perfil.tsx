import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConteudoDePerfil } from '@/components/perfil/ConteudoDePerfil';
import { Carregando, Erro, Icone, Texto } from '@/components/ui';
import { usePerfil } from '@/hooks/usePerfil';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';

/** Meu perfil: grade de vídeos, curtidos e salvos, com atalho para as configurações. */
export default function TelaPerfil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessao = useAuthStore((s) => s.sessao);
  const perfil = usePerfil(sessao ? 'eu' : undefined);

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <View style={estilos.topo}>
        <Texto variante="rotulo" cor={cores.textoSecundario}>
          {sessao?.visitante ? 'Visitante · demo' : 'Meu perfil'}
        </Texto>
        <View style={estilos.acoesTopo}>
          <Pressable
            onPress={() => router.push('/perfil/encontrar')}
            hitSlop={12}
            accessibilityLabel="Adicionar torcedores"
            testID="botao-adicionar-torcedores"
            style={estilos.botaoMenu}>
            <Icone nome="adicionarPessoa" tamanho={18} cor={cores.texto} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/mensagens')}
            hitSlop={12}
            accessibilityLabel="Mensagens"
            testID="botao-mensagens-perfil"
            style={estilos.botaoMenu}>
            <Icone nome="mensagens" tamanho={18} cor={cores.texto} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/configuracoes')}
            hitSlop={12}
            accessibilityLabel="Configurações e privacidade"
            testID="botao-menu-perfil"
            style={estilos.botaoMenu}>
            <Icone nome="configuracoes" tamanho={18} cor={cores.texto} />
          </Pressable>
        </View>
      </View>

      {perfil.isLoading ? (
        <Carregando />
      ) : perfil.isError ? (
        <Erro erro={perfil.error} aoTentarNovamente={() => perfil.refetch()} />
      ) : perfil.data ? (
        <ConteudoDePerfil
          perfil={perfil.data}
          atualizando={perfil.isRefetching}
          aoAtualizar={() => perfil.refetch()}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.sm,
  },
  acoesTopo: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  botaoMenu: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
