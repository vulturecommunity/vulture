import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icone, Texto } from '@/components/ui';
import { useRasantes } from '@/hooks/useRasantes';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';

import { AnelDeRasante } from './AnelDeRasante';

/**
 * Fileira horizontal do topo das mensagens: meu avatar (com "+") seguido dos rasantes
 * de quem eu sigo — os não vistos primeiro. Some quando não estou logado.
 */
export function FileiraDeRasantes() {
  const router = useRouter();
  const usuario = useAuthStore((s) => s.sessao?.usuario ?? null);
  const grupos = useRasantes();
  if (!usuario) return null;

  const meuGrupo = grupos.data?.find((g) => g.souEu) ?? null;
  const outros = grupos.data?.filter((g) => !g.souEu) ?? [];

  const gravar = () => router.push({ pathname: '/criar/camera', params: { destino: 'rasante' } });

  return (
    <View style={estilos.container} testID="fileira-rasantes">
      <View style={estilos.titulo}>
        <Icone nome="rasante" tamanho={14} cor={cores.vermelhoVivo} />
        <Texto variante="rotulo" cor={cores.textoSecundario}>
          Rasantes
        </Texto>
        <Texto variante="legenda" cor={cores.textoTerciario}>
          · vídeos de 15 s que somem em 24 h
        </Texto>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.lista}
        keyboardShouldPersistTaps="handled">
        <AnelDeRasante
          usuario={usuario}
          souEu
          ativo={!!meuGrupo}
          visto={meuGrupo?.todosVistos ?? false}
          aoPressionar={() =>
            meuGrupo
              ? router.push({ pathname: '/rasante/[usuarioId]', params: { usuarioId: usuario.id } })
              : gravar()
          }
          aoAdicionar={gravar}
          testID="rasante-eu"
        />
        {outros.map((g) => (
          <AnelDeRasante
            key={g.autor.id}
            usuario={g.autor}
            ativo
            visto={g.todosVistos}
            aoPressionar={() =>
              router.push({ pathname: '/rasante/[usuarioId]', params: { usuarioId: g.autor.id } })
            }
            testID={`rasante-${g.autor.id}`}
          />
        ))}
        {outros.length === 0 && grupos.isSuccess ? (
          <View style={estilos.vazio}>
            <Texto variante="pequeno" cor={cores.textoTerciario}>
              Ninguém que você segue postou um rasante hoje. Que tal abrir o voo?
            </Texto>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { paddingTop: espacos.sm, gap: espacos.sm },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.xs + 2,
    paddingHorizontal: espacos.lg,
  },
  lista: { paddingHorizontal: espacos.lg, gap: espacos.md, alignItems: 'flex-start' },
  vazio: { justifyContent: 'center', maxWidth: 220, paddingTop: espacos.md },
});
