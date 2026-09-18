import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConteudoDePerfil } from '@/components/perfil/ConteudoDePerfil';
import { Carregando, Erro, Sheet, Texto } from '@/components/ui';
import { usePerfil } from '@/hooks/usePerfil';
import { dataService } from '@/services/data';
import { MockDataService } from '@/services/data/mock/MockDataService';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos } from '@/theme';

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
        <View style={estilos.espacador} />
        <Texto variante="destaque">{sessao?.visitante ? 'Visitante (demo)' : 'Meu perfil'}</Texto>
        <Pressable
          onPress={() => setMenuAberto(true)}
          hitSlop={12}
          accessibilityLabel="Configurações"
          testID="botao-menu-perfil"
          style={estilos.espacador}>
          <Ionicons name="menu" size={26} color={cores.texto} />
        </Pressable>
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
            icone="create-outline"
            rotulo="Editar perfil"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/editar-perfil');
            }}
          />
          <ItemMenu
            icone="notifications-outline"
            rotulo="Notificações"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/notificacoes');
            }}
          />
          <ItemMenu
            icone="ban-outline"
            rotulo="Contas bloqueadas"
            aoPressionar={() => {
              setMenuAberto(false);
              router.push('/bloqueados');
            }}
          />
          <ItemMenu
            icone="information-circle-outline"
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
            <ItemMenu
              icone="refresh-outline"
              rotulo="Resetar demonstração"
              aoPressionar={resetarDemo}
            />
          ) : null}
          <ItemMenu
            icone="log-out-outline"
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
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  aoPressionar: () => void;
  cor?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      style={estilos.itemMenu}
      accessibilityRole="button"
      testID={testID}>
      <Ionicons name={icone} size={22} color={cor} />
      <Texto variante="corpo" cor={cor}>
        {rotulo}
      </Texto>
    </Pressable>
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
  espacador: { width: 32, alignItems: 'flex-end' },
  menu: { paddingVertical: espacos.sm },
  itemMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.xl,
    paddingVertical: espacos.md,
  },
});
