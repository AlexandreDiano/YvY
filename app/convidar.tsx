import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  PERSONAL_SCAN_MIN,
  REMOTE_TTL_H,
  TABLE_MAX_USES,
  TABLE_SCAN_MIN,
  TABLE_TTL_H,
  decideInvitee,
  generateInvite,
  inviteClaimStats,
  inviteDeepLink,
  myInvitees,
  releaseInviteClaims,
  rotateTableInvite,
  type GeneratedInvite,
  type Invitee,
} from '@/api/invites';
import { canInvite, setInvitePermission } from '@/api/members';
import { useAuth } from '@/features/auth/AuthProvider';
import { camarada } from '@/lib/format';
import { confirmAction, notify } from '@/lib/notify';
import { useNoScreenshots } from '@/lib/privacy';
import {
  Banner,
  Button,
  Card,
  Field,
  Loading,
  Options,
  Row,
  Screen,
  Section,
  Txt,
  color,
  radius,
  space,
} from '@/ui';

type Kind = 'personal' | 'table' | 'remote';

/**
 * Gerar convite.
 *
 * Membro só tem QRCode, mostrado na tela, cara a cara. Não existe código de
 * texto para membro justamente para o convite não sair rodando em grupo.
 * Moderador e admin também geram o convite à distância (código de 1 uso) para
 * quem está longe. Em todo caso quem gerou ainda confirma a pessoa.
 *
 * QRCode pessoal vale 2 min. O de mesa troca sozinho a cada 5 min enquanto
 * a tela está aberta (mesmo evento, mesmas 20 vagas), então foto do QRCode
 * perde a validade junto.
 */
