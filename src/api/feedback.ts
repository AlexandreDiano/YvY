import { supabase } from '../lib/supabase';

/** Ideias, problemas e sugestões dos membros (migration 0029). Só a equipe lê todos. */
export type FeedbackKind = 'ideia' | 'problema' | 'outro';
export type FeedbackStatus = 'novo' | 'visto' | 'feito' | 'descartado';
export type Feedback = {
  id: string;
  author_id: string;
  kind: FeedbackKind;
  message: string;
  status: FeedbackStatus;
  staff_note: string | null;
  created_at: string;
  author_display_name?: string | null;
  /** Grupo de feedbacks parecidos (0031). Só a equipe vê o título. */
  group_id?: string | null;
  group_title?: string | null;
};

export async function sendFeedback(authorId: string, kind: FeedbackKind, message: string): Promise<void> {
  if (!supabase) throw new Error('Disponível só com o servidor configurado.');
  const text = message.trim();
  if (text.length < 5) throw new Error('Escreva um pouco mais.');
  const res = await supabase
    .from('feedback' as never)
    .insert({ author_id: authorId, kind, message: text.slice(0, 1000) } as never);
  if (res.error) throw res.error;
}

/** Membro: só os próprios. Moderador/admin: todos (a RLS decide). */
export async function listFeedback(): Promise<Feedback[]> {
  if (!supabase) return [];
  const res = await supabase
    .from('feedback_with_author' as never)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (res.error) throw res.error;
  return res.data as unknown as Feedback[];
}

/** Muda a situação de um feedback ou de um grupo inteiro de parecidos. */
export async function setFeedbackStatus(ids: string | string[], status: FeedbackStatus, note?: string): Promise<void> {
  if (!supabase) return;
  const list = Array.isArray(ids) ? ids : [ids];
  const res = await supabase
    .from('feedback' as never)
    .update({ status, ...(note !== undefined ? { staff_note: note.trim() || null } : {}) } as never)
    .in('id', list);
  if (res.error) throw res.error;
}

/** Equipe: agrupa agora os que chegaram sem grupo (o cron faz de hora em hora). */
export async function groupFeedbackNow(): Promise<{ grouped: number; error?: string }> {
  if (!supabase) return { grouped: 0 };
  const { data, error } = await supabase.functions.invoke('feedback-group', { body: {} });
  if (error) return { grouped: 0, error: 'Não foi possível agrupar agora.' };
  const r = data as { grouped?: number; error?: string };
  return { grouped: r.grouped ?? 0, error: r.error };
}

export type FeedbackGroup = {
  key: string;
  title: string;
  items: Feedback[];
  /** Pessoas diferentes, não mensagens: quem mandou duas vezes conta uma. */
  people: number;
  status: FeedbackStatus;
  last: string;
};

const ORDER: FeedbackStatus[] = ['novo', 'visto', 'feito', 'descartado'];

/** Junta por grupo; sem grupo ainda, cada um fica sozinho até o próximo agrupamento. */
export function groupFeedback(list: Feedback[]): FeedbackGroup[] {
  const map = new Map<string, Feedback[]>();
  for (const f of list) {
    const key = f.group_id ?? f.id;
    map.set(key, [...(map.get(key) ?? []), f]);
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      key,
      title: items[0]!.group_title ?? '',
      items,
      people: new Set(items.map((f) => f.author_id)).size,
      // A situação do grupo é a mais "aberta" entre as mensagens dele.
      status: ORDER.find((s) => items.some((f) => f.status === s)) ?? 'novo',
      last: items.reduce((a, f) => (f.created_at > a ? f.created_at : a), items[0]!.created_at),
    }))
    .sort((a, b) => b.people - a.people || (b.last > a.last ? 1 : -1));
}
