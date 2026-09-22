import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Botao, Icone, Listras, Texto } from '@/components/ui';
import { ICONE_INTERESSE } from '@/constants/interesses';
import { cores, espacos, raios } from '@/theme';
import type { Perfil } from '@/types';
import { formatarContador } from '@/utils/formatadores';

export interface CabecalhoDePerfilProps {
  perfil: Perfil;
  aoEditar?: () => void;
  aoSeguir?: () => void;
  aoMais?: () => void;
  /** abrir conversa privada (perfil de outra pessoa) */
  aoMensagem?: () => void;
  ocupado?: boolean;
  /** rasantes ativos da pessoa: anel no avatar e toque abre o visualizador */
  rasante?: { ativo: boolean; visto: boolean } | null;
  aoAbrirRasantes?: () => void;
  /** "+" no meu avatar: gravar um rasante */
  aoNovoRasante?: () => void;
}

function Contador({ valor, rotulo, testID }: { valor: number; rotulo: string; testID?: string }) {
  return (
    <View style={estilos.contador}>
      <Texto variante="destaque" testID={testID}>
        {formatarContador(valor)}
      </Texto>
      <Texto variante="rotulo" cor={cores.textoSecundario}>
        {rotulo}
      </Texto>
    </View>
  );
}

/** Topo do perfil: faixa da identidade, avatar, nome, contadores, bio, interesses e ações. */
export function CabecalhoDePerfil({
  perfil,
  aoEditar,
  aoSeguir,
  aoMais,
  aoMensagem,
  ocupado,
  rasante,
  aoAbrirRasantes,
  aoNovoRasante,
}: CabecalhoDePerfilProps) {
  const temRasante = !!rasante?.ativo;
  const corDoAnel = !temRasante
    ? cores.transparente
    : rasante?.visto
      ? cores.textoTerciario
      : cores.vermelhoVivo;
  const rotuloAvatar = temRasante
    ? perfil.souEu
      ? 'Ver meus rasantes'
      : `Ver rasantes de @${perfil.apelido}`
    : perfil.souEu
      ? 'Gravar rasante'
      : undefined;
  return (
    <View style={estilos.container} testID="cabecalho-perfil">
      <Listras altura={56} faixas={22} style={estilos.faixa} />
      <View style={estilos.corpo}>
        <View style={estilos.linhaTopo}>
          <Pressable
            onPress={temRasante ? aoAbrirRasantes : perfil.souEu ? aoNovoRasante : undefined}
            disabled={!temRasante && !perfil.souEu}
            accessibilityRole={temRasante || perfil.souEu ? 'button' : undefined}
            accessibilityLabel={rotuloAvatar}
            style={[estilos.avatar, { borderColor: corDoAnel }]}
            testID="avatar-perfil">
            <Avatar url={perfil.avatarUrl} nome={perfil.nome} tamanho={88} borda={!temRasante} />
            {perfil.souEu && aoNovoRasante ? (
              <Pressable
                onPress={aoNovoRasante}
                hitSlop={8}
                accessibilityLabel="Gravar rasante"
                style={estilos.maisRasante}
                testID="botao-novo-rasante-perfil">
                <Icone nome="adicionar" tamanho={16} cor={cores.branco} />
              </Pressable>
            ) : null}
          </Pressable>
          <View style={estilos.acoes}>
            {perfil.souEu ? (
              <Botao
                titulo="Editar perfil"
                variante="contorno"
                tamanho="pequeno"
                icone={<Icone nome="editar" tamanho={14} cor={cores.texto} />}
                onPress={aoEditar}
                testID="botao-editar-perfil"
              />
            ) : (
              <>
                <Botao
                  titulo={perfil.estouSeguindo ? 'Seguindo' : 'Seguir'}
                  variante={perfil.estouSeguindo ? 'contorno' : 'primario'}
                  tamanho="pequeno"
                  onPress={aoSeguir}
                  carregando={ocupado}
                  style={estilos.botaoSeguir}
                  testID="botao-seguir"
                />
                {aoMensagem ? (
                  <Pressable
                    onPress={aoMensagem}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Enviar mensagem"
                    style={estilos.botaoMais}
                    testID="botao-mensagem-perfil">
                    <Icone nome="mensagens" tamanho={18} cor={cores.texto} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={aoMais}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Mais opções"
                  style={estilos.botaoMais}
                  testID="botao-mais-perfil">
                  <Icone nome="mais" tamanho={18} cor={cores.texto} />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={estilos.nomes}>
          <Texto variante="subtitulo">@{perfil.apelido}</Texto>
          {perfil.nome !== perfil.apelido ? (
            <Texto variante="corpo" cor={cores.textoSecundario}>
              {perfil.nome}
            </Texto>
          ) : null}
        </View>

        {perfil.bio ? <Texto variante="corpo">{perfil.bio}</Texto> : null}

        {perfil.interesses.length > 0 ? (
          <View style={estilos.interesses}>
            {perfil.interesses.map((i) => (
              <View key={i} style={estilos.interesse}>
                <Icone nome={ICONE_INTERESSE[i]} tamanho={12} cor={cores.vermelhoVivo} />
                <Texto variante="legenda" cor={cores.textoSecundario}>
                  {i}
                </Texto>
              </View>
            ))}
          </View>
        ) : null}

        <View style={estilos.contadores}>
          <Contador valor={perfil.seguindo} rotulo="Seguindo" />
          <View style={estilos.divisor} />
          <Contador valor={perfil.seguidores} rotulo="Seguidores" testID="total-seguidores" />
          <View style={estilos.divisor} />
          <Contador valor={perfil.curtidasRecebidas} rotulo="Curtidas" />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { backgroundColor: cores.fundo },
  faixa: { borderRadius: 0, opacity: 0.9 },
  corpo: { paddingHorizontal: espacos.lg, gap: espacos.md, marginTop: -40 },
  linhaTopo: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm, paddingBottom: espacos.xs },
  botaoSeguir: { minWidth: 96 },
  avatar: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundo,
  },
  maisRasante: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: cores.vermelho,
    borderWidth: 2,
    borderColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoMais: {
    width: 36,
    height: 36,
    borderRadius: raios.sm + 2,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.fundoElevado,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nomes: { gap: 2 },
  interesses: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm },
  interesse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs,
    paddingHorizontal: espacos.sm,
    paddingVertical: 4,
    borderRadius: raios.sm,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  contadores: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raios.md,
    paddingVertical: espacos.md,
    marginTop: espacos.xs,
  },
  contador: { flex: 1, alignItems: 'center', gap: 2 },
  divisor: { width: 1, height: 28, backgroundColor: cores.borda },
});
