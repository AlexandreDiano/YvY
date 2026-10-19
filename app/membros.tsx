import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import {
  canManageRoles,
  inviteesOf,
  listMembers,
  setInvitePermission,
  setMemberRole,
  setRoleManager,
  type Member,
  type MemberInvitee,
} from '@/api/members';
import { useAuth } from '@/features/auth/AuthProvider';
import { camarada } from '@/lib/format';
import { confirmAction, notify } from '@/lib/notify';
import { Badge, Button, Card, Divider, EmptyState, Field, Loading, Row, Screen, Txt, color, space } from '@/ui';

const ROLE_LABEL: Record<string, string> = {
  militant: 'Membro',
  moderator: 'Moderador',
  admin: 'Admin',
};
const ROLE_COLOR: Record<string, string> = {
  militant: color.neutral,
  moderator: color.primary,
  admin: color.accent,
};

/**
 * Membros e papéis. Admin e quem tem a permissão promovem a moderador e tiram;
 * só admin dá a permissão de mudar papel. Para convidar, admin, quem muda
 * papéis e o moderador do bairro liberam membro por membro (o moderador só vê
 * os bairros dele). O banco confere tudo de novo nas RPCs da 0032/0036,
 * esconder botão aqui é só para não confundir.
 *
 * Cada membro abre a lista de quem ele convidou (0046), um nível só. Quem foi
 * convidado e convidou outros aparece de novo na lista com os convidados dele.
 */
