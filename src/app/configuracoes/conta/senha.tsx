import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GrupoDeAjustes, NotaDeAjuste, TelaDeAjustes } from '@/components/configuracoes';
import { Botao, Icone, Input, Texto } from '@/components/ui';
import { dataService } from '@/services/data';
import { useAuthStore } from '@/stores/authStore';
import { useHistoricoStore } from '@/stores/historicoStore';
import { useUiStore } from '@/stores/uiStore';
import { cores, espacos } from '@/theme';
import { mensagemDeErro } from '@/utils/erros';

/** Exigências da senha nova, conferidas enquanto a pessoa digita. */
function requisitos(senha: string) {
  return [
    { texto: 'Pelo menos 8 caracteres', ok: senha.length >= 8 },
    { texto: 'Uma letra e um número', ok: /[a-zA-Z]/.test(senha) && /\d/.test(senha) },
    { texto: 'Um caractere especial (# ? ! @)', ok: /[^a-zA-Z0-9]/.test(senha) },
  ];
}

/** Trocar a senha do login, ou pedir o e-mail de redefinição quando ela foi esquecida. */
export default function TelaDeSenha() {
  const sessao = useAuthStore((s) => s.sessao);
  const mostrarAviso = useUiStore((s) => s.mostrarAviso);
  const registrarEvento = useHistoricoStore((s) => s.registrarEvento);

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const checagens = requisitos(nova);
  const forte = checagens.every((r) => r.ok);
  const confere = confirmacao.length > 0 && confirmacao === nova;
  const podeSalvar = atual.length > 0 && forte && confere;

  const trocar = useMutation({
    mutationFn: () => dataService().alterarSenha(atual, nova),
    onSuccess: () => {
      setAtual('');
      setNova('');
      setConfirmacao('');
      setErro(null);
      registrarEvento('senha', 'Senha alterada');
      mostrarAviso('Senha alterada.', 'sucesso');
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  const redefinir = useMutation({
    mutationFn: () => dataService().enviarRedefinicaoDeSenha(sessao?.email ?? ''),
    onSuccess: () => mostrarAviso('Enviamos o link de redefinição para o seu e-mail.', 'sucesso'),
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  if (sessao?.visitante || !sessao?.email) {
    return (
      <TelaDeAjustes titulo="Senha" rotaDeVolta="/configuracoes/conta">
        <NotaDeAjuste atencao>
          O visitante entra sem e-mail e sem senha, então não há o que trocar aqui. Crie uma conta
          para definir uma senha.
        </NotaDeAjuste>
      </TelaDeAjustes>
    );
  }

  return (
    <TelaDeAjustes
      titulo="Senha"
      subtitulo="Troque agora ou peça um link por e-mail"
      rotaDeVolta="/configuracoes/conta">
      <View style={estilos.formulario}>
        <Input
          rotulo="Senha atual"
          value={atual}
          onChangeText={(t) => {
            setAtual(t);
            setErro(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          placeholder="A que você usa hoje"
          testID="campo-senha-atual"
        />
        <Input
          rotulo="Nova senha"
          value={nova}
          onChangeText={(t) => {
            setNova(t);
            setErro(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Escolha uma nova"
          testID="campo-senha-nova"
        />

        <View style={estilos.requisitos}>
          {checagens.map((r) => (
            <View key={r.texto} style={estilos.requisito}>
              <Icone
                nome={r.ok ? 'ok' : 'menos'}
                tamanho={14}
                cor={r.ok ? cores.sucesso : cores.textoTerciario}
              />
              <Texto variante="pequeno" cor={r.ok ? cores.texto : cores.textoTerciario}>
                {r.texto}
              </Texto>
            </View>
          ))}
        </View>

        <Input
          rotulo="Confirmar nova senha"
          value={confirmacao}
          onChangeText={(t) => {
            setConfirmacao(t);
            setErro(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Digite de novo"
          erro={confirmacao.length > 0 && !confere ? 'As senhas não batem.' : null}
          testID="campo-senha-confirmacao"
        />

        {erro ? (
          <Texto variante="pequeno" cor={cores.erro}>
            {erro}
          </Texto>
        ) : null}

        <Botao
          titulo="Salvar nova senha"
          largo
          disabled={!podeSalvar}
          carregando={trocar.isPending}
          onPress={() => trocar.mutate()}
          testID="botao-salvar-senha"
        />
      </View>

      <GrupoDeAjustes titulo="Esqueceu a senha?" rodape={`Enviamos para ${sessao.email}.`}>
        <View style={estilos.redefinir}>
          <Texto variante="pequeno" cor={cores.textoSecundario} style={estilos.explicacao}>
            Recebe um link por e-mail para escolher outra senha sem precisar da atual.
          </Texto>
          <Botao
            titulo="Enviar link"
            variante="contorno"
            tamanho="pequeno"
            carregando={redefinir.isPending}
            onPress={() => redefinir.mutate()}
            testID="botao-redefinir-senha"
          />
        </View>
      </GrupoDeAjustes>
    </TelaDeAjustes>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espacos.lg },
  requisitos: { gap: espacos.xs, paddingHorizontal: espacos.xs },
  requisito: { flexDirection: 'row', alignItems: 'center', gap: espacos.sm },
  redefinir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    padding: espacos.md,
  },
  explicacao: { flex: 1 },
});
