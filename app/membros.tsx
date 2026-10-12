import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { canManageRoles, listMembers, setMemberRole, setRoleManager, type Member } from '@/api/members';
import { useAuth } from '@/features/auth/AuthProvider';
import { camarada } from '@/lib/format';
import { Badge, Button, Card, EmptyState, Field, Loading, Row, Screen, Txt, color } from '@/ui';

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
 * só admin dá a permissão de mudar papéis. O banco confere tudo de novo
 * (RPCs da 0032) — esconder botão aqui é só conforto.
 */
export default function Membros() {
  const { profile, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [q, setQ] = useState('');
  const [list, setList] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      setList(await listMembers(query));
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void canManageRoles().then((ok) => {
        setAllowed(ok);
        if (ok) void load('');
      });
    }, [load]),
  );

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
      await load(q);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível salvar.');
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
    Alert.alert(title, detail, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => void run(m.id, () => setMemberRole(m.id, role)) },
    ]);
  }

  function confirmManager(m: Member, enabled: boolean) {
    const who = camarada(m.display_name);
    Alert.alert(
      enabled ? `Deixar ${who} mudar papéis?` : `Tirar de ${who} a permissão de mudar papéis?`,
      enabled
        ? 'A pessoa poderá tornar membros moderadores e tirar moderadores. Não poderá dar esta permissão a ninguém nem mexer em admin.'
        : 'A pessoa deixa de poder promover ou tirar moderadores.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void run(m.id, () => setRoleManager(m.id, enabled)) },
      ],
    );
  }

  if (allowed === null) return <Loading />;
  if (!allowed) {
    return (
      <Screen>
        <EmptyState title="Sem permissão" detail="Só admin e quem recebeu a permissão mudam papéis." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt variant="small" muted>
        Moderador modera os posts do bairro do cadastro dele, vê ideias e problemas e gera convite à distância. A pessoa
        recebe um aviso quando o papel muda.
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
                {self ? ' · você' : ''}
              </Txt>
              {editable ? (
                <Row style={{ flexWrap: 'wrap' }}>
                  {m.role === 'moderator' ? (
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
            </Card>
          );
        })
      )}
    </Screen>
  );
}
