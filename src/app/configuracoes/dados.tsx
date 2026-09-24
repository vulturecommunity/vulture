import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
} from '@/components/configuracoes';
import { useAjustesStore } from '@/stores/ajustesStore';

/** Economizador de dados: o feed para de puxar vídeo sozinho. */
export default function TelaDeDados() {
  const economizarDados = useAjustesStore((s) => s.economizarDados);
  const definir = useAjustesStore((s) => s.definir);

  return (
    <TelaDeAjustes titulo="Economizador de dados" subtitulo="Menos internet no rolar do feed">
      <GrupoDeAjustes>
        <LinhaDeAjuste
          icone="economia"
          titulo="Economizador de dados"
          descricao="Os vídeos só tocam quando você toca na tela"
          destaque={economizarDados}
          ligado={economizarDados}
          aoAlternar={(v) => definir('economizarDados', v)}
          testID="switch-economizador"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste icone="aparelho">
        {economizarDados
          ? 'Ligado: ao chegar num vídeo você vê a capa parada e toca uma vez para assistir. Nada é baixado antes disso.'
          : 'Desligado: cada vídeo começa sozinho assim que aparece — mais fluido, e também mais internet.'}
      </NotaDeAjuste>

      <NotaDeAjuste>
        Rasantes e lives não entram nessa conta: eles sempre carregam quando você abre.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}
