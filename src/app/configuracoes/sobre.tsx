import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { GrupoDeAjustes, LinhaDeAjuste, TelaDeAjustes } from '@/components/configuracoes';
import { Sheet, Texto } from '@/components/ui';
import { dataService } from '@/services/data';
import { cores, espacos } from '@/theme';

type Documento = 'ajuda' | 'privacidade' | 'termos';

const DOCUMENTOS: Record<Documento, { titulo: string; paragrafos: string[] }> = {
  ajuda: {
    titulo: 'Como o Vulture funciona',
    paragrafos: [
      'O feed mostra vídeos curtos da torcida. Toque para pausar, toque duas vezes para curtir e arraste para cima para o próximo.',
      'Rasantes são vídeos de até 15 segundos que somem em 24 horas. Aparecem no topo do perfil e das mensagens.',
      'A Arquibancada é a resenha escrita: posts curtos, respostas, marcação de jogo e palpite de placar.',
      'Lives abrem a transmissão ao vivo com chat e reações. Quem transmite não conta como espectador.',
      'Se algo sair da linha, use o menu do conteúdo para denunciar ou bloquear. Bloquear corta os dois lados de uma vez.',
    ],
  },
  privacidade: {
    titulo: 'Privacidade',
    paragrafos: [
      'O que você publica fica visível conforme a sua escolha em Conta privada. Com a conta pública, vídeos podem aparecer no feed e no Explorar de qualquer torcedor.',
      'O Centro de atividade (vídeos assistidos, comentários e buscas) fica guardado só neste aparelho e é apagado quando você entra com outra conta ou limpa o histórico.',
      'Preferências como economizador de dados e palavras filtradas também não saem do aparelho.',
      'Denúncias guardam o conteúdo denunciado e quem denunciou, para que a moderação consiga avaliar o caso.',
      'Medimos como o app é usado (telas abertas, publicações, palpites) e recebemos relatório automático quando algo quebra. Esses dados vão para serviços de análise e de erro identificados por um código da conta — nunca pelo seu e-mail, nome ou telefone.',
      'Você pode apagar a conta a qualquer momento em Conta → Excluir conta. Isso remove seu perfil, suas publicações e os arquivos no servidor. Guardamos apenas a data do pedido, sem nada que identifique você, porque a lei exige comprovar que o pedido foi atendido.',
      'Este é um resumo em linguagem simples, não o documento legal completo.',
    ],
  },
  termos: {
    titulo: 'Termos de uso',
    paragrafos: [
      'Publique apenas conteúdo que seja seu ou que você tenha permissão para usar.',
      'Transmissão de jogo é protegida por direito autoral. Retransmitir a partida, mesmo filmando a TV, pode ser removido sem aviso e é o tipo de conteúdo que tira o app do ar.',
      'Não é permitido discurso de ódio, assédio, violência gráfica, conteúdo sexual nem desinformação apresentada como fato.',
      'Rivalidade e zoeira fazem parte do futebol e são bem-vindas. Ameaça a uma pessoa, exposição de endereço e convocação para briga não são, e levam à suspensão na primeira ocorrência.',
      'Contas que insistirem em quebrar essas regras podem ter conteúdo removido ou perder o acesso. Decisões de moderação ficam registradas e podem ser contestadas pelo suporte.',
      'O Vulture é um app de torcedores, sem relação oficial com o Clube de Regatas do Flamengo.',
      'O Vulture pode mudar recursos do app a qualquer momento enquanto estiver em desenvolvimento.',
      'Este é um resumo em linguagem simples, não o documento legal completo.',
    ],
  },
};

/** Suporte e sobre: como o app funciona, privacidade, termos e a versão instalada. */
export default function TelaSobre() {
  const [aberto, setAberto] = useState<Documento | null>(null);
  const versao = Constants.expoConfig?.version ?? '—';
  const driver = dataService().nome;

  return (
    <TelaDeAjustes titulo="Suporte e sobre" subtitulo="Vulture, a rede da nação">
      <GrupoDeAjustes titulo="Suporte">
        <LinhaDeAjuste
          icone="ajuda"
          titulo="Central de ajuda"
          descricao="O básico de cada parte do app"
          destaque
          aoPressionar={() => setAberto('ajuda')}
          testID="link-ajuda"
        />
        <LinhaDeAjuste
          icone="escudo"
          titulo="Central de privacidade"
          descricao="O que fica no aparelho e o que vai para o servidor"
          destaque
          aoPressionar={() => setAberto('privacidade')}
          testID="link-privacidade-doc"
        />
        <LinhaDeAjuste
          icone="documento"
          titulo="Termos e políticas"
          descricao="As regras da casa"
          destaque
          aoPressionar={() => setAberto('termos')}
          testID="link-termos"
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes
        titulo="Sobre"
        rodape={
          driver === 'mock'
            ? 'Modo demonstração: nada sai deste aparelho.'
            : 'Conectado ao Supabase.'
        }>
        <LinhaDeAjuste icone="info" titulo="Versão do app" valor={versao} />
        <LinhaDeAjuste icone="aparelho" titulo="Plataforma" valor={Platform.OS} />
        <LinhaDeAjuste
          icone="armazenamento"
          titulo="Origem dos dados"
          valor={driver === 'mock' ? 'Demonstração local' : 'Supabase'}
        />
      </GrupoDeAjustes>

      <Sheet
        visivel={aberto !== null}
        aoFechar={() => setAberto(null)}
        titulo={aberto ? DOCUMENTOS[aberto].titulo : ''}
        altura="72%">
        <ScrollView contentContainerStyle={estilos.documento}>
          {aberto
            ? DOCUMENTOS[aberto].paragrafos.map((paragrafo, i) => (
                <View key={i} style={estilos.paragrafo}>
                  <View style={estilos.marcador} />
                  <Texto variante="corpo" cor={cores.textoSecundario} style={estilos.texto}>
                    {paragrafo}
                  </Texto>
                </View>
              ))
            : null}
        </ScrollView>
      </Sheet>
    </TelaDeAjustes>
  );
}

const estilos = StyleSheet.create({
  documento: { padding: espacos.lg, gap: espacos.lg },
  paragrafo: { flexDirection: 'row', gap: espacos.md },
  marcador: { width: 3, borderRadius: 2, backgroundColor: cores.vermelho },
  texto: { flex: 1 },
});
