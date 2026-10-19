import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { actionTypeLabel, cancelPresence, confirmPresence, inArea, listActions, myConfirmations } from '@/api/actions';
import { followedRegions, inRegion, myRegion, type MyRegion } from '@/api/geo';
import { ActionsMap } from '@/features/actions/ActionsMap';
import { useAuth } from '@/features/auth/AuthProvider';
import { TourTarget } from '@/features/onboarding/Tour';
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
  // Região imediata do IBGE (Curitiba + SJP + Pinhais...). Ligada, cidade e
  // bairro só mostram o que é da região da pessoa.
  const [region, setRegion] = useState<MyRegion | null>(null);
  const [followed, setFollowed] = useState<MyRegion[]>([]);
  // 'mine' = região da pessoa, número = região seguida, 'all' = sem filtro
  const [regionSel, setRegionSel] = useState<'mine' | 'all' | number>('mine');
  useEffect(() => {
    if (profile) void myRegion(profile.id).then(setRegion);
  }, [profile]);
  const selected =
    regionSel === 'all' ? null : regionSel === 'mine' ? region : (followed.find((f) => f.id === regionSel) ?? region);
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
      setFollowed(await followedRegions());
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

  const inScope = useMemo(
    () => (selected ? acoes.filter((a) => inRegion(a.city, selected)) : acoes),
    [acoes, selected],
  );
  const cities = useMemo(
    () => distinct([selected === region || !selected ? profile?.city : null, ...inScope.map((a) => a.city)]),
    [inScope, profile, selected, region],
  );
  const neighborhoods = useMemo(
    () =>
      distinct([
        selected === region && (city === null || city === profile?.city) ? profile?.neighborhood : null,
        ...inScope.filter((a) => inArea(a, city, null)).map((a) => a.neighborhood),
      ]),
    [inScope, city, profile],
  );
  const visible = inScope.filter((a) => inArea(a, city, neighborhood));
  function pickRegion(sel: 'mine' | 'all' | number) {
    setPicked(true);
    setRegionSel(sel);
    setCity(null);
    setNeighborhood(null);
  }

  const where =
    [neighborhood, city].filter(Boolean).join(', ') ||
    (selected ? `região de ${selected.name}` : 'todas as cidades');

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
        <TourTarget id="acoes.nova">
          <Button title="+ Nova" small block={false} onPress={() => router.push('/acoes/nova')} />
        </TourTarget>
      </Row>

      {profile ? (
        <TourTarget id="acoes.map">
          <ActionsMap actions={visible} area={profile} />
        </TourTarget>
      ) : null}

      {region ? (
        <TourTarget id="acoes.region" style={{ gap: space.md }}>
          <Txt variant="label" muted upper>
            Região
          </Txt>
          <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
            <Chip
              label={`Região de ${region.name}`}
              active={regionSel === 'mine'}
              onPress={() => pickRegion('mine')}
            />
            {followed.map((f) => (
              <Chip
                key={f.id}
                label={`${f.name} (${f.uf})`}
                active={regionSel === f.id}
                onPress={() => pickRegion(f.id)}
              />
            ))}
            <Chip label="Todas" active={regionSel === 'all'} onPress={() => pickRegion('all')} />
            <Chip label="+ Seguir região" onPress={() => router.push('/regioes')} />
          </Row>
        </TourTarget>
      ) : null}
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
