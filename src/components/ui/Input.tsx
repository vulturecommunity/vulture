import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { cores, espacos, raios, tipografia } from '@/theme';

import { Icone, type NomeDeIcone } from './Icone';
import { Texto } from './Texto';

export interface InputProps extends TextInputProps {
  rotulo?: string;
  erro?: string | null;
  ajuda?: string;
  prefixo?: string;
  icone?: NomeDeIcone;
}

/** Campo de texto com rótulo, prefixo opcional (ex.: "@"), ícone e mensagem de erro. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { rotulo, erro, ajuda, prefixo, icone, style, onFocus, onBlur, ...resto },
  ref,
) {
  const [focado, setFocado] = useState(false);
  return (
    <View style={estilos.container}>
      {rotulo ? (
        <Texto variante="rotulo" cor={cores.textoSecundario} style={estilos.rotulo}>
          {rotulo}
        </Texto>
      ) : null}
      <View style={[estilos.caixa, focado && estilos.caixaFocada, !!erro && estilos.caixaErro]}>
        {icone ? (
          <Icone nome={icone} tamanho={18} cor={focado ? cores.texto : cores.textoTerciario} />
        ) : null}
        {prefixo ? (
          <Texto variante="corpo" cor={cores.textoTerciario}>
            {prefixo}
          </Texto>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={cores.textoTerciario}
          selectionColor={cores.vermelho}
          cursorColor={cores.vermelho}
          style={[estilos.input, style]}
          onFocus={(e) => {
            setFocado(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocado(false);
            onBlur?.(e);
          }}
          {...resto}
        />
      </View>
      {erro ? (
        <Texto variante="pequeno" cor={cores.erro} style={estilos.ajuda}>
          {erro}
        </Texto>
      ) : ajuda ? (
        <Texto variante="pequeno" cor={cores.textoTerciario} style={estilos.ajuda}>
          {ajuda}
        </Texto>
      ) : null}
    </View>
  );
});

const estilos = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  rotulo: { marginBottom: espacos.sm },
  caixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacos.sm,
    backgroundColor: cores.fundoCartao,
    borderRadius: raios.md,
    borderWidth: 1,
    borderColor: cores.borda,
    paddingHorizontal: espacos.md,
    minHeight: 50,
  },
  caixaFocada: { borderColor: cores.vermelho },
  caixaErro: { borderColor: cores.erro },
  input: {
    flex: 1,
    color: cores.texto,
    ...tipografia.corpo,
    paddingVertical: espacos.sm,
  },
  ajuda: { marginTop: espacos.xs },
});
