import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Icone, Texto } from '@/components/ui';
import { cores, espacos } from '@/theme';
import type { ResumoDeUsuario } from '@/types';

export interface AnelDeRasanteProps {
  usuario: ResumoDeUsuario;
  /** há rasantes ativos */
  ativo: boolean;
  /** todos já vistos: anel apagado */
  visto?: boolean;
  souEu?: boolean;
  tamanho?: number;
  rotulo?: string;
  aoPressionar: () => void;
  /** botão "+" (só no meu avatar) */
  aoAdicionar?: () => void;
  testID?: string;
}

/**
 * Avatar com o anel do rasante: vermelho vivo quando há vídeo novo, cinza quando já vi,
 * sem anel quando a pessoa não postou nada nas últimas 24 h. No meu avatar, o "+" grava um novo.
 */
export function AnelDeRasante({
  usuario,
  ativo,
  visto = false,
  souEu = false,
  tamanho = 62,
  rotulo,
  aoPressionar,
  aoAdicionar,
  testID,
}: AnelDeRasanteProps) {
  const corDoAnel = !ativo ? cores.borda : visto ? cores.textoTerciario : cores.vermelhoVivo;
  const espessura = ativo && !visto ? 3 : 2;
  return (
    <Pressable
      onPress={aoPressionar}
      style={estilos.item}
      accessibilityRole="button"
      accessibilityLabel={souEu ? 'Meus rasantes' : `Rasantes de @${usuario.apelido}`}
      testID={testID}>
      <View
        style={[
          estilos.anel,
          {
            width: tamanho + 8,
            height: tamanho + 8,
            borderRadius: (tamanho + 8) / 2,
            borderColor: corDoAnel,
            borderWidth: espessura,
          },
        ]}>
        <Avatar url={usuario.avatarUrl} nome={usuario.nome} tamanho={tamanho} />
        {souEu && aoAdicionar ? (
          <Pressable
            onPress={aoAdicionar}
            hitSlop={8}
            accessibilityLabel="Gravar rasante"
            style={estilos.mais}
            testID="botao-novo-rasante">
            <Icone nome="adicionar" tamanho={14} cor={cores.branco} />
          </Pressable>
        ) : null}
      </View>
      <Texto
        variante="legenda"
        cor={visto && ativo ? cores.textoTerciario : cores.textoSecundario}
        numberOfLines={1}
        style={[estilos.rotulo, { maxWidth: tamanho + 16 }]}>
        {rotulo ?? (souEu ? 'Você' : usuario.apelido)}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  item: { alignItems: 'center', gap: espacos.xs + 2 },
  anel: { alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
  mais: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: cores.vermelho,
    borderWidth: 2,
    borderColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: { textAlign: 'center' },
});
