import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Carregando, Input, Sheet, Texto } from '@/components/ui';
import { buscarGifs, type Gif } from '@/services/gifs/giphy';
import { cores, espacos, raios } from '@/theme';
import { mensagemDeErro } from '@/utils/erros';

export interface SheetDeGifsProps {
  visivel: boolean;
  aoFechar: () => void;
  aoEscolher: (gif: Gif) => void;
}

/** Busca no GIPHY (em alta quando o campo está vazio). */
export function SheetDeGifs({ visivel, aoFechar, aoEscolher }: SheetDeGifsProps) {
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  // espera a pessoa parar de digitar para não gastar a cota da API a cada letra
  useEffect(() => {
    const relogio = setTimeout(() => setBusca(termo.trim()), 400);
    return () => clearTimeout(relogio);
  }, [termo]);

  const gifs = useQuery({
    queryKey: ['gifs', busca],
    queryFn: () => buscarGifs(busca),
    enabled: visivel,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Sheet visivel={visivel} aoFechar={aoFechar} titulo="GIFs" altura="80%">
      <View style={estilos.busca}>
        <Input
          icone="buscar"
          placeholder="Buscar no GIPHY (ex.: gol, comemoração)"
          value={termo}
          onChangeText={setTermo}
          autoCorrect={false}
          returnKeyType="search"
          testID="busca-gif"
        />
      </View>
      {gifs.isLoading ? (
        <Carregando telaCheia={false} />
      ) : gifs.isError ? (
        <Texto variante="pequeno" cor={cores.erro} centralizado style={estilos.aviso}>
          {mensagemDeErro(gifs.error)}
        </Texto>
      ) : (
        <FlatList
          data={gifs.data ?? []}
          keyExtractor={(g) => g.id}
          numColumns={2}
          columnWrapperStyle={estilos.linha}
          contentContainerStyle={estilos.grade}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Texto
              variante="pequeno"
              cor={cores.textoSecundario}
              centralizado
              style={estilos.aviso}>
              Nenhum GIF encontrado.
            </Texto>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                aoEscolher(item);
                aoFechar();
              }}
              style={({ pressed }) => [estilos.gif, pressed && estilos.pressionado]}
              accessibilityRole="imagebutton"
              accessibilityLabel={item.titulo || 'GIF'}
              testID={`gif-${item.id}`}>
              <Image
                source={{ uri: item.previa }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                autoplay
              />
            </Pressable>
          )}
        />
      )}
      <Texto variante="legenda" cor={cores.textoTerciario} centralizado style={estilos.creditos}>
        Powered by GIPHY
      </Texto>
    </Sheet>
  );
}

const estilos = StyleSheet.create({
  busca: { paddingHorizontal: espacos.lg, paddingTop: espacos.md, paddingBottom: espacos.sm },
  grade: { paddingHorizontal: espacos.lg, paddingBottom: espacos.lg, gap: espacos.sm },
  linha: { gap: espacos.sm },
  gif: {
    flex: 1,
    height: 120,
    borderRadius: raios.md,
    overflow: 'hidden',
    backgroundColor: cores.fundoCartao,
  },
  pressionado: { opacity: 0.7 },
  aviso: { padding: espacos.lg },
  creditos: { paddingVertical: espacos.sm },
});
