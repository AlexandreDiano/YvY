import type { PlanPromise, PromiseStatus, PromiseUpdate } from '@/features/plans/promiseRules';
import { withCache } from '@/lib/cache';
import { all, insert, localId } from '@/lib/localStore';
import { supabase } from '@/lib/supabase';

/**
 * Monitor de promessas do plano de governo (migration 0051, YVY-130).
 *
 * Leitura pública pelas views `plan_promises` (trecho + status mais recente)
 * e `plan_promise_history` (todas as mudanças, sem quem registrou). Escrita
 * só pela RPC `set_plan_promise_status`, de moderador/admin, com prova.
 *
 * Cache curto: status muda e quem abre tem de ver o atual; o cache só serve
 * para a rede caída.
 */
const TTL = 24 * 60 * 60 * 1000;
const LOCAL = 'plan_promise_updates';

export async function listPromises(sq: string): Promise<{ promises: PlanPromise[]; stale: boolean }> {
  if (!supabase) {
    // modo local: sem plano importado (getGovernmentPlan devolve null), sem trechos
    return { promises: [], stale: false };
  }
  const { data, stale } = await withCache(
    `promises:${sq}`,
    async () => {
      const res = await supabase!
        .from('plan_promises' as never)
        .select('sq_candidato,promise_key,position,tema,texto,pagina,status,source_url,evidence_date,note,updated_at')
        .eq('sq_candidato', sq)
        .order('position');
      if (res.error) throw res.error;
      return res.data as unknown as PlanPromise[];
    },
    TTL,
  );
  return { promises: data ?? [], stale };
}

/** Histórico de uma promessa, da mudança mais nova para a mais antiga. */
export async function promiseHistory(sq: string, key: string): Promise<PromiseUpdate[]> {
  if (!supabase) {
    const rows = await all<PromiseUpdate>(LOCAL);
    return rows.filter((r) => r.sq_candidato === sq && r.promise_key === key);
  }
  const res = await supabase
    .from('plan_promise_history' as never)
    .select('id,sq_candidato,promise_key,status,source_url,evidence_date,note,created_at')
    .eq('sq_candidato', sq)
    .eq('promise_key', key)
    .order('created_at', { ascending: false });
  if (res.error) throw new Error(res.error.message);
  return res.data as unknown as PromiseUpdate[];
}

/** Moderador/admin registra o status com prova. `date` em ISO (AAAA-MM-DD). */
export async function setPromiseStatus(input: {
  sq: string;
  key: string;
  status: PromiseStatus;
  sourceUrl: string;
  date: string;
  note: string;
}): Promise<void> {
  if (!supabase) {
    await insert<PromiseUpdate>(LOCAL, {
      id: localId('promise'),
      sq_candidato: input.sq,
      promise_key: input.key,
      status: input.status,
      source_url: input.sourceUrl.trim(),
      evidence_date: input.date,
      note: input.note.trim(),
      created_at: new Date().toISOString(),
    });
    return;
  }
  const res = await supabase.rpc(
    'set_plan_promise_status' as never,
    {
      p_sq: input.sq,
      p_key: input.key,
      p_status: input.status,
      p_source_url: input.sourceUrl.trim(),
      p_evidence_date: input.date,
      p_note: input.note.trim(),
    } as never,
  );
  if (res.error) throw new Error(res.error.message);
}
