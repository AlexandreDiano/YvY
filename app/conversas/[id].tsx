import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  acceptPeerKeys,
  blockPeer,
  ensureDevice,
  fetchInbox,
  listContacts,
  markRead,
  MAX_TEXT,
  peerKeys,
  readMessages,
  reportPeer,
  sendMessage,
  unblockPeer,
  watchInbox,
  type Contact,
  type PeerKeys,
} from '@/api/chat';
import { useAuth } from '@/features/auth/AuthProvider';
import { ChatGate } from '@/features/chat/ChatGate';
import type { StoredMessage } from '@/lib/chat/store';
import { camarada, shortDateTime } from '@/lib/format';
import { confirmAction } from '@/lib/notify';
import { useNoScreenshots } from '@/lib/privacy';
import { Banner, Button, Card, EmptyState, Loading, Row, Txt, color, radius, space, type } from '@/ui';

export default function Conversa() {
  return (
    <ChatGate>
      <Tela />
    </ChatGate>
  );
}

function Tela() {
  useNoScreenshots('conversa');
  const { profile } = useAuth();
  const me = profile!.id;
  const { id: peer } = useLocalSearchParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null | 'loading'>('loading');
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [keys, setKeys] = useState<PeerKeys | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const stop = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const c = (await listContacts()).find((x) => x.peerId === peer && x.status === 'accepted') ?? null;
      setContact(c);
      if (!c) return;
      await fetchInbox(me);
      setMessages(await readMessages(me, peer));
      setKeys(await peerKeys(me, peer));
      await markRead(me, peer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setContact((c) => (c === 'loading' ? null : c));
    }
  }, [me, peer]);

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

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setMessages(await sendMessage(me, peer, text));
      setText('');
      await markRead(me, peer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  }

  function block(report: boolean) {
    if (contact === 'loading' || !contact) return;
    const who = camarada(contact.name);
    confirmAction(
      report ? `Bloquear e denunciar ${who}?` : `Bloquear ${who}?`,
      report
        ? `As últimas ${Math.min(20, messages.length)} mensagens desta conversa, decifradas neste aparelho, vão para a moderação, junto com o IP de vocês dois. ${who} não poderá mais te mandar mensagem.`
        : `${who} não poderá mais te mandar mensagem, e você também não manda para ${who}. Dá para desbloquear depois.`,
      report ? 'Bloquear e denunciar' : 'Bloquear',
      async () => {
        setBusy(true);
        try {
          if (report) await reportPeer(me, peer, true);
          else await blockPeer(peer);
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Não deu.');
        } finally {
          setBusy(false);
        }
      },
      true,
    );
  }

  if (contact === 'loading') return <Loading />;
  if (!contact) {
    return <EmptyState title="Conversa não encontrada" detail="A conversa só abre depois que o pedido é aceito." />;
  }

  const title = camarada(contact.name);

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        ref={scroll}
        style={s.flex}
        contentContainerStyle={s.list}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        {keys?.newDevice ? (
          <Banner
            tone="warning"
            title={`${title} está num aparelho novo`}
            detail="Pode ser troca de celular. Se tiver dúvida, confira o código de segurança com a pessoa, em pessoa."
            action={<Button title="Entendi" kind="outline" small block={false} onPress={() => void acceptPeerKeys(me, peer).then(load)} />}
          />
        ) : null}
        {keys?.qrMatch === false ? (
          <Banner
            tone="danger"
            title="A chave não bate com o QRCode"
            detail="A chave que chegou pelo servidor é diferente da que você leu no QRCode. Não mande nada sensível e fale com a pessoa em pessoa."
          />
        ) : null}

        {contact.blocked ? (
          <Banner
            title="Você bloqueou esta pessoa"
            detail="Ninguém manda mensagem enquanto estiver bloqueado."
            action={
              <Button
                title="Desbloquear"
                kind="outline"
                small
                block={false}
                onPress={() => void unblockPeer(peer).then(load)}
              />
            }
          />
        ) : null}

        {messages.length === 0 ? (
          <Txt variant="small" muted center>
            Nenhuma mensagem ainda. O histórico fica só neste aparelho.
          </Txt>
        ) : null}

        {messages.map((m) => {
          const mine = m.from === me;
          return (
            <View key={m.id} style={[s.bubble, mine ? s.mine : s.theirs]}>
              <Txt variant="body" tone={mine ? 'onPrimary' : 'default'}>
                {m.t}
              </Txt>
              <Txt variant="label" tone={mine ? 'onPrimary' : 'default'} muted={!mine}>
                {shortDateTime(m.at)}
                {!mine && !m.verified ? ' · assinatura não confere' : ''}
              </Txt>
            </View>
          );
        })}

        {error ? (
          <Txt variant="small" tone="danger">
            {error}
          </Txt>
        ) : null}

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label">Segurança</Txt>
            <Button title={showSafety ? 'Fechar' : 'Ver código'} kind="ghost" small block={false} onPress={() => setShowSafety((v) => !v)} />
          </Row>
          {showSafety ? (
            <>
              <Txt variant="small" muted>
                Código de segurança de {title} (compare com o que aparece no celular da pessoa, em Adicionar):
              </Txt>
              {(keys?.devices ?? []).map((d) => (
                <Txt key={d.id} variant="heading">
                  {d.fingerprint}
                </Txt>
              ))}
            </>
          ) : null}
          <Row>
            <Button title="Bloquear" kind="outline" small block={false} disabled={busy || contact.blocked} onPress={() => block(false)} />
            <Button title="Bloquear e denunciar" kind="outline" small block={false} disabled={busy} onPress={() => block(true)} />
          </Row>
        </Card>
      </ScrollView>

      {!contact.blocked ? (
        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Mensagem"
            placeholderTextColor={color.textMuted}
            multiline
            maxLength={MAX_TEXT}
            accessibilityLabel="Mensagem"
          />
          <Button title="Enviar" small block={false} loading={busy} disabled={!text.trim()} onPress={() => void send()} />
        </View>
      ) : null}
      <Button title="Voltar" kind="ghost" onPress={() => router.back()} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.lg, gap: space.sm },
  bubble: { maxWidth: '85%', padding: space.md, borderRadius: radius.lg, gap: space.xs },
  mine: { alignSelf: 'flex-end', backgroundColor: color.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
  },
  input: {
    ...type.body,
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    color: color.text,
  },
});
