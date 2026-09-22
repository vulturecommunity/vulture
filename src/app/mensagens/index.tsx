import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtalhoDaCaixa } from '@/components/mensagens/AtalhoDaCaixa';
import { LinhaDeConversa } from '@/components/mensagens/LinhaDeConversa';
import { FileiraDeRasantes } from '@/components/rasantes/FileiraDeRasantes';
import { Cabecalho, Carregando, EstadoVazio, Icone, Texto, TituloDeSecao } from '@/components/ui';
import { useConversas } from '@/hooks/useMensagens';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';
import type { Notificacao } from '@/types';

const TIPOS_ATIVIDADE: Notificacao['tipo'][] = ['curtida', 'comentario', 'live'];

/**
 * Caixa de mensagens: rasantes no topo, atalhos (novos seguidores, atividade, avisos do app)
 * e as conversas privadas.
 */
export default function TelaMensagens() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? '');
  const conversas = useConversas();
  const notificacoes = useNotificacoes();

  const resumo = useMemo(() => {
    const lista = notificacoes.data ?? [];
    const grupo = (tipos: Notificacao['tipo'][]) => {
      const itens = lista.filter((n) => tipos.includes(n.tipo));
      return { ultima: itens[0] ?? null, naoLidas: itens.filter((n) => !n.lida).length };
    };
    return {
      seguidores: grupo(['seguiu']),
      atividade: grupo(TIPOS_ATIVIDADE),
      sistema: grupo(['sistema']),
    };
  }, [notificacoes.data]);

  const descricaoDe = (n: Notificacao | null, vazio: string) =>
    n ? `${n.de ? `@${n.de.apelido} ` : ''}${n.texto}` : vazio;

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho
        titulo="Mensagens"
        aoVoltar={() => router.back()}
        direita={
          <>
            <Pressable
              onPress={() => router.push('/perfil/encontrar')}
              hitSlop={8}
              accessibilityLabel="Encontrar torcedores"
              style={estilos.botaoTopo}
              testID="botao-encontrar">
              <Icone nome="adicionarPessoa" tamanho={18} cor={cores.texto} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/mensagens/nova')}
              hitSlop={8}
              accessibilityLabel="Nova conversa"
              style={estilos.botaoTopo}
              testID="botao-nova-conversa">
              <Icone nome="novaConversa" tamanho={20} cor={cores.texto} />
            </Pressable>
          </>
        }
      />
      <FlatList
        data={conversas.data ?? []}
        keyExtractor={(c) => c.id}
        onRefresh={() => {
          conversas.refetch();
          notificacoes.refetch();
        }}
        refreshing={conversas.isRefetching}
        contentContainerStyle={[estilos.lista, { paddingBottom: insets.bottom + espacos.xl }]}
        ListHeaderComponent={
          <View>
            <FileiraDeRasantes />
            <View style={estilos.atalhos}>
              <AtalhoDaCaixa
                icone="adicionarPessoa"
                cor={cores.sucesso}
                titulo="Novos seguidores"
                descricao={descricaoDe(resumo.seguidores.ultima, 'Quem começou a te seguir')}
                naoLidas={resumo.seguidores.naoLidas}
                aoPressionar={() => router.push('/mensagens/seguidores')}
                testID="atalho-seguidores"
              />
              <AtalhoDaCaixa
                icone="curtido"
                cor={cores.vermelho}
                titulo="Atividade"
                descricao={descricaoDe(
                  resumo.atividade.ultima,
                  'Curtidas, comentários e lives de quem você segue',
                )}
                naoLidas={resumo.atividade.naoLidas}
                aoPressionar={() =>
                  router.push({ pathname: '/notificacoes', params: { grupo: 'atividade' } })
                }
                testID="atalho-atividade"
              />
              <AtalhoDaCaixa
                icone="megafone"
                cor={cores.dourado}
                titulo="Avisos do Vulture"
                descricao={descricaoDe(resumo.sistema.ultima, 'Novidades e recados do app')}
                naoLidas={resumo.sistema.naoLidas}
                aoPressionar={() =>
                  router.push({ pathname: '/notificacoes', params: { grupo: 'sistema' } })
                }
                testID="atalho-sistema"
              />
            </View>
            <View style={estilos.tituloConversas}>
              <TituloDeSecao titulo="Conversas" icone="mensagens" />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <LinhaDeConversa
            conversa={item}
            meuId={meuId}
            aoPressionar={() =>
              router.push({ pathname: '/mensagens/[id]', params: { id: item.id } })
            }
          />
        )}
        ListEmptyComponent={
          conversas.isLoading ? (
            <Carregando telaCheia={false} />
          ) : (
            <EstadoVazio
              icone="mensagens"
              titulo="Nenhuma conversa ainda"
              descricao="Puxe papo com quem você segue ou com quem te segue. É privado, só entre vocês."
              acao={{
                titulo: 'Começar uma conversa',
                aoPressionar: () => router.push('/mensagens/nova'),
              }}
            />
          )
        }
        ListFooterComponent={
          (conversas.data?.length ?? 0) > 0 ? (
            <Texto
              variante="legenda"
              cor={cores.textoTerciario}
              centralizado
              style={estilos.rodape}>
              Só quem você segue ou quem te segue pode te chamar. Ajuste em Perfil → Configurações.
            </Texto>
          ) : null
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { flexGrow: 1 },
  botaoTopo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhos: { marginTop: espacos.md },
  tituloConversas: { marginTop: espacos.md, marginBottom: espacos.xs },
  rodape: { paddingHorizontal: espacos.xl, paddingTop: espacos.lg },
});
