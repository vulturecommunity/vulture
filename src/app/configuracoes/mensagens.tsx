import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cabecalho, Carregando, Erro, Icone, Texto, type NomeDeIcone } from '@/components/ui';
import {
  useAtualizarPreferenciasDeMensagens,
  usePreferenciasDeMensagens,
} from '@/hooks/useMensagens';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import type { PreferenciasDeMensagens } from '@/types';

const OPCOES: {
  chave: keyof PreferenciasDeMensagens;
  icone: NomeDeIcone;
  titulo: string;
  descricao: string;
}[] = [
  {
    chave: 'deQuemSigo',
    icone: 'pessoaOk',
    titulo: 'Quem eu sigo',
    descricao: 'Pessoas que você segue podem te mandar mensagem.',
  },
  {
    chave: 'deSeguidores',
    icone: 'torcida',
    titulo: 'Meus seguidores',
    descricao: 'Quem te segue pode puxar papo com você.',
  },
];

/** Privacidade das mensagens diretas: quem pode me chamar no privado. */
export default function TelaConfiguracoesDeMensagens() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const preferencias = usePreferenciasDeMensagens();
  const atualizar = useAtualizarPreferenciasDeMensagens();

  function alternar(chave: keyof PreferenciasDeMensagens, valor: boolean) {
    atualizar.mutate(
      { [chave]: valor },
      {
        onError: (erro) =>
          mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível salvar.', 'erro'),
      },
    );
  }

  const nenhum =
    preferencias.data && !preferencias.data.deQuemSigo && !preferencias.data.deSeguidores;

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho
        titulo="Mensagens"
        subtitulo="Quem pode te chamar no privado"
        aoVoltar={() => router.back()}
      />
      {preferencias.isLoading ? (
        <Carregando />
      ) : preferencias.isError ? (
        <Erro erro={preferencias.error} aoTentarNovamente={() => preferencias.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={estilos.conteudo}>
          <View style={estilos.cartao}>
            {OPCOES.map((opcao, i) => (
              <View
                key={opcao.chave}
                style={[estilos.linha, i > 0 && estilos.linhaComBorda]}
                testID={`opcao-${opcao.chave}`}>
                <View style={estilos.icone}>
                  <Icone nome={opcao.icone} tamanho={18} cor={cores.vermelhoVivo} />
                </View>
                <View style={estilos.textos}>
                  <Texto variante="corpoForte">{opcao.titulo}</Texto>
                  <Texto variante="pequeno" cor={cores.textoSecundario}>
                    {opcao.descricao}
                  </Texto>
                </View>
                <Switch
                  value={preferencias.data?.[opcao.chave] ?? true}
                  onValueChange={(valor) => alternar(opcao.chave, valor)}
                  trackColor={{ false: cores.borda, true: cores.vermelho }}
                  thumbColor={cores.branco}
                  accessibilityLabel={opcao.titulo}
                  testID={`switch-${opcao.chave}`}
                />
              </View>
            ))}
          </View>

          <View style={[estilos.aviso, nenhum && estilos.avisoAtencao]}>
            <Icone
              nome={nenhum ? 'alerta' : 'escudoOk'}
              tamanho={18}
              cor={nenhum ? cores.aviso : cores.sucesso}
            />
            <Texto variante="pequeno" cor={cores.textoSecundario} style={estilos.textoAviso}>
              {nenhum
                ? 'Com as duas opções desligadas, ninguém consegue iniciar conversa com você. Suas conversas antigas continuam visíveis.'
                : 'Quem não te segue e você não segue nunca consegue te chamar. Bloquear alguém também corta as mensagens nos dois sentidos.'}
            </Texto>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espacos.lg, gap: espacos.md },
  cartao: {
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raios.md,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.md,
  },
  linhaComBorda: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: cores.borda },
  icone: {
    width: 36,
    height: 36,
    borderRadius: raios.sm + 2,
    backgroundColor: cores.vermelhoSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.sm,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
  },
  avisoAtencao: { borderWidth: 1, borderColor: cores.aviso },
  textoAviso: { flex: 1 },
});
