import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { listBlocked, unblockPeer } from '@/api/chat';
import { ChatGate } from '@/features/chat/ChatGate';
import { camarada, relativeTime } from '@/lib/format';
import { Button, Card, EmptyState, Loading, Row, Screen, Txt } from '@/ui';

/** Quem você bloqueou. Desbloquear volta a deixar os dois mandarem mensagem. */
export default function Bloqueados() {
  return (
    <ChatGate>
      <Lista />
    </ChatGate>
  );
}

function Lista() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listBlocked>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listBlocked());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!items) return <Loading />;

  return (
    <Screen>
      {items.length === 0 ? <EmptyState title="Ninguém bloqueado" /> : null}
      {items.map((b) => (
        <Card key={b.peerId}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label">{camarada(b.name)}</Txt>
            <Button
              title="Desbloquear"
              kind="outline"
              small
              block={false}
              onPress={() => void unblockPeer(b.peerId).then(load, (err) => setError(String(err?.message ?? err)))}
            />
          </Row>
          <Txt variant="small" muted>
            {b.neighborhood ? `${b.neighborhood} · ` : ''}bloqueado {relativeTime(b.at)}
          </Txt>
        </Card>
      ))}
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}
    </Screen>
  );
}
