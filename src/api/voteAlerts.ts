import { ptError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Votação em pauta (0057). A Edge Function vote-alerts compara a pauta do
 * Congresso com as palavras-chave e avisa a base; aqui o app só abre a
 * consulta pública e a ficha oficial do aviso, e o admin cuida da lista.
 *
 * Sem servidor (modo local) não há pauta nem aviso.
 */

export type VoteAlertLinks = {
  /** consulta pública (e-Cidadania ou enquete da Câmara); null em sessão do Congresso */
  voteUrl: string | null;
  /** ficha oficial da proposição */
  url: string;
};

/** Links de um aviso `vote_alert`. */
export async function voteAlertLinks(id: string): Promise<VoteAlertLinks | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('vote_alerts').select('url, vote_url').eq('id', id).maybeSingle();
  if (error) throw ptError(error);
  return data ? { url: data.url, voteUrl: data.vote_url } : null;
}

export async function listKeywords(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('vote_alert_keywords').select('term').order('term');
  if (error) throw ptError(error);
  return data.map((r) => r.term);
}

export async function addKeyword(term: string): Promise<void> {
  if (!supabase) throw new Error('A lista de palavras-chave precisa do servidor.');
  const t = term.trim().toLowerCase();
  if (t.replace(/^-|\*$/g, '').trim().length < 2) throw new Error('Escreva pelo menos 2 letras.');
  const { error } = await supabase.from('vote_alert_keywords').insert({ term: t });
  if (error) throw ptError(error);
}

export async function removeKeyword(term: string): Promise<void> {
  if (!supabase) throw new Error('A lista de palavras-chave precisa do servidor.');
  const { error } = await supabase.from('vote_alert_keywords').delete().eq('term', term);
  if (error) throw ptError(error);
}
