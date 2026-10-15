import { useFocusEffect, useRouter } from 'expo-router';
import { ensureNotificationPermission } from '@/lib/reminders';
import { useCallback, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { FLAG } from '@/api/flags';
import { decideInvitee, pendingInvitees } from '@/api/invites';
import { canInvite, canManageRoles, giveSensitiveConsent } from '@/api/members';
import { RESPONSAVEL } from '@/data/responsavel';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBiometricLock } from '@/features/auth/BiometricLock';
import { InstallCard } from '@/features/pwa/InstallCard';
import { useInstall } from '@/features/pwa/install';
import { SupportCard } from '@/features/support/SupportCard';
import { env } from '@/lib/env';
import { monitoringEnabled, sendTestError } from '@/lib/monitoring';
import { notify } from '@/lib/notify';
import { camarada, formatCep, formatPhone, longDate } from '@/lib/format';
import {
  Button,
  Card,
  Divider,
  Field,
  Options,
  Row,
  Screen,
  Section,
  Toggle,
  Txt,
  saveThemePref,
  space,
  themePref,
  type ThemePref,
  color,
} from '@/ui';

const ROLE_LABEL: Record<string, string> = {
  visitor: 'Sem acesso à base',
  militant: 'Membro',
  moderator: 'Moderador',
  admin: 'Admin',
};

const PRECISION = [
  { key: '4', label: 'Cidade' },
  { key: '3', label: 'Bairro' },
  { key: '2', label: 'Quadra' },
  { key: '1', label: 'Rua' },
] as const;

