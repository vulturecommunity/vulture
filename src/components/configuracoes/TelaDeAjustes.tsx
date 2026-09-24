import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cabecalho, Icone, Texto, type NomeDeIcone } from '@/components/ui';
import { useVoltar } from '@/hooks/useVoltar';
import { cores, espacos, raios } from '@/theme';

export interface TelaDeAjustesProps {
  titulo: string;
  subtitulo?: string;
  /** para onde voltar quando a tela foi aberta direto por link ou notificação */
  rotaDeVolta?: Href;
  children: ReactNode;
}

/** Moldura das telas de configuração: cabeçalho com voltar e conteúdo rolável. */
export function TelaDeAjustes({
  titulo,
  subtitulo,
  rotaDeVolta = '/configuracoes',
  children,
}: TelaDeAjustesProps) {
  const insets = useSafeAreaInsets();
  const voltar = useVoltar(rotaDeVolta);
  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <Cabecalho titulo={titulo} subtitulo={subtitulo} aoVoltar={voltar} />
      <ScrollView
        contentContainerStyle={[estilos.conteudo, { paddingBottom: insets.bottom + espacos.xxl }]}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export interface NotaDeAjusteProps {
  icone?: NomeDeIcone;
  children: string;
  /** amarelo, para quando a escolha tem uma consequência que surpreende */
  atencao?: boolean;
}

/** Bloco explicativo no pé de uma seção. */
export function NotaDeAjuste({ icone = 'info', children, atencao }: NotaDeAjusteProps) {
  return (
    <View style={[estilos.nota, atencao && estilos.notaAtencao]}>
      <Icone
        nome={atencao ? 'alerta' : icone}
        tamanho={17}
        cor={atencao ? cores.aviso : cores.textoSecundario}
      />
      <Texto variante="pequeno" cor={cores.textoSecundario} style={estilos.textoDaNota}>
        {children}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: espacos.lg, gap: espacos.xl },
  nota: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espacos.sm,
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
  },
  notaAtencao: { borderWidth: 1, borderColor: cores.aviso },
  textoDaNota: { flex: 1 },
});
