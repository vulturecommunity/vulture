import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Botao, Icone, Texto } from '@/components/ui';
import { useChatDaLive } from '@/hooks/useLive';
import { modoDeLive } from '@/services/live';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import type { Live } from '@/types';
import { formatarContador } from '@/utils/formatadores';

import { ChatDaLive } from './ChatDaLive';
import { ReacoesFlutuantes } from './ReacoesFlutuantes';
import { VideoDaLive } from './VideoDaLive';

export interface SalaDaLiveProps {
  live: Live;
  anfitriao: boolean;
  aoSair: () => void;
  aoEncerrar?: () => void;
  encerrando?: boolean;
}

/**
 * Tela completa da live (usada por quem assiste e por quem transmite):
 * vídeo ao fundo, cabeçalho com anfitrião/espectadores, chat, reações e corações flutuantes.
 */
export function SalaDaLive({ live, anfitriao, aoSair, aoEncerrar, encerrando }: SalaDaLiveProps) {
  const insets = useSafeAreaInsets();
  const usuario = useAuthStore((s) => s.sessao?.usuario);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const modo = modoDeLive();
  const chat = useChatDaLive(live.id, live.espectadores, usuario?.id ?? null);
  const encerrada = chat.encerrada || !live.ativa;

  return (
    <View style={estilos.tela} testID={`sala-live-${live.id}`}>
      <VideoDaLive
        live={live}
        modo={modo}
        anfitriao={anfitriao}
        identidade={usuario?.id ?? 'anonimo'}
        nome={usuario?.apelido ?? 'torcedor'}
        aoErro={(m) => mostrarAviso(m, 'erro')}
      />

      <View
        style={[estilos.cabecalho, { paddingTop: insets.top + espacos.sm }]}
        pointerEvents="box-none">
        <View style={estilos.anfitriao}>
          <Avatar url={live.anfitriao.avatarUrl} nome={live.anfitriao.nome} tamanho={38} borda />
          <View style={estilos.encolher}>
            <Texto variante="corpoForte" numberOfLines={1}>
              @{live.anfitriao.apelido}
            </Texto>
            <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
              {live.titulo}
            </Texto>
          </View>
        </View>
        <View style={estilos.direita}>
          <View style={[estilos.badge, encerrada ? estilos.badgeEncerrada : estilos.badgeAoVivo]}>
            {!encerrada ? <View style={estilos.ponto} /> : null}
            <Texto variante="rotulo">{encerrada ? 'ENCERRADA' : 'AO VIVO'}</Texto>
          </View>
          <View style={estilos.badge}>
            <Icone nome="olho" tamanho={12} cor={cores.branco} />
            <Texto variante="legenda" testID="total-espectadores">
              {formatarContador(chat.espectadores)}
            </Texto>
          </View>
          <Pressable
            onPress={aoSair}
            hitSlop={12}
            accessibilityLabel="Sair da live"
            style={estilos.fechar}
            testID="botao-sair-live">
            <Icone nome="fechar" tamanho={18} cor={cores.branco} />
          </Pressable>
        </View>
      </View>

      {modo === 'simulado' ? (
        <View style={[estilos.avisoSimulado, { top: insets.top + 66 }]} pointerEvents="none">
          <Icone nome="laboratorio" tamanho={12} cor={cores.textoSecundario} />
          <Texto variante="legenda" cor={cores.textoSecundario}>
            {anfitriao ? 'Preview local · modo simulado' : 'Modo simulado (sem WebRTC no Expo Go)'}
          </Texto>
        </View>
      ) : null}

      <ReacoesFlutuantes reacoes={chat.reacoes} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[estilos.rodape, { paddingBottom: insets.bottom + espacos.md }]}
        pointerEvents="box-none">
        <ChatDaLive
          mensagens={chat.mensagens}
          aoEnviar={async (t) => {
            try {
              await chat.enviarMensagem(t);
            } catch (e) {
              mostrarAviso(e instanceof Error ? e.message : 'Falha ao enviar', 'erro');
            }
          }}
          aoReagir={async (r) => {
            try {
              await chat.enviarReacao(r);
            } catch (e) {
              mostrarAviso(e instanceof Error ? e.message : 'Falha ao reagir', 'erro');
            }
          }}
          desabilitado={encerrada}
        />
        {anfitriao && aoEncerrar ? (
          <View style={estilos.encerrar}>
            <Botao
              titulo="Encerrar live"
              variante="perigo"
              onPress={aoEncerrar}
              carregando={encerrando}
              largo
              testID="botao-encerrar-live"
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.pretoPuro },
  cabecalho: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.md,
    gap: espacos.sm,
  },
  anfitriao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    flexShrink: 1,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    borderRadius: raios.redondo,
    paddingRight: espacos.md,
    padding: 3,
  },
  encolher: { flexShrink: 1 },
  direita: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    paddingHorizontal: espacos.sm,
    paddingVertical: 5,
    borderRadius: raios.sm,
  },
  badgeAoVivo: { backgroundColor: cores.vermelho, borderColor: cores.vermelho },
  badgeEncerrada: { backgroundColor: cores.fundoCartao },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.branco },
  fechar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.vidro,
    borderWidth: 1,
    borderColor: cores.bordaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoSimulado: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs,
    backgroundColor: cores.vidro,
    paddingHorizontal: espacos.md,
    paddingVertical: 5,
    borderRadius: raios.redondo,
  },
  rodape: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: espacos.sm },
  encerrar: { paddingHorizontal: espacos.lg },
});
