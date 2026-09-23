import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotoesDeAnexo } from '@/components/arquibancada/BotoesDeAnexo';
import { PreviaDeAnexos } from '@/components/arquibancada/PreviaDeAnexos';
import { SheetDeGifs } from '@/components/arquibancada/SheetDeGifs';
import { Avatar, Botao, Icone, Texto } from '@/components/ui';
import { useAnexos } from '@/hooks/useAnexos';
import { usePublicarPost } from '@/hooks/useArquibancada';
import { useCalendario } from '@/hooks/usePalpites';
import { useVoltar } from '@/hooks/useVoltar';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios, tipografia } from '@/theme';
import { TAMANHO_MAXIMO_POST, type MarcacaoDePartida } from '@/types';
import { mensagemDeErro } from '@/utils/erros';
import { partidaEmDestaque, rotuloDaPartida } from '@/utils/palpites';
import { tamanhoDoPost } from '@/utils/posts';

/** Quantos caracteres ainda cabem: amarelo perto do limite, vermelho quando passa. */
function Contador({ tamanho }: { tamanho: number }) {
  const restante = TAMANHO_MAXIMO_POST - tamanho;
  let cor: string = cores.textoTerciario;
  if (restante < 0) cor = cores.erro;
  else if (restante <= 20) cor = cores.aviso;
  return (
    <Texto variante="pequeno" cor={cor} testID="contador-post">
      {restante}
    </Texto>
  );
}

/** Escrever um post na resenha. ?partidaId=&rotulo= já chega com o jogo marcado. */
export default function TelaNovoPost() {
  const insets = useSafeAreaInsets();
  const voltar = useVoltar('/arquibancada');
  const params = useLocalSearchParams<{ partidaId?: string; rotulo?: string }>();
  const eu = useAuthStore((s) => s.sessao?.usuario ?? null);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const publicar = usePublicarPost();
  const calendario = useCalendario();

  const sugestao = useMemo<MarcacaoDePartida | null>(() => {
    if (params.partidaId) return { id: params.partidaId, rotulo: params.rotulo ?? 'jogo' };
    const partida = partidaEmDestaque(calendario.data ?? []);
    return partida ? { id: partida.id, rotulo: rotuloDaPartida(partida) } : null;
  }, [params.partidaId, params.rotulo, calendario.data]);
  const aoVivo = calendario.data?.some((p) => p.status === 'ao_vivo' && p.id === sugestao?.id);

  const [texto, setTexto] = useState('');
  // com jogo rolando (ou vindo da resenha de um jogo) o post já sai marcado
  const [marcarJogo, setMarcarJogo] = useState<boolean | null>(null);
  const marcado = marcarJogo ?? (!!params.partidaId || !!aoVivo);

  const anexos = useAnexos();
  const [buscandoGif, setBuscandoGif] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);

  const tamanho = tamanhoDoPost(texto);
  const valido =
    (tamanho > 0 || anexos.anexos.length > 0) &&
    tamanho <= TAMANHO_MAXIMO_POST &&
    !anexos.preparando;

  async function enviar() {
    try {
      await publicar.mutateAsync({
        texto,
        partida: marcado ? sugestao : null,
        midias: anexos.anexos,
        aoProgredir: (fracao, etapa) => setProgresso(`${etapa} · ${Math.round(fracao * 100)}%`),
      });
      mostrarAviso('Post publicado na resenha!', 'sucesso');
      voltar();
    } catch {
      // erro exibido na tela
    } finally {
      setProgresso(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[estilos.tela, { paddingTop: insets.top + espacos.sm }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.topo}>
        <Pressable onPress={voltar} hitSlop={10} accessibilityRole="button" testID="cancelar-post">
          <Texto variante="corpo" cor={cores.textoSecundario}>
            Cancelar
          </Texto>
        </Pressable>
        <Botao
          titulo="Publicar"
          tamanho="pequeno"
          onPress={enviar}
          disabled={!valido}
          carregando={publicar.isPending}
          testID="botao-publicar-post"
        />
      </View>

      <ScrollView contentContainerStyle={estilos.corpo} keyboardShouldPersistTaps="handled">
        <View style={estilos.linha}>
          <Avatar url={eu?.avatarUrl} nome={eu?.nome ?? 'Torcedor'} tamanho={42} />
          <TextInput
            style={estilos.input}
            placeholder="O que tá rolando, torcedor?"
            placeholderTextColor={cores.textoTerciario}
            value={texto}
            onChangeText={setTexto}
            multiline
            autoFocus
            selectionColor={cores.vermelho}
            cursorColor={cores.vermelho}
            testID="campo-post"
          />
        </View>
        <View style={estilos.anexos}>
          <PreviaDeAnexos anexos={anexos.anexos} aoRemover={anexos.remover} />
        </View>
        {anexos.erro ? (
          <Texto variante="pequeno" cor={cores.erro} testID="erro-anexo">
            {anexos.erro}
          </Texto>
        ) : null}
        {progresso ? (
          <Texto variante="pequeno" cor={cores.textoSecundario} testID="progresso-post">
            {progresso}
          </Texto>
        ) : null}
        {publicar.isError ? (
          <Texto variante="pequeno" cor={cores.erro}>
            {mensagemDeErro(publicar.error)}
          </Texto>
        ) : null}
      </ScrollView>

      <View style={[estilos.rodape, { paddingBottom: insets.bottom + espacos.sm }]}>
        <BotoesDeAnexo
          podeAdicionar={anexos.podeAdicionar}
          podeGif={anexos.podeGif}
          preparando={anexos.preparando}
          aoGaleria={anexos.daGaleria}
          aoGif={() => setBuscandoGif(true)}
        />
        {sugestao ? (
          <Pressable
            onPress={() => setMarcarJogo(!marcado)}
            style={[estilos.chip, marcado && estilos.chipAtivo]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: marcado }}
            testID="marcar-jogo">
            <Icone nome="bola" tamanho={14} cor={marcado ? cores.branco : cores.textoSecundario} />
            <Texto variante="pequeno" cor={marcado ? cores.branco : cores.textoSecundario}>
              {marcado ? `Sobre ${sugestao.rotulo}` : `Marcar ${sugestao.rotulo}`}
            </Texto>
          </Pressable>
        ) : (
          <Texto variante="legenda" cor={cores.textoTerciario} style={estilos.dica}>
            Use #hashtags para entrar nos assuntos
          </Texto>
        )}
        <Contador tamanho={tamanho} />
      </View>
      <SheetDeGifs
        visivel={buscandoGif}
        aoFechar={() => setBuscandoGif(false)}
        aoEscolher={anexos.adicionarGif}
      />
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
    paddingBottom: espacos.sm,
  },
  corpo: { padding: espacos.lg, gap: espacos.sm },
  linha: { flexDirection: 'row', gap: espacos.md },
  anexos: { paddingLeft: 42 + espacos.md },
  input: {
    flex: 1,
    ...tipografia.corpo,
    fontSize: 17,
    lineHeight: 24,
    color: cores.texto,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: espacos.sm,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingTop: espacos.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs,
    paddingHorizontal: espacos.md,
    paddingVertical: 6,
    borderRadius: raios.redondo,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  dica: { flex: 1 },
});
