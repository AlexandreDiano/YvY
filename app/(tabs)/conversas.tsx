import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import {
  decideContact,
  ensureDevice,
  fetchInbox,
  lastRead,
  listContacts,
  readMessages,
  watchInbox,
  type Contact,
} from '@/api/chat';
import { useAuth } from '@/features/auth/AuthProvider';
import { ChatGate } from '@/features/chat/ChatGate';
import { KEY_STORAGE_NOTE } from '@/lib/chat/keys';
import { camarada, relativeTime } from '@/lib/format';
import { Badge, Banner, Button, Card, EmptyState, Loading, Row, Screen, Section, Txt, color } from '@/ui';
import { IconLock } from '@/ui/icons';

type Preview = { text: string; at: string; fromMe: boolean; unread: boolean };

/**
 * Conversas 1:1. Ninguém escreve para quem não aceitou: a pessoa entra aqui
 * por código/QRCode de adicionar e o dono do código aceita.
 */
export default function Conversas() {
  return (
    <ChatGate>
      <Lista />
    </ChatGate>
  );
}

function Lista() {
  const { profile } = useAuth();
  const me = profile!.id;
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      await fetchInbox(me);
      const list = await listContacts();
      const read = await lastRead(me);
      const out: Record<string, Preview> = {};
      for (const c of list.filter((x) => x.status === 'accepted')) {
        const last = (await readMessages(me, c.peerId)).at(-1);
        if (last) {
          out[c.peerId] = {
            text: last.t,
            at: last.at,
            fromMe: last.from === me,
            unread: last.from !== me && (!read[c.peerId] || last.at > read[c.peerId]!),
          };
        }
      }
      setContacts(list);
      setPreviews(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setContacts((c) => c ?? []);
    }
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void ensureDevice(me).then((s) => {
        stop.current = watchInbox(s.deviceId, () => void load());
      });
      return () => {
        stop.current?.();
        stop.current = null;
      };
    }, [load, me]),
  );

  async function decide(c: Contact, accept: boolean) {
    setBusy(c.contactId);
    try {
      await decideContact(c.contactId, accept);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu.');
    } finally {
      setBusy(null);
    }
  }

  if (!contacts) return <Loading />;

  const incoming = contacts.filter((c) => c.status === 'pending' && c.incoming);
  const waiting = contacts.filter((c) => c.status === 'pending' && !c.incoming);
  const open = contacts
    .filter((c) => c.status === 'accepted' && !c.blocked)
    .sort((a, b) => (previews[b.peerId]?.at ?? b.createdAt).localeCompare(previews[a.peerId]?.at ?? a.createdAt));

  return (
    <Screen
      safeTop
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
        <Txt variant="title">Conversas</Txt>
        <Button title="Adicionar" small block={false} onPress={() => router.push('/conversas/adicionar')} />
      </Row>

      <Row gap={8}>
        <IconLock size={16} />
        <Txt variant="small" muted style={{ flex: 1 }}>
          Criptografia de ponta a ponta: o YvY não consegue ler suas conversas. {KEY_STORAGE_NOTE}
        </Txt>
      </Row>

      {error ? <Banner tone="danger" title="Algo deu errado" detail={error} /> : null}

      {incoming.length ? <Section title="Pedidos para você" /> : null}
      {incoming.map((c) => (
        <Card key={c.contactId}>
          <Txt variant="label">{camarada(c.name)}</Txt>
          <Txt variant="small" muted>
            {[c.neighborhood, c.city].filter(Boolean).join(', ')} · quer conversar com você
          </Txt>
          <Row>
            <Button title="Aceitar" small block={false} loading={busy === c.contactId} onPress={() => void decide(c, true)} />
            <Button title="Recusar" kind="outline" small block={false} disabled={busy === c.contactId} onPress={() => void decide(c, false)} />
          </Row>
        </Card>
      ))}

      {open.length ? <Section title="Suas conversas" /> : null}
      {open.map((c) => {
        const p = previews[c.peerId];
        return (
          <Card key={c.contactId} onPress={() => router.push({ pathname: '/conversas/[id]', params: { id: c.peerId } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="label">{camarada(c.name)}</Txt>
              {p?.unread ? <Badge label="nova" color={color.accent} /> : null}
            </Row>
            <Txt variant="small" muted numberOfLines={1}>
              {p ? `${p.fromMe ? 'Você: ' : ''}${p.text}` : [c.neighborhood, c.city].filter(Boolean).join(', ')}
            </Txt>
            {p ? (
              <Txt variant="small" muted>
                {relativeTime(p.at)}
              </Txt>
            ) : null}
          </Card>
        );
      })}

      {waiting.length ? <Section title="Esperando aceitar" /> : null}
      {waiting.map((c) => (
        <Card key={c.contactId}>
          <Txt variant="label">{camarada(c.name)}</Txt>
          <Txt variant="small" muted>
            Pedido enviado {relativeTime(c.createdAt)}. A conversa abre quando a pessoa aceitar.
          </Txt>
        </Card>
      ))}

      {!incoming.length && !open.length && !waiting.length ? (
        <EmptyState
          title="Nenhuma conversa ainda"
          detail="Para conversar com alguém, um dos dois mostra o QRCode em Adicionar e o outro lê. Quem mostrou aceita o pedido."
        />
      ) : null}

      <View style={{ height: 8 }} />
      <Button title="Pessoas bloqueadas" kind="ghost" onPress={() => router.push('/conversas/bloqueados')} />
    </Screen>
  );
}
