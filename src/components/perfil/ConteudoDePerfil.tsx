import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { GradeDeVideos } from '@/components/perfil/GradeDeVideos';
import { Carregando, EstadoVazio, Icone, Texto, type NomeDeIcone } from '@/components/ui';
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

const ABAS: { id: Aba; rotulo: string; icone: NomeDeIcone; soEu?: boolean }[] = [
  { id: 'usuario', rotulo: 'Vídeos', icone: 'grade' },
  { id: 'curtidos', rotulo: 'Curtidos', icone: 'curtir' },
  { id: 'salvos', rotulo: 'Salvos', icone: 'salvar', soEu: true },
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
          icone="bloquear"
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
                  style={estilos.aba}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  testID={`aba-perfil-${item.id}`}>
                  <Icone
                    nome={item.icone}
                    tamanho={16}
                    cor={ativa ? cores.vermelhoVivo : cores.textoTerciario}
                  />
                  <Texto variante="rotulo" cor={ativa ? cores.texto : cores.textoTerciario}>
                    {item.rotulo}
                  </Texto>
                  <View style={[estilos.indicador, ativa && estilos.indicadorAtivo]} />
                </Pressable>
              );
            })}
          </View>

          {lista.isLoading ? (
            <Carregando telaCheia={false} />
          ) : (lista.data?.length ?? 0) === 0 ? (
            <EstadoVazio
              icone={aba === 'usuario' ? 'video' : aba === 'curtidos' ? 'curtir' : 'salvar'}
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
                  ? 'Toque no botão vermelho para gravar seu primeiro vídeo.'
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
    marginTop: espacos.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  aba: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.xs + 2,
    paddingVertical: espacos.md,
  },
  indicador: {
    position: 'absolute',
    left: espacos.xl,
    right: espacos.xl,
    bottom: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  indicadorAtivo: { backgroundColor: cores.vermelho },
});
