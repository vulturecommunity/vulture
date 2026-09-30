import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import type { Partida } from '@/services/partidas';
import { cores, espacos, raios } from '@/theme';
import type { Palpite } from '@/types';
import { diaDaSemana, formatarHora } from '@/utils/formatadores';
import {
  avaliarPalpite,
  palpiteAberto,
  pontosDoPalpite,
  resultadoDoFlamengo,
  siglasDa,
} from '@/utils/palpites';

export interface CartaoDeJogoProps {
  partida: Partida;
  palpite?: Palpite;
  agora: Date;
  aoPalpitar: (partida: Partida) => void;
  aoVerResenha: (partida: Partida) => void;
}

const COR_DO_RESULTADO = { V: cores.sucesso, E: cores.aviso, D: cores.erro } as const;

/** O selo do palpite muda com o jogo: convite → palpite feito → cravou/errou. */
function SeloDoPalpite({
  partida,
  palpite,
  agora,
}: {
  partida: Partida;
  palpite?: Palpite;
  agora: Date;
}) {
  const aberto = palpiteAberto(partida, agora);
  const placarDoPalpite = palpite ? `${palpite.golsMandante} x ${palpite.golsVisitante}` : '';

  if (aberto && !palpite) {
    return (
      <View style={[estilos.selo, estilos.seloConvite]}>
        <Icone nome="palpite" tamanho={14} cor={cores.vermelhoVivo} />
        <Texto variante="legenda" cor={cores.vermelhoVivo}>
          Dar palpite
        </Texto>
      </View>
    );
  }
  if (!palpite) {
    return (
      <View style={estilos.selo}>
        <Icone nome="grafico" tamanho={13} cor={cores.textoTerciario} />
        <Texto variante="legenda" cor={cores.textoTerciario}>
          Palpites da torcida
        </Texto>
      </View>
    );
  }
  if (partida.status === 'encerrada' && partida.placar) {
    // `resultado`/`pontos` vêm da apuração no servidor quando ela já rodou (e só ela sabe
    // se o jogo valia em dobro); enquanto não rodou, a conta local dá o mesmo número.
    const resultado = palpite.resultado ?? avaliarPalpite(palpite, partida.placar);
    const pontos = pontosDoPalpite(palpite, partida.placar);
    const { texto, cor }: { texto: string; cor: string } = {
      cravou: { texto: `Cravou ${placarDoPalpite}! +${pontos}`, cor: cores.sucesso },
      saldo: { texto: `Acertou o saldo +${pontos}`, cor: cores.sucesso },
      vencedor: { texto: `Acertou o vencedor +${pontos}`, cor: cores.aviso },
      errou: { texto: `Seu palpite: ${placarDoPalpite}`, cor: cores.textoTerciario },
    }[resultado];
    return (
      <View style={estilos.selo} testID={`resultado-palpite-${partida.id}`}>
        <Icone nome={resultado === 'errou' ? 'palpite' : 'ok'} tamanho={13} cor={cor} />
        <Texto variante="legenda" cor={cor}>
          {texto}
        </Texto>
      </View>
    );
  }
  return (
    <View style={[estilos.selo, aberto && estilos.seloFeito]}>
      <Icone nome="palpite" tamanho={13} cor={cores.texto} />
      <Texto variante="legenda">
        Seu palpite: {placarDoPalpite}
        {aberto ? ' · trocar' : ''}
      </Texto>
    </View>
  );
}

