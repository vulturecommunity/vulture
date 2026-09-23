import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LegendaComHashtags } from '@/components/feed/LegendaComHashtags';
import { Avatar, Icone, Texto, type NomeDeIcone } from '@/components/ui';
import { useCompartilharPost, useCurtirPost } from '@/hooks/useArquibancada';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import type { MarcacaoDePartida, Post } from '@/types';
import { formatarContador, tempoRelativo } from '@/utils/formatadores';

import { MidiasDoPost } from './MidiasDoPost';

export interface CartaoDePostProps {
  post: Post;
  /** abre a thread; sem ele (dentro da própria thread) o cartão não é tocável */
  aoAbrir?: (post: Post) => void;
  aoTocarHashtag?: (tag: string) => void;
  aoTocarPartida?: (partida: MarcacaoDePartida) => void;
  /** post principal da thread: texto maior */
  destaque?: boolean;
  resposta?: boolean;
  voltarAoExcluir?: boolean;
}

function Acao({
  icone,
  valor,
  cor = cores.textoSecundario,
  rotulo,
  aoPressionar,
  testID,
}: {
  icone: NomeDeIcone;
  valor?: number;
  cor?: string;
  rotulo: string;
  aoPressionar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={estilos.acao}
      testID={testID}>
      <Icone nome={icone} tamanho={17} cor={cor} />
      {valor !== undefined ? (
        <Texto variante="pequeno" cor={cor}>
          {valor > 0 ? formatarContador(valor) : ''}
        </Texto>
      ) : null}
    </Pressable>
  );
}

/** Um post da resenha, no formato de timeline: avatar, texto, jogo marcado e ações. */
export const CartaoDePost = memo(function CartaoDePost({
  post,
  aoAbrir,
  aoTocarHashtag,
  aoTocarPartida,
  destaque = false,
  resposta = false,
  voltarAoExcluir = false,
}: CartaoDePostProps) {
  const router = useRouter();
  const curtir = useCurtirPost();
  const compartilhar = useCompartilharPost();
  const abrirDenuncia = useUiStore((s) => s.abrirDenuncia);

  return (
    <Pressable
      onPress={aoAbrir ? () => aoAbrir(post) : undefined}
      disabled={!aoAbrir}
      style={({ pressed }) => [
        estilos.cartao,
        resposta && estilos.resposta,
        pressed && estilos.pressionado,
      ]}
      testID={`post-${post.id}`}>
      <Pressable
        onPress={() => router.push({ pathname: '/usuario/[id]', params: { id: post.autorId } })}
        accessibilityLabel={`Perfil de @${post.autor.apelido}`}>
        <Avatar url={post.autor.avatarUrl} nome={post.autor.nome} tamanho={resposta ? 34 : 42} />
      </Pressable>
      <View style={estilos.corpo}>
        <View style={estilos.linhaAutor}>
          <Texto variante="corpoForte" numberOfLines={1} style={estilos.nome}>
            {post.autor.nome}
          </Texto>
          <Texto
            variante="pequeno"
            cor={cores.textoTerciario}
            numberOfLines={1}
            style={estilos.apelido}>
            @{post.autor.apelido} · {tempoRelativo(post.criadoEm)}
          </Texto>
          <Pressable
            onPress={() =>
              abrirDenuncia({
                tipo: 'post',
                id: post.id,
                autorId: post.autorId,
                autorApelido: post.autor.apelido,
                voltarAoExcluir,
              })
            }
            hitSlop={10}
            accessibilityLabel="Mais opções"
            style={estilos.mais}
            testID={`mais-post-${post.id}`}>
            <Icone nome="mais" tamanho={18} cor={cores.textoTerciario} />
          </Pressable>
        </View>

        {post.texto ? (
          <LegendaComHashtags
            texto={post.texto}
            aoTocarHashtag={aoTocarHashtag}
            style={destaque ? estilos.textoDestaque : undefined}
          />
        ) : null}

        <MidiasDoPost midias={post.midias} />

        {post.partida ? (
          <Pressable
            onPress={() => aoTocarPartida?.(post.partida!)}
            disabled={!aoTocarPartida}
            style={estilos.partida}
            accessibilityRole="button"
            accessibilityLabel={`Resenha do jogo ${post.partida.rotulo}`}
            testID={`partida-do-post-${post.id}`}>
            <Icone nome="bola" tamanho={12} cor={cores.vermelhoVivo} />
            <Texto variante="legenda" cor={cores.texto}>
              {post.partida.rotulo}
            </Texto>
          </Pressable>
        ) : null}

        <View style={estilos.acoes}>
          {resposta ? null : (
            <Acao
              icone="comentar"
              valor={post.respostas}
              rotulo="Responder"
              aoPressionar={() => aoAbrir?.(post)}
              testID={`responder-post-${post.id}`}
            />
          )}
          <Acao
            icone={post.curtido ? 'curtido' : 'curtir'}
            cor={post.curtido ? cores.vermelhoVivo : cores.textoSecundario}
            valor={post.curtidas}
            rotulo={post.curtido ? 'Descurtir' : 'Curtir'}
            aoPressionar={() => curtir(post)}
            testID={`curtir-post-${post.id}`}
          />
          <Acao
            icone="compartilhar"
            rotulo="Compartilhar"
            aoPressionar={() => compartilhar(post)}
          />
        </View>
      </View>
    </Pressable>
  );
});

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    gap: espacos.md,
    paddingHorizontal: espacos.lg,
    paddingVertical: espacos.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  resposta: { paddingLeft: espacos.xl + espacos.md },
  pressionado: { backgroundColor: cores.fundoElevado },
  corpo: { flex: 1, gap: espacos.xs },
  linhaAutor: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs },
  nome: { flexShrink: 1 },
  apelido: { flexShrink: 2 },
  mais: { marginLeft: 'auto', paddingLeft: espacos.xs },
  textoDestaque: { fontSize: 17, lineHeight: 24 },
  partida: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacos.xs,
    paddingHorizontal: espacos.sm,
    paddingVertical: 3,
    borderRadius: raios.redondo,
    backgroundColor: cores.vermelhoSuave,
    borderWidth: 1,
    borderColor: 'rgba(200,16,46,0.35)',
  },
  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xxl,
    marginTop: espacos.xs,
  },
  acao: { flexDirection: 'row', alignItems: 'center', gap: espacos.xs, minWidth: 36 },
});
