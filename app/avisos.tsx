import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, RefreshControl } from 'react-native';
import { deleteNotifications, listNotifications, markAllRead } from '@/api/notifications';
import { voteAlertLinks } from '@/api/voteAlerts';
import { useAuth } from '@/features/auth/AuthProvider';
import type { AppNotification } from '@/lib/db.types';
import { relativeTime } from '@/lib/format';
import { confirmAction } from '@/lib/notify';
import { Button, Card, EmptyState, Loading, Row, Screen, Txt, color } from '@/ui';

export default function Avisos() {
  const { profile, ready } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listNotifications();
    setItems(list);
    // abriu a tela, leu. O contador da Base zera na próxima vez
    if (list.some((n) => !n.read_at)) await markAllRead();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function openVote(id: string, which: 'vote' | 'ficha') {
    try {
      const links = await voteAlertLinks(id);
      const url = which === 'vote' ? (links?.voteUrl ?? links?.url) : links?.url;
      if (url) await Linking.openURL(url);
      else Alert.alert('Link indisponível', 'Essa votação saiu da lista.');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não deu para abrir o link.');
    }
  }

  async function remove(id?: string) {
    try {
      await deleteNotifications(id);
      await load();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível apagar.');
    }
  }

  // link do e-mail aberto num navegador sem login: entra e volta para cá
  if (ready && !profile) return <Redirect href={{ pathname: '/entrar', params: { next: '/avisos' } }} />;
  if (!items) return <Loading />;

  return (
    <Screen
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
      {items.length > 0 ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="small" muted>
            {items.length === 1 ? '1 aviso' : `${items.length} avisos`}
          </Txt>
          <Button
            title="Apagar todos"
            kind="outline"
            small
            block={false}
            onPress={() =>
              confirmAction(
                'Apagar todos os avisos?',
                'Somem todos de uma vez e não dá para desfazer.',
                'Apagar todos',
                () => void remove(),
                true,
              )
            }
          />
        </Row>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          title="Nenhum aviso"
          detail="Quando sair uma ação no seu bairro, entrar em pauta uma votação importante ou a moderação decidir um post seu, aparece aqui."
        />
      ) : (
        items.map((n) => (
          <Card key={n.id} stripe={n.kind === 'post_removed' ? color.accent : color.primary}>
            <Txt variant="heading">{n.title}</Txt>
            {n.body ? (
              <Txt variant="body">
                {n.kind === 'post_removed' ? `Motivo: ${n.body}` : n.body}
              </Txt>
            ) : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="small" muted>
                {relativeTime(n.created_at)}
                {n.read_at ? '' : ' · novo'}
              </Txt>
              <Row>
                {n.kind === 'action_new' && n.ref_id ? (
                  <Button
                    title="Ver e confirmar"
                    small
                    block={false}
                    onPress={() => router.push({ pathname: '/acoes/[id]', params: { id: n.ref_id! } })}
                  />
                ) : null}
                {n.kind === 'vote_alert' && n.ref_id ? (
                  <>
                    <Button title="Votar na consulta" small block={false} onPress={() => void openVote(n.ref_id!, 'vote')} />
                    <Button title="Ficha" kind="ghost" small block={false} onPress={() => void openVote(n.ref_id!, 'ficha')} />
                  </>
                ) : null}
                <Button title="Apagar" kind="ghost" small block={false} onPress={() => void remove(n.id)} />
              </Row>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
