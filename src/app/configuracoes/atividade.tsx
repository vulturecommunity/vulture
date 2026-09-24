import { useRouter } from 'expo-router';

import {
  GrupoDeAjustes,
  LinhaDeAjuste,
  NotaDeAjuste,
  TelaDeAjustes,
} from '@/components/configuracoes';
import { useHistoricoStore } from '@/stores/historicoStore';

function contagem(total: number, singular: string, plural = `${singular}s`): string {
  if (total === 0) return 'Nada por aqui';
  return `${total} ${total === 1 ? singular : plural}`;
}

/** Centro de atividade: tudo que o torcedor fez no app, reunido num lugar só. */
export default function TelaCentroDeAtividade() {
  const router = useRouter();
  const assistidos = useHistoricoStore((s) => s.assistidos.length);
  const comentarios = useHistoricoStore((s) => s.comentarios.length);
  const pesquisas = useHistoricoStore((s) => s.pesquisas.length);
  const eventos = useHistoricoStore((s) => s.conta.length);

  return (
    <TelaDeAjustes titulo="Centro de atividade" subtitulo="Seu rastro dentro do Vulture">
      <GrupoDeAjustes titulo="Conteúdo">
        <LinhaDeAjuste
          icone="play"
          titulo="Histórico de vídeos assistidos"
          descricao={contagem(assistidos, 'vídeo')}
          destaque
          aoPressionar={() => router.push('/configuracoes/historico/assistidos')}
          testID="link-historico-assistidos"
        />
        <LinhaDeAjuste
          icone="comentarios"
          titulo="Histórico de comentários"
          descricao={contagem(comentarios, 'comentário')}
          destaque
          aoPressionar={() => router.push('/configuracoes/historico/comentarios')}
          testID="link-historico-comentarios"
        />
        <LinhaDeAjuste
          icone="buscar"
          titulo="Histórico de pesquisa"
          descricao={contagem(pesquisas, 'busca')}
          destaque
          aoPressionar={() => router.push('/configuracoes/historico/pesquisas')}
          testID="link-historico-pesquisas"
        />
        <LinhaDeAjuste
          icone="arroba"
          titulo="Histórico de menções"
          descricao="Onde te chamaram na resenha"
          destaque
          aoPressionar={() => router.push('/configuracoes/historico/mencoes')}
          testID="link-historico-mencoes"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Conta">
        <LinhaDeAjuste
          icone="escudo"
          titulo="Histórico da conta"
          descricao={contagem(eventos, 'registro')}
          aoPressionar={() => router.push('/configuracoes/historico/conta')}
          testID="link-historico-conta"
        />
      </GrupoDeAjustes>

      <NotaDeAjuste icone="aparelho">
        Esse histórico fica guardado só neste aparelho e some quando você entra com outra conta.
        Menções são buscadas na resenha na hora em que você abre a tela.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}
