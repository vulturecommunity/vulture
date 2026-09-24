import {
  EscolhaDeOpcao,
  GrupoDeAjustes,
  NotaDeAjuste,
  TelaDeAjustes,
  type OpcaoDeEscolha,
} from '@/components/configuracoes';
import { useAjustesStore, type PublicoDosCurtidos } from '@/stores/ajustesStore';

const OPCOES: OpcaoDeEscolha<PublicoDosCurtidos>[] = [
  { valor: 'seguidores', titulo: 'Seguidores', descricao: 'Quem te segue vê a aba de curtidos' },
  { valor: 'somenteEu', titulo: 'Somente você', descricao: 'A aba fica escondida no seu perfil' },
];

/** Vídeos curtidos: quem enxerga a aba de curtidas do seu perfil. */
export default function TelaDeVideosCurtidos() {
  const curtidosVisiveisPara = useAjustesStore((s) => s.curtidosVisiveisPara);
  const definir = useAjustesStore((s) => s.definir);

  return (
    <TelaDeAjustes titulo="Vídeos curtidos" subtitulo="Quem pode ver o que você curte">
      <GrupoDeAjustes titulo="Quem pode assistir aos seus vídeos curtidos">
        <EscolhaDeOpcao
          opcoes={OPCOES}
          selecionada={curtidosVisiveisPara}
          aoEscolher={(v) => definir('curtidosVisiveisPara', v)}
          testID="opcao-curtidos"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste icone="curtir">
        A contagem de curtidas do vídeo nunca some: o que essa escolha esconde é a lista do que você
        curtiu, no seu perfil.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}
