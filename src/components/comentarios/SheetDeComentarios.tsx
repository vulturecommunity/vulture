import { ListaDeComentarios } from '@/components/comentarios/ListaDeComentarios';
import { Sheet } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

/** Painel global de comentários, aberto por qualquer tela via uiStore.abrirComentarios. */
export function SheetDeComentarios() {
  const videoId = useUiStore((s) => s.videoParaComentar);
  const fechar = useUiStore((s) => s.fecharComentarios);
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);

  return (
    <Sheet visivel={!!videoId} aoFechar={fechar} titulo="Comentários" altura="72%">
      {videoId ? <ListaDeComentarios videoId={videoId} meuId={meuId} /> : null}
    </Sheet>
  );
}
