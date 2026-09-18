import { Redirect } from 'expo-router';

/** A aba "Gravar" nunca é exibida: o botão central abre a câmera como modal. */
export default function AbaGravar() {
  return <Redirect href="/criar/camera" />;
}
