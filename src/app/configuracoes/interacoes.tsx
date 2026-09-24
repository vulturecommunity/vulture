import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  EscolhaDeOpcao,
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
  type OpcaoDeEscolha,
} from '@/components/configuracoes';
import { Icone, Input, Texto } from '@/components/ui';
import { useAjustesStore, type Publico } from '@/stores/ajustesStore';
import { cores, espacos, raios } from '@/theme';

const OPCOES_DE_COMENTARIO: OpcaoDeEscolha<Publico>[] = [
  { valor: 'todos', titulo: 'Todos', descricao: 'Qualquer torcedor comenta nos seus vídeos' },
  { valor: 'seguidores', titulo: 'Seguidores', descricao: 'Só quem te segue entra na resenha' },
  { valor: 'ninguem', titulo: 'Ninguém', descricao: 'Comentários desligados nos seus vídeos' },
];

const OPCOES_DE_MENCAO: OpcaoDeEscolha<Publico>[] = [
  { valor: 'todos', titulo: 'Todos', descricao: 'Qualquer um pode escrever o seu @' },
  { valor: 'seguidores', titulo: 'Seguidores', descricao: 'Só quem te segue te marca' },
  { valor: 'ninguem', titulo: 'Ninguém', descricao: 'Ninguém te marca em posts e comentários' },
];

/** Comentários e menções: quem fala com você e o que fica escondido. */
export default function TelaDeInteracoes() {
  const {
    comentariosDe,
    mencoesDe,
    filtrarComentarios,
    palavrasFiltradas,
    definir,
    adicionarPalavra,
    removerPalavra,
  } = useAjustesStore();
  const [palavra, setPalavra] = useState('');

  function adicionar() {
    adicionarPalavra(palavra);
    setPalavra('');
  }

  return (
    <TelaDeAjustes titulo="Comentários e menções" subtitulo="Quem fala com você">
      <GrupoDeAjustes titulo="Permitir comentários de">
        <EscolhaDeOpcao
          opcoes={OPCOES_DE_COMENTARIO}
          selecionada={comentariosDe}
          aoEscolher={(v) => definir('comentariosDe', v)}
          testID="opcao-comentarios"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Filtros de comentários">
        <LinhaDeAjuste
          icone="escudo"
          titulo="Esconder comentários indesejados"
          descricao="Some com o que tiver as palavras da sua lista"
          destaque={filtrarComentarios}
          ligado={filtrarComentarios}
          aoAlternar={(v) => definir('filtrarComentarios', v)}
          testID="switch-filtro"
        />
      </GrupoDeAjustes>

      <View style={estilos.palavras}>
        <Texto variante="rotulo" cor={cores.textoTerciario}>
          Palavras filtradas
        </Texto>
        <Input
          value={palavra}
          onChangeText={setPalavra}
          placeholder="Digite uma palavra e confirme"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={adicionar}
          maxLength={24}
          icone="escrever"
          ajuda={
            filtrarComentarios
              ? 'Comentários com essas palavras ficam escondidos para você.'
              : 'Ligue o filtro acima para a lista valer.'
          }
          testID="campo-palavra-filtrada"
        />
        {palavrasFiltradas.length > 0 ? (
          <View style={estilos.chips}>
            {palavrasFiltradas.map((p) => (
              <Pressable
                key={p}
                onPress={() => removerPalavra(p)}
                accessibilityRole="button"
                accessibilityLabel={`Remover ${p}`}
                style={({ pressed }) => [estilos.chip, pressed && estilos.chipPressionado]}>
                <Texto variante="pequeno">{p}</Texto>
                <Icone nome="fechar" tamanho={13} cor={cores.textoTerciario} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <GrupoDeAjustes titulo="Permitir menções de">
        <EscolhaDeOpcao
          opcoes={OPCOES_DE_MENCAO}
          selecionada={mencoesDe}
          aoEscolher={(v) => definir('mencoesDe', v)}
          testID="opcao-mencoes"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste>
        O filtro esconde o comentário para você, não apaga para quem escreveu. Para tirar alguém de
        vez do seu caminho, bloqueie a conta.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}

const estilos = StyleSheet.create({
  palavras: { gap: espacos.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.sm,
    borderRadius: raios.redondo,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipPressionado: { borderColor: cores.vermelho },
});
