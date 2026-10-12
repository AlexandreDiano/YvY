import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { deleteNotifications, listNotifications, markAllRead } from '../src/api/notifications';
import type { AppNotification } from '../src/lib/db.types';
import { relativeTime } from '../src/lib/format';
import { Button, Card, EmptyState, Loading, Row, Screen, Txt, color } from '../src/ui';

/** Avisos da pessoa: post publicado ou recusado, com o motivo da moderação. */
export default function Avisos() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listNotifications();
    setItems(list);
    // Abriu a tela = leu. O contador da Base zera na próxima vez.
    if (list.some((n) => !n.read_at)) await markAllRead();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function remove(id?: string) {
    try {
      await deleteNotifications(id);
      await load();
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível apagar.');
    }
  }

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
      {items.length > 1 ? (
        <Button
          title="Apagar todos"
          kind="ghost"
          small
          block={false}
          onPress={() =>
            Alert.alert('Apagar todos os avisos?', 'Não dá para desfazer.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => void remove() },
            ])
          }
        />
      ) : null}
      {items.length === 0 ? (
        <EmptyState title="Nenhum aviso" detail="Quando a moderação decidir um post seu, aparece aqui." />
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
              <Button title="Apagar" kind="ghost" small block={false} onPress={() => void remove(n.id)} />
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}