export default function Perfil() {
  const router = useRouter();
  const {
    profile,
    role,
    membership,
    isBaseMember,
    isModerator,
    flags,
    updateProfile,
    signOut,
    canPreviewVisitor,
    setVisitorView,
    mode,
    refresh,
  } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(formatPhone(profile?.phone ?? ''));
  const [cep, setCep] = useState(formatCep(profile?.cep ?? ''));
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof pendingInvitees>>>([]);

  const [rolesPower, setRolesPower] = useState(false);
  const [inviter, setInviter] = useState(false);
  const [theme, setTheme] = useState<ThemePref>(themePref);
  const bio = useBiometricLock();
  const install = useInstall();
  // recarrega a cada foco: o convidado pode ter entrado com a tela já aberta
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      void pendingInvitees(profile).then(setPending).catch(() => setPending([]));
      void canManageRoles().then(setRolesPower);
      void canInvite(isBaseMember).then(setInviter);
    }, [profile, isBaseMember]),
  );

  async function decide(id: string, decision: 'active' | 'rejected') {
    try {
      await decideInvitee(id, decision);
      setPending((list) => list.filter((x) => x.id !== id));
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível decidir.');
    }
  }

  if (!profile) return null;

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim() || profile!.display_name,
        phone: phone.replace(/\D+/g, '') || null,
        cep: cep.replace(/\D+/g, '') || null,
      });
      Alert.alert('Salvo', 'Seus dados foram atualizados.');
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen safeTop>
      <Txt variant="title">{camarada(profile.display_name)}</Txt>
      <Txt variant="small" muted>
        {profile.neighborhood ?? '—'} · {profile.city ?? ''}/{profile.state ?? ''}
      </Txt>
      <Txt variant="small" muted>
        {ROLE_LABEL[role ?? 'visitor']}
        {membership === 'pending' ? ' · aguardando confirmação' : ''} · desde{' '}
        {longDate(profile.created_at)}
      </Txt>

      {mode === 'backend' && !profile.sensitive_consent_at ? (
        <Card stripe={color.accent}>
          <Txt variant="label">Falta um consentimento seu</Txt>
          <Txt variant="small">
            Participar da base revela opinião política, que a LGPD trata como dado sensível. Precisamos do seu
            consentimento separado para tratar esse dado (só para o app funcionar: sua conta, seu bairro, as
            ações). Se não quiser, peça a exclusão da conta em {RESPONSAVEL.email}.
          </Txt>
          <Button
            title="Consinto"
            small
            onPress={async () => {
              try {
                await giveSensitiveConsent();
                await refresh();
              } catch (err) {
                notify('Erro', err instanceof Error ? err.message : 'Não foi possível salvar.');
              }
            }}
          />
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <>
          <Section title="Convites aguardando você" />
          {pending.map((p) => (
            <Card key={p.id}>
              <Txt variant="heading">{camarada(p.display_name)}</Txt>
              <Txt variant="small" muted>
                {p.neighborhood} · {p.city}/{p.state}
              </Txt>
              <Row>
                <Button
                  title="Confirmar"
                  small
                  block={false}
                  onPress={() => void decide(p.id, 'active')}
                />
                <Button
                  title="Rejeitar"
                  kind="ghost"
                  small
                  block={false}
                  onPress={() =>
                    Alert.alert(`Recusar ${camarada(p.display_name)}?`, 'A pessoa fica sem acesso à base.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Recusar', style: 'destructive', onPress: () => void decide(p.id, 'rejected') },
                    ])
                  }
                />
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      <Section title="Minhas informações" />
      <Card>
        <Field label="Apelido no app" value={displayName} onChangeText={setDisplayName} maxLength={12} />
        <Field
          label="Telefone"
          value={phone}
          onChangeText={(v) => setPhone(formatPhone(v))}
          keyboardType="phone-pad"
        />
        <Field
          label="CEP"
          value={cep}
          onChangeText={(v) => setCep(formatCep(v))}
          keyboardType="number-pad"
          maxLength={9}
          hint="Mudou de bairro? Atualizar o CEP troca o seu feed e o seu mapa."
        />
        <Options
          label="Precisão da localização"
          value={String(profile.location_precision) as '1' | '2' | '3' | '4'}
          options={PRECISION.map((p) => ({ ...p }))}
          onChange={(v) => void updateProfile({ location_precision: Number(v) })}
        />
        <Button title="Salvar" loading={saving} onPress={save} />
      </Card>

      {isBaseMember && flags[FLAG.convites] ? (
        <>
          <Section title="Convidar" />
          <Card>
            {inviter ? (
              <>
                <Txt variant="body">
                  O QRCode vale 1 uso e expira em 2 minutos. Mostre na tela para o
                  camarada escanear — presencialmente.
                </Txt>
                <Button title="Gerar QRCode de convite" onPress={() => router.push('/convidar')} />
              </>
            ) : (
              <Txt variant="body" muted>
                Convidar é liberado pela moderação. Quer trazer alguém? Fale com o
                moderador do seu bairro.
              </Txt>
            )}
          </Card>
        </>
      ) : null}

      <Section title="Notificações" />
      <Button
        title="Permitir avisos no celular"
        kind="outline"
        small
        onPress={async () => {
          const ok = await ensureNotificationPermission();
          Alert.alert(
            ok ? 'Avisos liberados' : 'Avisos bloqueados',
            ok
              ? 'Você recebe aviso 1 hora antes das ações em que confirmar presença.'
              : 'Libere as notificações do YvY nas configurações do celular.',
          );
        }}
      />
      <Card>
        <Toggle
          value={profile.notify_actions}
          onChange={(v) => void updateProfile({ notify_actions: v })}
          label="Ações do bairro"
          detail="Nova ação, lembrete de 24h e de 1h."
        />
        <Divider />
        <Toggle
          value={profile.notify_feed}
          onChange={(v) => void updateProfile({ notify_feed: v })}
          label="Feed do bairro"
          detail="Desligado por padrão. No máximo 3 por dia."
        />
        <Divider />
        <Toggle
          value
          onChange={() => {
            Alert.alert(
              'Sempre ligado',
              'Convite confirmado e decisão de moderação são avisos que afetam seu acesso. Não podem ser desligados.',
            );
          }}
          label="Avisos importantes"
          detail="Convites e moderação. Não pode ser desligado."
        />
      </Card>

      {canPreviewVisitor ? (
        <>
          <Section title="Admin" />
          <Card>
            <Txt variant="body">
              Veja o app como quem não tem conta, sem sair da sua. Só muda a tela: os dados continuam vindo com a
              sua sessão.
            </Txt>
            <Button
              title="Ver como visitante"
              kind="outline"
              small
              onPress={() => {
                setVisitorView(true);
                router.replace('/');
              }}
            />
            {monitoringEnabled() ? (
              <Button
                title="Enviar erro de teste (Sentry)"
                kind="ghost"
                small
                onPress={() => {
                  sendTestError();
                  notify('Erro de teste enviado', 'Deve aparecer no painel do Sentry em até alguns minutos.');
                }}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      {rolesPower || isModerator ? (
        <>
          <Section title="Membros e papéis" />
          <Button
            title={rolesPower ? 'Moderadores e convites' : 'Liberar convite no meu bairro'}
            kind="outline"
            onPress={() => router.push('/membros')}
          />
        </>
      ) : null}

      {bio.available ? (
        <>
          <Section title="Segurança" />
          <Card>
            <Toggle
              label="Entrar com digital"
              detail="Ao abrir o app e ao voltar depois de 1 minuto fora, pede a digital (ou a senha do celular). Quem pegar seu celular desbloqueado não abre o YvY."
              value={bio.enabled}
              onChange={(v) => void bio.setEnabled(v)}
            />
          </Card>
        </>
      ) : null}

      {install.kind !== 'none' ? (
        <>
          <Section title="Instalar o app" />
          <InstallCard compact />
        </>
      ) : null}

      <Section title="Aparência" />
      <Card>
        <Options
          value={theme}
          options={[
            { key: 'system', label: 'Igual ao celular' },
            { key: 'light', label: 'Claro' },
            { key: 'dark', label: 'Escuro' },
          ]}
          onChange={(v) => {
            setTheme(v);
            saveThemePref(v);
          }}
        />
        {theme !== themePref ? (
          <Txt variant="small" tone="primary">
            Feche e abra o app para aplicar.
          </Txt>
        ) : null}
      </Card>

      <Section title="Ajude a melhorar o app" />
      <Button
        title={isModerator ? 'Ideias e problemas (ver os recebidos)' : 'Enviar ideia ou problema'}
        kind="outline"
        onPress={() => router.push('/feedback')}
      />

      {/* Pix só depois da eleição. Arrecadar num app com conteúdo contra
        candidato pode ser lido como gasto eleitoral (revisão jurídica, 12/10). */}
      {isBaseMember && env.pixKey && Date.now() >= env.electionDate.getTime() + 16 * 3600_000 ? (
        <>
          <Section title="Apoie o YvY" />
          <SupportCard />
        </>
      ) : null}

      <Section title="Sobre" />
      <Card>
        <Button title="Quem somos" kind="ghost" onPress={() => router.push('/sobre/quem-somos')} />
        <Divider />
        <Button title="Privacidade" kind="ghost" onPress={() => router.push('/sobre/privacidade')} />
        <Divider />
        <Button title="Termos de uso" kind="ghost" onPress={() => router.push('/sobre/termos')} />
        <Divider />
        <Button title="Código-fonte (GitHub)" kind="ghost" onPress={() => void Linking.openURL(env.repoUrl)} />
      </Card>

      <View style={{ height: space.sm }} />
      <Button
        title="Sair"
        kind="outline"
        onPress={() =>
          Alert.alert(
            'Sair da conta?',
            bio.enabled
              ? 'Trancar: o YvY fecha e volta com a digital. Sair de vez: precisa de e-mail e senha para entrar de novo.'
              : 'Você precisará entrar de novo com e-mail e senha.',
            [
              { text: 'Cancelar', style: 'cancel' },
              ...(bio.enabled ? [{ text: 'Trancar', onPress: () => bio.lockNow() }] : []),
              {
                text: bio.enabled ? 'Sair de vez' : 'Sair',
                style: 'destructive' as const,
                onPress: async () => {
                  await signOut();
                  router.replace('/welcome');
                },
              },
            ],
          )
        }
      />
      <Txt variant="small" muted center>
        YvY · a terra é de quem a organiza.
      </Txt>
      {env.instagram ? (
        <Txt
          variant="small"
          tone="primary"
          center
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`https://instagram.com/${env.instagram}`)}
        >
          Fale com quem fez o app: @{env.instagram}
        </Txt>
      ) : null}
    </Screen>
  );
}
