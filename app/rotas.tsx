import { useCallback, useEffect, useState } from 'react';
import { useNoScreenshots } from '@/lib/privacy';
import { Alert } from 'react-native';
import {
  buildRoutes,
  claimRoute,
  coordinatorStats,
  listUnassignedRoutes,
  type CoordinatorStats,
} from '@/api/voters';
import { useAuth } from '@/features/auth/AuthProvider';
import type { PullRoute } from '@/lib/db.types';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Progress,
  Screen,
  Section,
  Txt,
} from '@/ui';

/** Fluxo 4.5, fase 2 — formar e atribuir rotas de puxada. */
export default function Rotas() {
  useNoScreenshots('rotas');
  const { profile, isModerator } = useAuth();
  const [stats, setStats] = useState<CoordinatorStats | null>(null);
  const [routes, setRoutes] = useState<PullRoute[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setStats(await coordinatorStats(profile));
    setRoutes(await listUnassignedRoutes(profile));
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isModerator) {
    return (
      <Screen>
        <Banner tone="warning" title="Painel do coordenador" detail="Só moderador do bairro ou admin." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Banner
        title="Dado pessoal de terceiro"
        tone="danger"
        detail="Esta tela mexe com nome e local de votação de pessoas que podem não usar o app. Não imprima, não tire print, não mande em grupo."
      />

      <Section title={stats?.neighborhood ?? 'Seu bairro'} />
      <Card>
        <Txt variant="small" muted>
          Eleitores cadastrados: {stats?.voters ?? 0}
        </Txt>
        <Txt variant="small" muted>
          Rotas formadas: {stats?.routes ?? 0} · com puxador: {stats?.assigned ?? 0}
        </Txt>
        {stats ? <Progress value={stats.voted} total={stats.voters} /> : null}
      </Card>

      <Section title="Formar rotas" />
      <Txt variant="small" muted>
        Agrupa quem ainda não tem rota por bairro e local de votação, no máximo 5
        por puxador. Pode rodar quantas vezes quiser: só pega quem sobrou.
      </Txt>
      <Button
        title="Formar rotas agora"
        loading={busy}
        onPress={async () => {
          if (!profile) return;
          setBusy(true);
          try {
            const created = await buildRoutes(profile);
            await load();
            Alert.alert('Rotas formadas', `${created} ${created === 1 ? 'rota criada' : 'rotas criadas'}.`);
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao formar rotas.');
          } finally {
            setBusy(false);
          }
        }}
      />

      <Section title="Rotas sem puxador" />
      {routes.length === 0 ? (
        <EmptyState title="Nenhuma rota livre" detail="Todas as rotas já têm puxador atribuído." />
      ) : (
        routes.map((r) => (
          <Card key={r.id}>
            <Txt variant="heading">
              {r.neighborhood} · até {r.max_voters} eleitores
            </Txt>
            <Button
              title="Assumir esta rota"
              small
              onPress={async () => {
                if (!profile) return;
                await claimRoute(r.id, profile.id);
                await load();
                Alert.alert('Rota atribuída', 'Ela aparece na aba Votar do puxador.');
              }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
