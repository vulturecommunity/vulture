import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Icone, Texto } from '@/components/ui';
import { cores, espacos, raios } from '@/theme';
import type { Palpiteiro } from '@/types';
import { formatarContador } from '@/utils/formatadores';

/** Medalha do pódio; do 4º em diante mostra o número mesmo. */
export function corDaPosicao(posicao: number): string {
  if (posicao === 1) return cores.dourado;
  if (posicao === 2) return '#C0C4CC';
  if (posicao === 3) return '#B87333';
  return cores.textoTerciario;
}

function Variacao({ valor }: { valor: number }) {
  if (valor === 0) return null;
  const subiu = valor > 0;
  return (
    <View style={estilos.variacao}>
      <Icone
        nome={subiu ? 'tendencia' : 'chevronBaixo'}
        tamanho={11}
        cor={subiu ? cores.sucesso : cores.textoTerciario}
      />
      <Texto variante="legenda" cor={subiu ? cores.sucesso : cores.textoTerciario}>
        {Math.abs(valor)}
      </Texto>
    </View>
  );
}

export interface LinhaDoRankingProps {
  palpiteiro: Palpiteiro;
  /** destaca a linha de quem está olhando */
  realce?: boolean;
}

/** Uma posição do ranking: medalha, torcedor, aproveitamento e pontos. */
export const LinhaDoRanking = memo(function LinhaDoRanking({
  palpiteiro,
  realce,
}: Readonly<LinhaDoRankingProps>) {
  const { posicao, usuario, pontos, cravadas, palpites, sequencia, variacao, souEu } = palpiteiro;
  const destacada = realce ?? souEu;

  return (
    <View
      style={[estilos.linha, destacada && estilos.linhaMinha]}
      testID={`ranking-linha-${usuario.id}`}>
      <View style={estilos.posicao}>
        <Texto variante="corpoForte" cor={corDaPosicao(posicao)}>
          {posicao}
        </Texto>
      </View>

      <Avatar url={usuario.avatarUrl} nome={usuario.nome || usuario.apelido} tamanho={36} />

      <View style={estilos.identidade}>
        <View style={estilos.nomeLinha}>
          <Texto variante="corpoForte" numberOfLines={1} style={estilos.flex}>
            {souEu ? 'Você' : `@${usuario.apelido}`}
          </Texto>
          {sequencia >= 3 ? (
            <View style={estilos.sequencia}>
              <Icone nome="emAlta" tamanho={11} cor={cores.vermelhoVivo} />
              <Texto variante="legenda" cor={cores.vermelhoVivo}>
                {sequencia}
              </Texto>
            </View>
          ) : null}
        </View>
        <Texto variante="legenda" cor={cores.textoTerciario} numberOfLines={1}>
          {cravadas > 0 ? `${cravadas} cravada${cravadas > 1 ? 's' : ''} · ` : ''}
          {palpites} palpite{palpites === 1 ? '' : 's'}
        </Texto>
      </View>

      <Variacao valor={variacao} />

      <View style={estilos.pontos}>
        <Texto variante="destaque" cor={destacada ? cores.branco : cores.texto}>
          {formatarContador(pontos)}
        </Texto>
        <Texto variante="legenda" cor={cores.textoTerciario}>
          pts
        </Texto>
      </View>
    </View>
  );
});

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingVertical: espacos.sm,
    paddingHorizontal: espacos.md,
    borderRadius: raios.md,
  },
  linhaMinha: {
    backgroundColor: cores.vermelhoSuave,
    borderWidth: 1,
    borderColor: cores.vermelho,
  },
  posicao: { width: 26, alignItems: 'center' },
  identidade: { flex: 1, gap: 2 },
  nomeLinha: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  sequencia: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  variacao: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  pontos: { alignItems: 'flex-end', minWidth: 46 },
});
