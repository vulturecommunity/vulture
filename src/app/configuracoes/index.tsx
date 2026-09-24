import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  ROTULO_CURTIDOS,
  ROTULO_PUBLICO,
  TelaDeAjustes,
  ligadoOuDesligado,
} from '@/components/configuracoes';
import { Avatar, Icone, Texto } from '@/components/ui';
import { dataService } from '@/services/data';
import { MockDataService } from '@/services/data/mock/MockDataService';
import { queryClient } from '@/services/queryClient';
import { useAjustesStore } from '@/stores/ajustesStore';
import { useAuthStore } from '@/stores/authStore';
import { useHistoricoStore } from '@/stores/historicoStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';

/** Configurações e privacidade: a porta de entrada de tudo que se ajusta na conta. */
export default function TelaDeConfiguracoes() {
  const router = useRouter();
  const sessao = useAuthStore((s) => s.sessao);
  const sair = useAuthStore((s) => s.sair);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const ajustes = useAjustesStore();
  const limparHistorico = useHistoricoStore((s) => s.limparTudo);
  const registrarEvento = useHistoricoStore((s) => s.registrarEvento);

  const usuario = sessao?.usuario;
  const visitante = !!sessao?.visitante;
  const demonstracao = dataService().nome === 'mock';

  function confirmarSaida() {
    Alert.alert('Sair da conta', 'Você vai precisar entrar de novo para publicar e comentar.', [
      { text: 'Ficar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          registrarEvento('saiu', 'Você saiu da conta neste aparelho');
          sair();
        },
      },
    ]);
  }

  function resetarDemonstracao() {
    const servico = dataService();
    if (!(servico instanceof MockDataService)) return;
    Alert.alert(
      'Resetar demonstração',
      'Isso apaga os dados locais (vídeos publicados, curtidas, contas, histórico) e volta ao estado inicial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar',
          style: 'destructive',
          onPress: async () => {
            await servico.resetar();
            queryClient.clear();
            limparHistorico();
            ajustes.restaurarPadroes();
            await sair();
            mostrarAviso('Demonstração reiniciada.', 'sucesso');
          },
        },
      ],
    );
  }

  return (
    <TelaDeAjustes
      titulo="Configurações e privacidade"
      subtitulo={visitante ? 'Modo visitante' : `@${usuario?.apelido ?? ''}`}
      rotaDeVolta="/(tabs)/perfil">
      <Pressable
        onPress={() => router.push('/editar-perfil')}
        accessibilityRole="button"
        accessibilityLabel="Editar perfil"
        testID="cartao-perfil"
        style={({ pressed }) => [estilos.cartaoPerfil, pressed && estilos.pressionado]}>
        <Avatar url={usuario?.avatarUrl ?? null} nome={usuario?.nome ?? '?'} tamanho={52} borda />
        <View style={estilos.textosDoPerfil}>
          <Texto variante="destaque" numberOfLines={1}>
            {usuario?.nome ?? 'Torcedor'}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
            @{usuario?.apelido ?? 'visitante'} · editar perfil
          </Texto>
        </View>
        <Icone nome="avancar" tamanho={18} cor={cores.textoTerciario} />
      </Pressable>

      <GrupoDeAjustes titulo="Conta">
        <LinhaDeAjuste
          icone="perfil"
          titulo="Conta"
          descricao="Informações do cadastro e senha"
          destaque
          aoPressionar={() => router.push('/configuracoes/conta')}
          testID="link-conta"
        />
        <LinhaDeAjuste
          icone="historico"
          titulo="Centro de atividade"
          descricao="O que você assistiu, comentou e pesquisou"
          destaque
          aoPressionar={() => router.push('/configuracoes/atividade')}
          testID="link-atividade"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Visibilidade">
        <LinhaDeAjuste
          icone="cadeado"
          titulo="Conta privada"
          valor={ajustes.contaPrivada ? 'Ativada' : 'Desativada'}
          aoPressionar={() => router.push('/configuracoes/privacidade')}
          testID="link-privacidade"
        />
        <LinhaDeAjuste
          icone="bloquear"
          titulo="Contas bloqueadas"
          aoPressionar={() => router.push('/bloqueados')}
          testID="link-bloqueados"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Interações">
        <LinhaDeAjuste
          icone="comentarios"
          titulo="Comentários e menções"
          valor={ROTULO_PUBLICO[ajustes.comentariosDe]}
          aoPressionar={() => router.push('/configuracoes/interacoes')}
          testID="link-interacoes"
        />
        <LinhaDeAjuste
          icone="mensagens"
          titulo="Mensagens diretas"
          aoPressionar={() => router.push('/configuracoes/mensagens')}
          testID="link-mensagens"
        />
        <LinhaDeAjuste
          icone="sino"
          titulo="Notificações"
          aoPressionar={() => router.push('/notificacoes')}
          testID="link-notificacoes"
        />
        <LinhaDeAjuste
          icone="baixar"
          titulo="Downloads"
          valor={ajustes.permitirDownloads ? 'Permitidos' : 'Desativado'}
          aoPressionar={() => router.push('/configuracoes/downloads')}
          testID="link-downloads"
        />
        <LinhaDeAjuste
          icone="curtir"
          titulo="Vídeos curtidos"
          valor={ROTULO_CURTIDOS[ajustes.curtidosVisiveisPara]}
          aoPressionar={() => router.push('/configuracoes/curtidos')}
          testID="link-curtidos"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Cache e dados">
        <LinhaDeAjuste
          icone="armazenamento"
          titulo="Liberar espaço"
          aoPressionar={() => router.push('/configuracoes/espaco')}
          testID="link-espaco"
        />
        <LinhaDeAjuste
          icone="economia"
          titulo="Economizador de dados"
          valor={ligadoOuDesligado(ajustes.economizarDados)}
          aoPressionar={() => router.push('/configuracoes/dados')}
          testID="link-dados"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Suporte e sobre">
        <LinhaDeAjuste
          icone="ajuda"
          titulo="Suporte e sobre"
          descricao="Como o app funciona, versão e privacidade"
          aoPressionar={() => router.push('/configuracoes/sobre')}
          testID="link-sobre"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes
        rodape={
          demonstracao
            ? 'Modo demonstração: tudo fica salvo só neste aparelho.'
            : 'Conectado ao Supabase.'
        }>
        {demonstracao ? (
          <LinhaDeAjuste
            icone="reiniciar"
            titulo="Resetar demonstração"
            descricao="Volta o app ao estado inicial"
            aoPressionar={resetarDemonstracao}
            testID="botao-resetar-demo"
          />
        ) : null}
        <LinhaDeAjuste
          icone="sair"
          titulo="Sair da conta"
          cor={cores.erro}
          aoPressionar={confirmarSaida}
          testID="botao-sair"
        />
      </GrupoDeAjustes>
    </TelaDeAjustes>
  );
}

const estilos = StyleSheet.create({
  cartaoPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pressionado: { opacity: 0.85 },
  textosDoPerfil: { flex: 1, gap: 2 },
});
