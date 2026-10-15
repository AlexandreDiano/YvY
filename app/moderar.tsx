import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { listForModeration, moderate, scopeLabel } from '@/api/feed';
import { useAuth } from '@/features/auth/AuthProvider';
import type { PostListed } from '@/lib/db.types';
import { useNoScreenshots } from '@/lib/privacy';
import { camarada, relativeTime } from '@/lib/format';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Row,
  Screen,
  PostImage,
  Txt,
  color,
  radius,
} from '@/ui';

const QUICK_REASONS = [
  'Rosto de pessoa sem autorização',
  'Sem fonte para a afirmação',
  'Provocação ou ofensa',
  'Dado pessoal de terceiro',
  'Fora do tema da base',
];

/**
 * Fila de moderação. Moderador vê o bairro dele; admin vê cidade, região e
 * Brasil. Recusar pede motivo, que aparece para o autor em Avisos.
 */
export default function Moderar() {
  useNoScreenshots('moderar');
  const { profile, isModerator } = useAuth();
  const [posts, setPosts] = useState<PostListed[]>([]);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setPosts(await listForModeration(profile));
  }, [profile]);

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

  async function decide(post: PostListed, decision: 'published' | 'removed') {
    if (!profile) return;
    setBusy(true);
    try {
      await moderate(post.id, decision, profile.id, decision === 'removed' ? reason.trim() : undefined);
      setRejecting(null);
      setReason('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt variant="small" muted>
        Pendentes e denunciados. Post de bairro sem resposta em 2h publica sozinho; de cidade, região e
        Brasil, só com aprovação.
      </Txt>

      {posts.length === 0 ? (
        <EmptyState title="Fila vazia" detail="Nada aguardando moderação agora." />
      ) : (
        posts.map((p) => (
          <Card key={p.id} stripe={p.status === 'flagged' ? color.danger : color.warning}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge
                label={p.status === 'flagged' ? `${p.flagged_count} denúncias` : 'Pendente'}
                color={p.status === 'flagged' ? color.danger : color.warning}
              />
              <Txt variant="small" muted>
                {relativeTime(p.created_at)}
              </Txt>
            </Row>
            <Txt variant="label" tone="primary">
              {camarada(p.author_display_name)} · {scopeLabel(p.scope ?? 'bairro', null)}
              {p.scope && p.scope !== 'bairro' ? ` · ${p.state}` : ''}
            </Txt>
            {p.image_url ? (
              <PostImage uri={p.image_url} />
            ) : null}
            <Txt variant="body">{p.content}</Txt>
            {rejecting === p.id ? (
              <>
                <Txt variant="label" muted upper>
                  Motivo (o autor vai ler)
                </Txt>
                <Row style={{ flexWrap: 'wrap' }}>
                  {QUICK_REASONS.map((r) => (
                    <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />
                  ))}
                </Row>
                <Field value={reason} onChangeText={setReason} placeholder="Ou escreva o motivo" maxLength={200} />
                <Row>
                  <Button
                    title="Recusar post"
                    kind="accent"
                    small
                    block={false}
                    loading={busy}
                    disabled={reason.trim().length < 4}
                    onPress={() => void decide(p, 'removed')}
                  />
                  <Button title="Voltar" kind="ghost" small block={false} onPress={() => setRejecting(null)} />
                </Row>
              </>
            ) : (
              <Row>
                <Button title="Aprovar" small block={false} loading={busy} onPress={() => void decide(p, 'published')} />
                <Button
                  title="Recusar"
                  kind="outline"
                  small
                  block={false}
                  onPress={() => {
                    setRejecting(p.id);
                    setReason('');
                  }}
                />
              </Row>
            )}
          </Card>
        ))
      )}
      <View />
    </Screen>
  );
}
