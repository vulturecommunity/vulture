import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { GradeDeVideos } from '@/components/perfil/GradeDeVideos';
import { Carregando, EstadoVazio, Texto } from '@/components/ui';
import { useSeguir } from '@/hooks/useInteracoes';
import { useListaDeVideos, type OrigemDaLista } from '@/hooks/useListasDeVideos';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos } from '@/theme';
import type { Perfil } from '@/types';

import { CabecalhoDePerfil } from './CabecalhoDePerfil';

type Aba = 'usuario' | 'curtidos' | 'salvos';

export interface ConteudoDePerfilProps {
  perfil: Perfil;
  atualizando?: boolean;
  aoAtualizar?: () => void;
}

const ABAS: { id: Aba; rotulo: string; icone: keyof typeof Ionicons.glyphMap; soEu?: boolean }[] = [
  { id: 'usuario', rotulo: 'Vídeos', icone: 'grid-outline' },
  { id: 'curtidos', rotulo: 'Curtidos', icone: 'heart-outline' },
  { id: 'salvos', rotulo: 'Salvos', icone: 'bookmark-outline', soEu: true },
];

/** Corpo do perfil (meu ou de outro usuário): cabeçalho + abas com grades de vídeos. */
export function ConteudoDePerfil({ perfil, atualizando, aoAtualizar }: ConteudoDePerfilProps) {
  const router = useRouter();
  const abrirDenuncia = useUiStore((s) => s.abrirDenuncia);
  const { alternar: alternarSeguir, ocupado } = useSeguir();
  const [aba, setAba] = useState<Aba>('usuario');
  const origem: OrigemDaLista = aba;
  const lista = useListaDeVideos(origem, perfil.id);

  const abas = ABAS.filter((a) => !a.soEu || perfil.souEu);

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        aoAtualizar ? (
          <RefreshControl
            refreshing={!!atualizando}
            onRefresh={() => {
              aoAtualizar();
              lista.refetch();
            }}
            tintColor={cores.branco}
            colors={[cores.vermelho]}
          />
        ) : undefined
      }>
      <CabecalhoDePerfil
        perfil={perfil}
        ocupado={ocupado}
        aoEditar={() => router.push('/editar-perfil')}
        aoSeguir={() => alternarSeguir(perfil.id, perfil.estouSeguindo).catch(() => {})}
        aoMais={() =>
          abrirDenuncia({
            tipo: 'usuario',
            id: perfil.id,
            autorId: perfil.id,
            autorApelido: perfil.apelido,
          })
        }
      />

      {perfil.bloqueado ? (
        <EstadoVazio
          icone="ban-outline"
          titulo="Você bloqueou esse perfil"
          descricao="Desbloqueie em Perfil → Contas bloqueadas para ver os vídeos."
        />
      ) : (
        <>
          <View style={estilos.abas}>
            {abas.map((item) => {
              const ativa = item.id === aba;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setAba(item.id)}
                  style={[estilos.aba, ativa && estilos.abaAtiva]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  testID={`aba-perfil-${item.id}`}>
                  <Ionicons
                    name={item.icone}
                    size={18}
                    color={ativa ? cores.branco : cores.textoTerciario}
                  />
                  <Texto variante="pequeno" cor={ativa ? cores.branco : cores.textoTerciario}>
                    {item.rotulo}
                  </Texto>
                </Pressable>
              );
            })}
          </View>

          {lista.isLoading ? (
            <Carregando telaCheia={false} />
          ) : (lista.data?.length ?? 0) === 0 ? (
            <EstadoVazio
              icone={
                aba === 'usuario'
                  ? 'videocam-outline'
                  : aba === 'curtidos'
                    ? 'heart-outline'
                    : 'bookmark-outline'
              }
              titulo={
                aba === 'usuario'
                  ? perfil.souEu
                    ? 'Você ainda não publicou'
                    : 'Nenhum vídeo publicado'
                  : aba === 'curtidos'
                    ? 'Nenhum vídeo curtido'
                    : 'Nenhum vídeo salvo'
              }
              descricao={
                aba === 'usuario' && perfil.souEu
                  ? 'Toque no + para gravar seu primeiro vídeo.'
                  : undefined
              }
              acao={
                aba === 'usuario' && perfil.souEu
                  ? { titulo: 'Gravar agora', aoPressionar: () => router.push('/criar/camera') }
                  : undefined
              }
            />
          ) : (
            <GradeDeVideos videos={lista.data ?? []} origem={origem} usuarioId={perfil.id} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { paddingBottom: espacos.xxxl, flexGrow: 1 },
  abas: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs,
    paddingVertical: espacos.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  abaAtiva: { borderBottomColor: cores.vermelho },
});
