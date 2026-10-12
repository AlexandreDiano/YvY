import type { Profile, PullRoute, Voter } from '@/lib/db.types';
import { all, insert, localId, patch } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

/**
 * Puxada de voto (fluxo 4.5 / tela 7.5).
 *
 * ATENCAO — dado pessoal de terceiro: `voters` guarda nome, local de votacao
 * e referencia de endereco de gente que pode nunca ter aberto o app. Regras
 * que o codigo tem de respeitar:
 *  - quem le uma linha e so o puxador daquela rota (ou admin). Garantido por
 *    RLS em supabase/migrations/0005_rls.sql;
 *  - nada disto vai para cache em disco (ver lib/cache.ts);
 *  - cadastro feito por militante grava `consent_source = 'militant'` e exige
 *    confirmacao de que a pessoa autorizou;
 *  - apos 25/10 a tabela e expurgada (ver supabase/migrations/0007_retention.sql).
 */

export type NewVoter = {
  full_name: string;
  zone: string;
  section: string;
  polling_place: string;
  cep: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  address_hint: string | null;
};

const COL_VOTERS = 'voters';
const COL_ROUTES = 'routes';

export async function registerVoter(
  input: NewVoter,
  registeredBy: Profile | null,
  consentSource: 'self' | 'militant',
): Promise<void> {
  if (!input.full_name.trim()) throw new Error('Informe o nome do eleitor.');
  if (!input.zone.trim() || !input.section.trim()) throw new Error('Zona e seção são obrigatórias.');
  if (!input.polling_place.trim()) throw new Error('Informe o local de votação.');

  if (!supabase) {
    await insert<Voter>(COL_VOTERS, {
      id: localId('voter'),
      ...input,
      full_name: input.full_name.trim(),
      registered_by: registeredBy?.id ?? null,
      consent_source: consentSource,
      pulled_by: null,
      pull_route_id: null,
      has_voted: false,
      voted_at: null,
      created_at: new Date().toISOString(),
    });
    return;
  }
  const res = await supabase.from('voters').insert({
    ...input,
    full_name: input.full_name.trim(),
    registered_by: registeredBy?.id ?? null,
    consent_source: consentSource,
  });
  if (res.error) throw res.error;
}

export type RouteWithVoters = { route: PullRoute; voters: Voter[] };

