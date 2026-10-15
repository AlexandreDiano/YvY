import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ACTION_TYPES, createAction } from '@/api/actions';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ActionType } from '@/lib/db.types';
import {
  Button,
  DateTimeField,
  Field,
  MeetingPointPicker,
  Options,
  Screen,
  Section,
  Txt,
  space,
  type Point,
} from '@/ui';

const HOUR = 60 * 60 * 1000;

// no mínimo daqui a 1h; por padrão ~2h, arredondado pra meia hora
function minStart(): Date {
  return new Date(Date.now() + HOUR);
}
function defaultStart(): Date {
  const d = new Date(Date.now() + 2 * HOUR);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

export default function NovaAcao() {
  const router = useRouter();
  const { profile } = useAuth();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ActionType>('panfletagem');
  const [description, setDescription] = useState('');
  const [when, setWhen] = useState<Date>(defaultStart);
  const [place, setPlace] = useState('');
  const [point, setPoint] = useState<Point | null>(null);
  const [max, setMax] = useState('');
  const [visibility, setVisibility] = useState<'base' | 'public'>('base');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!profile) return;
    setError(null);
    if (title.trim().length < 4) {
      setError('Dê um título que diga o que é e onde.');
      return;
    }
    if (when.getTime() < minStart().getTime() - 60 * 1000) {
      setError('A ação precisa ser daqui a pelo menos 1 hora.');
      return;
    }
    const iso = when.toISOString();
    setBusy(true);
    try {
      const id = await createAction(profile, {
        title: title.trim(),
        description: description.trim(),
        type,
        scheduled_at: iso,
        location_name: place.trim(),
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        max_participants: max.trim() ? Number(max) : null,
        visibility,
      });
      router.replace(`/acoes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a ação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field
        label="Título"
        value={title}
        onChangeText={setTitle}
        placeholder="Panfletagem na Praça da Matriz"
      />
      <Options
        label="Tipo"
        value={type}
        options={ACTION_TYPES.map((t) => ({ key: t.key, label: t.label }))}
        onChange={setType}
      />
      <Field
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Levar 200 panfletes. Trazer boné da campanha."
      />
      <DateTimeField
        label="Data e hora"
        value={when}
        minimum={minStart()}
        onChange={setWhen}
        hint="Só datas futuras: no mínimo daqui a 1 hora."
      />
      <Field
        label="Local"
        value={place}
        onChangeText={setPlace}
        placeholder="Praça da Matriz"
        hint={`Bairro preenchido pelo seu perfil: ${profile?.neighborhood ?? '—'}.`}
      />
      <Section title="Ponto de encontro (opcional)" />
      <MeetingPointPicker
        value={point}
        onChange={setPoint}
        area={{
          cep: profile?.cep,
          neighborhood: profile?.neighborhood,
          city: profile?.city,
          state: profile?.state,
        }}
      />
      <Field
        label="Máximo de participantes"
        value={max}
        onChangeText={setMax}
        keyboardType="number-pad"
        placeholder="15 (vazio = ilimitado)"
      />
      <Options
        label="Visibilidade"
        value={visibility}
        options={[
          { key: 'base', label: 'Só a base', detail: 'Membros confirmados do bairro' },
          { key: 'public', label: 'Pública', detail: 'Qualquer pessoa com o app vê' },
        ]}
        onChange={setVisibility}
      />

      <Section title="Antes de publicar" />
      <Txt variant="small" muted>
        Ao publicar, os membros do bairro veem a ação e podem confirmar
        presença. Você pode cancelar depois, com motivo.
      </Txt>
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
      <View style={{ height: space.sm }} />
      <Button title="Publicar ação" loading={busy} onPress={submit} />
    </Screen>
  );
}
