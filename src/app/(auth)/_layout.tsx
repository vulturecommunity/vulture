import { Stack } from 'expo-router';

import { cores } from '@/theme';

export default function LayoutAuth() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: cores.fundo },
        animation: 'slide_from_right',
      }}
    />
  );
}
