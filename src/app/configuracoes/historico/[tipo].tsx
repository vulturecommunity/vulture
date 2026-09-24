import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Cabecalho,
  Carregando,
  Erro,
  EstadoVazio,
  Icone,
  Texto,
  type NomeDeIcone,
} from '@/components/ui';
import { useMencoes } from '@/hooks/useMencoes';
import { useVoltar } from '@/hooks/useVoltar';
import {
  useHistoricoStore,
  type ColecaoDoHistorico,
  type TipoDeEventoDaConta,
} from '@/stores/historicoStore';
import { cores, espacos, raios } from '@/theme';
import { formatarHora, rotuloDoDia } from '@/utils/formatadores';

type TipoDeHistorico = ColecaoDoHistorico | 'mencoes';

const TIPOS: TipoDeHistorico[] = ['assistidos', 'comentarios', 'pesquisas', 'mencoes', 'conta'];

const CABECALHOS: Record<TipoDeHistorico, { titulo: string; subtitulo: string }> = {
  assistidos: { titulo: 'Vídeos assistidos', subtitulo: 'Na ordem em que você viu' },
  comentarios: { titulo: 'Comentários', subtitulo: 'O que você escreveu nos vídeos' },
  pesquisas: { titulo: 'Pesquisas', subtitulo: 'Toque para buscar de novo' },
  mencoes: { titulo: 'Menções', subtitulo: 'Quando te chamaram na resenha' },
  conta: { titulo: 'Histórico da conta', subtitulo: 'Entradas e mudanças importantes' },
};

const VAZIOS: Record<TipoDeHistorico, { icone: NomeDeIcone; titulo: string; descricao: string }> = {
  assistidos: {
    icone: 'play',
    titulo: 'Nada assistido ainda',
    descricao: 'Os vídeos que você ver no feed aparecem aqui.',
  },
  comentarios: {
    icone: 'comentarios',
    titulo: 'Nenhum comentário',
    descricao: 'Entre na resenha dos vídeos e o que você escrever fica registrado aqui.',
  },
  pesquisas: {
    icone: 'buscar',
    titulo: 'Nenhuma busca',
    descricao: 'O que você procurar no Explorar fica guardado aqui.',
  },
  mencoes: {
    icone: 'arroba',
    titulo: 'Ninguém te chamou ainda',
    descricao: 'Quando alguém escrever o seu @ na Arquibancada, o post aparece aqui.',
  },
  conta: {
    icone: 'escudo',
    titulo: 'Sem registros',
    descricao: 'Entradas, troca de senha e mudanças de privacidade ficam listadas aqui.',
  },
};

const ICONE_DO_EVENTO: Record<TipoDeEventoDaConta, NomeDeIcone> = {
  entrou: 'pessoaOk',
  saiu: 'sair',
  perfil: 'editar',
  senha: 'chave',
  privacidade: 'cadeado',
};

interface ItemDaLista {
  chave: string;
  em: string;
  titulo: string;
  legenda?: string;
  icone?: NomeDeIcone;
  thumbnailUrl?: string | null;
  avatarUrl?: string | null;
  avatarNome?: string;
  aoPressionar?: () => void;
}

function agrupar(itens: ItemDaLista[]): { title: string; data: ItemDaLista[] }[] {
  const secoes: { title: string; data: ItemDaLista[] }[] = [];
  for (const item of itens) {
    const dia = rotuloDoDia(item.em);
    const atual = secoes[secoes.length - 1];
    if (atual && atual.title === dia) atual.data.push(item);
    else secoes.push({ title: dia, data: [item] });
  }
  return secoes;
}

