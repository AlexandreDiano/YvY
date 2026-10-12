import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import {
  actionTypeLabel,
  cancelPresence,
  checkIn,
  confirmPresence,
  getAction,
  myConfirmations,
  setStatus,
} from '@/api/actions';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ActionListed } from '@/lib/db.types';
import { longDate, shortDateTime } from '@/lib/format';
import { addActionToCalendar, scheduleActionReminder } from '@/lib/reminders';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Loading,
  Row,
  Screen,
  Section,
  Txt,
  color,
  openPoint,
} from '@/ui';

/** Detalhe da ação: confirmar presença, check-in no dia, cancelar (criador). */
export default function DetalheAcao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [action, setAction] = useState<ActionListed | null | 'loading'>('loading');
  const [mine, setMine] = useState(false);

  const load = useCallback(async () => {
    const a = await getAction(id);
    setAction(a);
    if (profile) setMine((await myConfirmations(profile.id)).has(id));
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (action === 'loading') return <Loading />;
  if (!action) return <EmptyState title="Ação não encontrada" />;

  const isCreator = profile?.id === action.created_by;
  const today = new Date().toDateString() === new Date(action.scheduled_at).toDateString();
  const full = action.max_participants !== null && action.participant_count >= action.max_participants;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge label={actionTypeLabel(action.type)} color={color.primary} />
        {action.status === 'cancelled' ? <Badge label="Cancelada" color={color.danger} /> : null}
      </Row>
      <Txt variant="display">{action.title}</Txt>
      <Txt variant="body" muted>
        {longDate(action.scheduled_at)} · {shortDateTime(action.scheduled_at)}
      </Txt>
      {action.location_name ? <Txt variant="body">{action.location_name}</Txt> : null}
      <Txt variant="small" muted>
        {action.neighborhood} · {action.city}/{action.state}
      </Txt>
      <Row style={{ flexWrap: 'wrap' }}>
        {action.lat != null && action.lng != null ? (
          <Button
            title="Ponto de encontro no mapa"
            kind="outline"
            small
            block={false}
            onPress={() => openPoint({ lat: action.lat!, lng: action.lng! }, action.location_name ?? action.title)}
          />
        ) : null}
        {action.status !== 'cancelled' && new Date(action.scheduled_at).getTime() > Date.now() ? (
          <Button
            title="Adicionar ao calendário"
            kind="ghost"
            small
            block={false}
            onPress={() => void addActionToCalendar(action).catch(() => undefined)}
          />
        ) : null}
      </Row>

      {action.description ? (
        <>
          <Section title="Descrição" />
          <Txt variant="body">{action.description}</Txt>
        </>
      ) : null}

      <Section title="Presença" />
      <Card>
        <Txt variant="heading">
          {action.participant_count}
          {action.max_participants ? ` de ${action.max_participants}` : ''} confirmados
        </Txt>
        <Txt variant="small" muted>
          A lista de quem confirmou fica com quem criou a ação. Para os outros, só o número.
        </Txt>
        {action.status === 'cancelled' ? (
          <Banner
            tone="danger"
            title="Ação cancelada"
            detail={action.cancel_reason ?? 'Sem motivo informado.'}
          />
        ) : (
          <>
            <Button
              title={mine ? 'Desmarcar presença' : full ? 'Ação lotada' : 'Confirmar presença'}
              kind={mine ? 'outline' : 'primary'}
              disabled={!mine && full}
              onPress={async () => {
                if (!profile) return;
                if (mine) await cancelPresence(action.id, profile.id);
                else {
                  await confirmPresence(action.id, profile.id);
                  // Aviso 1h antes, neste celular. Pede permissão aqui, na hora que faz sentido.
                  const reminder = await scheduleActionReminder(action).catch(() => null);
                  if (reminder) Alert.alert('Presença confirmada', 'Você recebe um aviso 1 hora antes.');
                }
                await load();
              }}
            />
            {mine && today ? (
              <Button
                title="Estou aqui"
                kind="accent"
                onPress={async () => {
                  if (!profile) return;
                  await checkIn(action.id, profile.id);
                  Alert.alert('Check-in feito', 'Presença registrada no local.');
                }}
              />
            ) : null}
          </>
        )}
      </Card>

      {isCreator && action.status !== 'cancelled' ? (
        <>
          <Section title="Você criou esta ação" />
          <Button
            title="Cancelar ação"
            kind="outline"
            onPress={() =>
              Alert.alert('Cancelar ação?', 'Quem confirmou presença será avisado.', [
                { text: 'Voltar', style: 'cancel' },
                {
                  text: 'Cancelar ação',
                  style: 'destructive',
                  onPress: async () => {
                    await setStatus(action.id, 'cancelled', 'Cancelada pelo organizador');
                    await load();
                    router.back();
                  },
                },
              ])
            }
          />
        </>
      ) : null}
    </Screen>
  );
}
