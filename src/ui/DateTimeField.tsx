import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt } from './Text';
import { TOUCH, color, radius, space } from './tokens';

const pad = (n: number) => String(n).padStart(2, '0');
const label = (d: Date) =>
  `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Data + hora com o seletor nativo (sem digitar). `minimum` impede escolher
 * antes dela. No navegador usa o campo datetime-local do próprio browser.
 */
export function DateTimeField({
  label: title,
  value,
  minimum,
  onChange,
  hint,
}: {
  label: string;
  value: Date;
  minimum: Date;
  onChange: (d: Date) => void;
  hint?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);

  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate: minimum,
      onValueChange: (_e, date) => {
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_e2, time) => {
            const next = new Date(date);
            next.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(next);
          },
        });
      },
    });
  }

  return (
    <View style={{ gap: space.xs }}>
      <Txt variant="label" muted upper>
        {title}
      </Txt>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'datetime-local',
          value: toLocalInput(value),
          min: toLocalInput(minimum),
          onChange: (e: { target: { value: string } }) => {
            const d = new Date(e.target.value);
            if (!Number.isNaN(d.getTime())) onChange(d);
          },
          style: { padding: 12, borderRadius: 10, border: `1px solid ${color.border}`, fontSize: 15 },
        })
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => (Platform.OS === 'android' ? openAndroid() : setIosOpen((v) => !v))}
          style={({ pressed }) => [s.box, pressed && { opacity: 0.7 }]}
        >
          <Txt variant="body">{label(value)}</Txt>
          <Txt variant="small" tone="primary">
            Alterar
          </Txt>
        </Pressable>
      )}
      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="spinner"
          minimumDate={minimum}
          locale="pt-BR"
          onValueChange={(_, d) => onChange(d)}
        />
      ) : null}
      {hint ? (
        <Txt variant="small" muted>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const s = StyleSheet.create({
  box: {
    minHeight: TOUCH,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
