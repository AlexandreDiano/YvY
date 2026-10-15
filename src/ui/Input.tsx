import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { IconEye, IconEyeOff } from '@/ui/icons';
import { Txt } from '@/ui/Text';
import { TOUCH, color, radius, space } from '@/ui/tokens';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
};

export function Field({ label, hint, error, style, multiline, secureTextEntry, ...rest }: Props) {
  // campo de senha ganha o "olhinho" para conferir o que digitou antes de enviar
  const [show, setShow] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Txt variant="label" muted upper>
          {label}
        </Txt>
      ) : null}
      <View>
        <TextInput
          {...rest}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !show}
          autoCapitalize={secureTextEntry ? 'none' : rest.autoCapitalize}
          autoCorrect={secureTextEntry ? false : rest.autoCorrect}
          placeholderTextColor={color.textMuted}
          style={[
            s.input,
            multiline && { minHeight: 108, textAlignVertical: 'top', paddingTop: space.md },
            secureTextEntry && { paddingRight: TOUCH },
            error ? { borderColor: color.danger } : null,
            style,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={show ? 'Esconder senha' : 'Mostrar senha'}
            onPress={() => setShow((v) => !v)}
            hitSlop={8}
            style={s.eye}
          >
            {show ? <IconEyeOff size={20} color={color.textMuted} /> : <IconEye size={20} color={color.textMuted} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" muted>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: TOUCH,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: 15,
    color: color.text,
  },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
