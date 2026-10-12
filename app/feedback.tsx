import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import {
  groupFeedback,
  groupFeedbackNow,
  listFeedback,
  sendFeedback,
  setFeedbackStatus,
  type Feedback,
  type FeedbackKind,
  type FeedbackStatus,
} from '@/api/feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import { camarada, relativeTime } from '@/lib/format';
import { Badge, Button, Card, Chip, Field, Row, Screen, Section, Txt, color } from '@/ui';

const KINDS: { key: FeedbackKind; label: string }[] = [
  { key: 'ideia', label: 'Ideia / melhoria' },
  { key: 'problema', label: 'Problema / erro' },
  { key: 'outro', label: 'Outro' },
];
const STATUS_LABEL: Record<FeedbackStatus, string> = {
  novo: 'Novo',
  visto: 'Visto',
  feito: 'Feito',
  descartado: 'Descartado',
};
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  novo: color.accent,
  visto: color.warning,
  feito: color.success,
  descartado: color.neutral,
};

/**
 * Ideias e problemas para a equipe. Membro envia e acompanha os próprios;
 * moderador e admin veem todos e marcam a situação.
 */
export default function FeedbackScreen() {
  const { profile, isModerator } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>('ideia');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Feedback[]>([]);
  const [filter, setFilter] = useState<FeedbackStatus | 'todos'>('novo');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [grouping, setGrouping] = useState(false);

  const load = useCallback(async () => {
    setList(await listFeedback().catch(() => []));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function submit() {
    if (!profile) return;
    setBusy(true);
    try {
      await sendFeedback(profile.id, kind, text);
      setText('');
      await load();
      Alert.alert('Enviado', 'Obrigado! A equipe lê tudo que chega aqui.');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível enviar.');
    } finally {
      setBusy(false);
    }
  }

  const mine = list.filter((f) => f.author_id === profile?.id);
  const groups = groupFeedback(list);
  const shown = filter === 'todos' ? groups : groups.filter((g) => g.status === filter);
  const ungrouped = list.filter((f) => !f.group_id).length;

  async function apply(ids: string[], status: FeedbackStatus) {
    try {
      await setFeedbackStatus(ids, status);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
    await load();
  }

  async function groupNow() {
    setGrouping(true);
    const r = await groupFeedbackNow();
    setGrouping(false);
    if (r.error) Alert.alert('Agrupar', r.error);
    await load();
  }

  return (
    <Screen>
      <Row style={{ flexWrap: 'wrap' }}>
        {KINDS.map((k) => (
          <Chip key={k.key} label={k.label} active={kind === k.key} onPress={() => setKind(k.key)} />
        ))}
      </Row>
      <Field
        label="Sua mensagem"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        placeholder="O que poderia ser melhor? O que deu errado? Em qual tela?"
        hint="Só a equipe (moderadores e admin) lê. Para juntar mensagens parecidas, o texto passa pelo Gemini, do Google. Não coloque dados pessoais seus nem de outras pessoas."
      />
      <Button title="Enviar" loading={busy} disabled={text.trim().length < 5} onPress={() => void submit()} />

      {isModerator ? (
        <>
          <Section title={`Recebidos · ${list.length}`} />
          <Txt variant="small" muted>
            Mensagens parecidas são juntadas pela IA (Gemini) de hora em hora. O texto de cada pessoa não muda.
          </Txt>
          {ungrouped > 0 ? (
            <Button
              title={`Agrupar agora (${ungrouped} sem grupo)`}
              kind="ghost"
              small
              block={false}
              loading={grouping}
              onPress={() => void groupNow()}
            />
          ) : null}
          <Row style={{ flexWrap: 'wrap' }}>
            {(['novo', 'visto', 'feito', 'descartado', 'todos'] as const).map((s) => (
              <Chip
                key={s}
                label={s === 'todos' ? 'Todos' : `${STATUS_LABEL[s]} · ${groups.filter((g) => g.status === s).length}`}
                active={filter === s}
                onPress={() => setFilter(s)}
              />
            ))}
          </Row>
          {shown.map((g) => {
            const expanded = open.has(g.key) || g.items.length === 1;
            // Feito e descartado são finais (trigger da 0034): só mexe no que ainda está aberto.
            const ids = g.items.filter((f) => f.status === 'novo' || f.status === 'visto').map((f) => f.id);
            const next = (['visto', 'feito', 'descartado'] as const).filter(
              (s) => ids.length > 0 && s !== g.status && !(g.status === 'visto' && s === 'visto'),
            );
            return (
              <Card key={g.key} stripe={STATUS_COLOR[g.status]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Badge label={STATUS_LABEL[g.status]} color={STATUS_COLOR[g.status]} />
                  <Txt variant="small" muted>
                    {relativeTime(g.last)}
                  </Txt>
                </Row>
                {g.title ? <Txt variant="heading">{g.title}</Txt> : null}
                <Txt variant="label" tone="primary">
                  {g.people === 1 ? '1 pessoa comentou' : `${g.people} pessoas comentaram`}
                  {g.items.length > g.people ? ` · ${g.items.length} mensagens` : ''}
                </Txt>
                {(expanded ? g.items : g.items.slice(0, 1)).map((f) => (
                  <Txt key={f.id} variant="body">
                    <Txt variant="small" muted>
                      {camarada(f.author_display_name)} · {KINDS.find((k) => k.key === f.kind)?.label}:{' '}
                    </Txt>
                    {f.message}
                  </Txt>
                ))}
                {g.items.length > 1 ? (
                  <Txt
                    variant="small"
                    tone="primary"
                    onPress={() =>
                      setOpen((cur) => {
                        const next = new Set(cur);
                        if (next.has(g.key)) next.delete(g.key);
                        else next.add(g.key);
                        return next;
                      })
                    }
                  >
                    {expanded ? 'Mostrar menos' : `Ver as ${g.items.length} mensagens ›`}
                  </Txt>
                ) : null}
                {next.length === 0 ? (
                  <Txt variant="small" muted>
                    Situação final: não muda mais.
                  </Txt>
                ) : null}
                <Row style={{ flexWrap: 'wrap' }}>
                  {next.map((s) => (
                      <Button
                        key={s}
                        title={`Marcar ${STATUS_LABEL[s].toLowerCase()}`}
                        kind="ghost"
                        small
                        block={false}
                        onPress={() =>
                          s === 'visto'
                            ? void apply(ids, s)
                            : Alert.alert(
                                `Marcar como ${STATUS_LABEL[s].toLowerCase()}?`,
                                'Depois não dá para mudar.',
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  { text: 'Marcar', onPress: () => void apply(ids, s) },
                                ],
                              )
                        }
                      />
                  ))}
                </Row>
              </Card>
            );
          })}
        </>
      ) : mine.length ? (
        <>
          <Section title="Você enviou" />
          {mine.map((f) => (
            <Card key={f.id} stripe={STATUS_COLOR[f.status]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Badge label={STATUS_LABEL[f.status]} color={STATUS_COLOR[f.status]} />
                <Txt variant="small" muted>
                  {relativeTime(f.created_at)}
                </Txt>
              </Row>
              <Txt variant="body">{f.message}</Txt>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