/** Uma das listas do Centro de atividade: assistidos, comentários, buscas, menções ou conta. */
export default function TelaDeHistorico() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const voltar = useVoltar('/configuracoes/atividade');

  const valido = TIPOS.includes(tipo as TipoDeHistorico) ? (tipo as TipoDeHistorico) : null;

  const assistidos = useHistoricoStore((s) => s.assistidos);
  const comentarios = useHistoricoStore((s) => s.comentarios);
  const pesquisas = useHistoricoStore((s) => s.pesquisas);
  const eventos = useHistoricoStore((s) => s.conta);
  const limpar = useHistoricoStore((s) => s.limpar);
  const mencoes = useMencoes();

  const itens = useMemo<ItemDaLista[]>(() => {
    switch (valido) {
      case 'assistidos':
        return assistidos.map((a) => ({
          chave: `${a.videoId}-${a.em}`,
          em: a.em,
          titulo: a.legenda || 'Vídeo sem legenda',
          legenda: `@${a.apelido}`,
          thumbnailUrl: a.thumbnailUrl,
          aoPressionar: () => router.push({ pathname: '/video/[id]', params: { id: a.videoId } }),
        }));
      case 'comentarios':
        return comentarios.map((c) => ({
          chave: c.id,
          em: c.em,
          titulo: c.texto,
          legenda: 'Ver no vídeo',
          icone: 'comentarios',
          aoPressionar: () => router.push({ pathname: '/video/[id]', params: { id: c.videoId } }),
        }));
      case 'pesquisas':
        return pesquisas.map((p) => ({
          chave: `${p.termo}-${p.em}`,
          em: p.em,
          titulo: p.termo,
          icone: 'buscar',
          aoPressionar: () =>
            router.push({ pathname: '/(tabs)/explorar', params: { termo: p.termo } }),
        }));
      case 'mencoes':
        return (mencoes.data ?? []).map((p) => ({
          chave: p.id,
          em: p.criadoEm,
          titulo: p.texto,
          legenda: `@${p.autor.apelido}`,
          avatarUrl: p.autor.avatarUrl,
          avatarNome: p.autor.nome,
          aoPressionar: () =>
            router.push({ pathname: '/arquibancada/post/[id]', params: { id: p.id } }),
        }));
      case 'conta':
        return eventos.map((e) => ({
          chave: e.id,
          em: e.em,
          titulo: e.descricao,
          icone: ICONE_DO_EVENTO[e.tipo],
        }));
      default:
        return [];
    }
  }, [valido, assistidos, comentarios, pesquisas, eventos, mencoes.data, router]);

  const secoes = useMemo(() => agrupar(itens), [itens]);

  if (!valido) {
    return (
      <View style={[estilos.tela, { paddingTop: insets.top }]}>
        <Cabecalho titulo="Histórico" aoVoltar={voltar} />
        <EstadoVazio
          icone="alerta"
          titulo="Histórico desconhecido"
          descricao="Volte ao Centro de atividade e escolha uma das listas."
        />
      </View>
    );
  }

  const cabecalho = CABECALHOS[valido];
  const vazio = VAZIOS[valido];
  const podeLimpar = valido !== 'mencoes' && itens.length > 0;

  function confirmarLimpeza() {
    Alert.alert(`Limpar ${cabecalho.titulo.toLowerCase()}`, 'Esses registros somem do aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        style: 'destructive',
        onPress: () => limpar(valido as ColecaoDoHistorico),
      },
    ]);
  }

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho
        titulo={cabecalho.titulo}
        subtitulo={cabecalho.subtitulo}
        aoVoltar={voltar}
        direita={
          podeLimpar ? (
            <Pressable
              onPress={confirmarLimpeza}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico"
              testID="botao-limpar-historico"
              style={({ pressed }) => [estilos.limpar, pressed && estilos.pressionado]}>
              <Icone nome="excluir" tamanho={16} cor={cores.erro} />
            </Pressable>
          ) : undefined
        }
      />

      {valido === 'mencoes' && mencoes.isLoading ? (
        <Carregando />
      ) : valido === 'mencoes' && mencoes.isError ? (
        <Erro erro={mencoes.error} aoTentarNovamente={() => mencoes.refetch()} />
      ) : (
        <SectionList
          sections={secoes}
          keyExtractor={(item) => item.chave}
          contentContainerStyle={[
            estilos.lista,
            { paddingBottom: insets.bottom + espacos.xl },
            secoes.length === 0 && estilos.listaVazia,
          ]}
          stickySectionHeadersEnabled={false}
          refreshing={valido === 'mencoes' && mencoes.isRefetching}
          onRefresh={valido === 'mencoes' ? () => mencoes.refetch() : undefined}
          ListEmptyComponent={<EstadoVazio {...vazio} />}
          renderSectionHeader={({ section }) => (
            <Texto variante="rotulo" cor={cores.textoTerciario} style={estilos.dia}>
              {section.title}
            </Texto>
          )}
          renderItem={({ item }) => <LinhaDoHistorico item={item} />}
        />
      )}
    </View>
  );
}

function LinhaDoHistorico({ item }: { item: ItemDaLista }) {
  const conteudo = (
    <>
      {item.thumbnailUrl !== undefined ? (
        <View style={estilos.miniatura}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={estilos.imagem} contentFit="cover" />
          ) : (
            <Icone nome="filme" tamanho={18} cor={cores.textoTerciario} />
          )}
        </View>
      ) : item.avatarNome ? (
        <Avatar url={item.avatarUrl ?? null} nome={item.avatarNome} tamanho={40} />
      ) : item.icone ? (
        <View style={estilos.icone}>
          <Icone nome={item.icone} tamanho={17} cor={cores.textoSecundario} />
        </View>
      ) : null}

      <View style={estilos.textos}>
        <Texto variante="corpo" numberOfLines={2}>
          {item.titulo}
        </Texto>
        <View style={estilos.meta}>
          {item.legenda ? (
            <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
              {item.legenda}
            </Texto>
          ) : null}
          <Texto variante="pequeno" cor={cores.textoTerciario}>
            {item.legenda ? '· ' : ''}
            {formatarHora(item.em)}
          </Texto>
        </View>
      </View>

      {item.aoPressionar ? <Icone nome="avancar" tamanho={16} cor={cores.textoTerciario} /> : null}
    </>
  );

  if (!item.aoPressionar) return <View style={estilos.linha}>{conteudo}</View>;

  return (
    <Pressable
      onPress={item.aoPressionar}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.linha, pressed && estilos.linhaPressionada]}>
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { paddingHorizontal: espacos.lg, gap: espacos.xs },
  listaVazia: { flexGrow: 1 },
  dia: { paddingTop: espacos.lg, paddingBottom: espacos.sm },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  linhaPressionada: { backgroundColor: cores.fundoCartao },
  miniatura: {
    width: 44,
    height: 58,
    borderRadius: raios.sm,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imagem: { width: '100%', height: '100%' },
  icone: {
    width: 40,
    height: 40,
    borderRadius: raios.sm + 2,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  limpar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: cores.vidroClaro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.7 },
});