/** Uma partida do calendário: data, confronto, placar (V/E/D), palpite e atalho para a resenha. */
export const CartaoDeJogo = memo(function CartaoDeJogo({
  partida,
  palpite,
  agora,
  aoPalpitar,
  aoVerResenha,
}: CartaoDeJogoProps) {
  const siglas = siglasDa(partida);
  const resultado = resultadoDoFlamengo(partida);
  const aoVivo = partida.status === 'ao_vivo';
  const dia = new Date(partida.dataHora).getDate().toString().padStart(2, '0');
  const detalhes = [formatarHora(partida.dataHora), partida.estadio, partida.nota]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[estilos.cartao, aoVivo && estilos.cartaoAoVivo]} testID={`jogo-${partida.id}`}>
      <View style={estilos.data}>
        <Texto variante="rotulo" cor={aoVivo ? cores.vermelhoVivo : cores.textoTerciario}>
          {diaDaSemana(partida.dataHora)}
        </Texto>
        <Texto variante="subtitulo">{dia}</Texto>
      </View>

      <View style={estilos.corpo}>
        <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1}>
          {partida.competicao.toUpperCase()}
          {partida.fase ? ` · ${partida.fase}` : ''}
        </Texto>
        <View style={estilos.confronto}>
          <Texto variante="destaque" style={estilos.sigla}>
            {siglas.mandante}
          </Texto>
          {partida.placar ? (
            <Texto variante="destaque" cor={aoVivo ? cores.vermelhoVivo : cores.texto}>
              {partida.placar.mandante} – {partida.placar.visitante}
            </Texto>
          ) : (
            <Texto variante="pequeno" cor={cores.textoTerciario}>
              vs
            </Texto>
          )}
          <Texto variante="destaque" style={estilos.sigla}>
            {siglas.visitante}
          </Texto>
          {resultado ? (
            <View
              style={[estilos.resultado, { backgroundColor: COR_DO_RESULTADO[resultado] }]}
              testID={`resultado-${partida.id}`}>
              <Texto variante="legenda" cor={cores.preto} style={estilos.resultadoTexto}>
                {resultado}
              </Texto>
            </View>
          ) : aoVivo ? (
            <View style={estilos.aoVivo}>
              <View style={estilos.ponto} />
              <Texto variante="legenda" cor={cores.vermelhoVivo}>
                AO VIVO{partida.minuto ? ` ${partida.minuto}'` : ''}
              </Texto>
            </View>
          ) : null}
        </View>
        <Texto variante="pequeno" cor={cores.textoTerciario} numberOfLines={1}>
          {detalhes}
        </Texto>

        <View style={estilos.acoes}>
          <Pressable
            onPress={() => aoPalpitar(partida)}
            accessibilityRole="button"
            accessibilityLabel={`Palpite de ${siglas.mandante} x ${siglas.visitante}`}
            hitSlop={6}
            testID={`palpitar-${partida.id}`}>
            <SeloDoPalpite partida={partida} palpite={palpite} agora={agora} />
          </Pressable>
          <Pressable
            onPress={() => aoVerResenha(partida)}
            accessibilityRole="button"
            accessibilityLabel={`Resenha de ${siglas.mandante} x ${siglas.visitante}`}
            hitSlop={6}
            style={estilos.selo}
            testID={`resenha-${partida.id}`}>
            <Icone nome="comentarios" tamanho={13} cor={cores.textoSecundario} />
            <Texto variante="legenda" cor={cores.textoSecundario}>
              Resenha
            </Texto>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    gap: espacos.md,
    marginHorizontal: espacos.lg,
    marginBottom: espacos.sm,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaoAoVivo: { borderColor: cores.vermelho },
  data: {
    width: 44,
    alignItems: 'center',
    paddingRight: espacos.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: cores.borda,
  },
  corpo: { flex: 1, gap: 3 },
  confronto: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  sigla: { letterSpacing: 0.8 },
  resultado: {
    minWidth: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  resultadoTexto: { fontWeight: '900' },
  aoVivo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: cores.vermelhoVivo },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm, marginTop: espacos.xs },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: espacos.sm,
    paddingVertical: 4,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoCartao,
  },
  seloConvite: {
    backgroundColor: cores.vermelhoSuave,
    borderWidth: 1,
    borderColor: cores.vermelho,
  },
  seloFeito: { borderWidth: 1, borderColor: cores.bordaClara },
});
