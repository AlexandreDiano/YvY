// Votação em pauta vira aviso para a base (migration 0057, DIANO-136).
//
// Quem chama é o pg_cron de 3 em 3 horas (x-cron-key do Vault) ou um admin
// logado. Lê a pauta do Plenário da Câmara e do Senado dos próximos 7 dias,
// compara cada ementa com vote_alert_keywords e, no que bater, chama
// vote_alert_publish, que grava a proposição e cria o aviso de cada membro.
//
// O aviso chama para a consulta pública (e-Cidadania ou enquete da Câmara)
// antes da sessão e só repete campo oficial (sigla, número, ementa, data, link).
// Deploy sem verificação de JWT: o cron não manda Authorization.
//   supabase functions deploy vote-alerts --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { matchTerms, title, type Item } from "./match.ts";
import { camara, senado } from "./sources.ts";

/** Teto por rodada: se uma palavra-chave ficar larga demais, não vira enxurrada. */
const MAX_PER_RUN = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, x-yvy-client",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: CORS });

// deno-lint-ignore no-explicit-any
async function authorized(req: Request, db: any): Promise<boolean> {
  const { data: cron } = await db.rpc("check_claim_cron_key", { p_key: req.headers.get("x-cron-key") ?? "" });
  if (cron === true) return true;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  if (!data.user) return false;
  const { data: role } = await db.rpc("role_of", { p_user: data.user.id });
  return role === "admin";
}

/** AAAA-MM-DD em Brasília */
function brDay(offsetDays: number): string {
  const d = new Date(Date.now() - 3 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await authorized(req, db))) return json({ error: "não autorizado" }, 401);

  const { data: kw, error: kwErr } = await db.from("vote_alert_keywords").select("term");
  if (kwErr) return json({ error: kwErr.message }, 500);
  const terms = (kw ?? []).map((r: { term: string }) => r.term);
  if (!terms.some((t: string) => !t.startsWith("-"))) return json({ skipped: "sem palavra-chave" });

  const from = brDay(0);
  const to = brDay(7);
  const errors: string[] = [];
  const items: Item[] = [];
  for (const [name, fetcher] of [["camara", camara], ["senado", senado]] as const) {
    try {
      items.push(...(await fetcher(from, to)));
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // as duas fontes fora: erro de verdade, para o health_watch avisar
  if (errors.length === 2) return json({ errors }, 502);

  const seen = new Set<string>();
  let notified = 0;
  let matched = 0;
  for (const it of items) {
    const key = `${it.casa}:${it.propId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hits = matchTerms(it.ementa, terms);
    if (hits.length === 0) continue;
    matched++;
    if (notified >= MAX_PER_RUN) continue;
    const { data, error } = await db.rpc("vote_alert_publish", {
      p_casa: it.casa,
      p_prop_id: it.propId,
      p_title: title(it),
      p_ementa: it.ementa,
      p_url: it.url,
      p_vote_url: it.voteUrl,
      p_session_at: it.sessionAt,
      p_matched: hits,
    });
    if (error) errors.push(`${key}: ${error.message}`);
    else if (data === true) notified++;
  }
  return json({ window: [from, to], items: seen.size, matched, notified, errors });
});