export default function Membros() {
  const { profile, isAdmin, isModerator } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rolesPower, setRolesPower] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // convidados de cada membro aberto; undefined = fechado, null = carregando
  const [open, setOpen] = useState<Record<string, MemberInvitee[] | null | undefined>>({});

  function toggle(m: Member) {
    if (open[m.id] !== undefined) {
      setOpen(({ [m.id]: _, ...rest }) => rest);
      return;
    }
    setOpen((o) => ({ ...o, [m.id]: null }));
    inviteesOf(m.id).then(
      (list) => setOpen((o) => (m.id in o ? { ...o, [m.id]: list } : o)),
      (err: unknown) => {
        setOpen(({ [m.id]: _, ...rest }) => rest);
        notify('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.');
      },
    );
  }

  const load = useCallback(async (query: string) => {
    try {
      setList(await listMembers(query));
    } catch (err) {
      notify('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void canManageRoles().then((roles) => {
        setRolesPower(roles);
        const ok = roles || isModerator;
        setAllowed(ok);
        if (ok) void load('');
      });
    }, [load, isModerator]),
  );

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
      await load(q);
    } catch (err) {
      notify('Erro', err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(null);
    }
  }

  function confirmRole(m: Member, role: 'militant' | 'moderator') {
    const who = camarada(m.display_name);
    const [title, detail] =
      role === 'moderator'
        ? [`Tornar ${who} moderador?`, `Vai moderar posts do bairro ${m.neighborhood ?? '—'}, ver ideias e problemas e gerar convite à distância.`]
        : [`Tirar a moderação de ${who}?`, 'A pessoa volta a ser membro. Dá para promover de novo depois.'];
    confirmAction(title, detail, 'Confirmar', () => void run(m.id, () => setMemberRole(m.id, role)));
  }

  function confirmInvite(m: Member, enabled: boolean) {
    const who = camarada(m.display_name);
    confirmAction(
      enabled ? `Liberar convite para ${who}?` : `Tirar o convite de ${who}?`,
      enabled
        ? 'A pessoa vai poder gerar QRCode de convite presencial. Quem entrar pelo convite dela aparece aqui, embaixo do nome dela.'
        : 'A pessoa deixa de gerar convites. Quem ela já convidou continua.',
      'Confirmar',
      () => void run(m.id, () => setInvitePermission(m.id, enabled)),
    );
  }

  function confirmManager(m: Member, enabled: boolean) {
    const who = camarada(m.display_name);
    confirmAction(
      enabled ? `Deixar ${who} mudar papéis?` : `Tirar de ${who} a permissão de mudar papéis?`,
      enabled
        ? 'A pessoa poderá tornar membros moderadores e tirar moderadores. Não poderá dar esta permissão a ninguém nem mexer em admin.'
        : 'A pessoa deixa de poder promover ou tirar moderadores.',
      'Confirmar',
      () => void run(m.id, () => setRoleManager(m.id, enabled)),
    );
  }

  if (allowed === null) return <Loading />;
  if (!allowed) {
    return (
      <Screen>
        <EmptyState
          title="Sem permissão"
          detail="Só admin, moderador e quem recebeu a permissão de mudar papéis veem esta lista."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="small" muted>
        {rolesPower
          ? 'Moderador modera os posts do bairro do cadastro dele, vê ideias e problemas e gera convite à distância. '
          : 'Aqui aparecem os membros dos bairros que você modera. '}
        Membro comum só convida se for liberado. A pessoa recebe um aviso quando algo muda.
      </Txt>
      <Field
        label="Buscar por apelido, bairro ou cidade"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load(q)}
        returnKeyType="search"
      />
      <Button title="Buscar" kind="outline" small block={false} onPress={() => void load(q)} />
      {list.length === 0 ? (
        <EmptyState title="Ninguém encontrado" detail="Só aparecem membros confirmados." />
      ) : (
        list.map((m) => {
          const self = m.id === profile?.id;
          const editable = !self && m.role !== 'admin';
          return (
            <Card key={m.id} stripe={ROLE_COLOR[m.role]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="heading">{camarada(m.display_name)}</Txt>
                <Badge label={ROLE_LABEL[m.role] ?? m.role} color={ROLE_COLOR[m.role] ?? color.neutral} />
              </Row>
              <Txt variant="small" muted>
                {[m.neighborhood, m.city, m.state].filter(Boolean).join(' · ')}
                {m.is_role_manager ? ' · pode mudar papéis' : ''}
                {m.role === 'militant' && m.can_invite ? ' · pode convidar' : ''}
                {self ? ' · você' : ''}
              </Txt>
              {m.invited_by_name ? (
                <Txt variant="small" muted>
                  Convidado por {camarada(m.invited_by_name)}
                </Txt>
              ) : null}
              {editable ? (
                <Row style={{ flexWrap: 'wrap' }}>
                  {m.role === 'militant' ? (
                    <Button
                      title={m.can_invite ? 'Tirar convite' : 'Liberar convite'}
                      kind={m.can_invite ? 'ghost' : 'outline'}
                      small
                      block={false}
                      disabled={busy === m.id}
                      onPress={() => confirmInvite(m, !m.can_invite)}
                    />
                  ) : null}
                  {!rolesPower ? null : m.role === 'moderator' ? (
                    <Button
                      title="Tirar moderação"
                      kind="ghost"
                      small
                      block={false}
                      loading={busy === m.id}
                      onPress={() => confirmRole(m, 'militant')}
                    />
                  ) : (
                    <Button
                      title="Tornar moderador"
                      small
                      block={false}
                      loading={busy === m.id}
                      onPress={() => confirmRole(m, 'moderator')}
                    />
                  )}
                  {isAdmin ? (
                    <Button
                      title={m.is_role_manager ? 'Tirar permissão de papéis' : 'Pode mudar papéis'}
                      kind="ghost"
                      small
                      block={false}
                      disabled={busy === m.id}
                      onPress={() => confirmManager(m, !m.is_role_manager)}
                    />
                  ) : null}
                </Row>
              ) : null}
              {m.invited_count > 0 ? (
                <>
                  <Button
                    title={open[m.id] !== undefined ? 'Esconder convidados' : `Convidou ${m.invited_count}`}
                    kind="ghost"
                    small
                    block={false}
                    loading={open[m.id] === null}
                    onPress={() => toggle(m)}
                  />
                  {open[m.id] ? (
                    <View style={{ gap: space.xs, paddingLeft: space.md }}>
                      <Divider />
                      {open[m.id]!.map((i) => (
                        <Txt key={i.id} variant="small">
                          {camarada(i.display_name)}
                          <Txt variant="small" muted>
                            {' · '}
                            {[i.neighborhood, i.city].filter(Boolean).join(' · ')}
                            {i.membership_status === 'pending' ? ' · pendente' : i.membership_status === 'rejected' ? ' · recusado' : ''}
                          </Txt>
                        </Txt>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
