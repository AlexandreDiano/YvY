import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { actionTypeLabel, cancelPresence, confirmPresence, inArea, listActions, myConfirmations } from '@/api/actions';
import { ActionsMap } from '@/features/actions/ActionsMap';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ActionListed } from '@/lib/db.types';
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
  // null = todas. Começa no bairro do cadastro, que é o que a pessoa mais procura.
  const [city, setCity] = useState<string | null>(profile?.city ?? null);
  const [neighborhood, setNeighborhood] = useState<string | null>(profile?.neighborhood ?? null);
  const [picked, setPicked] = useState(false);
  // perfil pode chegar depois do primeiro render (site aberto direto em /acoes)
  useEffect(() => {
    if (picked || !profile) return;
    setCity(profile.city);
    setNeighborhood(profile.neighborhood);
  }, [profile, picked]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setAcoes(await listActions());
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

  const cities = useMemo(() => distinct([profile?.city, ...acoes.map((a) => a.city)]), [acoes, profile]);
  const neighborhoods = useMemo(
    () =>
      distinct([
        city === null || city === profile?.city ? profile?.neighborhood : null,
        ...acoes.filter((a) => inArea(a, city, null)).map((a) => a.neighborhood),
      ]),
    [acoes, city, profile],
  );
  const visible = acoes.filter((a) => inArea(a, city, neighborhood));
  const where = [neighborhood, city].filter(Boolean).join(', ') || 'todas as cidades';

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
        <Txt variant="title">Ações</Txt>
        <Button title="+ Nova" small block={false} onPress={() => router.push('/acoes/nova')} />
      </Row>

      {profile ? <ActionsMap actions={visible} area={profile} /> : null}

      <Txt variant="label" muted upper>
        Cidade
      </Txt>
      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        <Chip
          label="Todas"
          active={city === null}
          onPress={() => {
            setPicked(true);
            setCity(null);
            setNeighborhood(null);
          }}
        />
        {cities.map((c) => (
          <Chip
            key={c}
            label={c}
            active={city === c}
            onPress={() => {
              setPicked(true);
              setCity(c);
              setNeighborhood(null);
            }}
          />
        ))}
      </Row>
      <Txt variant="label" muted upper>
        Bairro
      </Txt>
      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        <Chip
          label="Todos"
          active={neighborhood === null}
          onPress={() => {
            setPicked(true);
            setNeighborhood(null);
          }}
        />
        {neighborhoods.map((n) => (
          <Chip
            key={n}
            label={n}
            active={neighborhood === n}
            onPress={() => {
              setPicked(true);
              setNeighborhood(n);
            }}
          />
        ))}
      </Row>

      <Section title={`Lista · ${where}`} />
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          title="Nenhuma ação por aqui"
          detail={
            neighborhood === profile?.neighborhood
              ? 'Panfletagem, mutirão, porta a porta: a primeira ação do bairro pode ser sua.'
              : 'De outros bairros aparecem só as ações abertas ao público.'
          }
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

/** Sem repetidos e sem vazios, em ordem alfabética. */
function distinct(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
