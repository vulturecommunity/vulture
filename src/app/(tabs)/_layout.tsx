import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { BotaoGravar } from '@/components/navegacao/BotaoGravar';
import { cores } from '@/theme';

type NomeIcone = keyof typeof Ionicons.glyphMap;

function icone(ativo: NomeIcone, inativo: NomeIcone) {
  function IconeDaAba({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: ColorValue;
    size: number;
  }) {
    return <Ionicons name={focused ? ativo : inativo} size={size} color={color} />;
  }
  return IconeDaAba;
}

export default function LayoutAbas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: cores.pretoPuro,
          borderTopColor: cores.borda,
          borderTopWidth: 0.5,
        },
        tabBarActiveTintColor: cores.branco,
        tabBarInactiveTintColor: cores.textoTerciario,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: cores.fundo },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarIcon: icone('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="explorar"
        options={{ title: 'Explorar', tabBarIcon: icone('compass', 'compass-outline') }}
      />
      <Tabs.Screen
        name="gravar"
        options={{
          title: '',
          tabBarButton: () => <BotaoGravar />,
        }}
      />
      <Tabs.Screen
        name="lives"
        options={{ title: 'Lives', tabBarIcon: icone('radio', 'radio-outline') }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: icone('person', 'person-outline') }}
      />
    </Tabs>
  );
}
