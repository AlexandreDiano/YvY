import * as ImagePicker from 'expo-image-picker';
import { shrinkImage } from '@/lib/shrinkImage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, RefreshControl, View } from 'react-native';
import {
  FLAG_REASONS,
  MAX_POST_CHARS,
  createPost,
  deletePost,
  flagPost,
  listFeed,
  scopeLabel,
  type FeedScope,
} from '@/api/feed';
import { unreadCount } from '@/api/notifications';
import { uploadPostImage, type PickedImage } from '@/api/storage';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNoScreenshots } from '@/lib/privacy';
import type { PostListed } from '@/lib/db.types';
import { camarada, dayBucket, relativeTime } from '@/lib/format';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Row,
  Screen,
  Section,
  PostImage,
  Txt,
  color,
  radius,
  space,
} from '@/ui';
import { IconCamera, IconFlag } from '@/ui/icons';

const SCOPES: FeedScope[] = ['bairro', 'estado', 'regiao', 'brasil'];

/**
 * Tela 7.4 — Base. Quatro níveis de feed (bairro, estado, região, Brasil).
 * Post de bairro passa pelo moderador do bairro; dos outros níveis, pelo admin.
 */
export default function Base() {
  useNoScreenshots('base');
  const router = useRouter();
  const { profile, isModerator, mode } = useAuth();
  const [scope, setScope] = useState<FeedScope>('bairro');
  const [posts, setPosts] = useState<PostListed[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(
    async (p = 0, s: FeedScope = scope) => {
      if (!profile) return;
      try {
        setPosts(await listFeed(profile, p, s));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar o feed.');
      }
    },
    [profile, scope],
  );

  // Recarrega sempre que a aba ganha foco: post aprovado aparece sem puxar a tela.
  useFocusEffect(
    useCallback(() => {
      setPage(0);
      void load(0);
      void unreadCount().then(setUnread);
    }, [load]),
  );

  async function pickImage(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Sem permissão',
        source === 'camera'
          ? 'Libere a câmera para tirar a foto.'
          : 'Libere o acesso às fotos para anexar uma imagem.',
      );
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    // No site: diminui e tira o EXIF (GPS) antes de subir. No celular o
    // seletor já fez isso.
    const img = await shrinkImage(asset, { maxSide: 1280, quality: 0.7 });
    if (img) setImage(img);
  }

  function chooseImage() {
    Alert.alert('Foto do post', 'Evite rostos de quem não autorizou: a moderação recusa.', [
      { text: 'Tirar foto agora', onPress: () => void pickImage('camera') },
      { text: 'Escolher da galeria', onPress: () => void pickImage('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function publish() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const url = image ? await uploadPostImage(image, profile.id) : null;
      await createPost(profile, text, url, scope);
      setText('');
      setImage(null);
      await load(0);
      Alert.alert(
        'Post enviado',
        mode === 'local'
          ? 'Publicado neste aparelho.'
          : scope === 'bairro'
            ? 'Vai para a moderação do bairro. Se ninguém responder em 2h, publica sozinho.'
            : 'Vai para a moderação. Posts de estado, região e Brasil só saem depois de aprovados.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível publicar.');
    } finally {
      setBusy(false);
    }
  }

  function remove(post: PostListed) {
    Alert.alert('Apagar post', 'O post some para todos. Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(post.id);
            await load(0);
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao apagar.');
          }
        },
      },
    ]);
  }

  function denounce(post: PostListed) {
    if (!profile) return;
    Alert.alert(
      'Denunciar post',
      'Qual o motivo?',
      [
        ...FLAG_REASONS.map((r) => ({
          text: r.label,
          onPress: async () => {
            try {
              await flagPost(post.id, profile.id, r.key);
              await load(0);
              Alert.alert('Denúncia enviada', 'A moderação foi avisada.');
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao denunciar.');
            }
          },
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
      { cancelable: true },
    );
  }

  let lastBucket = '';

  return (
    <Screen
      safeTop
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            setPage(0);
            await load(0);
            setRefreshing(false);
          }}
        />
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt variant="title">Base</Txt>
          <Txt variant="small" muted>
            {profile?.neighborhood ?? '—'} · {profile?.city ?? ''}
          </Txt>
        </View>
        <Row>
          <Button
            title={unread ? `Avisos (${unread})` : 'Avisos'}
            small
            kind={unread ? 'accent' : 'ghost'}
            block={false}
            onPress={() => router.push('/avisos')}
          />
          {isModerator ? (
            <Button title="Moderar" small kind="outline" block={false} onPress={() => router.push('/moderar')} />
          ) : null}
        </Row>
      </Row>

      <Row style={{ flexWrap: 'wrap' }}>
        {SCOPES.map((s) => (
          <Chip
            key={s}
            label={scopeLabel(s, profile)}
            active={scope === s}
            onPress={() => {
              setScope(s);
              setPage(0);
              void load(0, s);
            }}
          />
        ))}
      </Row>

      <Card>
        <Field
          placeholder={`Escreva para ${scopeLabel(scope, profile).toLowerCase()}...`}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_POST_CHARS}
        />
        {image ? <Image source={{ uri: image.uri }} style={{ height: 160, borderRadius: radius.sm }} /> : null}
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Button
              title={image ? 'Trocar foto' : 'Foto'}
              kind="ghost"
              small
              block={false}
              left={<IconCamera size={18} color={color.primary} />}
              onPress={chooseImage}
            />
            {image ? (
              <Button title="Tirar" kind="ghost" small block={false} onPress={() => setImage(null)} />
            ) : null}
          </Row>
          <Txt variant="small" muted>
            {text.length}/{MAX_POST_CHARS}
          </Txt>
        </Row>
        <Button title="Publicar" small loading={busy} disabled={!text.trim()} onPress={publish} />
      </Card>

      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      {posts.length === 0 ? (
        <EmptyState
          title="Nada por aqui ainda"
          detail="Pergunta, convocação, relato da panfletagem de ontem: o que a base precisa saber?"
        />
      ) : (
        posts.map((p) => {
          const bucket = dayBucket(p.created_at);
          const header = bucket !== lastBucket ? bucket : null;
          lastBucket = bucket;
          const mine = p.author_id === profile?.id;
          return (
            <View key={p.id} style={{ gap: space.sm }}>
              {header ? <Section title={header} /> : null}
              <Card>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="label" tone="primary">
                    {camarada(p.author_display_name)}
                  </Txt>
                  <Txt variant="small" muted>
                    {relativeTime(p.created_at)}
                  </Txt>
                </Row>
                {p.image_url ? (
                  <PostImage uri={p.image_url} />
                ) : null}
                <Txt variant="body">{p.content}</Txt>
                <Row style={{ justifyContent: 'flex-end' }}>
                  {mine ? (
                    <Button title="Apagar" kind="ghost" small block={false} onPress={() => remove(p)} />
                  ) : (
                    <Button
                      title="Denunciar"
                      kind="ghost"
                      small
                      block={false}
                      left={<IconFlag size={16} color={color.accent} />}
                      onPress={() => denounce(p)}
                    />
                  )}
                </Row>
              </Card>
            </View>
          );
        })
      )}

      {posts.length >= 20 * (page + 1) ? (
        <Button
          title="Carregar mais"
          kind="outline"
          onPress={async () => {
            const next = page + 1;
            setPage(next);
            await load(next);
          }}
        />
      ) : null}
    </Screen>
  );
}
