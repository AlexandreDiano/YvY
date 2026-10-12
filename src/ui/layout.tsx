import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';
import { color, space } from './tokens';

/** Container de tela. `scroll` liga o ScrollView com padding seguro. */
export function Screen({
  children,
  scroll = true,
  refreshControl,
  contentStyle,
  safeTop,
}: {
  children: ReactNode;
  scroll?: boolean;
  /**
   * Tela sem header de navegacao (abas, welcome): afasta o conteudo da barra
   * de status. Telas com header do Stack nao usam — o header ja faz isso.
   */
  safeTop?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  contentStyle?: ViewProps['style'];
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingBottom: insets.bottom + space.xxl };
  // depois de contentStyle: padding proprio da tela nao pode esconder a barra de status
  const top = safeTop ? { paddingTop: insets.top + space.lg } : null;

  if (!scroll) {
    return <View style={[s.screen, s.pad, pad, contentStyle, top]}>{children}</View>;
  }
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.pad, pad, contentStyle, top]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

/** Rotulo de secao com regua, como nos wireframes (secao 7 do contexto). */
export function Section({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={s.section}>
      <Txt variant="label" muted upper>
        {title}
      </Txt>
      <View style={s.rule} />
      {right}
    </View>
  );
}

export function Row({ style, children, gap = space.sm, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

export function Divider() {
  return <View style={s.divider} />;
}

export function Spacer({ size = space.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  pad: { padding: space.lg, gap: space.md },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  rule: { flex: 1, height: 1, backgroundColor: color.border },
  divider: { height: 1, backgroundColor: color.border, marginVertical: space.sm },
});
