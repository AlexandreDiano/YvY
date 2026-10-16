import { useEffect, useState } from 'react';
import { Keyboard, Linking, View } from 'react-native';
import {
  cancelClaimRequest,
  deleteClaimCheck,
  listClaimChecks,
  listClaimQueue,
  markClaimsSeen,
  myClaimChecks,
  publishClaimCheck,
  readTextFromImage,
  unpublishFactCheck,
  runClaimNow,
  type ClaimCheck,
  type QueueItem,
} from '@/api/claims';
import { useAuth } from '@/features/auth/AuthProvider';
import * as ImagePicker from 'expo-image-picker';
import { shrinkImage } from '@/lib/shrinkImage';
import { checkFact, listChecks, type CheckOutcome } from '@/api/content';
import { CHECK_LABEL } from '@/data/factChecks';
import type { CheckResult, FactCheck } from '@/lib/db.types';
import { brDate } from '@/lib/format';
import { confirmAction } from '@/lib/notify';
import { shareCheck } from '@/lib/share';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Field,
  Row,
  Screen,
  Section,
  Txt,
  color,
  space,
} from '@/ui';
import { IconShare } from '@/ui/icons';

const SEAL: Record<CheckResult, string> = {
  true: color.success,
  half_true: color.warning,
  exaggeration: color.accent,
  false: color.danger,
  unverified: color.neutral,
};

