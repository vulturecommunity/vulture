import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { cores } from '@/theme';
import { iniciais } from '@/utils/formatadores';

import { Texto } from './Texto';

export interface AvatarProps {
  url?: string | null;
  nome: string;
  tamanho?: number;
  /** anel vermelho da identidade */
  borda?: boolean;
}

const PALETA = ['#C8102E', '#8E0B20', '#3A3A40', '#5A0A16', '#2A2A2E', '#A3122C'];

function corPeloNome(nome: string): string {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i) * (i + 1)) % 9973;
  return PALETA[soma % PALETA.length];
}

/** Avatar circular: usa a foto quando existe, senão as iniciais em tons rubro-negros. */
export function Avatar({ url, nome, tamanho = 40, borda = false }: AvatarProps) {
  const anel = borda ? Math.max(2, Math.round(tamanho / 28)) : 0;
  const interno = tamanho - anel * 2 - (borda ? 4 : 0);
  const estiloInterno = { width: interno, height: interno, borderRadius: interno / 2 };

  const miolo = url ? (
    <Image
      source={{ uri: url }}
      style={estiloInterno}
      contentFit="cover"
      transition={150}
      accessibilityLabel={'Foto de ' + nome}
      cachePolicy="memory-disk"
    />
  ) : (
    <View
      accessibilityLabel={'Avatar de ' + nome}
      style={[estiloInterno, estilos.centro, { backgroundColor: corPeloNome(nome) }]}>
      <Texto variante="corpoForte" style={{ fontSize: interno * 0.38, color: cores.branco }}>
        {iniciais(nome)}
      </Texto>
    </View>
  );

  if (!borda) return miolo;
  return (
    <View
      style={[
        estilos.centro,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          borderWidth: anel,
          borderColor: cores.vermelho,
          backgroundColor: cores.fundo,
        },
      ]}>
      {miolo}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
});
