import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PullRoute, Voter } from '@/lib/db.types';
import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * Puxada sem internet (YVY-51). No dia 25 a rede perto dos locais de votação
 * congestiona; marcar "votou" não pode depender dela.
 *
 * EXCEÇÃO À REGRA 5 do anonimato (decisão de 12/10): a rota vai ao disco,
 * mas só o mínimo para o puxador achar a pessoa e marcar o voto —
 *   primeiro nome + inicial do sobrenome, zona, seção e local de votação.
 *   NUNCA nome completo, CEP, bairro ou referência de endereço.
 * E com prazo: a cópia some no fim do dia da eleição, ao sair da conta, ou
 * quando chega uma rota nova do servidor.
 *
 * A fila de votos marcados guarda só IDs e horário — não é dado pessoal — e
 * fica até ser enviada (ou até o fim do dia seguinte à eleição).
 */

const ROUTE_KEY = 'yvy:pull-route:v1';
const QUEUE_KEY = 'yvy:pull-queue:v1';

/** Fim do dia da eleição (horário de Brasília): depois disso a cópia não vale. */
function routeDeadline(): number {
  const d = new Date(env.electionDate);
  // electionDate é 08:00 -03:00 do dia; o dia acaba 16 h depois (23:59 -03:00).
  return d.getTime() + 16 * 3600_000;
}

/** Fila pode esperar um dia a mais: o voto marcado no fim do dia ainda sobe. */
const queueDeadline = () => routeDeadline() + 24 * 3600_000;

/** "Maria Aparecida Souza" → "Maria S." */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

type CachedVoter = Pick<Voter, 'id' | 'zone' | 'section' | 'polling_place' | 'has_voted' | 'voted_at'> & {
  label: string;
};
type CachedRoute = {
  userId: string;
  savedAt: string;
  route: Pick<PullRoute, 'id' | 'neighborhood' | 'city' | 'state' | 'max_voters' | 'is_complete' | 'created_at' | 'puller_id'>;
  voters: CachedVoter[];
};

export type QueuedVote = { userId: string; voterId: string; voted: boolean; at: string };

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // disco cheio/bloqueado: segue sem cópia, nunca quebra a tela
  }
}

/** Guarda a cópia mínima da rota que acabou de chegar do servidor. */
export async function saveRouteCopy(userId: string, route: PullRoute, voters: Voter[]): Promise<void> {
  if (Date.now() > routeDeadline()) return clearRouteCopy();
  const copy: CachedRoute = {
    userId,
    savedAt: new Date().toISOString(),
    route: {
      id: route.id,
      neighborhood: route.neighborhood,
      city: route.city,
      state: route.state,
      max_voters: route.max_voters,
      is_complete: route.is_complete,
      created_at: route.created_at,
      puller_id: route.puller_id,
    },
    voters: voters.map((v) => ({
      id: v.id,
      label: shortName(v.full_name),
      zone: v.zone,
      section: v.section,
      polling_place: v.polling_place,
      has_voted: v.has_voted,
      voted_at: v.voted_at,
    })),
  };
  await writeJson(ROUTE_KEY, copy);
}

/**
 * Rota guardada, no formato da tela. Campos que não vão ao disco voltam
 * vazios; `full_name` traz o nome curto. Null se não há, venceu ou é de outra
 * pessoa.
 */
export async function loadRouteCopy(
  userId: string,
): Promise<{ route: PullRoute; voters: Voter[]; savedAt: string } | null> {
  const copy = await readJson<CachedRoute>(ROUTE_KEY);
  if (!copy) return null;
  if (copy.userId !== userId || Date.now() > routeDeadline()) {
    await clearRouteCopy();
    return null;
  }
  return {
    savedAt: copy.savedAt,
    route: { ...copy.route } as PullRoute,
    voters: copy.voters.map(
      (v): Voter => ({
        id: v.id,
        full_name: v.label,
        zone: v.zone,
        section: v.section,
        polling_place: v.polling_place,
        has_voted: v.has_voted,
        voted_at: v.voted_at,
        cep: null,
        neighborhood: null,
        city: null,
        state: null,
        address_hint: null,
        registered_by: null,
        consent_source: 'militant',
        pulled_by: userId,
        pull_route_id: copy.route.id,
        created_at: copy.savedAt,
      }),
    ),
  };
}

