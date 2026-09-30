import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { LADO_DO_AVATAR, comprimirImagem } from '@/services/midia/arquivos';

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
      // o avatar nunca é exibido acima de ~100 px; subir o original era mandar megabytes
      // para servir um círculo pequeno, e essa imagem é baixada em toda lista do app
      const menor = await comprimirImagem(a.uri, LADO_DO_AVATAR, 0.8, {
        largura: a.width,
        altura: a.height,
      }).catch(() => null);
      return {
        uri: menor?.uri ?? a.uri,
        largura: menor?.largura ?? a.width,
        altura: menor?.altura ?? a.height,
      };
    } finally {
      setOcupado(false);
    }
  }, []);

  return { escolher, ocupado };
}
