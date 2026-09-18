import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Botao, Input, Sheet, Texto } from '@/components/ui';
import { dataService } from '@/services/data';
import { chaves } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore, type AlvoParaDenuncia } from '@/stores/uiStore';
import { cores, espacos, raios } from '@/theme';
import { MOTIVOS_DENUNCIA, type MotivoDenuncia } from '@/types';

type Etapa = 'opcoes' | 'motivo' | 'enviado';

/**
 * Painel "Mais opções" de um conteúdo: denunciar (com motivo), bloquear autor
 * e, quando o conteúdo é meu, excluir. Requisito das lojas de aplicativos.
 */
export function SheetDeDenuncia() {
  const alvo = useUiStore((s) => s.alvoParaDenuncia);
  const fechar = useUiStore((s) => s.fecharDenuncia);
  return (
    <Sheet visivel={!!alvo} aoFechar={fechar} altura="auto">
      {alvo ? <ConteudoDaDenuncia key={`${alvo.tipo}-${alvo.id}`} alvo={alvo} /> : null}
    </Sheet>
  );
}

/** O estado (etapa/motivo) vive aqui e é reiniciado a cada alvo via "key". */
function ConteudoDaDenuncia({ alvo }: { alvo: AlvoParaDenuncia }) {
  const fechar = useUiStore((s) => s.fecharDenuncia);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const meuId = useAuthStore((s) => s.sessao?.usuario.id ?? null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>('opcoes');
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [detalhes, setDetalhes] = useState('');

  const denunciar = useMutation({
    mutationFn: () =>
      dataService().report({ tipoAlvo: alvo.tipo, alvoId: alvo.id, motivo: motivo!, detalhes }),
    onSuccess: () => setEtapa('enviado'),
    onError: (e) => mostrarAviso(e instanceof Error ? e.message : 'Falha ao denunciar', 'erro'),
  });

  const bloquear = useMutation({
    mutationFn: () => dataService().bloquear(alvo.autorId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
      queryClient.invalidateQueries({ queryKey: ['comentarios'] });
      queryClient.invalidateQueries({ queryKey: chaves.bloqueados });
      mostrarAviso(
        `@${alvo.autorApelido} bloqueado. Você não verá mais o conteúdo dessa pessoa.`,
        'sucesso',
      );
      fechar();
    },
    onError: (e) => mostrarAviso(e instanceof Error ? e.message : 'Falha ao bloquear', 'erro'),
  });

  const excluir = useMutation({
    mutationFn: () => dataService().excluirVideo(alvo.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['videos-usuario'] });
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
      mostrarAviso('Vídeo excluído.', 'sucesso');
      fechar();
      if (router.canGoBack()) router.back();
    },
    onError: (e) => mostrarAviso(e instanceof Error ? e.message : 'Falha ao excluir', 'erro'),
  });

  const meu = !!alvo.autorId && alvo.autorId === meuId;

  return (
    <View>
      {etapa === 'motivo' ? (
        <Texto variante="destaque" style={estilos.tituloMotivo}>
          Motivo da denúncia
        </Texto>
      ) : null}
      {etapa === 'opcoes' ? (
        <View style={estilos.opcoes}>
          {meu && alvo.tipo === 'video' ? (
            <Opcao
              icone="trash-outline"
              rotulo="Excluir meu vídeo"
              cor={cores.erro}
              aoPressionar={() => excluir.mutate()}
              ocupado={excluir.isPending}
            />
          ) : null}
          {!meu ? (
            <Opcao
              icone="flag-outline"
              rotulo="Denunciar"
              aoPressionar={() => setEtapa('motivo')}
              testID="opcao-denunciar"
            />
          ) : null}
          {!meu && alvo.autorId ? (
            <Opcao
              icone="ban-outline"
              rotulo={`Bloquear @${alvo.autorApelido ?? 'usuário'}`}
              cor={cores.erro}
              aoPressionar={() => bloquear.mutate()}
              ocupado={bloquear.isPending}
              testID="opcao-bloquear"
            />
          ) : null}
          <Opcao icone="close-outline" rotulo="Cancelar" aoPressionar={fechar} />
        </View>
      ) : etapa === 'motivo' ? (
        <ScrollView contentContainerStyle={estilos.motivos} keyboardShouldPersistTaps="handled">
          {MOTIVOS_DENUNCIA.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMotivo(m)}
              style={[estilos.motivo, motivo === m && estilos.motivoAtivo]}
              accessibilityRole="radio"
              accessibilityState={{ selected: motivo === m }}
              testID={`motivo-${m}`}>
              <Texto variante="corpo">{m}</Texto>
              {motivo === m ? (
                <Ionicons name="checkmark-circle" size={20} color={cores.vermelho} />
              ) : null}
            </Pressable>
          ))}
          <Input
            placeholder="Detalhes (opcional)"
            value={detalhes}
            onChangeText={setDetalhes}
            multiline
            maxLength={300}
          />
          <Botao
            titulo="Enviar denúncia"
            onPress={() => denunciar.mutate()}
            disabled={!motivo}
            carregando={denunciar.isPending}
            largo
            testID="botao-enviar-denuncia"
          />
        </ScrollView>
      ) : (
        <View style={estilos.enviado}>
          <Ionicons name="shield-checkmark" size={48} color={cores.sucesso} />
          <Texto variante="destaque" centralizado>
            Denúncia recebida
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSecundario} centralizado>
            Obrigado por ajudar a manter a nação segura. Nossa equipe vai analisar.
          </Texto>
          <Botao titulo="Fechar" variante="secundario" onPress={fechar} largo />
        </View>
      )}
    </View>
  );
}

function Opcao({
  icone,
  rotulo,
  aoPressionar,
  cor = cores.texto,
  ocupado,
  testID,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  aoPressionar: () => void;
  cor?: string;
  ocupado?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={aoPressionar}
      disabled={ocupado}
      style={estilos.opcao}
      accessibilityRole="button"
      testID={testID}>
      <Ionicons name={icone} size={22} color={cor} />
      <Texto variante="corpo" cor={cor}>
        {rotulo}
      </Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tituloMotivo: { paddingHorizontal: espacos.lg, paddingTop: espacos.xs },
  opcoes: { paddingVertical: espacos.sm },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.xl,
    paddingVertical: espacos.md,
  },
  motivos: { padding: espacos.lg, gap: espacos.sm },
  motivo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoCartao,
  },
  motivoAtivo: { borderWidth: 1, borderColor: cores.vermelho },
  enviado: { alignItems: 'center', gap: espacos.md, padding: espacos.xl },
});
