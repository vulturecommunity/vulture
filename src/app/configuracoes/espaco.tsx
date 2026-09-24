import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, StyleSheet, View } from 'react-native';

import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
} from '@/components/configuracoes';
import { Carregando, Texto } from '@/components/ui';
import { formatarBytes, limparCache, medirArmazenamento } from '@/services/armazenamento';
import { useHistoricoStore } from '@/stores/historicoStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';

const FATIAS = [
  { chave: 'cacheBytes', rotulo: 'Cache', cor: cores.vermelhoVivo },
  { chave: 'midiaBytes', rotulo: 'Publicações', cor: cores.dourado },
  { chave: 'dadosBytes', rotulo: 'Dados do app', cor: cores.textoSecundario },
] as const;

/** Liberar espaço: o que o Vulture ocupa no aparelho e o que dá para apagar. */
export default function TelaDeEspaco() {
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const historico = useHistoricoStore();

  const uso = useQuery({ queryKey: ['armazenamento'], queryFn: medirArmazenamento });

  const limpeza = useMutation({
    mutationFn: limparCache,
    onSuccess: async () => {
      await uso.refetch();
      mostrarAviso('Cache liberado.', 'sucesso');
    },
    onError: () => mostrarAviso('Não foi possível liberar o cache agora.', 'erro'),
  });

  const total = uso.data ? uso.data.cacheBytes + uso.data.midiaBytes + uso.data.dadosBytes : 0;
  const registros =
    historico.assistidos.length +
    historico.comentarios.length +
    historico.pesquisas.length +
    historico.conta.length;

  function confirmarHistorico() {
    Alert.alert('Apagar histórico local', 'Some com tudo que está no Centro de atividade.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          historico.limparTudo();
          uso.refetch();
          mostrarAviso('Histórico apagado.', 'sucesso');
        },
      },
    ]);
  }

  return (
    <TelaDeAjustes titulo="Liberar espaço" subtitulo="O que o app ocupa neste aparelho">
      {uso.isLoading ? (
        <Carregando />
      ) : (
        <View style={estilos.resumo}>
          <Texto variante="titulo">{formatarBytes(total)}</Texto>
          <Texto variante="pequeno" cor={cores.textoSecundario}>
            {uso.data?.livreBytes
              ? `${formatarBytes(uso.data.livreBytes)} ainda livres no aparelho`
              : 'Espaço usado pelo Vulture'}
          </Texto>

          <View style={estilos.barra}>
            {total > 0 ? (
              FATIAS.map((fatia) => {
                const valor = uso.data?.[fatia.chave] ?? 0;
                if (valor <= 0) return null;
                return (
                  <View
                    key={fatia.chave}
                    style={{ flex: valor / total, backgroundColor: fatia.cor }}
                  />
                );
              })
            ) : (
              <View style={estilos.barraVazia} />
            )}
          </View>

          <View style={estilos.legenda}>
            {FATIAS.map((fatia) => (
              <View key={fatia.chave} style={estilos.itemDaLegenda}>
                <View style={[estilos.ponto, { backgroundColor: fatia.cor }]} />
                <Texto variante="pequeno" cor={cores.textoSecundario} style={estilos.rotuloLegenda}>
                  {fatia.rotulo}
                </Texto>
                <Texto variante="pequeno">{formatarBytes(uso.data?.[fatia.chave] ?? 0)}</Texto>
              </View>
            ))}
          </View>
        </View>
      )}

      <GrupoDeAjustes titulo="Apagar">
        <LinhaDeAjuste
          icone="nuvem"
          titulo="Limpar cache"
          descricao="Miniaturas e arquivos temporários"
          valor={formatarBytes(uso.data?.cacheBytes ?? 0)}
          destaque
          aoPressionar={() => limpeza.mutate()}
          desabilitada={limpeza.isPending}
          testID="botao-limpar-cache"
        />
        <LinhaDeAjuste
          icone="historico"
          titulo="Apagar histórico local"
          descricao={registros > 0 ? `${registros} registros` : 'Nada guardado'}
          aoPressionar={confirmarHistorico}
          desabilitada={registros === 0}
          testID="botao-apagar-historico"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste>
        Limpar o cache não apaga nada que você publicou: o app só baixa de novo as miniaturas e os
        vídeos quando você voltar ao feed. A primeira rolagem depois disso fica um pouco mais lenta.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}

const estilos = StyleSheet.create({
  resumo: {
    gap: espacos.sm,
    padding: espacos.lg,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  barra: {
    flexDirection: 'row',
    height: 10,
    borderRadius: raios.sm,
    overflow: 'hidden',
    backgroundColor: cores.fundoCartao,
    marginTop: espacos.sm,
  },
  barraVazia: { flex: 1, backgroundColor: cores.fundoCartao },
  legenda: { gap: espacos.sm, marginTop: espacos.xs },
  itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  rotuloLegenda: { flex: 1 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
});