export default function Convidar() {
  useNoScreenshots('convidar');
  const { profile, isBaseMember, isModerator } = useAuth();
  const [big, setBig] = useState(false);
  const prevBrightness = useRef<number | null>(null);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [inviter, setInviter] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      void myInvitees().then(setInvitees, () => setInvitees([]));
      void canInvite(isBaseMember).then(setInviter);
    }, [isBaseMember]),
  );

  async function decide(i: Invitee, decision: 'active' | 'rejected') {
    try {
      await decideInvitee(i.id, decision);
      setInvitees((list) => list.map((x) => (x.id === i.id ? { ...x, membership_status: decision } : x)));
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível decidir.');
    }
  }

  /** QR na tela inteira com brilho no máximo, para o outro celular ler fácil. */
  async function openBig() {
    setBig(true);
    if (Platform.OS === 'web') return;
    try {
      // No Android o brilho é só desta tela. No iOS é da tela toda, então guarda o anterior.
      prevBrightness.current = await Brightness.getBrightnessAsync();
      await Brightness.setBrightnessAsync(1);
    } catch {
      // sem permissão de brilho, o QR grande já ajuda
    }
  }

  async function closeBig() {
    setBig(false);
    if (Platform.OS === 'web') return;
    try {
      if (Platform.OS === 'android') await Brightness.restoreSystemBrightnessAsync();
      else if (prevBrightness.current !== null) await Brightness.setBrightnessAsync(prevBrightness.current);
    } catch {
    }
  }
  const [kind, setKind] = useState<Kind>('personal');
  const [eventName, setEventName] = useState('');
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [focused, setFocused] = useState(true);
  const rotating = useRef(false);
  // falhou (mesa sem rede)? tenta de novo a cada 15 s
  const retryAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // mesa: cadastros x reservas pendentes, a cada 15 s enquanto a tela está aberta
  const [stats, setStats] = useState<{ redeemed: number; pending: number } | null>(null);
  const tableId = invite && kind === 'table' ? invite.id : null;
  useEffect(() => {
    if (!tableId || !focused) return;
    const load = () => void inviteClaimStats(tableId).then(setStats, () => undefined);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [tableId, focused]);

  function releaseStuck() {
    if (!invite) return;
    confirmAction(
      'Liberar vagas presas?',
      'Apaga as reservas de quem escaneou e ainda não terminou o cadastro. Quem estiver no meio do cadastro vai precisar escanear de novo.',
      'Liberar',
      () =>
        void releaseInviteClaims(invite.id).then(
          (n) => {
            notify('Vagas liberadas', `${n} ${n === 1 ? 'reserva apagada' : 'reservas apagadas'}.`);
            void inviteClaimStats(invite.id).then(setStats, () => undefined);
          },
          (err: unknown) => notify('Erro', err instanceof Error ? err.message : 'Não foi possível liberar.'),
        ),
      true,
    );
  }

  // relógio da contagem, só com QRCode na tela
  const showingQr = Boolean(invite) && kind !== 'remote';
  useEffect(() => {
    if (!showingQr || !focused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [showingQr, focused]);

  // mesa: troca o QRCode quando acabam os 5 min, só com a tela aberta
  useEffect(() => {
    if (!invite || kind !== 'table' || !focused || rotating.current) return;
    if (now < new Date(invite.scanExpiresAt).getTime()) return;
    if (now >= new Date(invite.expiresAt).getTime() || now < retryAt.current) return;
    rotating.current = true;
    rotateTableInvite(invite)
      .then(
        (next) => {
          setError(null);
          setInvite(next);
        },
        (err: unknown) => {
          retryAt.current = Date.now() + 15_000;
          setError(err instanceof Error ? err.message : 'Não foi possível renovar o QRCode.');
        },
      )
      .finally(() => {
        rotating.current = false;
      });
  }, [invite, kind, focused, now]);

  function grant(i: Invitee, enabled: boolean) {
    const who = camarada(i.display_name);
    confirmAction(
      enabled ? `Deixar ${who} convidar?` : `Tirar o convite de ${who}?`,
      enabled
        ? `${who} vai poder gerar QRCode de convite. Quem entrar pelo convite dele aparece para ele confirmar, não para você.`
        : `${who} para de gerar convite. Quem já entrou continua.`,
      'Confirmar',
      () =>
        void setInvitePermission(i.id, enabled).then(
          () => setInvitees((list) => list.map((x) => (x.id === i.id ? { ...x, can_invite: enabled } : x))),
          (err: unknown) => notify('Erro', err instanceof Error ? err.message : 'Não foi possível salvar.'),
        ),
    );
  }

  const list = <InviteeList invitees={invitees} canGrant={inviter === true} onDecide={decide} onGrant={grant} />;

  if (inviter === null) return <Loading />;
  if (!inviter) {
    return (
      <Screen>
        <Banner
          tone="warning"
          title="Convite não liberado"
          detail={
            isBaseMember
              ? 'Quem libera é quem te convidou ou a moderação do seu bairro.'
              : 'Você ainda está pendente. Só dá para convidar depois de confirmado.'
          }
        />
        {invitees.length > 0 ? list : null}
      </Screen>
    );
  }

  async function generate() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      setInvite(await generateInvite(profile, kind, kind === 'table' ? eventName.trim() : undefined));
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar o convite.');
    } finally {
      setBusy(false);
    }
  }

  const scanLeft = invite ? new Date(invite.scanExpiresAt).getTime() - now : 0;
  const personalExpired = Boolean(invite) && kind === 'personal' && scanLeft <= 0;
  const eventOver = Boolean(invite) && kind === 'table' && now >= new Date(invite!.expiresAt).getTime();

  const options: { key: Kind; label: string; detail: string }[] = [
    { key: 'personal', label: 'Pessoal', detail: `QRCode · 1 uso · vale ${PERSONAL_SCAN_MIN} min` },
    {
      key: 'table',
      label: 'De mesa (evento)',
      detail: `QRCode · até ${TABLE_MAX_USES} pessoas · troca a cada ${TABLE_SCAN_MIN} min · evento de ${TABLE_TTL_H}h`,
    },
  ];
  if (isModerator) {
    options.push({
      key: 'remote',
      label: 'À distância',
      detail: `Código para quem está longe · 1 uso · expira em ${REMOTE_TTL_H}h`,
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

      {invite && kind !== 'remote' && personalExpired ? (
        <Card>
          <Txt variant="heading" center>
            QRCode expirou
          </Txt>
          <Txt variant="small" muted center>
            O QRCode pessoal vale {PERSONAL_SCAN_MIN} minutos. Toque em "Gerar outro" com o camarada na sua frente.
          </Txt>
        </Card>
      ) : null}

      {invite && kind !== 'remote' && !personalExpired && !eventOver ? (
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
              {kind === 'table'
                ? `Escaneie para entrar no YvY · até ${invite.maxUses} pessoas · QRCode novo em ${mmss(scanLeft)} · evento até ${new Date(invite.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : `Escaneie para entrar no YvY · 1 uso · expira em ${mmss(scanLeft)}`}
            </Txt>
            {kind === 'table' && stats ? (
              <>
                <Txt variant="small" center>
                  {stats.redeemed} {stats.redeemed === 1 ? 'cadastro' : 'cadastros'} · {stats.pending}{' '}
                  {stats.pending === 1 ? 'reserva pendente' : 'reservas pendentes'} · {Math.max(0, invite.maxUses - stats.redeemed - stats.pending)} vagas livres
                </Txt>
                {stats.pending > 0 ? (
                  <Button title="Liberar vagas presas" kind="ghost" small onPress={releaseStuck} />
                ) : null}
              </>
            ) : null}
          </Card>
        </>
      ) : null}
      {invite && kind === 'table' && eventOver ? (
        <Card>
          <Txt variant="heading" center>
            Convite do evento encerrado
          </Txt>
          <Txt variant="small" muted center>
            O QRCode de mesa vale {TABLE_TTL_H}h. Gere outro se o evento continua.
          </Txt>
        </Card>
      ) : null}

      {invite && kind !== 'remote' && !personalExpired && !eventOver ? (
        <Modal visible={big} animationType="fade" onRequestClose={() => void closeBig()}>
          <Pressable style={s.full} onPress={() => void closeBig()}>
            <QRCode value={inviteDeepLink(invite.token)} size={320} color="#000000" backgroundColor="#FFFFFF" />
            <Txt variant="small" muted center>
              Toque para fechar
            </Txt>
          </Pressable>
        </Modal>
      ) : null}

      {list}
    </Screen>
  );
}

/** Quem esta pessoa convidou: confirmar/recusar quem está pendente e liberar o convite de quem já entrou. */
function InviteeList({
  invitees,
  canGrant,
  onDecide,
  onGrant,
}: {
  invitees: Invitee[];
  canGrant: boolean;
  onDecide: (i: Invitee, decision: 'active' | 'rejected') => void;
  onGrant: (i: Invitee, enabled: boolean) => void;
}) {
  return (
    <>
      <Section title={`Quem você convidou · ${invitees.length}`} />
      {invitees.length === 0 ? (
        <Txt variant="small" muted>
          Ninguém ainda. Quem entrar com o seu convite aparece aqui.
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
                  ? 'esperando você confirmar'
                  : 'recusado'}
              {i.membership_status === 'active' && i.can_invite ? ' · pode convidar' : ''}
              {i.invited_count > 0 ? ` · trouxe ${i.invited_count}` : ''}
            </Txt>
            {i.membership_status === 'pending' ? (
              <Row>
                <Button title="Confirmar" small block={false} onPress={() => onDecide(i, 'active')} />
                <Button
                  title="Recusar"
                  kind="ghost"
                  small
                  block={false}
                  onPress={() =>
                    confirmAction(
                      `Recusar ${camarada(i.display_name)}?`,
                      'A pessoa fica sem acesso à base.',
                      'Recusar',
                      () => onDecide(i, 'rejected'),
                      true,
                    )
                  }
                />
              </Row>
            ) : null}
            {canGrant && i.membership_status === 'active' && i.role === 'militant' ? (
              <Button
                title={i.can_invite ? 'Tirar convite' : 'Deixar convidar'}
                kind={i.can_invite ? 'ghost' : 'outline'}
                small
                block={false}
                onPress={() => onGrant(i, !i.can_invite)}
              />
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
    backgroundColor: '#FFFFFF', // QR sempre em fundo claro, leitor falha com QR invertido
    borderRadius: radius.md,
  },
});
