import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { cores } from '@/theme';
import { iniciais } from '@/utils/formatadores';

import { Texto } from './Texto';

export interface AvatarProps {
  url?: string | null;
  nome: string;
  tamanho?: number;
  borda?: boolean;
}

const PALETA = ['#E30613', '#7B1FA2', '#1565C0', '#00897B', '#EF6C00', '#5D4037', '#455A64'];

function corPeloNome(nome: string): string {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i) * (i + 1)) % 9973;
  return PALETA[soma % PALETA.length];
}

/** Avatar circular: usa a foto quando existe, senão as iniciais coloridas. */
export function Avatar({ url, nome, tamanho = 40, borda = false }: AvatarProps) {
  const estiloBase = {
    width: tamanho,
    height: tamanho,
    borderRadius: tamanho / 2,
  };
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[estiloBase, borda && estilos.borda]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={'Foto de ' + nome}
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View
      accessibilityLabel={'Avatar de ' + nome}
      style={[
        estiloBase,
        estilos.centro,
        { backgroundColor: corPeloNome(nome) },
        borda && estilos.borda,
      ]}>
      <Texto variante="corpoForte" style={{ fontSize: tamanho * 0.38 }}>
        {iniciais(nome)}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  borda: { borderWidth: 2, borderColor: cores.branco },
});
