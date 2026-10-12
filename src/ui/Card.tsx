import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { color, radius, space } from '@/ui/tokens';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /** Faixa colorida de 3px na borda esquerda. Usada para severidade/estado. */
  stripe?: string;
  style?: ViewStyle;
};

export function Card({ children, onPress, stripe, style }: Props) {
  const body = (
    <View style={[s.card, stripe ? { borderLeftWidth: 3, borderLeftColor: stripe } : null, style]}>
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.lg,
    gap: space.sm,
  },
});
