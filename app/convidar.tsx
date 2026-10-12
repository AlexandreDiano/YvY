import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  PERSONAL_TTL_H,
  TABLE_MAX_USES,
  TABLE_TTL_H,
  decideInvitee,
  generateInvite,
  inviteDeepLink,
  myInvitees,
  type GeneratedInvite,
  type Invitee,
} from '../src/api/invites';
import { useNoScreenshots } from '../src/lib/privacy';
import { useAuth } from '../src/features/auth/AuthProvider';
import { camarada } from '../src/lib/format';
import {
  Banner,
  Button,
  Card,
  Field,
  Options,
  Row,
  Screen,
  Section,
  Txt,
  color,
  radius,
  space,
} from '../src/ui';

type Kind = 'personal' | 'table' | 'remote';

/**
 * Fluxo 4.2 — gerar convite.
 *
 * Membro: só QRCode, mostrado na tela, olho no olho. Não existe código de
 * texto para membro — é isso que impede o convite de circular em grupo.
 * Moderador/admin: também o convite à distância, um código de texto de 1 uso
 * para quem está longe (outro estado). Quem gera ainda confirma a pessoa.
 */
export default function Convidar() {
  useNoScreenshots('convidar');
  const { profile, isBaseMember, isModerator } = useAuth();
  const [big, setBig] = useState(false);
  const prevBrightness = useRef<number | null>(null);
  const [invitees, setInvitees] = useState<Invitee[]>([]);

  useFocusEffect(
    useCallback(() => {
      void myInvitees().then(setInvitees, () => setInvitees([]));
    }, []),
  );

  async function decide(i: Invitee, decision: 'active' | 'rejected') {
    try {
      await decideInvitee(i.id, decision);
      setInvitees((list) => list.map((x) => (x.id === i.id ? { ...x, membership_status: decision } : x)));
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível decidir.');
    }
  }

  /** QR grande na tela inteira com brilho no máximo, para o outro celular ler fácil. */
  async function openBig() {
    setBig(true);
    if (Platform.OS === 'web') return;
    try {
      // Android: brilho só desta tela. iOS: brilho da tela toda — guarda o anterior.
      prevBrightness.current = await Brightness.getBrightnessAsync();
      await Brightness.setBrightnessAsync(1);
    } catch {
      // sem permissão de brilho: o QR grande já ajuda
    }
  }

  async function closeBig() {
    setBig(false);
    if (Platform.OS === 'web') return;
    try {
      if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
      else if (prevBrightness.current !== null) await Brightness.setBrightnessAsync(prevBrightness.current);
    } catch {
      // ignora
    }
  }
  const [kind, setKind] = useState<Kind>('personal');
  const [eventName, setEventName] = useState('');
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isBaseMember) {
    return (
      <Screen>
        <Banner
          tone="warning"
          title="Só membro confirmado convida"
          detail="Quem ainda está pendente de confirmação não pode gerar convite."
        />
      </Screen>
    );
  }

  async function generate() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      setInvite(await generateInvite(profile, kind, kind === 'table' ? eventName.trim() : undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o convite.');
    } finally {
      setBusy(false);
    }
  }

  const options: { key: Kind; label: string; detail: string }[] = [
    { key: 'personal', label: 'Pessoal', detail: `QRCode · 1 uso · expira em ${PERSONAL_TTL_H}h` },
    { key: 'table', label: 'De mesa (evento)', detail: `QRCode · ${TABLE_MAX_USES} usos · expira em ${TABLE_TTL_H}h` },
  ];
  if (isModerator) {
    options.push({
      key: 'remote',
      label: 'À distância',
      detail: `Código para quem está longe · 1 uso · expira em ${PERSONAL_TTL_H}h`,
    });
  }

  return (
    <Screen>
      {kind === 'remote' ? (
        <Banner
          tone="warning"
          title="Convite à distância"
          detail="Mande só para quem você conhece e confia. O código vale 1 uso, expira em 24h, e você ainda precisa confirmar a pessoa depois que ela se cadastrar."
        />
      ) : (
        <Banner
          title="Convite é olho no olho"
          detail="O camarada tem que estar na sua frente para escanear a tela. Não existe código para mandar no WhatsApp."
        />
      )}

      <Options
        label="Tipo de convite"
        value={kind}
        options={options}
        onChange={(v) => {
          setKind(v);
          setInvite(null);
        }}
      />
      {kind === 'table' ? (
        <Field
          label="Nome do evento"
          value={eventName}
          onChangeText={setEventName}
          placeholder="Mutirão da Praça X"
          hint="Fica registrado no banco junto com quem entrou por essa mesa."
        />
      ) : null}

      <Button
        title={invite ? 'Gerar outro' : kind === 'remote' ? 'Gerar código' : 'Gerar QRCode'}
        loading={busy}
        onPress={generate}
        disabled={kind === 'table' && !eventName.trim()}
      />
      {error ? (
        <Txt variant="small" tone="danger">
          {error}
        </Txt>
      ) : null}

      {invite && kind === 'remote' ? (
        <>
          <Section title="Código do convite" />
          <Card>
            <Txt variant="heading" selectable center>
              {invite.token}
            </Txt>
            <Txt variant="small" muted center>
              1 uso · expira {new Date(invite.expiresAt).toLocaleString('pt-BR')}
            </Txt>
            <Button
              title="Enviar para a pessoa"
              small
              onPress={() =>
                void Share.share({
                  message: [
                    `${camarada(profile?.display_name)} te convidou para o YvY.`,
                    '',
                    'Instale o app, toque em "Tenho um convite" e cole este código:',
                    invite.token,
                    '',
                    'Vale 1 uso e expira em 24h. Não repasse.',
                  ].join('\n'),
                })
              }
            />
            <Button
              title="Copiar código"
              kind="ghost"
              small
              onPress={async () => {
                await Clipboard.setStringAsync(invite.token);
                Alert.alert('Copiado', 'Mande só para a pessoa convidada, em conversa privada.');
              }}
            />
          </Card>
        </>
      ) : null}

      {invite && kind !== 'remote' ? (
        <>
          <Section title="Mostre esta tela" />
          <Card>
            <Pressable accessibilityRole="button" onPress={() => void openBig()} style={s.qr}>
              <QRCode
                value={inviteDeepLink(invite.token)}
                size={240}
                color="#1E7440"
                backgroundColor="#FFFFFF"
              />
            </Pressable>
            <Txt variant="small" muted center>
              Toque no QRCode para aumentar e deixar a tela no brilho máximo.
            </Txt>
            <Txt variant="heading" center>
              Convite de {camarada(profile?.display_name)}
            </Txt>
            <Txt variant="small" muted center>
              Escaneie para entrar no YvY · {invite.maxUses === 1 ? '1 uso' : `${invite.maxUses} usos`} ·
              expira {new Date(invite.expiresAt).toLocaleString('pt-BR')}
            </Txt>
          </Card>
        </>
      ) : null}
      {invite && kind !== 'remote' ? (
        <Modal visible={big} animationType="fade" onRequestClose={() => void closeBig()}>
          <Pressable style={s.full} onPress={() => void closeBig()}>
            <QRCode value={inviteDeepLink(invite.token)} size={320} color="#000000" backgroundColor="#FFFFFF" />
            <Txt variant="small" muted center>
              Toque para fechar
            </Txt>
          </Pressable>
        </Modal>
      ) : null}

      <Section title={`Quem você convidou · ${invitees.length}`} />
      {invitees.length === 0 ? (
        <Txt variant="small" muted>
          Ninguém ainda. Quem entrar pelo seu convite aparece aqui.
        </Txt>
      ) : (
        invitees.map((i) => (
          <Card key={i.id}>
            <Txt variant="heading">{camarada(i.display_name)}</Txt>
            <Txt variant="small" muted>
              {[i.neighborhood, i.city, i.state].filter(Boolean).join(' · ')} ·{' '}
              {i.membership_status === 'active'
                ? 'confirmado'
                : i.membership_status === 'pending'
                  ? 'aguardando sua confirmação'
                  : 'recusado'}
            </Txt>
            {i.membership_status === 'pending' ? (
              <Row>
                <Button title="Confirmar" small block={false} onPress={() => void decide(i, 'active')} />
                <Button
                  title="Recusar"
                  kind="ghost"
                  small
                  block={false}
                  onPress={() =>
                    Alert.alert(`Recusar ${camarada(i.display_name)}?`, 'A pessoa fica sem acesso à base.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Recusar', style: 'destructive', onPress: () => void decide(i, 'rejected') },
                    ])
                  }
                />
              </Row>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  full: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  qr: {
    alignSelf: 'center',
    padding: space.md,
    backgroundColor: '#FFFFFF', // QR sempre em fundo claro: leitor falha com QR invertido
    borderRadius: radius.md,
  },
});
