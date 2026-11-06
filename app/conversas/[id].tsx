import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Fragment, useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
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
import { camarada, clockTime, dayBucket } from '@/lib/format';
import { confirmAction } from '@/lib/notify';
import { useNoScreenshots } from '@/lib/privacy';
import { Banner, Button, Divider, EmptyState, Loading, Txt, color, radius, space, type } from '@/ui';

const DESKTOP_WEB =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true;

export default function Conversa() {
  return (
    <ChatGate>
      <Tela />
    </ChatGate>
  );
}

/**
 * Conversa 1:1. Segurança, bloquear e denunciar ficam no menu Opções do
 * cabeçalho, fora da lista de mensagens.
 */
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
  const [menu, setMenu] = useState(false);
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

  // no site no computador, Enter envia e Shift+Enter quebra a linha. Celular
  // (inclusive o site no celular) não tem Shift: lá Enter quebra a linha.
  function onKeyPress(
    e: NativeSyntheticEvent<TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean }>,
  ) {
    const { key, shiftKey, isComposing } = e.nativeEvent;
    if (!DESKTOP_WEB || key !== 'Enter' || shiftKey || isComposing) return;
    e.preventDefault();
    void send();
  }

  function block(report: boolean) {
    if (contact === 'loading' || !contact) return;
    setMenu(false);
    const who = camarada(contact.name);
    confirmAction(
      report ? `Denunciar ${who}?` : `Bloquear ${who}?`,
      report
        ? `As últimas ${Math.min(20, messages.length)} mensagens desta conversa, decifradas neste aparelho, vão para a moderação, junto com o IP de vocês dois. ${who} também fica bloqueado e não poderá mais te mandar mensagem.`
        : `${who} não poderá mais te mandar mensagem, e você também não manda para ${who}. Dá para desbloquear depois.`,
      report ? 'Denunciar e bloquear' : 'Bloquear',
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

  async function unblock() {
    setMenu(false);
    await unblockPeer(peer);
    await load();
  }

  if (contact === 'loading') return <Loading />;
  if (!contact) {
    return <EmptyState title="Conversa não encontrada" detail="A conversa só abre depois que o pedido é aceito." />;
  }

  const title = camarada(contact.name);

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
      <Stack.Screen
        options={{
          title,
          // link direto (sem histórico) não tem para onde voltar
          headerLeft: router.canGoBack()
            ? undefined
            : () => <HeaderButton label="Conversas" onPress={() => router.replace('/(tabs)/conversas')} />,
          headerRight: () => <HeaderButton label="Opções" onPress={() => setMenu(true)} />,
        }}
      />
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
            detail="Pode ser troca de celular. Se tiver dúvida, confira o código de segurança (em Opções) com a pessoa, em pessoa."
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

        {messages.length === 0 ? (
          <Txt variant="small" muted center>
            Nenhuma mensagem ainda. O histórico fica só neste aparelho.
          </Txt>
        ) : null}

        {messages.map((m, i) => {
          const mine = m.from === me;
          const day = dayBucket(m.at);
          const newDay = i === 0 || dayBucket(messages[i - 1]!.at) !== day;
          return (
            <Fragment key={m.id}>
              {newDay ? (
                <View style={s.day}>
                  <Txt variant="label" muted>
                    {day}
                  </Txt>
                </View>
              ) : null}
              <View style={[s.bubble, mine ? s.mine : s.theirs]}>
                <Txt variant="body" tone={mine ? 'onPrimary' : 'default'}>
                  {m.t}
                </Txt>
                <Txt variant="label" tone={mine ? 'onPrimary' : 'default'} muted={!mine} style={s.time}>
                  {clockTime(m.at)}
                  {!mine && !m.verified ? ' · assinatura não confere' : ''}
                </Txt>
              </View>
            </Fragment>
          );
        })}
      </ScrollView>

      {error ? (
        <Txt variant="small" tone="danger" style={s.error}>
          {error}
        </Txt>
      ) : null}

      {contact.blocked ? (
        <View style={s.blocked}>
          <Txt variant="small" muted style={{ flex: 1 }}>
            Você bloqueou {title}. Ninguém manda mensagem enquanto estiver bloqueado.
          </Txt>
          <Button title="Desbloquear" kind="outline" small block={false} onPress={() => void unblock()} />
        </View>
      ) : (
        <View style={s.composer}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            onKeyPress={onKeyPress}
            placeholder="Mensagem"
            placeholderTextColor={color.textMuted}
            multiline
            maxLength={MAX_TEXT}
            accessibilityLabel="Mensagem"
          />
          <Button title="Enviar" small block={false} loading={busy} disabled={!text.trim()} onPress={() => void send()} />
        </View>
      )}

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={s.scrim} onPress={() => setMenu(false)} accessibilityLabel="Fechar opções">
          {/* toque dentro da folha não fecha */}
          <Pressable style={s.sheet} onPress={() => undefined}>
            <Txt variant="heading">{title}</Txt>

            <Pressable onPress={() => setShowSafety((v) => !v)} style={s.item} accessibilityRole="button">
              <Txt variant="body">Código de segurança</Txt>
              <Txt variant="small" muted>
                {showSafety ? 'Esconder' : 'Compare com o celular da pessoa para ter certeza de que é ela.'}
              </Txt>
            </Pressable>
            {showSafety ? (
              <View style={s.safety}>
                <Txt variant="small" muted>
                  Peça para {title} abrir Adicionar e comparar com este código:
                </Txt>
                {(keys?.devices ?? []).map((d) => (
                  <Txt key={d.id} variant="heading" selectable>
                    {d.fingerprint}
                  </Txt>
                ))}
              </View>
            ) : null}

            <Divider />
            {contact.blocked ? (
              <Pressable onPress={() => void unblock()} style={s.item} accessibilityRole="button">
                <Txt variant="body">Desbloquear</Txt>
              </Pressable>
            ) : (
              <Pressable onPress={() => block(false)} disabled={busy} style={s.item} accessibilityRole="button">
                <Txt variant="body">Bloquear</Txt>
                <Txt variant="small" muted>
                  Nenhum dos dois manda mensagem. Dá para desfazer.
                </Txt>
              </Pressable>
            )}
            <Pressable onPress={() => block(true)} disabled={busy} style={s.item} accessibilityRole="button">
              <Txt variant="body" tone="danger">
                Denunciar
              </Txt>
              <Txt variant="small" muted>
                Manda as últimas mensagens para a moderação e bloqueia.
              </Txt>
            </Pressable>

            <Button title="Fechar" kind="ghost" onPress={() => setMenu(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" style={s.headerBtn}>
      <Txt variant="body" tone="primary">
        {label}
      </Txt>
    </Pressable>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  list: { padding: space.lg, gap: space.sm },
  day: {
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    marginVertical: space.xs,
  },
  bubble: { maxWidth: '85%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg, gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: color.primary, borderBottomRightRadius: radius.sm },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderBottomLeftRadius: radius.sm,
  },
  time: { alignSelf: 'flex-end', opacity: 0.8 },
  error: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  blocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
  },
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
  headerBtn: { paddingHorizontal: space.sm },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.scrim },
  sheet: {
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  item: { paddingVertical: space.sm, gap: 2 },
  safety: { gap: space.xs, paddingBottom: space.sm },
});
