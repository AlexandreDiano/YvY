import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/ui/Text';
import { TOUCH, color, radius, space } from '@/ui/tokens';

type Kind = 'primary' | 'accent' | 'outline' | 'ghost';

type Props = {
  title: string;
  onPress?: () => void;
  kind?: Kind;
  loading?: boolean;
  disabled?: boolean;
  /** Ocupa a largura toda. Padrao em formularios. */
  block?: boolean;
  small?: boolean;
  left?: ReactNode;
};

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading,
  disabled,
  block = true,
  small,
  left,
}: Props) {
  const off = disabled || loading;
  const solid = kind === 'primary' || kind === 'accent';
  const bg = kind === 'primary' ? color.primary : kind === 'accent' ? color.accent : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        s.base,
        small && s.small,
        { backgroundColor: bg },
        kind === 'outline' && s.outline,
        block ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' },
        pressed && { opacity: 0.75 },
        off && { opacity: 0.45 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? color.textOnPrimary : color.primary} />
      ) : (
        <View style={s.inner}>
          {left}
          <Txt
            variant="heading"
            tone={solid ? 'onPrimary' : 'primary'}
            style={small ? { fontSize: 14 } : undefined}
          >
            {title}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  small: { minHeight: 36, paddingVertical: space.sm, paddingHorizontal: space.md },
  outline: { borderWidth: 1, borderColor: color.primary },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
