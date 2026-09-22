import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Icone, Texto } from '@/components/ui';
import { DURACAO_MAXIMA_RASANTE_SEGUNDOS, VALIDADE_RASANTE_HORAS } from '@/constants/rasantes';
import { usePublicarRasante } from '@/hooks/useRasantes';
import { useFecharFluxo, useVoltar } from '@/hooks/useVoltar';
import { useCriacaoStore } from '@/stores/criacaoStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { formatarDuracao } from '@/utils/formatadores';

function PreviewDoRasante({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      allowsPictureInPicture={false}
    />
  );
}

/** Pré-visualização do rasante gravado e publicação (some sozinho em 24 h). */
export default function TelaNovoRasante() {
  const router = useRouter();
  const voltar = useVoltar('/(tabs)');
  const fecharFluxo = useFecharFluxo('/mensagens');
  const insets = useSafeAreaInsets();
  const midia = useCriacaoStore((s) => s.midia);
  const limpar = useCriacaoStore((s) => s.limpar);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const publicar = usePublicarRasante();
  const [progresso, setProgresso] = useState<{ fracao: number; etapa: string } | null>(null);

  if (!midia || midia.tipo !== 'video') {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Texto variante="corpo" cor={cores.textoSecundario}>
          Nenhum vídeo para publicar.
        </Texto>
        <Botao
          titulo="Gravar rasante"
          onPress={() =>
            router.replace({ pathname: '/criar/camera', params: { destino: 'rasante' } })
          }
        />
      </View>
    );
  }

  const longoDemais = midia.duracao > DURACAO_MAXIMA_RASANTE_SEGUNDOS + 0.5;

  async function aoPublicar() {
    if (!midia) return;
    try {
      await publicar.mutateAsync({
        novo: {
          uriLocal: midia.uri,
          duracao: midia.duracao,
          largura: midia.largura,
          altura: midia.altura,
        },
        aoProgredir: (fracao, etapa) => setProgresso({ fracao, etapa }),
      });
      limpar();
      mostrarAviso('Rasante no ar! Some em 24 h.', 'sucesso');
      fecharFluxo();
    } catch (erro) {
      setProgresso(null);
      mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível publicar.', 'erro');
    }
  }

  return (
    <View style={estilos.tela}>
      <PreviewDoRasante uri={midia.uri} />
      <View style={[estilos.topo, { paddingTop: insets.top }]}>
        <Cabecalho
          titulo="Novo rasante"
          aoVoltar={() => {
            limpar();
            voltar();
          }}
          rotuloVoltar="Refazer"
          sobreposto
        />
      </View>

      <View style={[estilos.rodape, { paddingBottom: insets.bottom + espacos.lg }]}>
        <View style={estilos.etiqueta}>
          <Icone nome="rasante" tamanho={14} cor={cores.vermelhoVivo} />
          <Texto variante="legenda">
            {formatarDuracao(midia.duracao)} · some em {VALIDADE_RASANTE_HORAS} h · só quem te segue
            vê
          </Texto>
        </View>
        {longoDemais ? (
          <Texto variante="pequeno" cor={cores.erro} centralizado>
            Rasantes têm até {DURACAO_MAXIMA_RASANTE_SEGUNDOS} segundos. Grave um trecho mais curto.
          </Texto>
        ) : null}
        {progresso ? (
          <View style={estilos.progresso}>
            <View style={estilos.trilha}>
              <View style={[estilos.barra, { width: `${progresso.fracao * 100}%` }]} />
            </View>
            <Texto variante="legenda" cor={cores.textoSecundario}>
              {progresso.etapa}
            </Texto>
          </View>
        ) : null}
        <Botao
          titulo="Publicar rasante"
          largo
          onPress={aoPublicar}
          carregando={publicar.isPending}
          disabled={longoDemais}
          icone={<Icone nome="enviar" tamanho={16} cor={cores.branco} />}
          testID="botao-publicar-rasante"
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  centro: { alignItems: 'center', justifyContent: 'center', gap: espacos.md, padding: espacos.xl },
  topo: { position: 'absolute', top: 0, left: 0, right: 0 },
  rodape: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: espacos.lg,
    gap: espacos.md,
    backgroundColor: cores.overlayEscuro,
    paddingTop: espacos.lg,
  },
  etiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    alignSelf: 'center',
    paddingHorizontal: espacos.md,
    paddingVertical: 6,
    borderRadius: raios.redondo,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
  },
  progresso: { gap: espacos.xs, alignItems: 'center' },
  trilha: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  barra: { height: 4, backgroundColor: cores.vermelhoVivo },
});