/** Rota do puxador logado. Nunca cacheada em disco. */
export async function myRoute(userId: string): Promise<RouteWithVoters | null> {
  if (!supabase) {
    const routes = (await all<PullRoute>(COL_ROUTES)).filter((r) => r.puller_id === userId);
    if (!routes.length) return null;
    const route = routes[0]!;
    const voters = (await all<Voter>(COL_VOTERS)).filter((v) => v.pull_route_id === route.id);
    return { route, voters };
  }
  const routeRes = await supabase
    .from('pull_routes')
    .select('*')
    .eq('puller_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (routeRes.error) throw routeRes.error;
  const route = routeRes.data as PullRoute | null;
  if (!route) return null;

  const votersRes = await supabase
    .from('voters')
    .select('*')
    .eq('pull_route_id', route.id)
    .order('polling_place');
  if (votersRes.error) throw votersRes.error;
  return { route, voters: votersRes.data as Voter[] };
}

export async function markVoted(voterId: string, voted: boolean): Promise<void> {
  const changes = { has_voted: voted, voted_at: voted ? new Date().toISOString() : null };
  if (!supabase) {
    await patch<Voter>(COL_VOTERS, voterId, changes);
    return;
  }
  const res = await supabase.from('voters').update(changes).eq('id', voterId);
  if (res.error) throw res.error;
}

export type CoordinatorStats = {
  neighborhood: string;
  voters: number;
  routes: number;
  assigned: number;
  voted: number;
};

/** Painel do coordenador (tela 7.5, bloco final). So moderador/admin ve. */
export async function coordinatorStats(profile: Profile): Promise<CoordinatorStats> {
  if (!supabase) {
    const voters = await all<Voter>(COL_VOTERS);
    const routes = await all<PullRoute>(COL_ROUTES);
    return {
      neighborhood: profile.neighborhood ?? '—',
      voters: voters.length,
      routes: routes.length,
      assigned: routes.filter((r) => r.puller_id).length,
      voted: voters.filter((v) => v.has_voted).length,
    };
  }
  const base = supabase
    .from('voters')
    .select('id', { count: 'exact', head: true })
    .eq('neighborhood', profile.neighborhood ?? '')
    .eq('city', profile.city ?? '');
  const [total, voted, routes] = await Promise.all([
    base,
    supabase
      .from('voters')
      .select('id', { count: 'exact', head: true })
      .eq('neighborhood', profile.neighborhood ?? '')
      .eq('city', profile.city ?? '')
      .eq('has_voted', true),
    supabase
      .from('pull_routes')
      .select('id,puller_id')
      .eq('neighborhood', profile.neighborhood ?? '')
      .eq('city', profile.city ?? ''),
  ]);
  const routeRows = (routes.data as { id: string; puller_id: string | null }[] | null) ?? [];
  return {
    neighborhood: profile.neighborhood ?? '—',
    voters: total.count ?? 0,
    routes: routeRows.length,
    assigned: routeRows.filter((r) => r.puller_id).length,
    voted: voted.count ?? 0,
  };
}

/**
 * Forma as rotas agrupando por bairro e local de votacao, no maximo 5 por rota
 * (fluxo 4.5, fase 2). No backend isso roda na Edge Function/RPC
 * `build_pull_routes`, que e transacional; aqui so o caminho local.
 */
export async function buildRoutes(profile: Profile, maxPerRoute = 5): Promise<number> {
  if (supabase) {
    const res = await supabase.rpc('build_pull_routes', {
      p_neighborhood: profile.neighborhood ?? '',
      p_city: profile.city ?? '',
      p_state: profile.state ?? '',
      p_max: maxPerRoute,
    });
    if (res.error) throw res.error;
    return (res.data ?? []).length;
  }

  const voters = (await all<Voter>(COL_VOTERS)).filter((v) => !v.pull_route_id);
  const byPlace = new Map<string, Voter[]>();
  for (const v of voters) {
    const key = `${v.neighborhood ?? ''}|${v.polling_place}`;
    const bucket = byPlace.get(key) ?? [];
    bucket.push(v);
    byPlace.set(key, bucket);
  }

  let created = 0;
  for (const bucket of byPlace.values()) {
    for (let i = 0; i < bucket.length; i += maxPerRoute) {
      const slice = bucket.slice(i, i + maxPerRoute);
      const route: PullRoute = {
        id: localId('route'),
        puller_id: null,
        neighborhood: slice[0]!.neighborhood ?? profile.neighborhood ?? '',
        city: slice[0]!.city ?? profile.city ?? '',
        state: slice[0]!.state ?? profile.state ?? '',
        max_voters: maxPerRoute,
        is_complete: false,
        created_at: new Date().toISOString(),
      };
      await insert(COL_ROUTES, route);
      for (const v of slice) await patch<Voter>(COL_VOTERS, v.id, { pull_route_id: route.id });
      created += 1;
    }
  }
  return created;
}

/** Coordenador assume/atribui uma rota sem puxador. */
export async function claimRoute(routeId: string, pullerId: string): Promise<void> {
  if (!supabase) {
    await patch<PullRoute>(COL_ROUTES, routeId, { puller_id: pullerId });
    const voters = (await all<Voter>(COL_VOTERS)).filter((v) => v.pull_route_id === routeId);
    for (const v of voters) await patch<Voter>(COL_VOTERS, v.id, { pulled_by: pullerId });
    return;
  }
  const res = await supabase.from('pull_routes').update({ puller_id: pullerId }).eq('id', routeId);
  if (res.error) throw res.error;
  const upd = await supabase.from('voters').update({ pulled_by: pullerId }).eq('pull_route_id', routeId);
  if (upd.error) throw upd.error;
}

export async function listUnassignedRoutes(profile: Profile): Promise<PullRoute[]> {
  if (!supabase) {
    return (await all<PullRoute>(COL_ROUTES)).filter((r) => !r.puller_id);
  }
  const res = await supabase
    .from('pull_routes')
    .select('*')
    .is('puller_id', null)
    .eq('neighborhood', profile.neighborhood ?? '')
    .eq('city', profile.city ?? '');
  if (res.error) throw res.error;
  return res.data as PullRoute[];
}
