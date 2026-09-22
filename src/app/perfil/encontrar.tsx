import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Botao,
  Cabecalho,
  Carregando,
  EstadoVazio,
  Icone,
  Texto,
  TituloDeSecao,
} from '@/components/ui';
import { ICONE_INTERESSE } from '@/constants/interesses';
import { useBuscaDeUsuarios, useValorAtrasado } from '@/hooks/useExplorar';
import { useSeguir } from '@/hooks/useInteracoes';
import { useSugestoesDeTorcedores } from '@/hooks/useSeguidores';
import { useVoltar } from '@/hooks/useVoltar';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos, raios, tipografia } from '@/theme';
import type { Usuario } from '@/types';
import { formatarContador } from '@/utils/formatadores';

/**
 * "Adicionar torcedores": sugestões de quem seguir (afinidade de interesses + popularidade),
 * busca por nome e convite compartilhando o link do meu perfil.
 */
export default function TelaEncontrarTorcedores() {
  const router = useRouter();
  const voltar = useVoltar('/(tabs)/perfil');
  const insets = useSafeAreaInsets();
  const eu = useAuthStore((s) => s.sessao?.usuario ?? null);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const sugestoes = useSugestoesDeTorcedores();
  const { alternar, ocupado } = useSeguir();
  const [termo, setTermo] = useState('');
  const termoAtrasado = useValorAtrasado(termo.trim(), 250);
  const busca = useBuscaDeUsuarios(termoAtrasado);
  const [seguidosAgora, setSeguidosAgora] = useState<Set<string>>(new Set());

  async function seguir(usuario: Usuario) {
    try {
      await alternar(usuario.id, false);
      setSeguidosAgora((atual) => new Set(atual).add(usuario.id));
    } catch (erro) {
      mostrarAviso(erro instanceof Error ? erro.message : 'Não foi possível seguir.', 'erro');
    }
  }

  async function convidar() {
    if (!eu) return;
    try {
      await Share.share({
        message: `Cola comigo no Vulture, o app da nação: vulture://usuario/${eu.id} — sou @${eu.apelido} por lá 🔴⚫`,
        title: 'Convidar para o Vulture',
      });
    } catch {
      // usuário fechou a folha de compartilhamento
    }
  }

  const lista = termoAtrasado ? (busca.data ?? []) : (sugestoes.data ?? []);
  const carregando = termoAtrasado ? busca.isLoading : sugestoes.isLoading;
  const interessesMeus = new Set<string>(eu?.interesses ?? []);

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho titulo="Adicionar torcedores" aoVoltar={voltar} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.busca}>
          <Icone nome="buscar" tamanho={18} cor={cores.textoTerciario} />
          <TextInput
            style={estilos.input}
            placeholder="Buscar @usuário ou nome"
            placeholderTextColor={cores.textoTerciario}
            value={termo}
            onChangeText={setTermo}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={cores.vermelho}
            testID="campo-busca-torcedor"
          />
          {termo ? (
            <Pressable onPress={() => setTermo('')} hitSlop={8} accessibilityLabel="Limpar busca">
              <Icone nome="limpar" tamanho={18} cor={cores.textoTerciario} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={convidar}
          style={({ pressed }) => [estilos.convite, pressed && estilos.pressionado]}
          accessibilityRole="button"
          testID="botao-convidar">
          <View style={estilos.iconeConvite}>
            <Icone nome="link" tamanho={20} cor={cores.branco} />
          </View>
          <View style={estilos.flex}>
            <Texto variante="corpoForte">Convidar amigos</Texto>
            <Texto variante="pequeno" cor={cores.textoSecundario}>
              Compartilhe o link do seu perfil pra galera te achar.
            </Texto>
          </View>
          <Icone nome="compartilhar" tamanho={18} cor={cores.textoTerciario} />
        </Pressable>

        <TituloDeSecao
          titulo={termoAtrasado ? 'Resultados' : 'Sugestões para você'}
          subtitulo={
            termoAtrasado
              ? undefined
              : 'Pela afinidade com seus interesses e quem a nação mais segue'
          }
          icone={termoAtrasado ? 'buscar' : 'adicionarPessoa'}
          semMargem
        />

        {carregando ? (
          <Carregando telaCheia={false} />
        ) : lista.length === 0 ? (
          <EstadoVazio
            icone="torcida"
            titulo={termoAtrasado ? 'Nenhum torcedor encontrado' : 'Você já segue todo mundo!'}
            descricao={
              termoAtrasado
                ? 'Confira o apelido e tente de novo.'
                : 'Convide amigos para o Vulture e a lista cresce.'
            }
          />
        ) : (
          <View style={estilos.lista}>
            {lista
              .filter((u) => u.id !== eu?.id)
              .map((u) => {
                const jaSigo = seguidosAgora.has(u.id);
                const afinidade = u.interesses.filter((i) => interessesMeus.has(i));
                return (
                  <View key={u.id} style={estilos.linha} testID={`sugestao-${u.id}`}>
                    <Pressable
                      style={estilos.pessoa}
                      onPress={() =>
                        router.push({ pathname: '/usuario/[id]', params: { id: u.id } })
                      }
                      accessibilityLabel={`Abrir perfil de @${u.apelido}`}>
                      <Avatar url={u.avatarUrl} nome={u.nome} tamanho={50} />
                      <View style={estilos.textos}>
                        <Texto variante="corpoForte" numberOfLines={1}>
                          {u.nome}
                        </Texto>
                        <Texto variante="pequeno" cor={cores.textoSecundario} numberOfLines={1}>
                          @{u.apelido} · {formatarContador(u.seguidores)} seguidores
                        </Texto>
                        {afinidade.length > 0 ? (
                          <View style={estilos.afinidade}>
                            {afinidade.slice(0, 3).map((i) => (
                              <View key={i} style={estilos.chip}>
                                <Icone
                                  nome={ICONE_INTERESSE[i]}
                                  tamanho={10}
                                  cor={cores.vermelhoVivo}
                                />
                                <Texto variante="legenda" cor={cores.textoSecundario}>
                                  {i}
                                </Texto>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                    <Botao
                      titulo={jaSigo ? 'Seguindo' : 'Seguir'}
                      variante={jaSigo ? 'contorno' : 'primario'}
                      tamanho="pequeno"
                      disabled={jaSigo || ocupado}
                      onPress={() => seguir(u)}
                      testID={`seguir-${u.id}`}
                    />
                  </View>
                );
              })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  flex: { flex: 1 },
  conteudo: { paddingHorizontal: espacos.lg, paddingBottom: espacos.xxxl, gap: espacos.md },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingHorizontal: espacos.md,
    height: 44,
    borderRadius: raios.md,
    backgroundColor: cores.fundoCartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  input: { flex: 1, color: cores.texto, ...tipografia.corpo, paddingVertical: 0 },
  convite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pressionado: { backgroundColor: cores.fundoCartao },
  iconeConvite: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.vermelho,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lista: { gap: espacos.xs },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    paddingVertical: espacos.sm,
  },
  pessoa: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espacos.md },
  textos: { flex: 1, gap: 2 },
  afinidade: { flexDirection: 'row', flexWrap: 'wrap', gap: espacos.xs, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: raios.sm,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.borda,
  },
});
