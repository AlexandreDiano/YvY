import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CheckResult } from '@/lib/db.types';
import { supabase } from '@/lib/supabase';

/**
 * Checagem automática em fila (supabase/migrations/0012_claim_checks.sql).
 *
 * Texto que a base editorial não cobre vai para a fila, e a cada 15 min uma
 * rotina checa um lote com IA e busca na web. Quem pediu vê o resultado na
 * tela de checagem e um aviso no Início. Fica dentro do app porque visitante
 * não tem conta para receber push.
 *
 * O aparelho guarda só os ids que ele mesmo pediu, sem vínculo com perfil.
 * É isso que deixa avisar o visitante.
 */

export type ClaimStatus = 'queued' | 'processing' | 'done' | 'failed';

export type ClaimCheck = {
  id: string;
  status: ClaimStatus;
  claim_text: string | null;
  result: CheckResult | null;
  explanation: string | null;
  source_name: string | null;
  source_url: string | null;
  checked_at: string | null;
  /** A equipe conferiu e publicou, então os campos acima já são da versão validada. */
  reviewed?: boolean;
};

/** `text` é o que a pessoa colou. Fica só aqui, o servidor não devolve o texto colado. */
type Mine = { id: string; seen: boolean; at: number; text?: string };

const KEY = 'yvy:my-claims';
const KEEP_MS = 1000 * 60 * 60 * 24 * 14;

async function readMine(): Promise<Mine[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Mine[]) : [];
    return list.filter((m) => Date.now() - m.at < KEEP_MS);
  } catch {
    return [];
  }
}

async function writeMine(list: Mine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // storage cheio: perde só o aviso, a checagem continua no servidor
  }
}

/** Pede a checagem. No modo local não tem fila e devolve null. */
export async function requestClaimCheck(text: string): Promise<ClaimCheck | null> {
  if (!supabase) return null;
  const res = await supabase.rpc('request_claim_check', { p_text: text });
  if (res.error) throw new Error(res.error.message);
  const check = res.data as unknown as ClaimCheck;
  const mine = await readMine();
  if (!mine.some((m) => m.id === check.id)) {
    // se já veio pronta conta como vista; se foi pra fila, avisa quando ficar pronta
    mine.push({ id: check.id, seen: check.status === 'done', at: Date.now(), text: text.trim().slice(0, 300) });
    await writeMine(mine);
  }
  return check;
}

/** Checagens que este aparelho pediu, mais recentes primeiro, com `unseen`. */
export async function myClaimChecks(): Promise<(ClaimCheck & { unseen: boolean; asked?: string })[]> {
  if (!supabase) return [];
  const mine = await readMine();
  if (!mine.length) return [];
  const res = await supabase.rpc('get_claim_checks', { p_ids: mine.map((m) => m.id) });
  if (res.error) return [];
  const byId = new Map((res.data as unknown as ClaimCheck[]).map((c) => [c.id, c]));
  return [...mine]
    .reverse()
    .flatMap((m) => {
      const c = byId.get(m.id);
      return c ? [{ ...c, unseen: !m.seen && c.status === 'done', asked: m.text }] : [];
    });
}

/** Checagens por IA com veredito (nunca "não verificado"), mais recentes primeiro. */
export async function listClaimChecks(): Promise<ClaimCheck[]> {
  if (!supabase) return [];
  const res = await supabase.rpc('list_claim_checks', { p_limit: 30 });
  if (res.error) return [];
  return res.data as unknown as ClaimCheck[];
}

export type QueueItem = {
  id: string;
  status: ClaimStatus;
  input_text: string | null;
  claim_text: string | null;
  result: CheckResult | null;
  error: string | null;
  attempts: number;
  requested_count: number;
  queued_at: string;
  checked_at: string | null;
};

/** Fila inteira, para moderador/admin (RPC list_claim_queue). */
export async function listClaimQueue(): Promise<QueueItem[]> {
  if (!supabase) return [];
  const res = await supabase.rpc('list_claim_queue' as never);
  if (res.error) throw new Error(res.error.message);
  return res.data as unknown as QueueItem[];
}

/** "Checar agora": a Edge Function processa este item na hora. Só moderador/admin. */
export async function runClaimNow(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Sem servidor configurado.' };
  const { data, error } = await supabase.functions.invoke('process-claim-checks', { body: { id } });
  if (error) return { ok: false, error: 'Não foi possível checar agora.' };
  const r = data as { ok?: number; error?: string };
  return { ok: (r.ok ?? 0) > 0, error: r.error };
}

/**
 * Moderador/admin confere a checagem da IA e publica em `fact_checks`
 * (promote_claim_check, migration 0041). Dá para corrigir o texto antes; a
 * fonte é sempre a que a busca achou.
 */
export async function publishClaimCheck(
  id: string,
  edits: {
    claim: string;
    result: Exclude<CheckResult, 'unverified'>;
    explanation: string;
    /** Só quando a IA não achou fonte e a equipe achou. */
    sourceUrl?: string;
    sourceName?: string;
  },
): Promise<void> {
  if (!supabase) return;
  const res = await supabase.rpc(
    'promote_claim_check' as never,
    {
      p_id: id,
      p_claim: edits.claim,
      p_result: edits.result,
      p_explanation: edits.explanation,
      p_source_url: edits.sourceUrl ?? null,
      p_source_name: edits.sourceName ?? null,
    } as never,
  );
  if (res.error) throw new Error(res.error.message);
}

/** Tira do ar uma checagem que a equipe já tinha publicado (migration 0044). */
export async function unpublishFactCheck(id: string): Promise<void> {
  if (!supabase) return;
  const res = await supabase.rpc('unpublish_fact_check' as never, { p_id: id } as never);
  if (res.error) throw new Error(res.error.message);
}

/** Apaga item com problema (texto sem sentido, teste, abuso). Moderador/admin. */
export async function deleteClaimCheck(id: string): Promise<void> {
  if (!supabase) return;
  const res = await supabase.rpc('delete_claim_check' as never, { p_id: id } as never);
  if (res.error) throw new Error(res.error.message);
}

/**
 * Desiste de uma checagem que ainda está na fila. Sai da lista deste aparelho,
 * e no servidor o pedido só some se mais ninguém pediu o mesmo texto.
 */
export async function cancelClaimRequest(id: string, queued: boolean): Promise<void> {
  if (supabase && queued) {
    const res = await supabase.rpc('cancel_claim_request' as never, { p_id: id } as never);
    if (res.error) throw new Error(res.error.message);
  }
  const mine = await readMine();
  await writeMine(mine.filter((m) => m.id !== id));
}

/** Lê o texto de um print pela Edge Function `ocr` (Gemini). A imagem não fica guardada. */
export async function readTextFromImage(base64: string, mime: string): Promise<{ text: string; error?: string }> {
  if (!supabase) return { text: '', error: 'Disponível só com o servidor configurado.' };
  const { data, error } = await supabase.functions.invoke('ocr', { body: { image: base64, mime } });
  if (error) return { text: '', error: 'Não foi possível ler a imagem agora.' };
  const r = data as { text?: string; error?: string };
  return { text: r.text ?? '', error: r.error };
}

export async function markClaimsSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const mine = await readMine();
  await writeMine(mine.map((m) => (ids.includes(m.id) ? { ...m, seen: true } : m)));
}
