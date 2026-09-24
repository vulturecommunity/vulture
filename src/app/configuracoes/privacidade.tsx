import { useRouter } from 'expo-router';

import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
} from '@/components/configuracoes';
import { useAjustesStore } from '@/stores/ajustesStore';
import { useHistoricoStore } from '@/stores/historicoStore';

/** Conta privada e contas bloqueadas: quem enxerga o que você posta. */
export default function TelaDePrivacidade() {
  const router = useRouter();
  const contaPrivada = useAjustesStore((s) => s.contaPrivada);
  const definir = useAjustesStore((s) => s.definir);
  const registrarEvento = useHistoricoStore((s) => s.registrarEvento);

  function alternar(valor: boolean) {
    definir('contaPrivada', valor);
    registrarEvento('privacidade', valor ? 'Conta privada ativada' : 'Conta privada desativada');
  }

  return (
    <TelaDeAjustes titulo="Conta privada" subtitulo="Quem alcança o seu perfil">
      <GrupoDeAjustes>
        <LinhaDeAjuste
          icone={contaPrivada ? 'cadeado' : 'cadeadoAberto'}
          titulo="Conta privada"
          descricao={contaPrivada ? 'Só quem você aprovar te segue' : 'Qualquer torcedor te segue'}
          destaque={contaPrivada}
          ligado={contaPrivada}
          aoAlternar={alternar}
          testID="switch-conta-privada"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste icone="escudoOk">
        {contaPrivada
          ? 'Com a conta privada, novos seguidores passam pela sua aprovação e seus vídeos, rasantes e curtidas ficam fora do Explorar. Quem já te segue continua vendo tudo.'
          : 'Com a conta pública, seus vídeos podem aparecer no feed e no Explorar de qualquer torcedor. Rasantes continuam sumindo em 24 h.'}
      </NotaDeAjuste>

      <GrupoDeAjustes titulo="Bloqueios">
        <LinhaDeAjuste
          icone="bloquear"
          titulo="Contas bloqueadas"
          descricao="Quem não te vê nem te encontra"
          aoPressionar={() => router.push('/bloqueados')}
          testID="link-bloqueados"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste>
        Bloquear corta os dois lados de uma vez: a pessoa some do seu feed, não consegue comentar
        nos seus vídeos nem te mandar mensagem.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}
