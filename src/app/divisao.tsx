import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Botao, Cabecalho, Carregando, Erro, Icone, Texto } from '@/components/ui';
import { useMinhaDivisao } from '@/hooks/useDivisao';
import { cores, espacos, raios } from '@/theme';
import type { MembroDoGrupo, MinhaDivisao, ZonaDaDivisao } from '@/types';
import { formatarContador } from '@/utils/formatadores';

const COR_DA_ZONA: Record<ZonaDaDivisao, string> = {
  acesso: cores.sucesso,
  rebaixamento: cores.vermelhoVivo,
  neutro: 'transparent',
};

/**
 * Divisão do mês.
 *
 * POR QUE ESTA TELA EXISTE
 *
 * O ranking nacional tem um vencedor e milhares de pessoas que sabem, na primeira semana,
 * que não chegam perto — para elas o placar vira enfeite. Aqui a disputa tem o tamanho de
 * uma tela: ~30 pessoas de nível parecido, onde subir é possível e cair dói.
 *
 * O número que importa na tela não é a posição, é `pontosParaSubir`. "Faltam 35" é um
 * objetivo para amanhã; "você é o 4.312º do Brasil" não é.
 */
export default function TelaDaDivisao() {
  const router = useRouter();
  const divisao = useMinhaDivisao();

  if (divisao.isLoading) return <Carregando mensagem="Carregando sua divisão..." />;
  if (divisao.isError) {
    return <Erro erro={divisao.error} aoTentarNovamente={() => divisao.refetch()} />;
  }

  // ainda não palpitou neste mês: o convite é dar o primeiro palpite, não ver grupo vazio
  if (!divisao.data) {
    return (
      <View style={estilos.tela}>
        <Cabecalho titulo="Divisão" aoVoltar={() => router.back()} />
        <View style={estilos.vazio}>
          <Icone nome="trofeu" tamanho={44} cor={cores.textoTerciario} />
          <Texto variante="subtitulo" centralizado>
            Você ainda não entrou na disputa deste mês
          </Texto>
          <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
            Dê um palpite em qualquer jogo e você cai automaticamente num grupo de até 30
            torcedores do seu nível. Os primeiros sobem de divisão; os últimos caem.
          </Texto>
          <Botao
            titulo="Ver os próximos jogos"
            onPress={() => router.push('/arquibancada')}
            largo
            testID="botao-ir-palpitar"
          />
        </View>
      </View>
    );
  }

  const { resumo, grupo } = divisao.data;

  return (
    <View style={estilos.tela}>
      <Cabecalho titulo="Divisão" aoVoltar={() => router.back()} />
      <FlatList
        data={grupo}
        keyExtractor={(m) => m.usuario.id}
        ListHeaderComponent={<CartaoDaDivisao resumo={resumo} />}
        contentContainerStyle={estilos.lista}
        renderItem={({ item }) => <LinhaDoGrupo membro={item} />}
      />
    </View>
  );
}

function CartaoDaDivisao({ resumo }: { readonly resumo: MinhaDivisao }) {
  const subindo = resumo.zona === 'acesso';
  const caindo = resumo.zona === 'rebaixamento';

  return (
    <View style={estilos.cartao}>
      <Texto variante="rotulo" cor={cores.textoTerciario}>
        SUA DIVISÃO
      </Texto>
      <Texto variante="titulo">{resumo.nome}</Texto>
      <Texto variante="legenda" cor={cores.textoSecundario}>
        Grupo {resumo.grupoNumero} · {resumo.posicao}º de {resumo.total}
      </Texto>

      <View style={estilos.separador} />

      {subindo ? (
        <View style={estilos.situacao}>
          <Icone nome="emAlta" tamanho={16} cor={COR_DA_ZONA.acesso} />
          <Texto variante="corpoForte" style={{ color: COR_DA_ZONA.acesso }}>
            Em zona de acesso
          </Texto>
        </View>
      ) : null}

      {caindo ? (
        <View style={estilos.situacao}>
          <Icone nome="chevronBaixo" tamanho={16} cor={COR_DA_ZONA.rebaixamento} />
          <Texto variante="corpoForte" style={{ color: COR_DA_ZONA.rebaixamento }}>
            Em zona de rebaixamento
          </Texto>
        </View>
      ) : null}

      {resumo.pontosParaSubir > 0 ? (
        <Texto variante="corpo" cor={cores.textoSecundario}>
          Faltam{' '}
          <Texto variante="corpoForte" cor={cores.texto}>
            {resumo.pontosParaSubir} pontos
          </Texto>{' '}
          para entrar na zona de acesso.
        </Texto>
      ) : (
        <Texto variante="corpo" cor={cores.textoSecundario}>
          Termine o mês aqui e você sobe de divisão.
        </Texto>
      )}
    </View>
  );
}

function LinhaDoGrupo({ membro }: { readonly membro: MembroDoGrupo }) {
  return (
    <View style={[estilos.linha, membro.souEu && estilos.linhaEu]}>
      <View style={[estilos.faixa, { backgroundColor: COR_DA_ZONA[membro.zona] }]} />
      <Texto variante="corpoForte" cor={cores.textoSecundario} style={estilos.posicao}>
        {membro.posicao}
      </Texto>
      <Avatar url={membro.usuario.avatarUrl} nome={membro.usuario.nome} tamanho={36} />
      <View style={estilos.flex}>
        <Texto variante="corpoForte" numberOfLines={1}>
          @{membro.usuario.apelido}
          {membro.souEu ? ' · você' : ''}
        </Texto>
        <Texto variante="legenda" cor={cores.textoTerciario}>
          {membro.palpites} palpites · {membro.cravadas} cravadas
        </Texto>
      </View>
      <Texto variante="corpoForte">{formatarContador(membro.pontos)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  flex: { flex: 1 },
  lista: { padding: espacos.md, gap: espacos.xs, paddingBottom: espacos.xl },
  vazio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacos.md,
    padding: espacos.xl,
  },
  cartao: {
    backgroundColor: cores.fundoCartao,
    borderRadius: raios.md,
    padding: espacos.lg,
    gap: espacos.xs,
    marginBottom: espacos.md,
  },
  separador: { height: 1, backgroundColor: cores.borda, marginVertical: espacos.sm },
  situacao: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    backgroundColor: cores.fundoCartao,
    borderRadius: raios.sm,
    paddingRight: espacos.md,
    paddingVertical: espacos.sm,
    overflow: 'hidden',
  },
  linhaEu: { borderWidth: 1, borderColor: cores.vermelho },
  faixa: { width: 4, alignSelf: 'stretch' },
  posicao: { minWidth: 26, textAlign: 'center' },
});
