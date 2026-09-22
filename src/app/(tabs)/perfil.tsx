import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConteudoDePerfil } from '@/components/perfil/ConteudoDePerfil';
import { Carregando, Erro, Icone, Sheet, Texto, type NomeDeIcone } from '@/components/ui';
import { usePerfil } from '@/hooks/usePerfil';
import { dataService } from '@/services/data';
import { MockDataService } from '@/services/data/mock/MockDataService';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';

/** Meu perfil: grade de vídeos, curtidos, salvos e menu de configurações. */
export default function TelaPerfil() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sessao = useAuthStore((s) => s.sessao);
  const sair = useAuthStore((s) => s.sair);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const perfil = usePerfil(sessao ? 'eu' : undefined);
  const [menuAberto, setMenuAberto] = useState(false);

  async function resetarDemo() {
    const servico = dataService();
    if (!(servico instanceof MockDataService)) return;
    Alert.alert(
      'Resetar demonstração',
      'Isso apaga todos os dados locais (vídeos publicados, curtidas, contas) e volta ao estado inicial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: async () => {
            setMenuAberto(false);
            await servico.resetar();
            queryClient.clear();
            await sair();
            mostrarAviso('Demonstração reiniciada.', 'sucesso');
          },
        },
      ],
    );
  }

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
            onPress={() => setMenuAberto(true)}
            hitSlop={12}
            accessibilityLabel="Configurações"
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

      <Sheet
        visivel={menuAberto}
        aoFechar={() => setMenuAberto(false)}
        altura="auto"
        titulo="Configurações">
        <View style={estilos.menu}>
          <ItemMenu
            icone="editar"
            rotulo="Editar perfil"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/editar-perfil');
            }}
          />
          <ItemMenu
            icone="mensagens"
            rotulo="Mensagens: quem pode me chamar"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/configuracoes/mensagens');
            }}
            testID="menu-config-mensagens"
          />
          <ItemMenu
            icone="sino"
            rotulo="Notificações"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/notificacoes');
            }}
          />
          <ItemMenu
            icone="bloquear"
            rotulo="Contas bloqueadas"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/bloqueados');
            }}
          />
          <ItemMenu
            icone="info"
            rotulo={`Driver de dados: ${dataService().nome}`}
            aoPressionar={() =>
              mostrarAviso(
                dataService().nome === 'mock'
                  ? 'Modo demonstração: tudo salvo só neste aparelho.'
                  : 'Conectado ao Supabase.',
                'info',
              )
            }
          />
          {dataService().nome === 'mock' ? (
            <ItemMenu icone="reiniciar" rotulo="Resetar demonstração" aoPressionar={resetarDemo} />
          ) : null}
          <ItemMenu
            icone="sair"
            rotulo="Sair"
            cor={cores.erro}
            aoPressionar={() => {
              setMenuAberto(false);
              sair();
            }}
            testID="botao-sair"
          />
        </View>
      </Sheet>
    </View>
  );
}

function ItemMenu({
  icone,
  rotulo,
  aoPressionar,
  cor = cores.texto,
  testID,
}: {
  icone: NomeDeIcone;
  rotulo: string;
  aoPressionar: () => void;
  cor?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      style={({ pressed }) => [estilos.itemMenu, pressed && estilos.itemPressionado]}
      accessibilityRole="button"
      testID={testID}>
      <View style={estilos.iconeMenu}>
        <Icone nome={icone} tamanho={18} cor={cor} />
      </View>
      <Texto variante="corpo" cor={cor} style={estilos.flex}>
        {rotulo}
      </Texto>
      <Icone nome="avancar" tamanho={16} cor={cores.textoTerciario} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  flex: { flex: 1 },
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
  menu: { paddingVertical: espacos.sm, paddingHorizontal: espacos.sm },
  itemMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm + 2,
    borderRadius: raios.md,
  },
  itemPressionado: { backgroundColor: cores.fundoCartao },
  iconeMenu: {
    width: 36,
    height: 36,
    borderRadius: raios.sm + 2,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
