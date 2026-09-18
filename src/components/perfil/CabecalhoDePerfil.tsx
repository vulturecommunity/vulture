import { StyleSheet, View } from 'react-native';

import { Avatar, Botao, Texto } from '@/components/ui';
import { ICONE_INTERESSE } from '@/constants/interesses';
import { cores, espacos } from '@/theme';
import type { Perfil } from '@/types';
import { formatarContador } from '@/utils/formatadores';

export interface CabecalhoDePerfilProps {
  perfil: Perfil;
  aoEditar?: () => void;
  aoSeguir?: () => void;
  aoMais?: () => void;
  ocupado?: boolean;
}

function Contador({ valor, rotulo, testID }: { valor: number; rotulo: string; testID?: string }) {
  return (
    <View style={estilos.contador}>
      <Texto variante="destaque" testID={testID}>
        {formatarContador(valor)}
      </Texto>
      <Texto variante="legenda" cor={cores.textoSecundario}>
        {rotulo}
      </Texto>
    </View>
  );
}

/** Topo do perfil: avatar, nome, contadores, bio, interesses e botão de ação. */
export function CabecalhoDePerfil({
  perfil,
  aoEditar,
  aoSeguir,
  aoMais,
  ocupado,
}: CabecalhoDePerfilProps) {
  return (
    <View style={estilos.container} testID="cabecalho-perfil">
      <Avatar url={perfil.avatarUrl} nome={perfil.nome} tamanho={92} borda />
      <Texto variante="subtitulo">@{perfil.apelido}</Texto>
      {perfil.nome !== perfil.apelido ? (
        <Texto variante="corpo" cor={cores.textoSecundario}>
          {perfil.nome}
        </Texto>
      ) : null}
      <View style={estilos.contadores}>
        <Contador valor={perfil.seguindo} rotulo="Seguindo" />
        <Contador valor={perfil.seguidores} rotulo="Seguidores" testID="total-seguidores" />
        <Contador valor={perfil.curtidasRecebidas} rotulo="Curtidas" />
      </View>
      {perfil.bio ? (
        <Texto variante="corpo" centralizado style={estilos.bio}>
          {perfil.bio}
        </Texto>
      ) : null}
      {perfil.interesses.length > 0 ? (
        <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
          {perfil.interesses.map((i) => `${ICONE_INTERESSE[i]} ${i}`).join('  ·  ')}
        </Texto>
      ) : null}
      <View style={estilos.acoes}>
        {perfil.souEu ? (
          <Botao
            titulo="Editar perfil"
            variante="secundario"
            onPress={aoEditar}
            style={estilos.botao}
            testID="botao-editar-perfil"
          />
        ) : (
          <>
            <Botao
              titulo={perfil.estouSeguindo ? 'Seguindo' : 'Seguir'}
              variante={perfil.estouSeguindo ? 'secundario' : 'primario'}
              onPress={aoSeguir}
              carregando={ocupado}
              style={estilos.botao}
              testID="botao-seguir"
            />
            <Botao titulo="•••" variante="secundario" onPress={aoMais} testID="botao-mais-perfil" />
          </>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.xl,
    paddingVertical: espacos.lg,
  },
  contadores: { flexDirection: 'row', gap: espacos.xxl, marginVertical: espacos.xs },
  contador: { alignItems: 'center' },
  bio: { maxWidth: 320 },
  acoes: { flexDirection: 'row', gap: espacos.sm, marginTop: espacos.xs },
  botao: { minWidth: 160 },
});
