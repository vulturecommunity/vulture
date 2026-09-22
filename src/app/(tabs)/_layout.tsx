import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { BotaoGravar } from '@/components/navegacao/BotaoGravar';
import { TelaDeErro } from '@/components/navegacao/TelaDeErro';
import { Icone, type NomeDeIcone } from '@/components/ui';
import { cores } from '@/theme';

function icone(nome: NomeDeIcone) {
  function IconeDaAba({ color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <Icone nome={nome} tamanho={size - 2} cor={String(color)} />;
  }
  return IconeDaAba;
}

/** Um erro numa aba mostra a tela de erro dentro das abas, sem derrubar o app. */
export { TelaDeErro as ErrorBoundary };

export default function LayoutAbas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: cores.fundo,
          borderTopWidth: 0.5,
          borderTopColor: cores.borda,
          height: 64,
          paddingTop: 6,
          paddingHorizontal: 12,
        },
        tabBarActiveTintColor: cores.vermelhoVivo,
        tabBarInactiveTintColor: cores.textoTerciario,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        },
        sceneStyle: { backgroundColor: cores.fundo },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('inicio') }} />
      <Tabs.Screen name="explorar" options={{ title: 'Explorar', tabBarIcon: icone('explorar') }} />
      <Tabs.Screen
        name="gravar"
        options={{
          title: '',
          tabBarButton: () => <BotaoGravar />,
        }}
      />
      <Tabs.Screen name="lives" options={{ title: 'Lives', tabBarIcon: icone('lives') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icone('perfil') }} />
    </Tabs>
  );
}
