import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Txt } from '@/ui/Text';
import { color, radius, space } from '@/ui/tokens';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={color.primary} />
      {label ? (
        <Txt variant="small" muted>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <Txt variant="heading" center>
        {title}
      </Txt>
      {detail ? (
        <Txt variant="small" muted center>
          {detail}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

type BannerTone = 'info' | 'warning' | 'danger' | 'success';

const BANNER: Record<BannerTone, { bg: string; bar: string }> = {
  info: { bg: color.primarySoft, bar: color.primary },
  warning: { bg: color.warningSoft, bar: color.warning },
  danger: { bg: color.accentSoft, bar: color.danger },
  success: { bg: color.successSoft, bar: color.success },
};

export function Banner({
  title,
  detail,
  tone = 'info',
  action,
}: {
  title: string;
  detail?: string;
  tone?: BannerTone;
  action?: ReactNode;
}) {
  const t = BANNER[tone];
  return (
    <View style={[s.banner, { backgroundColor: t.bg, borderLeftColor: t.bar }]}>
      <Txt variant="heading">{title}</Txt>
      {detail ? (
        <Txt variant="small" muted>
          {detail}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View style={{ gap: space.xs }}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: value }}
        style={s.track}
      >
        <View style={[s.fill, { width: `${pct}%` }]} />
      </View>
      <Txt variant="small" muted>
        {value} de {total} · {pct}%
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  center: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  empty: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  banner: {
    backgroundColor: color.primarySoft,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.xs,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    overflow: 'hidden',
  },
  fill: { height: 8, backgroundColor: color.primary },
});
