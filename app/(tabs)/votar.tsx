import { useRouter } from 'expo-router';
import { useNoScreenshots } from '@/lib/privacy';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, View } from 'react-native';
import { FLAG } from '@/api/flags';
import {
  coordinatorStats,
  markVoted,
  myRoute,
  registerVoter,
  type CoordinatorStats,
  type RouteWithVoters,
} from '@/api/voters';
import { useAuth } from '@/features/auth/AuthProvider';
import { flushVotes, pendingVotes } from '@/features/pull/offline';
import { daysToElection, electionLabel, formatCep } from '@/lib/format';
import {
  Banner,
  Button,
  Card,
  Field,
  Progress,
  Row,
  Screen,
  Section,
  Toggle,
  Txt,
  color,
  space,
} from '@/ui';
import { IconCheck } from '@/ui/icons';

/** Tela 7.5 — Votar (puxada de voto). */
export default function Votar() {
  useNoScreenshots('votar');
  const router = useRouter();
  const { profile, isBaseMember, isModerator, flags } = useAuth();

  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [section, setSection] = useState('');
  const [place, setPlace] = useState('');
  const [cep, setCep] = useState('');
  const [hint, setHint] = useState('');
  const [forOther, setForOther] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [route, setRoute] = useState<RouteWithVoters | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [stats, setStats] = useState<CoordinatorStats | null>(null);
  const [pending, setPending] = useState(0);
  const [sending, setSending] = useState(false);
  const [lastFailed, setLastFailed] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setRoute(await myRoute(profile.id));
      setRouteError(false);
    } catch {
      // Sem internet e sem cópia no aparelho.
      setRoute(null);
      setRouteError(true);
    }
    setPending((await pendingVotes(profile.id)).length);
    if (isModerator) setStats(await coordinatorStats(profile).catch(() => null));
  }, [profile, isModerator]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Manda a fila de votos marcados; chamado também sozinho quando a rede volta. */
  const sendQueued = useCallback(async () => {
    if (!profile) return;
    setSending(true);
    try {
      const r = await flushVotes(profile.id);
      setPending(r.pending);
      if (r.failed) setLastFailed((n) => n + r.failed);
      if (r.sent) void load();
    } catch {
      // segue na fila
    } finally {
      setSending(false);
    }
  }, [profile, load]);

  // Fila pendente: tenta a cada 30 s, ao voltar ao app e quando a rede volta.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => void sendQueued(), 30_000);
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') void sendQueued();
    });
    const online = () => void sendQueued();
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', online);
    return () => {
      clearInterval(t);
      app.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', online);
    };
  }, [pending, sendQueued]);

  async function submit() {
    if (!profile) return;
    setError(null);
    if (forOther && !authorized) {
      setError('Sem a autorização da pessoa, não cadastre. O dado é dela, não seu.');
      return;
    }
    setBusy(true);
    try {
      await registerVoter(
        {
          full_name: name,
          zone,
          section,
          polling_place: place,
          cep: cep.replace(/\D+/g, '') || null,
          neighborhood: profile.neighborhood,
          city: profile.city,
          state: profile.state,
          address_hint: hint.trim() || null,
        },
        profile,
        forOther ? 'militant' : 'self',
      );
      setName('');
      setZone('');
      setSection('');
      setPlace('');
      setCep('');
      setHint('');
      setAuthorized(false);
      Alert.alert(
        'Cadastro feito',
        'No dia 25 a rota de puxada aparece aqui com os eleitores agrupados por local de votação.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar.');
    } finally {
      setBusy(false);
    }
  }

  const dias = daysToElection();
  const voted = route?.voters.filter((v) => v.has_voted).length ?? 0;

  return (
    <Screen safeTop>
      <Card stripe={color.accent}>
        <Txt variant="heading">
          {dias > 0 ? `${dias} ${dias === 1 ? 'dia' : 'dias'} para votar` : 'Hoje é dia de votar'}
        </Txt>
        <Txt variant="small" muted>
          {electionLabel()}
        </Txt>
      </Card>

      {!flags[FLAG.puxada] ? (
        <Banner
          tone="warning"
          title="Módulo de puxada ainda desligado"
          detail="A puxada de voto é ativada pela coordenação na véspera (24/10). O cadastro abaixo já funciona."
        />
      ) : null}

      <Section title="Cadastrar eleitor" />
      <Card>
        <Toggle
          value={forOther}
          onChange={(v) => {
            setForOther(v);
            if (!v) setAuthorized(false);
          }}
          label="Estou cadastrando outra pessoa"
          detail="Vizinho, parente, alguém que não usa o app."
        />
        {forOther ? (
          <Toggle
            value={authorized}
            onChange={setAuthorized}
            label="A pessoa autorizou este cadastro"
            detail="Ela precisa saber que o nome e o local de votação dela ficam com a coordenação até 25/10, e que pode pedir a exclusão a qualquer momento."
          />
        ) : null}
        <Field label="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" />
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Zona" value={zone} onChangeText={setZone} keyboardType="number-pad" maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Seção" value={section} onChangeText={setSection} keyboardType="number-pad" maxLength={5} />
          </View>
        </Row>
        <Field label="Local de votação" value={place} onChangeText={setPlace} placeholder="Escola Municipal X" />
        <Field
          label="CEP"
          value={cep}
          onChangeText={(v) => setCep(formatCep(v))}
          keyboardType="number-pad"
          maxLength={9}
        />
        <Field
          label="Referência para encontrar (opcional)"
          value={hint}
          onChangeText={setHint}
          placeholder="Prédio azul em frente à padaria"
          hint="Referência, não endereço completo. O app não guarda rua e número."
        />
        {error ? (
          <Txt variant="small" tone="danger">
            {error}
          </Txt>
        ) : null}
        <Button title="Cadastrar" loading={busy} onPress={submit} />
      </Card>

      <Section title="Minha rota de puxada" />
      {pending > 0 ? (
        <Banner
          tone="warning"
          title={`${pending} ${pending === 1 ? 'registro aguardando' : 'registros aguardando'} envio`}
          detail="Estão salvos neste aparelho e sobem sozinhos quando a internet voltar. Não feche a conta antes disso."
        />
      ) : null}
      {pending > 0 ? (
        <Button title="Enviar agora" kind="outline" small loading={sending} onPress={() => void sendQueued()} />
      ) : null}
      {lastFailed > 0 ? (
        <Txt variant="small" tone="danger">
          {lastFailed} {lastFailed === 1 ? 'registro foi recusado' : 'registros foram recusados'} pelo servidor (eleitor
          saiu da sua rota ou foi apagado). Avise a coordenação.
        </Txt>
      ) : null}
      {route?.offline ? (
        <Txt variant="small" muted>
          Sem internet: mostrando a cópia guardada às{' '}
          {new Date(route.savedAt ?? '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Os votos
          que você marcar ficam salvos e sobem depois.
        </Txt>
      ) : null}
      {!route && routeError ? (
        <Card>
          <Txt variant="body" muted>
            Sem internet, e a rota ainda não foi guardada neste aparelho. Abra esta tela uma vez com internet no dia
            (antes de sair para a rua) para ela ficar salva.
          </Txt>
        </Card>
      ) : !route ? (
        <Card>
          <Txt variant="body" muted>
            Nenhuma rota atribuída a você. As rotas são formadas na véspera e
            aparecem aqui com até 5 eleitores, agrupados por local de votação.
          </Txt>
        </Card>
      ) : (
        <Card>
          <Txt variant="heading">
            {route.voters.length} {route.voters.length === 1 ? 'eleitor' : 'eleitores'} ·{' '}
            {route.route.neighborhood}
          </Txt>
          {route.voters.map((v, i) => (
            <View key={v.id} style={{ gap: space.xs, marginTop: space.sm }}>
              <Txt variant="body">
                {i + 1}. {v.full_name}
              </Txt>
              <Txt variant="small" muted>
                Vota em: {v.polling_place}
                {v.address_hint ? ` · ${v.address_hint}` : ''}
              </Txt>
              <Button
                title={v.has_voted ? 'Voto confirmado' : 'Confirmou voto'}
                kind={v.has_voted ? 'ghost' : 'primary'}
                small
                block={false}
                left={v.has_voted ? <IconCheck size={16} color={color.success} /> : undefined}
                onPress={async () => {
                  if (!profile) return;
                  // Vai para a fila do aparelho primeiro: sem rede, não se perde.
                  setPending(await markVoted(profile.id, v.id, !v.has_voted));
                  await load();
                }}
              />
            </View>
          ))}
          <View style={{ marginTop: space.md }}>
            <Progress value={voted} total={route.voters.length} />
          </View>
        </Card>
      )}

      {isModerator ? (
        <>
          <Section title="Painel do coordenador" />
          <Card>
            <Txt variant="heading">{stats?.neighborhood ?? profile?.neighborhood ?? '—'}</Txt>
            <Txt variant="small" muted>
              Eleitores cadastrados: {stats?.voters ?? 0}
            </Txt>
            <Txt variant="small" muted>
              Rotas formadas: {stats?.routes ?? 0} · com puxador: {stats?.assigned ?? 0}
            </Txt>
            <Txt variant="small" muted>
              Votos confirmados: {stats?.voted ?? 0}
            </Txt>
            <Button title="Gerenciar rotas" kind="outline" small onPress={() => router.push('/rotas')} />
          </Card>
        </>
      ) : null}

      {!isBaseMember ? (
        <Banner
          tone="warning"
          title="Rota só para membro confirmado"
          detail="Você já pode cadastrar eleitores. Receber uma rota de puxada depende da confirmação do camarada que te convidou."
        />
      ) : null}
    </Screen>
  );
}
