import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/ui/Text';
import { IconCheck } from '@/ui/icons';
import { TOUCH, color, radius, space } from '@/ui/tokens';

/** Caixa de marcar: aceite de termos, notificações. */
export function Toggle({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }, disabled && { opacity: 0.5 }]}
    >
      <View style={[s.box, value && { backgroundColor: color.primary, borderColor: color.primary }]}>
        {value ? <IconCheck size={16} color={color.textOnPrimary} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="body">{label}</Txt>
        {detail ? (
          <Txt variant="small" muted>
            {detail}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Escolha única em lista vertical (tipo de ação, precisão de localização). */
export function Options<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { key: T; label: string; detail?: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Txt variant="label" muted upper>
          {label}
        </Txt>
      ) : null}
      <View style={s.group}>
        {options.map((opt, i) => {
          const active = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(opt.key)}
              style={({ pressed }) => [
                s.option,
                i > 0 && { borderTopWidth: 1, borderTopColor: color.border },
                active && { backgroundColor: color.primarySoft },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[s.radio, active && { borderColor: color.primary, borderWidth: 6 }]} />
              <View style={{ flex: 1 }}>
                <Txt variant="body">{opt.label}</Txt>
                {opt.detail ? (
                  <Txt variant="small" muted>
                    {opt.detail}
                  </Txt>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    minHeight: TOUCH,
    paddingVertical: space.xs,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  group: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: TOUCH,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
  },
});
