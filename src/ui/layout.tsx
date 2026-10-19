import { createContext, useMemo, useRef, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/ui/Text';
import { color, space } from '@/ui/tokens';

/**
 * Rolagem da tela em volta, para quem precisa trazer um item para a vista
 * (tour do primeiro acesso, src/features/onboarding/Tour.tsx).
 */
export type ScreenScroll = { scrollBy: (dy: number) => void };
export const ScreenScrollContext = createContext<ScreenScroll | null>(null);

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
   * Tela sem header de navegação (abas, boas-vindas): afasta o conteúdo da
   * barra de status. Tela com header do Stack não precisa, o header já faz isso.
   */
  safeTop?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  contentStyle?: ViewProps['style'];
}) {
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollView>(null);
  const y = useRef(0);
  const scroller = useMemo<ScreenScroll>(
    () => ({
      scrollBy: (dy) => ref.current?.scrollTo({ y: Math.max(0, y.current + dy), animated: true }),
    }),
    [],
  );
  const pad = { paddingBottom: insets.bottom + space.xxl };
  // depois do contentStyle, senão o padding da tela esconde a barra de status
  const top = safeTop ? { paddingTop: insets.top + space.lg } : null;

  if (!scroll) {
    return <View style={[s.screen, s.pad, pad, contentStyle, top]}>{children}</View>;
  }
  return (
    <ScreenScrollContext.Provider value={scroller}>
      <ScrollView
        ref={ref}
        onScroll={(e) => {
          y.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={64}
        style={s.screen}
        contentContainerStyle={[s.pad, pad, contentStyle, top]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </ScreenScrollContext.Provider>
  );
}

/** Rótulo de seção com régua, como nos wireframes. */
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
