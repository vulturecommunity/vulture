import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ViewShotRef } from 'react-native-view-shot';

import { Botao, Carregando, Icone, Sheet, Texto } from '@/components/ui';
import { CardDoPalpite } from '@/components/arquibancada/CardDoPalpite';
import { useResumoDosPalpites, useSalvarPalpite } from '@/hooks/usePalpites';
import type { Partida } from '@/services/partidas';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos, raios } from '@/theme';
import type { Palpite, ResumoDePalpites } from '@/types';
import { abrirCompartilhamento, compartilharPalpite } from '@/utils/compartilhar';
import { compartilharImagemDoPalpite } from '@/utils/compartilharImagem';
import { mensagemDeErro } from '@/utils/erros';
import { diaDaSemana, formatarDataHora } from '@/utils/formatadores';
import { GOLS_MAXIMOS_NO_PALPITE, palpiteAberto, siglasDa } from '@/utils/palpites';

export interface SheetDePalpiteProps {
  partida: Partida | null;
  palpite?: Palpite;
  aoFechar: () => void;
}

export function SheetDePalpite({ partida, palpite, aoFechar }: SheetDePalpiteProps) {
  return (
    <Sheet visivel={!!partida} aoFechar={aoFechar} titulo="Palpite" altura="auto">
      {partida ? <ConteudoDoPalpite key={partida.id} partida={partida} palpite={palpite} /> : null}
    </Sheet>
  );
}

