import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { listReports, resolveReport, type ChatReport } from '@/api/chat';
import { setMemberActive } from '@/api/members';
import { useAuth } from '@/features/auth/AuthProvider';
import { camarada, relativeTime, shortDateTime } from '@/lib/format';
import { confirmAction } from '@/lib/notify';
import { useNoScreenshots } from '@/lib/privacy';
import { Badge, Banner, Button, Card, EmptyState, Field, Loading, Options, Row, Screen, Txt, color, radius, space } from '@/ui';

/**
 * Denúncias de conversa. O conteúdo veio do aparelho de quem denunciou; cada
 * mensagem traz a assinatura de quem escreveu, conferida aqui com a chave
 * que o servidor guardou no momento da denúncia. "Não confere" = não dá para
 * provar que a pessoa escreveu aquilo.
 */
export default function Denuncias() {
  useNoScreenshots('denuncias');
  const { isModerator } = useAuth();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [items, setItems] = useState<ChatReport[] | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await listReports(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar.');
      setItems([]);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!isModerator) {
    return (
      <Screen>
        <Banner tone="warning" title="Área da moderação" detail="Só moderador do bairro ou admin." />
      </Screen>
    );
  }
  if (!items) return <Loading />;

  async function resolve(r: ChatReport, suspend: boolean) {
    const text = (note[r.id] ?? '').trim();
    if (!text) {
      setError('Escreva o que foi decidido (fica no registro).');
      return;
    }
    setBusy(r.id);
    try {
      if (suspend) await setMemberActive(r.reportedId, false, text);
      await resolveReport(r.id, suspend ? `Conta suspensa. ${text}` : text);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Options
        value={status}
        onChange={setStatus}
        options={[
          { key: 'open', label: 'Abertas' },
          { key: 'resolved', label: 'Resolvidas' },
        ]}
      />
      {error ? <Banner tone="danger" title="Algo deu errado" detail={error} /> : null}
      {items.length === 0 ? <EmptyState title={status === 'open' ? 'Nenhuma denúncia aberta' : 'Nada resolvido ainda'} /> : null}

      {items.map((r) => (
        <Card key={r.id} stripe={color.accent}>
          <Txt variant="heading">
            {camarada(r.reportedName)} denunciado por {camarada(r.reporterName)}
          </Txt>
          <Txt variant="small" muted>
            {r.area || 'bairro desconhecido'} · {relativeTime(r.createdAt)}
            {r.blocked ? ' · bloqueou' : ''}
          </Txt>

          <View style={{ gap: space.xs }}>
            {r.messages.length === 0 ? (
              <Txt variant="small" muted>
                Sem mensagens no aparelho de quem denunciou.
              </Txt>
            ) : null}
            {r.messages.map((m) => (
              <View
                key={m.id}
                style={{
                  padding: space.sm,
                  borderRadius: radius.sm,
                  backgroundColor: m.byReported ? color.accentSoft : color.surface,
                  borderWidth: 1,
                  borderColor: color.border,
                }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="label">{m.byReported ? camarada(r.reportedName) : camarada(r.reporterName)}</Txt>
                  <Badge label={m.verified ? 'assinatura confere' : 'não confere'} color={m.verified ? color.success : color.danger} />
                </Row>
                <Txt variant="body">{m.text ?? '(ilegível)'}</Txt>
                <Txt variant="label" muted>
                  {shortDateTime(m.at)}
                </Txt>
              </View>
            ))}
          </View>

          <Txt variant="small" muted>
            IP de quem denunciou: {r.reporterIp ?? 'não registrado'}
          </Txt>
          <Txt variant="small" muted>
            IPs recentes de quem foi denunciado:{' '}
            {r.reportedIps.length ? r.reportedIps.map((x) => `${x.ip} (${shortDateTime(x.last_seen)})`).join(', ') : 'nenhum'}
          </Txt>

          {r.status === 'open' ? (
            <>
              <Field
                label="Decisão (fica no registro)"
                value={note[r.id] ?? ''}
                onChangeText={(v) => setNote((n) => ({ ...n, [r.id]: v }))}
                multiline
              />
              <Row>
                <Button title="Resolver" small block={false} loading={busy === r.id} onPress={() => void resolve(r, false)} />
                <Button
                  title="Suspender e resolver"
                  kind="outline"
                  small
                  block={false}
                  disabled={busy === r.id}
                  onPress={() =>
                    confirmAction(
                      'Suspender a conta?',
                      `${camarada(r.reportedName)} perde o acesso à base até alguém reativar em Membros.`,
                      'Suspender',
                      () => void resolve(r, true),
                      true,
                    )
                  }
                />
              </Row>
            </>
          ) : (
            <Txt variant="small">Decisão: {r.resolution}</Txt>
          )}
        </Card>
      ))}
    </Screen>
  );
}
