import { SheetDeComentarios } from '@/components/comentarios/SheetDeComentarios';
import { SheetDeDenuncia } from '@/components/seguranca/SheetDeDenuncia';
import { Aviso } from '@/components/ui/Aviso';

/** Painéis e avisos que podem ser abertos de qualquer tela. */
export function SheetsGlobais() {
  return (
    <>
      <SheetDeComentarios />
      <SheetDeDenuncia />
      <Aviso />
    </>
  );
}
