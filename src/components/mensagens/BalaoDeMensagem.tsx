import { StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
import type { Mensagem } from '@/types';
import { formatarHora } from '@/utils/formatadores';

export interface BalaoDeMensagemProps {
  mensagem: Mensagem;
  minha: boolean;
  /** primeira de uma sequência do mesmo remetente (cantos mais retos entre elas) */
  primeiraDaSequencia: boolean;
  ultimaDaSequencia: boolean;
  /** "Visto" embaixo do balão: só na última mensagem minha, e só depois de lida */
  mostrarVisto?: boolean;
}

/** Balão do chat: vermelho à direita para as minhas, cinza à esquerda para as da outra pessoa. */
export function BalaoDeMensagem({
  mensagem,
  minha,
  primeiraDaSequencia,
  ultimaDaSequencia,
  mostrarVisto = false,
}: BalaoDeMensagemProps) {
  const pendente = mensagem.id.startsWith('temp-');
  const lida = !pendente && mensagem.lida;
  return (
    <View
      style={[
        estilos.linha,
        minha ? estilos.linhaMinha : estilos.linhaOutro,
        !ultimaDaSequencia && estilos.colada,
      ]}
      testID={`mensagem-${mensagem.id}`}>
      <View
        style={[
          estilos.balao,
          minha ? estilos.balaoMeu : estilos.balaoOutro,
          minha && !primeiraDaSequencia && estilos.meuCantoTopo,
          minha && !ultimaDaSequencia && estilos.meuCantoBaixo,
          !minha && !primeiraDaSequencia && estilos.outroCantoTopo,
          !minha && !ultimaDaSequencia && estilos.outroCantoBaixo,
          pendente && estilos.pendente,
        ]}>
        <Texto variante="corpo" cor={cores.texto}>
          {mensagem.texto}
        </Texto>
        <View style={estilos.rodape}>
          <Texto variante="legenda" cor={minha ? 'rgba(255,255,255,0.75)' : cores.textoTerciario}>
            {formatarHora(mensagem.criadoEm)}
          </Texto>
          {minha ? (
            <Icone
              nome={pendente ? 'relogio' : lida ? 'lido' : 'enviado'}
              tamanho={12}
              cor={lida ? cores.azulLido : 'rgba(255,255,255,0.75)'}
              testID={lida ? 'tique-lido' : 'tique-enviado'}
            />
          ) : null}
        </View>
      </View>
      {mostrarVisto ? (
        <Texto variante="legenda" cor={cores.textoTerciario} style={estilos.visto} testID="visto">
          Visto
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { paddingHorizontal: espacos.lg, marginBottom: espacos.sm },
  linhaMinha: { alignItems: 'flex-end' },
  linhaOutro: { alignItems: 'flex-start' },
  colada: { marginBottom: 2 },
  balao: {
    maxWidth: '80%',
    paddingHorizontal: espacos.md,
    paddingTop: espacos.sm,
    paddingBottom: espacos.xs + 2,
    borderRadius: raios.lg,
    gap: 2,
  },
  balaoMeu: { backgroundColor: cores.vermelho, borderBottomRightRadius: raios.sm },
  balaoOutro: {
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
    borderBottomLeftRadius: raios.sm,
  },
  meuCantoTopo: { borderTopRightRadius: raios.sm },
  meuCantoBaixo: { borderBottomRightRadius: raios.sm },
  outroCantoTopo: { borderTopLeftRadius: raios.sm },
  outroCantoBaixo: { borderBottomLeftRadius: raios.sm },
  pendente: { opacity: 0.7 },
  visto: { marginTop: 2, marginRight: 2 },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: espacos.xs,
  },
});
