import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
} from '@/components/configuracoes';
import { useAjustesStore } from '@/stores/ajustesStore';

/** Downloads: se outras pessoas podem baixar os seus vídeos. */
export default function TelaDeDownloads() {
  const contaPrivada = useAjustesStore((s) => s.contaPrivada);
  const permitirDownloads = useAjustesStore((s) => s.permitirDownloads);
  const definir = useAjustesStore((s) => s.definir);

  return (
    <TelaDeAjustes titulo="Downloads" subtitulo="Quem pode salvar os seus vídeos">
      <GrupoDeAjustes>
        <LinhaDeAjuste
          icone="baixar"
          titulo="Download dos meus vídeos"
          descricao={
            contaPrivada ? 'Indisponível com a conta privada' : 'Outros salvam o vídeo no aparelho'
          }
          destaque={permitirDownloads && !contaPrivada}
          ligado={permitirDownloads && !contaPrivada}
          desabilitada={contaPrivada}
          aoAlternar={(v) => definir('permitirDownloads', v)}
          testID="switch-downloads"
        />
      </GrupoDeAjustes>

      {contaPrivada ? (
        <NotaDeAjuste atencao>
          Sua conta está privada, então ninguém baixa os seus vídeos — nem com essa opção ligada.
          Desative a conta privada se quiser liberar o download.
        </NotaDeAjuste>
      ) : (
        <NotaDeAjuste>
          Mesmo com o download desligado, qualquer pessoa ainda pode compartilhar o link do seu
          vídeo. O que muda é a cópia do arquivo no aparelho dela.
        </NotaDeAjuste>
      )}
    </TelaDeAjustes>
  );
}
