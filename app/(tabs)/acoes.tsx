import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import {
  ACTION_TYPES,
  actionTypeLabel,
  cancelPresence,
  confirmPresence,
  listActions,
  myConfirmations,
} from '@/api/actions';
import { ActionsMap } from '@/features/actions/ActionsMap';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ActionListed, ActionType } from '@/lib/db.types';
import { shortDateTime } from '@/lib/format';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Row,
  Screen,
  Section,
  Txt,
  space,
} from '@/ui';

export default function Acoes() {
  const router = useRouter();
  const { profile } = useAuth();
  const [acoes, setAcoes] = useState<ActionListed[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ActionType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setAcoes(await listActions(profile));
      setConfirmed(await myConfirmations(profile.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar as ações.');
    }
  }, [profile]);

  // recarrega quando volta pra tela (ex.: depois de criar uma ação)
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visible = filter === 'all' ? acoes : acoes.filter((a) => a.type === filter);

  return (
    <Screen safeTop
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="title">Ações no seu bairro</Txt>
        <Button title="+ Nova" small block={false} onPress={() => router.push('/acoes/nova')} />
      </Row>

      {profile ? <ActionsMap actions={visible} area={profile} /> : null}

      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        <Chip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
        {ACTION_TYPES.map((t) => (
          <Chip key={t.key} label={t.label} active={filter === t.key} onPress={() => setFilter(t.key)} />
        ))}
      </Row>

      <Section title="Lista" />
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhuma ação por aqui"
          detail="Panfletagem, mutirão, porta a porta: a primeira ação do bairro pode ser sua."
          action={<Button title="Criar ação" small block={false} onPress={() => router.push('/acoes/nova')} />}
        />
      ) : (
        visible.map((a) => {
          const mine = confirmed.has(a.id);
          const full = a.max_participants !== null && a.participant_count >= a.max_participants;
          return (
            <Card key={a.id} onPress={() => router.push(`/acoes/${a.id}`)}>
              <Txt variant="label" muted upper>
                {actionTypeLabel(a.type)}
              </Txt>
              <Txt variant="heading">{a.title}</Txt>
              <Txt variant="small" muted>
                {shortDateTime(a.scheduled_at)}
                {a.location_name ? ` · ${a.location_name}` : ''}
              </Txt>
              <Txt variant="small" muted>
                {a.participant_count}
                {a.max_participants ? `/${a.max_participants}` : ''} confirmados
              </Txt>
              <Row>
                <Button
                  title="Detalhes"
                  kind="outline"
                  small
                  block={false}
                  onPress={() => router.push(`/acoes/${a.id}`)}
                />
                <Button
                  title={mine ? 'Desmarcar' : full ? 'Lotada' : 'Confirmar'}
                  kind={mine ? 'ghost' : 'primary'}
                  small
                  block={false}
                  disabled={!mine && full}
                  onPress={async () => {
                    if (!profile) return;
                    if (mine) await cancelPresence(a.id, profile.id);
                    else await confirmPresence(a.id, profile.id);
                    await load();
                  }}
                />
              </Row>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
