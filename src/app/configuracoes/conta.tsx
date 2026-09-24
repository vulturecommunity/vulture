import { useRouter } from 'expo-router';

import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
} from '@/components/configuracoes';
import { useAuthStore } from '@/stores/authStore';

/** Conta: onde ficam os dados do cadastro e a senha. */
export default function TelaDaConta() {
  const router = useRouter();
  const sessao = useAuthStore((s) => s.sessao);
  const visitante = !!sessao?.visitante;

  return (
    <TelaDeAjustes titulo="Conta" subtitulo={visitante ? 'Modo visitante' : (sessao?.email ?? '')}>
      <GrupoDeAjustes>
        <LinhaDeAjuste
          icone="info"
          titulo="Informações da conta"
          descricao="Apelido, e-mail e desde quando você é da nação"
          destaque
          aoPressionar={() => router.push('/configuracoes/conta/informacoes')}
          testID="link-informacoes"
        />
        <LinhaDeAjuste
          icone="chave"
          titulo="Senha"
          descricao={visitante ? 'Indisponível no modo visitante' : 'Trocar ou redefinir'}
          destaque
          desabilitada={visitante}
          aoPressionar={() => router.push('/configuracoes/conta/senha')}
          testID="link-senha"
        />
        <LinhaDeAjuste
          icone="editar"
          titulo="Editar perfil"
          descricao="Nome, bio, foto e interesses"
          aoPressionar={() => router.push('/editar-perfil')}
          testID="link-editar-perfil"
        />
      </GrupoDeAjustes>

      {visitante ? (
        <NotaDeAjuste atencao>
          O visitante existe só para você conhecer o app: não tem e-mail nem senha, e o que você
          publicar some no reset. Crie uma conta para levar tudo com você.
        </NotaDeAjuste>
      ) : null}
    </TelaDeAjustes>
  );
}
