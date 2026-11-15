import { ptError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/**
 * Apelido que a pessoa dá a um contato aceito das Conversas (0055). Só ela vê;
 * é como o contato aparece para ela no feed e nas conversas. Arquivo à parte
 * de chat.ts para o feed não carregar o código das conversas.
 *
 * Sem servidor (modo local) não há contatos, então não há apelido.
 */
let cache: Promise<Map<string, string>> | null = null;

export function myAliases(): Promise<Map<string, string>> {
  if (!supabase) return Promise.resolve(new Map());
  cache ??= (async () => {
    const { data, error } = await supabase!.from('contact_aliases').select('contact_id, alias');
    if (error) {
      cache = null;
      return new Map<string, string>();
    }
    return new Map(data.map((r) => [r.contact_id, r.alias]));
  })();
  return cache;
}

/** Texto vazio tira o apelido. */
export async function setContactAlias(contactId: string, alias: string): Promise<void> {
  if (!supabase) throw new Error('Apelido de contato precisa do servidor.');
  const { error } = await supabase.rpc('set_contact_alias', { p_contact: contactId, p_alias: alias });
  if (error) throw ptError(error);
  cache = null;
}

/** Limpa ao sair da conta, para a próxima pessoa no aparelho não ver os apelidos. */
export function forgetAliases(): void {
  cache = null;
}
