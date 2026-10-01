import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GrupoDeAjustes, NotaDeAjuste, TelaDeAjustes } from '@/components/configuracoes';
import { Botao, Icone, Input, Texto } from '@/components/ui';
import { dataService } from '@/services/data';
import { EVENTOS, registrar } from '@/services/telemetria';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { mensagemDeErro } from '@/utils/erros';

/** A pessoa precisa digitar isto. Escolhido para não sair por engano nem por autocompletar. */
const CONFIRMACAO = 'EXCLUIR';

/** O que sai junto com a conta — listado antes, não depois. */
const O_QUE_SOME = [
  'Seus vídeos, fotos e resenhas, com os arquivos no servidor',
  'Comentários, curtidas e itens salvos',
  'Palpites, pontos no ranking e títulos do mês',
  'Conversas e mensagens enviadas',
  'Quem você segue e quem te segue',
];

/**
 * Excluir a conta.
 *
 * POR QUE ESTA TELA EXISTE
 *
 * Apple e Google recusam, na revisão, app com cadastro que não ofereça exclusão dentro do
 * próprio app — não vale e-mail nem formulário na web. A LGPD (art. 18, VI) chega no
 * mesmo lugar pelo direito à eliminação.
 *
 * POR QUE ELA É DESCONFORTÁVEL DE PROPÓSITO
 *
 * Exclusão é irreversível e o app não tem backup por usuário. Então a tela diz o que some
 * ANTES de oferecer o botão, e pede uma palavra digitada em vez de um toque de confirmação
 * — que é exatamente o tipo de gesto que se dá sem ler.
 */
export default function TelaDeExcluirConta() {
  const router = useRouter();
  const sessao = useAuthStore((s) => s.sessao);
  const sair = useAuthStore((s) => s.sair);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);

  const [digitado, setDigitado] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const confirmado = digitado.trim().toUpperCase() === CONFIRMACAO;

  const excluir = useMutation({
    mutationFn: () => dataService().excluirMinhaConta(),
    onSuccess: () => {
      registrar(EVENTOS.CONTA_EXCLUIDA);
      // `sair` limpa a sessão local e o cache; sem isto o app tentaria restaurar uma
      // conta que o servidor já não conhece e cairia numa tela sem perfil.
      void sair();
      mostrarAviso('Sua conta foi excluída.', 'sucesso');
      router.replace('/(auth)/login');
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  if (sessao?.visitante) {
    return (
      <TelaDeAjustes titulo="Excluir conta" rotaDeVolta="/configuracoes/conta">
        <NotaDeAjuste icone="info">
          O visitante não é uma conta: nada foi guardado no servidor. Saindo do modo
          visitante, tudo que você viu aqui some sozinho.
        </NotaDeAjuste>
        <View style={estilos.acoes}>
          <Botao titulo="Sair do modo visitante" variante="perigo" onPress={() => void sair()} largo />
        </View>
      </TelaDeAjustes>
    );
  }

  return (
    <TelaDeAjustes
      titulo="Excluir conta"
      subtitulo="Esta ação não tem volta"
      rotaDeVolta="/configuracoes/conta">
      <View style={estilos.alerta}>
        <Icone nome="alerta" tamanho={20} cor={cores.vermelhoVivo} />
        <Texto variante="corpo" style={estilos.flex}>
          Apagar a conta é permanente. Não guardamos cópia e não há como desfazer depois.
        </Texto>
      </View>

      <GrupoDeAjustes titulo="O que some junto">
        <View style={estilos.lista}>
          {O_QUE_SOME.map((item) => (
            <View key={item} style={estilos.item}>
              <Icone nome="fechar" tamanho={14} cor={cores.textoTerciario} />
              <Texto variante="corpo" cor={cores.textoSecundario} style={estilos.flex}>
                {item}
              </Texto>
            </View>
          ))}
        </View>
      </GrupoDeAjustes>

      <NotaDeAjuste icone="info">
        {`O seu apelido (@${sessao?.usuario.apelido ?? ''}) volta a ficar livre e pode ser usado ` +
          'por outra pessoa. Guardamos só a data da exclusão, sem e-mail e sem apelido, ' +
          'porque a lei pede o registro de que o pedido foi atendido.'}
      </NotaDeAjuste>

      <GrupoDeAjustes titulo={`Digite ${CONFIRMACAO} para confirmar`}>
        <View style={estilos.campo}>
          <Input
            value={digitado}
            onChangeText={setDigitado}
            placeholder={CONFIRMACAO}
            autoCapitalize="characters"
            autoCorrect={false}
            testID="campo-confirmacao-exclusao"
          />
        </View>
      </GrupoDeAjustes>

      {erro ? (
        <NotaDeAjuste atencao>{erro}</NotaDeAjuste>
      ) : null}

      <View style={estilos.acoes}>
        <Botao
          titulo="Excluir minha conta para sempre"
          variante="perigo"
          onPress={() => excluir.mutate()}
          disabled={!confirmado}
          carregando={excluir.isPending}
          largo
          testID="botao-excluir-conta"
        />
        <Botao
          titulo="Cancelar"
          variante="secundario"
          onPress={() => router.back()}
          largo
          testID="botao-cancelar-exclusao"
        />
      </View>
    </TelaDeAjustes>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    backgroundColor: cores.fundoCartao,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelhoVivo,
    borderRadius: raios.sm,
    padding: espacos.md,
    marginBottom: espacos.md,
  },
  lista: { gap: espacos.sm, padding: espacos.md },
  campo: { padding: espacos.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  acoes: { gap: espacos.sm, marginTop: espacos.lg },
});
