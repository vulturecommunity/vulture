import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Botao, Input, Sheet, Texto } from '@/components/ui';
import { useCriarLiga, useEntrarNaLiga } from '@/hooks/useRanking';
import { cores, espacos, raios } from '@/theme';
import type { Liga } from '@/types';
import { abrirCompartilhamento, compartilharLiga } from '@/utils/compartilhar';
import { mensagemDeErro } from '@/utils/erros';

export interface SheetDeLigasProps {
  visivel: boolean;
  aoFechar: () => void;
  aoEntrar: (liga: Liga) => void;
}

/**
 * Criar uma liga ou entrar com um código.
 *
 * O convite é o produto aqui: o código de 6 caracteres existe para ser ditado no grupo do
 * WhatsApp, e o botão de compartilhar logo depois de criar é o que faz a liga sair do app.
 */
export function SheetDeLigas({ visivel, aoFechar, aoEntrar }: Readonly<SheetDeLigasProps>) {
  const [modo, setModo] = useState<'criar' | 'entrar'>('criar');
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [criada, setCriada] = useState<Liga | null>(null);

  const criar = useCriarLiga();
  const entrar = useEntrarNaLiga();
  const ocupado = criar.isPending || entrar.isPending;

  function fechar() {
    setNome('');
    setCodigo('');
    setErro(null);
    setCriada(null);
    aoFechar();
  }

  async function confirmar() {
    setErro(null);
    try {
      if (modo === 'criar') {
        setCriada(await criar.mutateAsync(nome));
      } else {
        aoEntrar(await entrar.mutateAsync(codigo));
        fechar();
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  function convidar(liga: Liga) {
    void abrirCompartilhamento(compartilharLiga({ nome: liga.nome, codigo: liga.codigo }));
  }

  if (criada) {
    return (
      <Sheet visivel={visivel} aoFechar={fechar} titulo="Liga criada!" altura="52%">
        <View style={estilos.conteudo}>
          <Texto variante="corpo" cor={cores.textoSecundario} centralizado>
            Agora chame a galera. Quem usar este código entra direto na sua liga:
          </Texto>
          <View style={estilos.codigoCaixa} testID="codigo-da-liga">
            <Texto variante="titulo" cor={cores.dourado} centralizado>
              {criada.codigo}
            </Texto>
          </View>
          <Botao titulo="Compartilhar convite" onPress={() => convidar(criada)} largo />
          <Botao titulo="Pronto" variante="fantasma" onPress={fechar} largo />
        </View>
      </Sheet>
    );
  }

  const invalido = modo === 'criar' ? nome.trim().length < 3 : codigo.trim().length < 6;

  return (
    <Sheet visivel={visivel} aoFechar={fechar} titulo="Ligas de palpite" altura="60%">
      <View style={estilos.conteudo}>
        <View style={estilos.abas}>
          <Botao
            titulo="Criar liga"
            variante={modo === 'criar' ? 'primario' : 'contorno'}
            onPress={() => {
              setModo('criar');
              setErro(null);
            }}
            style={estilos.flex}
          />
          <Botao
            titulo="Usar código"
            variante={modo === 'entrar' ? 'primario' : 'contorno'}
            onPress={() => {
              setModo('entrar');
              setErro(null);
            }}
            style={estilos.flex}
          />
        </View>

        {modo === 'criar' ? (
          <>
            <Texto variante="pequeno" cor={cores.textoSecundario}>
              Uma disputa fechada com os seus: no ranking da Nação só 20 pessoas aparecem; na sua
              liga, alguém sempre está em primeiro.
            </Texto>
            <Input
              rotulo="Nome da liga"
              icone="trofeu"
              placeholder="Resenha do trabalho"
              maxLength={40}
              value={nome}
              onChangeText={(t) => {
                setNome(t);
                setErro(null);
              }}
              erro={erro}
              testID="input-nome-da-liga"
            />
          </>
        ) : (
          <>
            <Texto variante="pequeno" cor={cores.textoSecundario}>
              Peça o código de 6 caracteres para quem criou a liga.
            </Texto>
            <Input
              rotulo="Código da liga"
              icone="cadeado"
              placeholder="ABC234"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              value={codigo}
              onChangeText={(t) => {
                setCodigo(t.toUpperCase());
                setErro(null);
              }}
              erro={erro}
              testID="input-codigo-da-liga"
            />
          </>
        )}

        <Botao
          titulo={modo === 'criar' ? 'Criar liga' : 'Entrar na liga'}
          onPress={confirmar}
          carregando={ocupado}
          disabled={invalido || ocupado}
          largo
          testID="confirmar-liga"
        />
      </View>
    </Sheet>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  conteudo: { gap: espacos.md, paddingTop: espacos.sm },
  abas: { flexDirection: 'row', gap: espacos.sm },
  codigoCaixa: {
    paddingVertical: espacos.md,
    borderRadius: raios.md,
    backgroundColor: cores.fundoElevado,
    borderWidth: 1,
    borderColor: cores.dourado,
  },
});
