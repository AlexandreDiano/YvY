import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { confirmPresence, inArea, listActions, myConfirmations } from '@/api/actions';
import { myClaimChecks } from '@/api/claims';
import { pendingInvitees } from '@/api/invites';
import { FLAG } from '@/api/flags';
import { PlanCompare } from '@/features/plans/PlanCompare';
import { useAuth } from '@/features/auth/AuthProvider';
import type { ActionListed } from '@/lib/db.types';
import { daysToElection, electionLabel, shortDateTime } from '@/lib/format';
import {
  Banner,
  Button,
  Card,
  Row,
  Screen,
  Section,
  Txt,
  YvyMark,
  color,
} from '@/ui';
import { IconBallot, IconFlag, IconSearch } from '@/ui/icons';

export default function Home() {
  const router = useRouter();
  const { profile, isBaseMember, membership, flags, mode } = useAuth();
  const [readyChecks, setReadyChecks] = useState(0);

  // Checagem que ficou pronta enquanto a pessoa estava fora. Visitante não tem
  // push, então o aviso fica aqui e recarrega a cada foco.
  useFocusEffect(
    useCallback(() => {
      void myClaimChecks().then((list) => setReadyChecks(list.filter((c) => c.unseen).length));
    }, []),
  );
  // convidado esperando confirmação: avisa aqui também, não só no Perfil
  const [waiting, setWaiting] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!profile || !isBaseMember) return;
      void pendingInvitees(profile).then((l) => setWaiting(l.length), () => setWaiting(0));
    }, [profile, isBaseMember]),
  );
  const [acoes, setAcoes] = useState<ActionListed[]>([]);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (profile && isBaseMember && flags[FLAG.acoes]) {
      try {
        setAcoes((await listActions()).filter((a) => inArea(a, profile.city, profile.neighborhood)));
        setConfirmed(await myConfirmations(profile.id));
      } catch {
        setAcoes([]);
      }
    }
  }, [profile, isBaseMember, flags]);

  // recarrega quando volta pra tela (ex.: depois de criar uma ação)
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const dias = daysToElection();

  return (
    <Screen safeTop refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <YvyMark size={34} />
          <Txt variant="small" muted>
            Do guarani: terra
          </Txt>
        </View>
        {profile?.neighborhood ? (
          <Txt variant="small" muted>
            {profile.neighborhood} · {profile.state}
          </Txt>
        ) : null}
      </Row>

      <Card stripe={color.accent}>
        <Txt variant="heading">
          {dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'} para o 2º turno` : 'Hoje é dia de votar'}
        </Txt>
        <Txt variant="small" muted>
          Votação: {electionLabel()}
        </Txt>
      </Card>

      {mode === 'local' ? (
        <Banner
          tone="warning"
          title="Modo local"
          detail="Sem Supabase configurado: conteúdo público vem do app e o resto fica neste aparelho."
        />
      ) : null}

      {profile?.is_active === false ? (
        <Banner
          tone="danger"
          title="Sua conta foi suspensa"
          detail="A moderação suspendeu seu acesso à base. O motivo está nos seus avisos. Para contestar, fale com a coordenação."
          action={<Button title="Ver avisos" small block={false} onPress={() => router.push('/avisos')} />}
        />
      ) : null}

      {membership === 'pending' ? (
        <Banner
          tone="warning"
          title="Cadastro aguardando confirmação"
          detail="Falta o camarada que te convidou confirmar sua entrada. Até lá, só conteúdo público."
        />
      ) : null}

      {waiting > 0 ? (
        <Banner
          tone="warning"
          title={waiting === 1 ? '1 pessoa entrou com seu convite' : `${waiting} pessoas entraram com seu convite`}
          detail="Confirme ou recuse para liberar o acesso à base."
          action={<Button title="Decidir" small block={false} onPress={() => router.push('/convidar')} />}
        />
      ) : null}

      {readyChecks > 0 ? (
        <Banner
          title={readyChecks === 1 ? 'Sua checagem ficou pronta' : `${readyChecks} checagens ficaram prontas`}
          detail="O resultado está na tela de checagem."
          action={<Button title="Ver resultado" small block={false} onPress={() => router.push('/checar')} />}
        />
      ) : null}

      <PlanCompare />
      <Button title="Ver propostas e planos" kind="outline" onPress={() => router.push('/propostas')} />

      {flags[FLAG.checagem] ? (
        <>
          <Section title="Checar fake news" />
          <Card onPress={() => router.push('/checar')}>
            <Row>
              <IconSearch size={20} color={color.primary} />
              <Txt variant="heading">Colou um print? Cheque aqui.</Txt>
            </Row>
            <Txt variant="small" muted>
              Cole o texto e veja o selo: verdade, meio verdade, exagero ou mentira — com fonte.
            </Txt>
          </Card>
        </>
      ) : null}

      {flags[FLAG.transparencia] ? (
        <>
          <Section title="De olho em quem foi eleito" />
          <Card onPress={() => router.push('/congresso')}>
            <Row>
              <IconBallot size={20} color={color.primary} />
              <Txt variant="heading">Consultas e votações no Congresso</Txt>
            </Row>
            <Txt variant="small" muted>
              Dê sua opinião nas consultas públicas do Senado e veja o que a Câmara e o Senado votaram.
            </Txt>
          </Card>
          <Card onPress={() => router.push('/representantes')}>
            <Row>
              <IconFlag size={20} color={color.primary} />
              <Txt variant="heading">Quem foi eleito por aqui</Txt>
            </Row>
            <Txt variant="small" muted>
              Presidência, senadores e deputados do seu estado, e o diário oficial da sua cidade.
            </Txt>
          </Card>
        </>
      ) : null}

      {isBaseMember && flags[FLAG.acoes] ? (
        <>
          <Section title="Ações no seu bairro" />
          {acoes.length === 0 ? (
            <Card>
              <Txt variant="body" muted>
                Nenhuma ação aberta no seu bairro. Crie a primeira.
              </Txt>
              <Button title="Nova ação" small block={false} onPress={() => router.push('/acoes/nova')} />
            </Card>
          ) : (
            acoes.slice(0, 3).map((a) => (
              <Card key={a.id} onPress={() => router.push(`/acoes/${a.id}`)}>
                <Txt variant="heading">{a.title}</Txt>
                <Txt variant="small" muted>
                  {shortDateTime(a.scheduled_at)}
                  {a.location_name ? ` · ${a.location_name}` : ''}
                  {' · '}
                  {a.participant_count}
                  {a.max_participants ? `/${a.max_participants}` : ''} confirmados
                </Txt>
                <Button
                  title={confirmed.has(a.id) ? 'Presença confirmada' : 'Confirmar presença'}
                  small
                  kind={confirmed.has(a.id) ? 'ghost' : 'primary'}
                  disabled={confirmed.has(a.id)}
                  onPress={async () => {
                    if (!profile) return;
                    await confirmPresence(a.id, profile.id);
                    await load();
                  }}
                />
              </Card>
            ))
          )}
          <Button title="Ver mapa de ações" kind="outline" onPress={() => router.push('/(tabs)/acoes')} />
        </>
      ) : (
        <Banner
          tone="warning"
          title="Base liberada após a confirmação"
          detail="Falta quem te convidou confirmar sua entrada. Assim que confirmar, as abas Ações e Base aparecem aqui."
          action={
            <Button
              title="Como funciona?"
              kind="ghost"
              small
              block={false}
              onPress={() => router.push('/sobre/quem-somos')}
            />
          }
        />
      )}
    </Screen>
  );
}