function Placar({
  time,
  sigla,
  valor,
  aoMudar,
  editavel,
  testID,
}: {
  time: string;
  sigla: string;
  valor: number;
  aoMudar: (v: number) => void;
  editavel: boolean;
  testID: string;
}) {
  const botao = (delta: number) => (
    <Pressable
      onPress={() => aoMudar(Math.min(GOLS_MAXIMOS_NO_PALPITE, Math.max(0, valor + delta)))}
      disabled={!editavel || (delta < 0 ? valor === 0 : valor === GOLS_MAXIMOS_NO_PALPITE)}
      style={({ pressed }) => [
        estilos.passo,
        pressed && estilos.passoPressionado,
        !editavel && estilos.invisivel,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${delta > 0 ? 'Mais' : 'Menos'} um gol para ${time}`}
      testID={`${testID}-${delta > 0 ? 'mais' : 'menos'}`}>
      <Icone nome={delta > 0 ? 'adicionar' : 'menos'} tamanho={18} cor={cores.texto} />
    </Pressable>
  );
  return (
    <View style={estilos.time}>
      <Texto variante="destaque" style={estilos.sigla}>
        {sigla}
      </Texto>
      <Texto variante="legenda" cor={cores.textoSecundario} numberOfLines={1} centralizado>
        {time}
      </Texto>
      <View style={estilos.controle}>
        {botao(-1)}
        <Texto variante="titulo" style={estilos.gols} testID={testID}>
          {valor}
        </Texto>
        {botao(1)}
      </View>
    </View>
  );
}

function Barra({ rotulo, votos, total }: { rotulo: string; votos: number; total: number }) {
  const fracao = total > 0 ? votos / total : 0;
  return (
    <View style={estilos.barraLinha}>
      <Texto variante="pequeno" style={estilos.barraRotulo} numberOfLines={1}>
        {rotulo}
      </Texto>
      <View style={estilos.barraTrilho}>
        <View style={[estilos.barraCheia, { width: `${Math.round(fracao * 100)}%` }]} />
      </View>
      <Texto variante="pequeno" cor={cores.textoSecundario} style={estilos.barraValor}>
        {Math.round(fracao * 100)}%
      </Texto>
    </View>
  );
}

function OQueATorcidaAposta({
  resumo,
  siglas,
}: {
  resumo: ResumoDePalpites;
  siglas: { mandante: string; visitante: string };
}) {
  if (resumo.total === 0) {
    return (
      <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
        Ninguém palpitou ainda. Seja o primeiro!
      </Texto>
    );
  }
  const popular = resumo.placarPopular;
  return (
    <View style={estilos.torcida} testID="resumo-palpites">
      <Texto variante="rotulo" cor={cores.textoSecundario}>
        O que a torcida aposta · {resumo.total} {resumo.total === 1 ? 'palpite' : 'palpites'}
      </Texto>
      <Barra
        rotulo={`${siglas.mandante} vence`}
        votos={resumo.vitoriaMandante}
        total={resumo.total}
      />
      <Barra rotulo="Empate" votos={resumo.empate} total={resumo.total} />
      <Barra
        rotulo={`${siglas.visitante} vence`}
        votos={resumo.vitoriaVisitante}
        total={resumo.total}
      />
      {popular ? (
        <Texto variante="pequeno" cor={cores.textoSecundario}>
          Placar mais apostado:{' '}
          <Texto variante="corpoForte">
            {siglas.mandante} {popular.golsMandante} x {popular.golsVisitante} {siglas.visitante}
          </Texto>{' '}
          ({Math.round((popular.votos / resumo.total) * 100)}%)
        </Texto>
      ) : null}
    </View>
  );
}

/** A aposta da torcida só aparece depois do palpite (ou com o jogo fechado), para não influenciar. */
function PainelDaTorcida({
  partidaId,
  siglas,
  revelar,
}: {
  partidaId: string;
  siglas: { mandante: string; visitante: string };
  revelar: boolean;
}) {
  const resumo = useResumoDosPalpites(partidaId, revelar);
  if (!revelar) {
    return (
      <Texto variante="legenda" cor={cores.textoTerciario} centralizado>
        Depois do seu palpite você vê o que a torcida está apostando.
      </Texto>
    );
  }
  if (resumo.isLoading) return <Carregando telaCheia={false} />;
  return resumo.data ? <OQueATorcidaAposta resumo={resumo.data} siglas={siglas} /> : null;
}

function ConteudoDoPalpite({ partida, palpite }: { partida: Partida; palpite?: Palpite }) {
  const siglas = siglasDa(partida);
  const aberto = palpiteAberto(partida);
  const [mandante, setMandante] = useState(palpite?.golsMandante ?? 0);
  const [visitante, setVisitante] = useState(palpite?.golsVisitante ?? 0);
  const salvar = useSalvarPalpite();
  const eu = useAuthStore((s) => s.sessao?.usuario);
  const mudou =
    !palpite || palpite.golsMandante !== mandante || palpite.golsVisitante !== visitante;

  const cardRef = useRef<ViewShotRef>(null);

  /**
   * Tenta a imagem primeiro e cai no link se não der.
   *
   * A imagem funciona no Instagram Stories e no X, onde link é texto cinza que ninguém
   * toca. O link funciona em todo lugar e gera card no WhatsApp. Tentar a imagem e cair
   * no link cobre os dois sem perguntar nada a quem está compartilhando.
   */
  const convidar = useCallback(async () => {
    const porImagem = await compartilharImagemDoPalpite(cardRef.current);
    if (porImagem.compartilhou || porImagem.motivo === 'cancelado') return;

    await abrirCompartilhamento(
      compartilharPalpite({
        partidaId: partida.id,
        mandante: siglas.mandante,
        visitante: siglas.visitante,
        golsMandante: mandante,
        golsVisitante: visitante,
        apelido: eu?.apelido ?? 'torcedor',
      }),
    );
  }, [partida.id, siglas.mandante, siglas.visitante, mandante, visitante, eu?.apelido]);

  return (
    <View style={estilos.conteudo}>
      <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
        {partida.competicao}
        {partida.fase ? ` · ${partida.fase}` : ''} · {diaDaSemana(partida.dataHora)}{' '}
        {formatarDataHora(partida.dataHora)}
      </Texto>

      <View style={estilos.placar}>
        <Placar
          time={partida.mandante}
          sigla={siglas.mandante}
          valor={mandante}
          aoMudar={setMandante}
          editavel={aberto}
          testID="gols-mandante"
        />
        <Texto variante="subtitulo" cor={cores.textoTerciario}>
          x
        </Texto>
        <Placar
          time={partida.visitante}
          sigla={siglas.visitante}
          valor={visitante}
          aoMudar={setVisitante}
          editavel={aberto}
          testID="gols-visitante"
        />
      </View>

      {aberto ? (
        <>
          <Botao
            titulo={palpite ? 'Trocar palpite' : 'Confirmar palpite'}
            onPress={() =>
              salvar.mutate({
                partidaId: partida.id,
                inicioDaPartida: partida.dataHora,
                golsMandante: mandante,
                golsVisitante: visitante,
              })
            }
            carregando={salvar.isPending}
            disabled={!mudou}
            largo
            testID="botao-salvar-palpite"
          />
          {/* Só depois de cravado: convidar para um palpite que você ainda não deu é vazio. */}
          {palpite && !mudou ? (
            <>
              <Botao
                titulo="Provocar a galera"
                variante="secundario"
                onPress={() => void convidar()}
                largo
                testID="botao-compartilhar-palpite"
              />
              {/* fora da tela: existe só para ser fotografado na hora de compartilhar */}
              <CardDoPalpite
                ref={cardRef}
                mandante={siglas.mandante}
                visitante={siglas.visitante}
                golsMandante={mandante}
                golsVisitante={visitante}
                apelido={eu?.apelido ?? 'torcedor'}
                competicao={partida.competicao}
                quando={formatarDataHora(partida.dataHora)}
              />
            </>
          ) : null}
        </>
      ) : (
        <Texto variante="pequeno" cor={cores.textoTerciario} centralizado>
          {palpite ? 'Palpites encerrados. Boa sorte!' : 'Palpites encerrados: a bola já rolou.'}
        </Texto>
      )}
      {salvar.isError ? (
        <Texto variante="pequeno" cor={cores.erro} centralizado>
          {mensagemDeErro(salvar.error)}
        </Texto>
      ) : null}
      {salvar.isSuccess && !mudou ? (
        <Texto variante="pequeno" cor={cores.sucesso} centralizado testID="palpite-registrado">
          Palpite registrado! Cravar o placar vale 3 pontos; acertar o vencedor, 1.
        </Texto>
      ) : null}

      <PainelDaTorcida
        partidaId={partida.id}
        siglas={siglas}
        revelar={!!palpite || !aberto || salvar.isSuccess}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: espacos.lg, gap: espacos.lg },
  placar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espacos.md },
  time: { flex: 1, alignItems: 'center', gap: 2 },
  sigla: { letterSpacing: 1 },
  controle: { flexDirection: 'row', alignItems: 'center', gap: espacos.md, marginTop: espacos.sm },
  gols: { minWidth: 36, textAlign: 'center' },
  passo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passoPressionado: { backgroundColor: cores.vermelhoSuave, borderColor: cores.vermelho },
  invisivel: { opacity: 0 },
  torcida: {
    gap: espacos.sm,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoCartao,
  },
  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  barraRotulo: { width: 86 },
  barraTrilho: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: cores.borda,
    overflow: 'hidden',
  },
  barraCheia: { height: 8, borderRadius: 4, backgroundColor: cores.vermelho },
  barraValor: { width: 38, textAlign: 'right' },
});
