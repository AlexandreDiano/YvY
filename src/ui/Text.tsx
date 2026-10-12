import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { color, type } from '@/ui/tokens';

type Variant = keyof typeof type;

type Props = TextProps & {
  variant?: Variant;
  muted?: boolean;
  tone?: 'default' | 'primary' | 'accent' | 'danger' | 'onPrimary';
  center?: boolean;
  /** Caixa alta + tracking, para rotulos de secao ("O QUE ELE VAI CORTAR"). */
  upper?: boolean;
};

const tones: Record<NonNullable<Props['tone']>, string> = {
  default: color.text,
  primary: color.primary,
  accent: color.accent,
  danger: color.danger,
  onPrimary: color.textOnPrimary,
};

export function Txt({
  variant = 'body',
  muted,
  tone = 'default',
  center,
  upper,
  style,
  ...rest
}: Props) {
  const base = type[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: muted ? color.textMuted : tones[tone] },
        center && { textAlign: 'center' },
        upper && { textTransform: 'uppercase', letterSpacing: 0.8 },
        style,
      ]}
    />
  );
}