export default function Checar() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<FactCheck[]>([]);
  const { isModerator } = useAuth();
  const [reading, setReading] = useState(false);

  /** Foto ou print: o Gemini lê o texto, a pessoa confere e pede a checagem. */
  async function fromImage(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(source === 'camera' ? 'Libere a câmera para fotografar.' : 'Libere o acesso às fotos.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
    const picked =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    setReading(true);
    setError(null);
    try {
      // texto pequeno de print precisa de resolução, por isso até 2000 px no lado maior
      const img = await shrinkImage(asset, { maxSide: 2000, quality: 0.8 });
      if (!img) {
        setError('Não deu para abrir essa imagem. Tente outra.');
        return;
      }
      const r = await readTextFromImage(img.base64, img.mimeType);
      if (r.text) setInput(r.text);
      else setError(r.error ?? 'Não achei texto na imagem.');
    } finally {
      setReading(false);
    }
  }

  async function cancelMine(c: ClaimCheck) {
    await cancelClaimRequest(c.id, c.status !== 'done').catch(() => undefined);
    await loadMine();
  }
  const [mine, setMine] = useState<(ClaimCheck & { unseen: boolean; asked?: string })[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  async function loadQueue() {
    if (!isModerator) return;
    setQueue(await listClaimQueue().catch(() => []));
  }

  async function checkNow(id: string) {
    setRunning(id);
    try {
      const r = await runClaimNow(id);
      if (!r.ok) setError(r.error ?? 'Não foi possível checar agora.');
      await Promise.all([loadQueue(), loadMine(), isModerator ? listClaimChecks().then(setOthers) : Promise.resolve()]);
    } finally {
      setRunning(null);
    }
  }

  async function removeCheck(id: string) {
    try {
      await deleteClaimCheck(id);
      await Promise.all([loadQueue(), loadMine(), isModerator ? listClaimChecks().then(setOthers) : Promise.resolve()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao apagar.');
    }
  }
  const [others, setOthers] = useState<ClaimCheck[]>([]);

  function unpublish(c: FactCheck) {
    confirmAction(
      'Tirar esta checagem do ar?',
      `"${c.claim_text}" deixa de aparecer para todo mundo e não pode mais ser compartilhada pelo app.`,
      'Tirar do ar',
      () =>
        void unpublishFactCheck(c.id)
          .then(() => listChecks().then(setRecent))
          .catch((err) => setError(err instanceof Error ? err.message : 'Não deu para tirar do ar.')),
      true,
    );
  }

  async function publish(id: string, edits: Parameters<typeof publishClaimCheck>[1]) {
    try {
      await publishClaimCheck(id, edits);
      await Promise.all([listClaimChecks().then(setOthers), listChecks().then(setRecent), loadMine()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu para publicar.');
    }
  }

  async function loadMine() {
    const list = await myClaimChecks();
    setMine(list);
    // abriu a tela, viu: some o aviso do Início
    await markClaimsSeen(list.filter((c) => c.unseen).map((c) => c.id));
  }

  useEffect(() => {
    void listChecks().then(setRecent);
    if (isModerator) void listClaimChecks().then(setOthers);
    void loadQueue();
    void loadMine();
    // isModerator chega quando o perfil carrega: recarrega a lista da equipe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModerator]);

  async function run() {
    if (busy || input.trim().length < 8) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    setOutcome(null);
    try {
      const res = await checkFact(input);
      setOutcome(res);
      // o texto pedido continua no resultado (e em "Suas checagens"), o campo fica livre
      setInput('');
      if (res.kind === 'queued' || res.kind === 'auto') void loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao checar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field
        label="Texto para checar"
        value={input}
        onChangeText={setInput}
        multiline
        submitOnEnter
        onSubmitEditing={() => void run()}
        placeholder="Cole aqui o que chegou no WhatsApp..."
        hint="Telefone, e-mail e CPF são apagados antes de qualquer coisa. Se for checado por IA, só você vê o resultado até alguém da equipe conferir e publicar."
      />
      <Button title="Checar" loading={busy} onPress={run} disabled={input.trim().length < 8} />
      <Row style={{ flexWrap: 'wrap' }}>
        <Button
          title="Ler de um print"
          kind="outline"
          small
          block={false}
          loading={reading}
          onPress={() => void fromImage('library')}
        />
        <Button title="Fotografar" kind="ghost" small block={false} onPress={() => void fromImage('camera')} />
      </Row>
      <Txt variant="small" muted>
        A imagem não é guardada: só o texto lido vem para o campo acima, para você conferir antes de checar.
      </Txt>

      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      {outcome ? (
        <>
          <Section title="Resultado" />
          {outcome.kind === 'auto' ? (
            <AutoResult
              claim={outcome.claim}
              result={outcome.result}
              explanation={outcome.explanation}
              sourceName={outcome.source_name}
              sourceUrl={outcome.source_url}
              checkedAt={outcome.checked_at}
            />
          ) : (
          <Card stripe={SEAL[outcome.result]}>
            <Badge label={CHECK_LABEL[outcome.result].toUpperCase()} color={SEAL[outcome.result]} />
            <Txt variant="heading">"{outcome.claim}"</Txt>
            <Txt variant="body">{outcome.explanation}</Txt>
            <Source name={outcome.source_name} url={outcome.source_url} />
            {outcome.result !== 'unverified' ? (
              <Button
                title="Compartilhar resultado"
                small
                left={<IconShare size={16} color={color.textOnPrimary} />}
                onPress={() =>
                  void shareCheck({
                    claim: outcome.claim,
                    result: outcome.result,
                    explanation: outcome.explanation,
                    source_name: outcome.source_name,
                    source_url: outcome.source_url,
                  })
                }
              />
            ) : (
              <Banner
                tone="warning"
                title={outcome.kind === 'queued' ? 'Na fila de checagem' : 'Não verificamos ainda'}
                detail="Na dúvida, não compartilhe. Mande também para a equipe de checagem do seu bairro."
              />
            )}
          </Card>
          )}
        </>
      ) : null}

      {mine.length ? (
        <>
          <Section title="Suas checagens" />
          {mine.map((c) => (
            <ClaimCard
              key={c.id}
              c={c}
              unseen={c.unseen}
              asked={c.asked}
              onCancel={() => void cancelMine(c)}
              onPublish={
                isModerator && c.status === 'done' && c.claim_text
                  ? (edits) => publish(c.id, edits)
                  : undefined
              }
            />
          ))}
        </>
      ) : null}

      {others.length ? (
        <>
          <Section title="Checagens por IA · equipe" />
          <Txt variant="small" muted>
            Só moderador e admin veem. Nada daqui é público até alguém da equipe abrir a fonte, conferir e
            publicar. Se a IA errou, corrija o texto antes ou apague. Se ela não achou fonte, cole o link de
            uma que vocês acharam.
          </Txt>
          {others
            .filter((c) => !mine.some((m) => m.id === c.id))
            .map((c) => (
              <ClaimCard
                key={c.id}
                c={c}
                onDelete={isModerator ? () => void removeCheck(c.id) : undefined}
                onPublish={isModerator ? (edits) => publish(c.id, edits) : undefined}
              />
            ))}
        </>
      ) : null}

      {isModerator && queue.length ? (
        <>
          <Section title="Fila da checagem · equipe" />
          <Txt variant="small" muted>
            Só moderador e admin veem. "Checar agora" não espera a rodada de 15 min. "Apagar" é para item com
            problema (teste, texto sem sentido), não para mudar veredito.
          </Txt>
          {queue
            .filter((q) => q.status !== 'done')
            .map((q) => (
              <Card key={q.id} stripe={q.status === 'failed' ? color.danger : color.neutral}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Badge label={STATUS_LABEL[q.status]} color={q.status === 'failed' ? color.danger : color.neutral} />
                  <Txt variant="small" muted>
                    {q.requested_count}× pedido · {q.attempts} tentativa(s)
                  </Txt>
                </Row>
                <Txt variant="body">"{q.input_text ?? q.claim_text ?? '—'}"</Txt>
                {q.error ? (
                  <Txt variant="small" tone="danger" numberOfLines={2}>
                    {q.error}
                  </Txt>
                ) : null}
                <Row>
                  <Button
                    title="Checar agora"
                    small
                    block={false}
                    loading={running === q.id}
                    disabled={!!running}
                    onPress={() => void checkNow(q.id)}
                  />
                  <Button title="Apagar" kind="ghost" small block={false} onPress={() => void removeCheck(q.id)} />
                </Row>
              </Card>
            ))}
        </>
      ) : null}

      <Section title="Checagens da equipe" />
      {recent.map((c) => (
        <PublishedCheck key={c.id} c={c} onUnpublish={isModerator ? () => unpublish(c) : undefined} />
      ))}
    </Screen>
  );
}

function ClaimCard({
  c,
  unseen,
  asked,
  onDelete,
  onCancel,
  onPublish,
}: {
  c: ClaimCheck;
  unseen?: boolean;
  /** O que a pessoa colou. Só existe no aparelho dela. */
  asked?: string;
  onDelete?: () => void;
  /** Na fila, cancela o pedido. Pronta, só tira da lista. */
  onCancel?: () => void;
  onPublish?: (edits: Parameters<typeof publishClaimCheck>[1]) => Promise<void>;
}) {
  const [reviewing, setReviewing] = useState(false);
  if (c.reviewed && c.result && c.claim_text) {
    return <ReviewedCard c={c} onCancel={onCancel} />;
  }
  return (
    <Card stripe={color.neutral}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge
          label={c.status === 'done' && c.result ? 'Checagem por IA' : STATUS_LABEL[c.status]}
          color={color.neutral}
        />
        {unseen ? (
          <Txt variant="label" tone="accent" upper>
            Novo
          </Txt>
        ) : null}
      </Row>
      {asked && c.status !== 'done' ? (
        <Txt variant="small" muted>
          Você pediu: "{asked}"
        </Txt>
      ) : null}
      {c.claim_text ? <Txt variant="body">"{c.claim_text}"</Txt> : null}
      {c.status === 'done' && c.result && c.result !== 'unverified' ? (
        <Txt variant="small">{AUTO_HINT[c.result]}</Txt>
      ) : null}
      {c.explanation ? (
        <Txt variant="small" muted>
          {c.explanation}
        </Txt>
      ) : null}
      <Source name={c.source_name} url={c.source_url} />
      {c.status === 'done' ? <AutoLabel checkedAt={c.checked_at} /> : null}
      {onPublish && reviewing ? (
        <ReviewForm c={c} onPublish={onPublish} onClose={() => setReviewing(false)} />
      ) : null}
      {onPublish && !reviewing && c.status === 'done' ? (
        <Button title="Conferir e publicar" small block={false} onPress={() => setReviewing(true)} />
      ) : null}
      {onDelete ? (
        <Button title="Apagar (equipe)" kind="ghost" small block={false} onPress={onDelete} />
      ) : null}
      {onCancel ? (
        <Button
          title={c.status === 'done' ? 'Tirar da minha lista' : 'Cancelar pedido'}
          kind="ghost"
          small
          block={false}
          onPress={onCancel}
        />
      ) : null}
    </Card>
  );
}

function ReviewedCard({ c, onCancel }: { c: ClaimCheck; onCancel?: () => void }) {
  const result = c.result!;
  return (
    <Card stripe={SEAL[result]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge label={CHECK_LABEL[result].toUpperCase()} color={SEAL[result]} />
        <Txt variant="small" muted>
          Conferida pela equipe
        </Txt>
      </Row>
      <Txt variant="body">"{c.claim_text}"</Txt>
      {c.explanation ? (
        <Txt variant="small" muted>
          {c.explanation}
        </Txt>
      ) : null}
      <Source name={c.source_name} url={c.source_url} />
      <Row>
        <Button
          title="Compartilhar"
          small
          kind="outline"
          block={false}
          left={<IconShare size={14} color={color.primary} />}
          onPress={() =>
            void shareCheck({
              claim: c.claim_text!,
              result,
              explanation: c.explanation ?? '',
              source_name: c.source_name,
              source_url: c.source_url,
            })
          }
        />
        {onCancel ? (
          <Button title="Tirar da minha lista" kind="ghost" small block={false} onPress={onCancel} />
        ) : null}
      </Row>
    </Card>
  );
}

/** Checagem pública da equipe. Moderador/admin pode tirar do ar. */
function PublishedCheck({ c, onUnpublish }: { c: FactCheck; onUnpublish?: () => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Row>
        <Badge label={CHECK_LABEL[c.result]} color={SEAL[c.result]} />
      </Row>
      <Txt variant="body">"{c.claim_text}"</Txt>
      <Txt variant="small" muted>
        {c.explanation}
      </Txt>
      <Source name={c.source_name} url={c.source_url} />
      {c.source_auto ? (
        <Txt variant="small" muted>
          Link achado pela busca automática, a equipe confere se a fonte diz isso.
        </Txt>
      ) : null}
      <Row>
        {c.result !== 'unverified' ? (
          <Button
            title="Compartilhar"
            small
            kind="outline"
            block={false}
            left={<IconShare size={14} color={color.primary} />}
            onPress={() =>
              void shareCheck({
                claim: c.claim_text,
                result: c.result,
                explanation: c.explanation,
                source_name: c.source_name,
                source_url: c.source_url,
              })
            }
          />
        ) : null}
        {onUnpublish ? <Button title="Tirar do ar" kind="ghost" small block={false} onPress={onUnpublish} /> : null}
      </Row>
    </View>
  );
}

type Published = Exclude<CheckResult, 'unverified'>;
const PUBLISHABLE: Published[] = ['true', 'half_true', 'exaggeration', 'false'];

/**
 * Revisão antes de ir a público. Quem publica responde pelo que está escrito,
 * então dá para corrigir afirmação, resultado e explicação. Se a busca trouxe
 * fonte, ela fica (é o que as pessoas vão abrir). Se não trouxe, ou a IA não
 * concluiu, a equipe cola o link da fonte que achou.
 */
function ReviewForm({
  c,
  onPublish,
  onClose,
}: {
  c: ClaimCheck;
  onPublish: (edits: Parameters<typeof publishClaimCheck>[1]) => Promise<void>;
  onClose: () => void;
}) {
  const [claim, setClaim] = useState(c.claim_text ?? '');
  const [result, setResult] = useState<Published | null>(c.result && c.result !== 'unverified' ? c.result : null);
  const [explanation, setExplanation] = useState(c.result === 'unverified' ? '' : (c.explanation ?? ''));
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [saving, setSaving] = useState(false);
  const needsSource = !c.source_url;
  const ready =
    !!result &&
    claim.trim().length > 8 &&
    explanation.trim().length > 8 &&
    (!needsSource || /^https?:\/\/\S+\.\S+/.test(sourceUrl.trim()));

  function submit() {
    if (!result) return;
    const source = needsSource ? sourceName.trim() || sourceUrl.trim() : (c.source_name ?? c.source_url);
    confirmAction(
      'Publicar para todo mundo?',
      `Vai aparecer como "${CHECK_LABEL[result]}" para qualquer pessoa, com a fonte ${source}. Você abriu a fonte e ela diz isso mesmo?`,
      'Publicar',
      () => {
        setSaving(true);
        void onPublish({
          claim: claim.trim(),
          result,
          explanation: explanation.trim(),
          sourceUrl: needsSource ? sourceUrl.trim() : undefined,
          sourceName: needsSource ? sourceName.trim() || undefined : undefined,
        }).finally(() => {
          setSaving(false);
          onClose();
        });
      },
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <Field label="Afirmação" value={claim} onChangeText={setClaim} multiline />
      <Row style={{ flexWrap: 'wrap' }}>
        {PUBLISHABLE.map((r) => (
          <Chip key={r} label={CHECK_LABEL[r]} active={r === result} onPress={() => setResult(r)} />
        ))}
      </Row>
      <Field label="Explicação" value={explanation} onChangeText={setExplanation} multiline />
      {needsSource ? (
        <>
          <Field
            label="Link da fonte"
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
            hint="A IA não achou fonte. Sem link não dá para publicar."
          />
          <Field label="Nome da fonte (opcional)" value={sourceName} onChangeText={setSourceName} placeholder="Ex.: Agência Lupa" />
        </>
      ) : null}
      <Row>
        <Button title="Publicar" small block={false} loading={saving} disabled={!ready} onPress={submit} />
        <Button title="Voltar" kind="ghost" small block={false} onPress={onClose} />
      </Row>
    </View>
  );
}

/**
 * Resultado da IA para quem pediu: sem selo de veredito e sem compartilhar.
 * Mostra o que achou e a fonte, e a pessoa tira a conclusão. Selo e
 * compartilhar só depois que a equipe confere (revisão jurídica de 12/10).
 */
const AUTO_HINT: Record<Exclude<CheckResult, 'unverified'>, string> = {
  true: 'Indício: parece verdade.',
  half_true: 'Indício: parece verdade só em parte.',
  exaggeration: 'Indício: parece exagerado.',
  false: 'Indício: parece não se sustentar.',
};

function AutoResult(props: {
  claim: string;
  result: CheckResult;
  explanation: string;
  sourceName: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
}) {
  return (
    <Card stripe={color.neutral}>
      <Badge label="O que a IA encontrou" color={color.neutral} />
      <Txt variant="heading">"{props.claim}"</Txt>
      {props.result !== 'unverified' ? <Txt variant="small">{AUTO_HINT[props.result]}</Txt> : null}
      <Txt variant="body">{props.explanation}</Txt>
      <Source name={props.sourceName} url={props.sourceUrl} />
      <AutoLabel checkedAt={props.checkedAt} />
      <Txt variant="small" muted>
        Leia a fonte e tire sua conclusão. Checagem por IA não pode ser compartilhada pelo app até a equipe
        revisar.
      </Txt>
    </Card>
  );
}

const STATUS_LABEL: Record<ClaimCheck['status'], string> = {
  queued: 'Na fila',
  processing: 'Checando',
  done: 'Pronto',
  failed: 'Não deu para checar',
};

/**
 * Aviso de que foi IA e ninguém revisou ainda. É precaução por causa das
 * regras do TSE sobre conteúdo de IA na eleição (falta confirmar com o jurídico).
 */
function AutoLabel({ checkedAt }: { checkedAt: string | null }) {
  return (
    <Txt variant="small" muted>
      Checagem automática feita por IA{checkedAt ? ` em ${brDate(checkedAt)}` : ''}, ainda não revisada pela
      equipe. Confira a fonte.
    </Txt>
  );
}

/** Toque abre o original, para a pessoa conferir sozinha. */
function Source({ name, url }: { name: string | null; url: string | null }) {
  if (!name && !url) return null;
  return url ? (
    <Txt variant="small" tone="primary" onPress={() => void Linking.openURL(url)}>
      Fonte: {name ?? url} ›
    </Txt>
  ) : (
    <Txt variant="small" muted>
      Fonte: {name}
    </Txt>
  );
}
