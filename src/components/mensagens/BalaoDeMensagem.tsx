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
}

/** Balão do chat: vermelho à direita para as minhas, cinza à esquerda para as da outra pessoa. */
export function BalaoDeMensagem({
  mensagem,
  minha,
  primeiraDaSequencia,
  ultimaDaSequencia,
}: BalaoDeMensagemProps) {
  const pendente = mensagem.id.startsWith('temp-');
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
              nome={pendente ? 'relogio' : mensagem.lida ? 'lido' : 'enviado'}
              tamanho={12}
              cor={mensagem.lida ? cores.branco : 'rgba(255,255,255,0.75)'}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', paddingHorizontal: espacos.lg, marginBottom: espacos.sm },
  linhaMinha: { justifyContent: 'flex-end' },
  linhaOutro: { justifyContent: 'flex-start' },
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
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: espacos.xs,
  },
});
