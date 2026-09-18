import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

export interface ImagemEscolhida {
  uri: string;
  largura: number;
  altura: number;
}

/** Abre a galeria para escolher uma imagem (foto de perfil). */
export function useEscolherImagem() {
  const [ocupado, setOcupado] = useState(false);

  const escolher = useCallback(async (): Promise<ImagemEscolhida | null> => {
    setOcupado(true);
    try {
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert('Permissão necessária', 'Libere o acesso à galeria para escolher uma foto.');
        return null;
      }
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (resultado.canceled || resultado.assets.length === 0) return null;
      const a = resultado.assets[0];
      return { uri: a.uri, largura: a.width, altura: a.height };
    } finally {
      setOcupado(false);
    }
  }, []);

  return { escolher, ocupado };
}
