import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { followRegion, followedRegions, listRegions, myRegion, UFS, type MyRegion, type RegionOption } from '@/api/geo';
import { useAuth } from '@/features/auth/AuthProvider';
import { Button, Card, Chip, EmptyState, Row, Screen, Section, Txt, space } from '@/ui';

/**
 * Regiões que a pessoa segue (migration 0045). Seguir uma região deixa ler os
 * posts de região de lá na Base e ver as ações abertas de lá. Postar continua
 * só na própria região. Até 5.
 */
export default function Regioes() {
  const { profile } = useAuth();
  const [followed, setFollowed] = useState<MyRegion[]>([]);
  const [uf, setUf] = useState<string>(profile?.state ?? 'PR');
  const [options, setOptions] = useState<RegionOption[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [own, setOwn] = useState<number | null>(null);

  const load = useCallback(async (nextUf: string) => {
    setFollowed(await followedRegions());
    if (profile) setOwn((await myRegion(profile.id))?.id ?? null);
    try {
      setOptions(await listRegions(nextUf));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para carregar as regiões.');
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load(uf);
    }, [load, uf]),
  );

  async function toggle(id: number, follow: boolean) {
    setBusy(id);
    setError(null);
    try {
      await followRegion(id, follow);
      setFollowed(await followedRegions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para salvar.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Txt variant="small" muted>
        Seguir uma região deixa você ler os posts de região de lá na Base e ver as ações abertas ao público
        de lá. Seus posts continuam indo só para a sua região. Dá para seguir até 5.
      </Txt>

      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      <Section title="Você segue" />
      {followed.length === 0 ? (
        <EmptyState title="Nenhuma ainda" detail="Escolha o estado e a região abaixo." />
      ) : (
        followed.map((f) => (
          <Card key={f.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="heading">
                {f.name} ({f.uf})
              </Txt>
              <Button
                title="Deixar de seguir"
                kind="ghost"
                small
                block={false}
                loading={busy === f.id}
                onPress={() => void toggle(f.id, false)}
              />
            </Row>
            <Txt variant="small" muted numberOfLines={2}>
              {f.cities.join(', ')}
            </Txt>
          </Card>
        ))
      )}

      <Section title="Seguir outra região" />
      <Row style={{ flexWrap: 'wrap' }} gap={space.xs}>
        {UFS.map((u) => (
          <Chip key={u} label={u} active={uf === u} onPress={() => setUf(u)} />
        ))}
      </Row>
      {options.map((o) => {
        const following = followed.some((f) => f.id === o.id);
        const mine = o.id === own;
        return (
          <Row key={o.id} style={{ justifyContent: 'space-between' }}>
            <Txt variant="body">
              {o.name} <Txt variant="small" muted>· {o.cityCount} {o.cityCount === 1 ? 'cidade' : 'cidades'}</Txt>
            </Txt>
            <Button
              title={mine ? 'Sua região' : following ? 'Seguindo' : 'Seguir'}
              kind={following || mine ? 'ghost' : 'outline'}
              small
              block={false}
              loading={busy === o.id}
              disabled={mine || following || followed.length >= 5}
              onPress={() => void toggle(o.id, true)}
            />
          </Row>
        );
      })}
    </Screen>
  );
}
