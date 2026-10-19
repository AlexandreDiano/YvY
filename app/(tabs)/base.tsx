import * as ImagePicker from 'expo-image-picker';
import { shrinkImage } from '@/lib/shrinkImage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, RefreshControl, View } from 'react-native';
import {
  FLAG_REASONS,
  MAX_POST_CHARS,
  createPost,
  deletePost,
  flagPost,
  listFeed,
  scopeLabel,
  sendPostToReview,
  type FeedScope,
} from '@/api/feed';
import { followedRegions, myRegion, type MyRegion } from '@/api/geo';
import { unreadCount } from '@/api/notifications';
import { uploadPostImage, type PickedImage } from '@/api/storage';
import { useAuth } from '@/features/auth/AuthProvider';
import { TourTarget } from '@/features/onboarding/Tour';
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

const SCOPES: FeedScope[] = ['bairro', 'regiao_imediata', 'regiao', 'brasil'];

// Fora do componente para sobreviver a uma remontagem da tela (trava de
// biometria, troca de aba): senão o nível voltava para bairro e o post de
// Brasil que a pessoa estava vendo sumia.
let lastScope: FeedScope = 'bairro';

/**
 * Feed da Base em quatro níveis: bairro, região imediata do IBGE, região do
 * país e Brasil. Post de
 * bairro passa pelo moderador do bairro; o resto passa pelo admin.
 */
export default function Base() {
  useNoScreenshots('base');
  const router = useRouter();
  const { profile, isModerator, mode } = useAuth();
  const [scope, setScope] = useState<FeedScope>(lastScope);
  const [region, setRegion] = useState<MyRegion | null>(null);
  const [followed, setFollowed] = useState<MyRegion[]>([]);
  // no nível região: null = a própria, senão o id de uma região seguida
  const [viewing, setViewing] = useState<number | null>(null);
  useEffect(() => {
    if (profile) void myRegion(profile.id).then(setRegion);
  }, [profile]);
  const shownRegion = (viewing !== null && followed.find((f) => f.id === viewing)) || region;
  const readingOther = scope === 'regiao_imediata' && viewing !== null && shownRegion !== region;
  const [posts, setPosts] = useState<PostListed[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Várias buscas podem estar no ar ao mesmo tempo (foco, troca de nível,
  // perfil recarregado a cada renovação de sessão). Só a última pedida vale:
  // uma resposta atrasada de outro nível não pode sobrescrever a tela.
  const latest = useRef(0);
  const load = useCallback(
    async (p = 0, s: FeedScope = scope) => {
      if (!profile) return;
      const req = ++latest.current;
      try {
        const list = await listFeed(profile, p, s, s === 'regiao_imediata' ? shownRegion : null);
        if (req !== latest.current) return;
        setPosts(list);
        setError(null);
      } catch (err) {
        if (req !== latest.current) return;
        setError(err instanceof Error ? err.message : 'Falha ao carregar o feed.');
      }
    },
    [profile, scope, shownRegion],
  );

  // recarrega a cada foco, assim post aprovado aparece sem precisar puxar a tela
  useFocusEffect(
    useCallback(() => {
      setPage(0);
      void load(0);
      void unreadCount().then(setUnread);
      // a lista de regiões seguidas muda na tela /regioes
      void followedRegions().then((list) => {
        setFollowed(list);
        if (viewing !== null && !list.some((f) => f.id === viewing)) setViewing(null);
      });
    }, [load, viewing]),
  );

  async function pickImage(source: 'camera' | 'library') {
    // galeria não pede permissão: o seletor do sistema só entrega a foto escolhida
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      Alert.alert('Sem permissão', 'Libere a câmera para tirar a foto.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: false });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;
    // No site a imagem chega original, então diminui e tira o EXIF (que tem GPS).
    // No celular o seletor já faz isso.
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
            : 'Vai para a moderação. Posts de região e Brasil só saem depois de aprovados.',
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

  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState('');

  async function sendToReview(post: PostListed) {
    try {
      await sendPostToReview(post.id, reviewReason.trim());
      setReviewing(null);
      setReviewReason('');
      await load(0);
      Alert.alert(
        'Post em revisão',
        post.scope && post.scope !== 'bairro'
          ? 'Saiu do feed. Post fora do bairro é decidido por um admin, na Moderação.'
          : 'Saiu do feed e está na Moderação do bairro.',
      );
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não deu para mandar para revisão.');
    }
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
          <TourTarget id="base.avisos">
            <Button
              title={unread ? `Avisos (${unread})` : 'Avisos'}
              small
              kind={unread ? 'accent' : 'ghost'}
              block={false}
              onPress={() => router.push('/avisos')}
            />
          </TourTarget>
          {isModerator ? (
            <Button title="Moderar" small kind="outline" block={false} onPress={() => router.push('/moderar')} />
          ) : null}
        </Row>
      </Row>

      <TourTarget id="base.scope">
        <Row style={{ flexWrap: 'wrap' }}>
          {SCOPES.map((s) => (
            <Chip
              key={s}
              label={scopeLabel(s, profile, region?.name)}
              active={scope === s}
              onPress={() => {
                lastScope = s;
                setScope(s);
                setPage(0);
                setPosts([]);
                void load(0, s);
              }}
            />
          ))}
        </Row>
      </TourTarget>

      {scope === 'regiao_imediata' && region ? (
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip
            label={`Minha · ${region.name}`}
            active={viewing === null}
            onPress={() => {
              setViewing(null);
              setPosts([]);
            }}
          />
          {followed.map((f) => (
            <Chip
              key={f.id}
              label={`${f.name} (${f.uf})`}
              active={viewing === f.id}
              onPress={() => {
                setViewing(f.id);
                setPosts([]);
              }}
            />
          ))}
          <Chip label="+ Seguir região" onPress={() => router.push('/regioes')} />
        </Row>
      ) : null}

      {readingOther ? (
        <Txt variant="small" muted>
          Você está lendo a região de {shownRegion?.name}. Para postar, volte para a sua região.
        </Txt>
      ) : (
        <TourTarget id="base.composer">
          <Card>
            <Field
              placeholder={`Escreva para ${scopeLabel(scope, profile, region?.name)}...`}
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
        </TourTarget>
      )}

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
                {reviewing === p.id ? (
                  <>
                    <Field
                      label="Por que este post precisa de revisão?"
                      value={reviewReason}
                      onChangeText={setReviewReason}
                      maxLength={200}
                    />
                    <Row>
                      <Button
                        title="Tirar do feed e revisar"
                        kind="accent"
                        small
                        block={false}
                        disabled={reviewReason.trim().length < 4}
                        onPress={() => void sendToReview(p)}
                      />
                      <Button title="Voltar" kind="ghost" small block={false} onPress={() => setReviewing(null)} />
                    </Row>
                  </>
                ) : null}
                <Row style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {isModerator && !mine && reviewing !== p.id ? (
                    <Button
                      title="Mandar para revisão"
                      kind="ghost"
                      small
                      block={false}
                      onPress={() => {
                        setReviewing(p.id);
                        setReviewReason('');
                      }}
                    />
                  ) : null}
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
