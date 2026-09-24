import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GrupoDeAjustes, NotaDeAjuste, TelaDeAjustes } from '@/components/configuracoes';
import { Icone, Texto } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { cores, espacos } from '@/theme';
import { formatarData } from '@/utils/formatadores';

/** Esconde o miolo do e-mail: "torcedor@gmail.com" → "t*******r@gmail.com". */
function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@');
  if (!dominio) return email;
  if (usuario.length <= 2) return `${usuario[0]}*@${dominio}`;
  return `${usuario[0]}${'*'.repeat(usuario.length - 2)}${usuario[usuario.length - 1]}@${dominio}`;
}

/** Informações da conta: o cadastro em si, sem nada editável. */
export default function TelaInformacoesDaConta() {
  const sessao = useAuthStore((s) => s.sessao);
  const [emailAberto, setEmailAberto] = useState(false);

  const usuario = sessao?.usuario;
  const email = sessao?.email ?? null;

  return (
    <TelaDeAjustes
      titulo="Informações da conta"
      subtitulo="Só para consulta"
      rotaDeVolta="/configuracoes/conta">
      <GrupoDeAjustes titulo="Cadastro">
        <Campo rotulo="Apelido" valor={usuario ? `@${usuario.apelido}` : '—'} />
        <Campo rotulo="Nome" valor={usuario?.nome || '—'} />
        <Campo
          rotulo="E-mail"
          valor={email ? (emailAberto ? email : mascararEmail(email)) : 'Sem e-mail'}
          acao={
            email
              ? {
                  icone: emailAberto ? 'olhoFechado' : 'olho',
                  rotulo: emailAberto ? 'Esconder e-mail' : 'Mostrar e-mail',
                  aoPressionar: () => setEmailAberto((v) => !v),
                }
              : undefined
          }
        />
      </GrupoDeAjustes>

      <GrupoDeAjustes titulo="Na nação">
        <Campo
          rotulo="Tipo de conta"
          valor={sessao?.visitante ? 'Visitante (demonstração)' : 'Conta completa'}
        />
        <Campo rotulo="Torcendo desde" valor={usuario ? formatarData(usuario.criadoEm) : '—'} />
        <Campo rotulo="Identificador" valor={usuario?.id ?? '—'} />
      </GrupoDeAjustes>

      <NotaDeAjuste>
        Para mudar nome, foto ou bio, use Editar perfil. O apelido também muda por lá.
      </NotaDeAjuste>
    </TelaDeAjustes>
  );
}

function Campo({
  rotulo,
  valor,
  acao,
}: {
  rotulo: string;
  valor: string;
  acao?: { icone: 'olho' | 'olhoFechado'; rotulo: string; aoPressionar: () => void };
}) {
  return (
    <View style={estilos.campo}>
      <View style={estilos.textos}>
        <Texto variante="pequeno" cor={cores.textoTerciario}>
          {rotulo}
        </Texto>
        <Texto variante="corpoForte" numberOfLines={1}>
          {valor}
        </Texto>
      </View>
      {acao ? (
        <Pressable
          onPress={acao.aoPressionar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={acao.rotulo}
          style={({ pressed }) => [estilos.acao, pressed && estilos.pressionada]}>
          <Icone nome={acao.icone} tamanho={17} cor={cores.textoSecundario} />
        </Pressable>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.md,
    paddingHorizontal: espacos.md,
    paddingVertical: espacos.md,
    minHeight: 58,
  },
  textos: { flex: 1, gap: 2 },
  acao: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: cores.fundoCartao,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionada: { opacity: 0.7 },
});
