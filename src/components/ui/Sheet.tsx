import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores, espacos, raios } from '@/theme';

import { Texto } from './Texto';

export interface SheetProps {
  visivel: boolean;
  aoFechar: () => void;
  titulo?: string;
  children: ReactNode;
  altura?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}

/** Painel inferior (bottom sheet) simples, baseado em Modal nativo. */
export function Sheet({ visivel, aoFechar, titulo, children, altura = '70%', style }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="slide"
      onRequestClose={aoFechar}
      statusBarTranslucent>
      <View style={estilos.fundo}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={aoFechar}
          accessibilityLabel="Fechar painel"
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[estilos.painel, { height: altura, paddingBottom: insets.bottom }, style]}>
          <View style={estilos.alca} />
          {titulo ? (
            <View style={estilos.cabecalho}>
              <Texto variante="destaque">{titulo}</Texto>
              <Pressable onPress={aoFechar} hitSlop={12} accessibilityLabel="Fechar">
                <Ionicons name="close" size={24} color={cores.textoSecundario} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: cores.overlayEscuro },
  painel: {
    backgroundColor: cores.fundoElevado,
    borderTopLeftRadius: raios.xl,
    borderTopRightRadius: raios.xl,
    paddingTop: espacos.sm,
  },
  alca: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: cores.borda,
    marginBottom: espacos.sm,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espacos.lg,
    paddingBottom: espacos.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
});
