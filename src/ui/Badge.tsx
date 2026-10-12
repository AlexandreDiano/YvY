import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/ui/Text';
import { color, radius, space } from '@/ui/tokens';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Severidade dos cards de proposta. O contexto usa emoji (🟡/🔴/🔴🔴);
 * aqui a cor carrega o sinal e o texto carrega o significado — emoji sozinho
 * nao e lido por leitor de tela.
 */
export const SEVERITY: Record<Severity, { label: string; color: string }> = {
  low: { label: 'Baixo', color: color.neutral },
  medium: { label: 'Médio', color: color.warning },
  high: { label: 'Alto', color: color.accent },
  critical: { label: 'Crítico', color: color.danger },
};

export function SeverityBadge({ level }: { level: Severity }) {
  const s = SEVERITY[level] ?? SEVERITY.medium;
  return <Badge label={s.label} color={s.color} />;
}

export function Badge({ label, color: c = color.neutral }: { label: string; color?: string }) {
  return (
    <View style={[st.badge, { backgroundColor: c }]}>
      <Txt variant="label" tone="onPrimary">
        {label}
      </Txt>
    </View>
  );
}

/** Chip de filtro (lista de acoes, areas de proposta). */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        st.chip,
        active && { backgroundColor: color.primary, borderColor: color.primary },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Txt variant="small" tone={active ? 'onPrimary' : 'default'}>
        {label}
      </Txt>
    </Pressable>
  );
}

const st = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