export async function clearRouteCopy(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ROUTE_KEY);
  } catch {
    // ignora
  }
}

// ---------------------------------------------------------------- fila

async function readQueue(): Promise<QueuedVote[]> {
  const q = (await readJson<QueuedVote[]>(QUEUE_KEY)) ?? [];
  if (Date.now() > queueDeadline() && q.length) {
    await writeJson(QUEUE_KEY, []);
    return [];
  }
  return q;
}

/** Marca na fila. Mesmo eleitor marcado de novo: vale a última marcação. */
export async function enqueueVote(userId: string, voterId: string, voted: boolean): Promise<void> {
  const q = (await readQueue()).filter((x) => !(x.userId === userId && x.voterId === voterId));
  q.push({ userId, voterId, voted, at: new Date().toISOString() });
  await writeJson(QUEUE_KEY, q);
}

export async function pendingVotes(userId: string): Promise<QueuedVote[]> {
  return (await readQueue()).filter((x) => x.userId === userId);
}

/** Erro de rede (sem sinal, timeout) — o pedido nem chegou ao banco. */
function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const err = e as { code?: string; message?: string; name?: string };
  if (err.code) return false; // PostgREST respondeu: é erro "de verdade"
  return /fetch|network|timeout|abort|load failed|offline/i.test(`${err.name ?? ''} ${err.message ?? ''}`);
}

export type FlushResult = { sent: number; failed: number; pending: number };

let flushing: Promise<FlushResult> | null = null;

/**
 * Manda a fila ao servidor, na ordem. Para no primeiro erro de rede (tenta
 * de novo depois). Linha que o banco recusa (rota trocada, eleitor apagado,
 * RLS) sai da fila e conta como falha — insistir não resolve.
 *
 * Não duplica: marcar voto é UPDATE da linha do eleitor, e o horário enviado
 * é o da marcação no aparelho, não o do envio.
 */
export function flushVotes(userId: string): Promise<FlushResult> {
  // Um envio por vez; quem chama durante um envio recebe o mesmo resultado.
  if (flushing) return flushing;
  flushing = sendQueue(userId).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function sendQueue(userId: string): Promise<FlushResult> {
  let sent = 0;
  let failed = 0;
  if (!supabase) return { sent, failed, pending: 0 };
  try {
    for (const item of await pendingVotes(userId)) {
      const res = await supabase
        .from('voters')
        .update({ has_voted: item.voted, voted_at: item.voted ? item.at : null })
        .eq('id', item.voterId)
        .select('id');
      // Tenta de novo depois (NÃO tira da fila): sem rede, sessão vencida
      // (401 — renova quando a rede voltar), limite (429) ou servidor fora (5xx).
      if (res.error && (isNetworkError(res.error) || res.status === 401 || res.status === 429 || res.status >= 500)) {
        break;
      }
      // Recusa de verdade: outro erro 4xx, ou 0 linhas (o RLS filtrou — o
      // eleitor saiu da rota dele ou foi apagado).
      if (res.error || !res.data?.length) failed += 1;
      else sent += 1;
      const rest = (await readQueue()).filter(
        (x) => !(x.userId === item.userId && x.voterId === item.voterId && x.at === item.at),
      );
      await writeJson(QUEUE_KEY, rest);
    }
  } catch (e) {
    if (!isNetworkError(e)) throw e;
  }
  return { sent, failed, pending: (await pendingVotes(userId)).length };
}

/** Ao sair da conta: some a cópia da rota. A fila fica (é só ID) para o mesmo puxador enviar ao voltar. */
export async function clearPullOnSignOut(): Promise<void> {
  await clearRouteCopy();
}
