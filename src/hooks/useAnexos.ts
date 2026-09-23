import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import type { NovaMidia } from '@/services/data/types';
import type { Gif } from '@/services/gifs/giphy';
import { LIMITES_DE_MIDIA } from '@/types';
import { mensagemDeErro } from '@/utils/erros';
import { validarMidiasDoPost, validarVideoDoPost } from '@/utils/posts';

/** Reduz para no máximo 1080 px no lado maior e recomprime em JPEG (~200–400 KB). */
async function comprimirImagem(
  asset: ImagePicker.ImagePickerAsset,
): Promise<Extract<NovaMidia, { tipo: 'imagem' }>> {
  const lado = LIMITES_DE_MIDIA.imagemLado;
  const contexto = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > lado) {
    contexto.resize(asset.width >= asset.height ? { width: lado } : { height: lado });
  }
  const imagem = await contexto.renderAsync();
  const salva = await imagem.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  return { tipo: 'imagem', uriLocal: salva.uri, largura: salva.width, altura: salva.height };
}

function tamanhoDe(asset: ImagePicker.ImagePickerAsset): number {
  if (asset.fileSize) return asset.fileSize;
  try {
    return new File(asset.uri).size ?? 0;
  } catch {
    return 0;
  }
}

/** Anexos do post em edição: até 4 imagens, OU 1 vídeo, OU 1 GIF. */
export function useAnexos() {
  const [anexos, setAnexos] = useState<NovaMidia[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);

  const imagens = anexos.filter((a) => a.tipo === 'imagem').length;
  const temVideoOuGif = anexos.some((a) => a.tipo !== 'imagem');
  const podeAdicionar = !temVideoOuGif && imagens < LIMITES_DE_MIDIA.imagens;
  const podeGif = anexos.length === 0;

  const daGaleria = useCallback(async () => {
    setErro(null);
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Libere o acesso à galeria para anexar fotos e vídeos.');
      return;
    }
    const restantes = LIMITES_DE_MIDIA.imagens - imagens;
    const resultado = await ImagePicker.launchImageLibraryAsync({
      // com imagem já anexada, só dá para somar imagens; vídeo vai sozinho
      mediaTypes: imagens > 0 ? ['images'] : ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: restantes,
      videoMaxDuration: LIMITES_DE_MIDIA.videoSegundos,
      quality: 1,
    });
    if (resultado.canceled || resultado.assets.length === 0) return;

    setPreparando(true);
    try {
      const novos: NovaMidia[] = [];
      for (const asset of resultado.assets.slice(0, restantes)) {
        if (asset.type === 'video') {
          const duracao = (asset.duration ?? 0) / 1000;
          const tamanhoBytes = tamanhoDe(asset);
          validarVideoDoPost(duracao, tamanhoBytes);
          novos.push({
            tipo: 'video',
            uriLocal: asset.uri,
            largura: asset.width || null,
            altura: asset.height || null,
            duracao,
            tamanhoBytes,
          });
        } else {
          novos.push(await comprimirImagem(asset));
        }
      }
      const todos = [...anexos, ...novos];
      validarMidiasDoPost(todos);
      setAnexos(todos);
    } catch (e) {
      setErro(mensagemDeErro(e, 'Não foi possível anexar esse arquivo.'));
    } finally {
      setPreparando(false);
    }
  }, [anexos, imagens]);

  const adicionarGif = useCallback((gif: Gif) => {
    setErro(null);
    setAnexos([{ tipo: 'gif', url: gif.url, largura: gif.largura, altura: gif.altura }]);
  }, []);

  const remover = useCallback((indice: number) => {
    setErro(null);
    setAnexos((atual) => atual.filter((_, i) => i !== indice));
  }, []);

  const limpar = useCallback(() => {
    setErro(null);
    setAnexos([]);
  }, []);

  return {
    anexos,
    erro,
    preparando,
    podeAdicionar,
    podeGif,
    daGaleria,
    adicionarGif,
    remover,
    limpar,
  };
}
