import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  BULK_LABEL,
  FILTERS,
  bulkTargets,
  isEditable,
  matchesFilter,
  namesPreview,
  runBulk,
  type BulkAction,
  type MemberFilter,
} from '@/features/members/permissions';
import { camarada } from '@/lib/format';
import { confirmAction, notify } from '@/lib/notify';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Field,
  Loading,
  Row,
  Screen,
  Toggle,
  Txt,
  color,
  space,
} from '@/ui';

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
const BULK_ORDER: BulkAction[] = ['invite_on', 'invite_off', 'make_mod', 'remove_mod'];

/**
 * Membros e permissões. Cada pessoa mostra o que pode hoje em caixas de marcar
 * (convidar, moderar, mudar papéis); "Selecionar" muda convite e moderação de
 * várias de uma vez (YVY-62). Quem pode o quê:
 * - convite: admin, quem muda papéis e o moderador do bairro (0036);
 * - moderador: admin e quem muda papéis (0032);
 * - mudar papéis: só admin, e só um por um, para ninguém espalhar a permissão
 *   sem querer.
 * O banco confere tudo de novo nas RPCs; esconder controle aqui é só para não
 * confundir.
 *
 * Cada membro abre a lista de quem ele convidou (0046), um nível só.
 */
export default function Membros() {
  const { profile, isAdmin, isModerator } = useAuth();
  const insets = useSafeAreaInsets();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rolesPower, setRolesPower] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<MemberFilter>('all');
  const [list, setList] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // modo de seleção: null = desligado
  const [selected, setSelected] = useState<Set<string> | null>(null);
  // convidados de cada membro aberto; undefined = fechado, null = carregando
  const [open, setOpen] = useState<Record<string, MemberInvitee[] | null | undefined>>({});

  function toggleInvitees(m: Member) {
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

  const shown = list.filter((m) => matchesFilter(m, filter));
  const selectable = shown.filter((m) => isEditable(m, profile?.id));
  const picked = selected ? list.filter((m) => selected.has(m.id)) : [];

  function pick(m: Member) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  }

  function confirmBulk(action: BulkAction) {
    const targets = bulkTargets(picked, action, rolesPower);
    const names = targets.map((m) => camarada(m.display_name));
    const skipped = picked.length - targets.length;
    const detail = [
      names.length === 1 ? `Vai mudar: ${names[0]}.` : `Vai mudar ${names.length} pessoas: ${namesPreview(names)}.`,
      skipped > 0 ? `${skipped} da seleção já ${skipped === 1 ? 'está' : 'estão'} assim ou não se aplica.` : '',
      'Cada pessoa recebe um aviso.',
    ]
      .filter(Boolean)
      .join(' ');
    confirmAction(`${BULK_LABEL[action]} (${names.length})?`, detail, 'Confirmar', () => void applyBulk(action, targets));
  }

  async function applyBulk(action: BulkAction, targets: Member[]) {
    setBusy('bulk');
    const call = (m: Member) =>
      action === 'invite_on' || action === 'invite_off'
        ? setInvitePermission(m.id, action === 'invite_on')
        : setMemberRole(m.id, action === 'make_mod' ? 'moderator' : 'militant');
    const { ok, failed } = await runBulk(targets, call);
    await load(q);
    setBusy(null);
    setSelected(null);
    if (failed.length === 0) {
      notify('Pronto', `${BULK_LABEL[action]}: ${ok.length} ${ok.length === 1 ? 'pessoa' : 'pessoas'}.`);
    } else {
      notify(
        `${ok.length} de ${targets.length} alterados`,
        `Não deu para ${namesPreview(failed.map((f) => camarada(f.member.display_name)))}: ${failed[0]?.message ?? 'erro'}`,
      );
    }
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
    <View style={s.page}>
      <Screen>
      <Txt variant="small" muted>
        {rolesPower
          ? 'Moderador modera os posts do bairro do cadastro dele, vê ideias e problemas e gera convite à distância. '
          : 'Aqui aparecem os membros dos bairros que você modera. '}
        Membro comum só convida (gera QRCode de convite) se for liberado.{' '}
        {isAdmin ? 'Quem pode mudar papéis torna membros moderadores e tira; só admin dá essa permissão. ' : ''}
        Marque ou desmarque o que cada pessoa pode, ou use Selecionar para mudar várias de uma vez. A pessoa recebe
        um aviso quando algo muda.
      </Txt>
      <Field
        label="Buscar por apelido, bairro ou cidade"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => void load(q)}
        returnKeyType="search"
      />
      <Button title="Buscar" kind="outline" small block={false} onPress={() => void load(q)} />
      <Row style={{ flexWrap: 'wrap' }}>
        {FILTERS.filter((f) => f.key !== 'moderators' || rolesPower).map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </Row>

      {selected ? (
        <Card stripe={color.primary}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading">
              {picked.length === 0 ? 'Toque nas pessoas' : `${picked.length} ${picked.length === 1 ? 'selecionada' : 'selecionadas'}`}
            </Txt>
            <Button title="Cancelar" kind="ghost" small block={false} onPress={() => setSelected(null)} />
          </Row>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button
              title={`Todos da lista (${selectable.length})`}
              kind="outline"
              small
              block={false}
              onPress={() => setSelected(new Set(selectable.map((m) => m.id)))}
            />
            {picked.length > 0 ? (
              <Button title="Limpar" kind="ghost" small block={false} onPress={() => setSelected(new Set())} />
            ) : null}
          </Row>
        </Card>
      ) : selectable.length > 0 ? (
        <Button title="Selecionar várias pessoas" kind="outline" small block={false} onPress={() => setSelected(new Set())} />
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          title="Ninguém encontrado"
          detail={filter === 'all' ? 'Só aparecem membros confirmados.' : 'Ninguém da lista se encaixa neste filtro.'}
        />
      ) : (
        shown.map((m) => {
          const self = m.id === profile?.id;
          const editable = isEditable(m, profile?.id);
          const where = [m.neighborhood, m.city, m.state].filter(Boolean).join(' · ');
          return (
            <Card key={m.id} stripe={ROLE_COLOR[m.role]}>
              {selected && editable ? (
                <Toggle
                  value={selected.has(m.id)}
                  onChange={() => pick(m)}
                  label={camarada(m.display_name)}
                  detail={`${ROLE_LABEL[m.role] ?? m.role} · ${where}${m.can_invite ? ' · pode convidar' : ''}`}
                />
              ) : (
                <>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="heading">{camarada(m.display_name)}</Txt>
                    <Badge label={ROLE_LABEL[m.role] ?? m.role} color={ROLE_COLOR[m.role] ?? color.neutral} />
                  </Row>
                  <Txt variant="small" muted>
                    {where}
                    {self ? ' · você' : ''}
                  </Txt>
                  {m.invited_by_name ? (
                    <Txt variant="small" muted>
                      Convidado por {camarada(m.invited_by_name)}
                    </Txt>
                  ) : null}
                  {editable ? (
                    <View style={{ gap: space.xs }}>
                      <Divider />
                      {m.role === 'militant' ? (
                        <Toggle
                          value={m.can_invite}
                          disabled={busy !== null}
                          onChange={(v) => confirmInvite(m, v)}
                          label="Pode convidar"
                        />
                      ) : (
                        <Txt variant="small" muted>
                          Convida por ser moderador.
                        </Txt>
                      )}
                      {rolesPower ? (
                        <Toggle
                          value={m.role === 'moderator'}
                          disabled={busy !== null}
                          onChange={(v) => confirmRole(m, v ? 'moderator' : 'militant')}
                          label="Moderador"
                          detail={`Modera o bairro ${m.neighborhood ?? '—'}.`}
                        />
                      ) : null}
                      {isAdmin ? (
                        <Toggle
                          value={m.is_role_manager}
                          disabled={busy !== null}
                          onChange={(v) => confirmManager(m, v)}
                          label="Pode mudar papéis"
                        />
                      ) : null}
                    </View>
                  ) : null}
                  {m.invited_count > 0 ? (
                    <>
                      <Button
                        title={open[m.id] !== undefined ? 'Esconder convidados' : `Convidou ${m.invited_count}`}
                        kind="ghost"
                        small
                        block={false}
                        loading={open[m.id] === null}
                        onPress={() => toggleInvitees(m)}
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
                </>
              )}
            </Card>
          );
        })
      )}
      </Screen>
      {selected && picked.length > 0 ? (
        // fixa embaixo: quem desce marcando gente não precisa voltar ao topo para agir
        <View style={[s.footer, { paddingBottom: insets.bottom + space.sm }]}>
          {BULK_ORDER.map((action) => {
            const n = bulkTargets(picked, action, rolesPower).length;
            if (n === 0) return null;
            return (
              <Button
                key={action}
                title={`${BULK_LABEL[action]} (${n})`}
                kind={action === 'invite_off' || action === 'remove_mod' ? 'outline' : 'primary'}
                small
                block={false}
                loading={busy === 'bulk'}
                onPress={() => confirmBulk(action)}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.bg },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
  },
});
