// Manda por e-mail os avisos de quem ligou "Avisos por e-mail" (migration 0047).
//
// Quem chama é o pg_cron a cada 5 min (x-cron-key do Vault), só quando tem
// aviso esperando. Pega até BATCH avisos não lidos de menos de 1 dia, marca
// como enviados antes de mandar (duas chamadas seguidas não mandam em dobro) e
// desmarca o que falhou, para tentar de novo na próxima volta.
//
// O aviso já é texto entre pessoas (apelido e bairro), então o e-mail leva só
// título e corpo dele, mais o link para o app.
//
// Envio pela API HTTP do Resend, em lote (/emails/batch, até 100 por chamada:
// conta como 1 pedido no limite de 2 pedidos/s). O lote passa ou falha
// inteiro.
//
// Segredos: RESEND_API_KEY, EMAIL_FROM ("YvY <avisos@useyvy.app>", domínio
// verificado no Resend).
//
// Teto: o plano grátis do Resend dá 100 e-mails/dia e a confirmação de
// cadastro do Auth (SMTP do Resend) sai da mesma cota. Aviso para em
// EMAIL_DAILY_CAP (padrão 80) nas últimas 24h; o resto espera a próxima volta
// e some sozinho quando o aviso passa de 1 dia (continua no app).

import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const BATCH = 100;
const DAILY_CAP = Number(Deno.env.get("EMAIL_DAILY_CAP") ?? 80);
const SITE = "https://www.useyvy.app";

const json = (b: unknown, status = 200) => Response.json(b, { status });

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function render(title: string, body: string | null) {
  const text = [title, "", body ?? "", "", `Abrir o YvY: ${SITE}/avisos`, "",
    "Você recebe este e-mail porque ligou \"Avisos por e-mail\" no seu Perfil. Para parar, desligue lá."].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1F2A1D">
<h2 style="color:#2D5A27;margin:0 0 12px">${escape(title)}</h2>
${body ? `<p style="line-height:1.5">${escape(body)}</p>` : ""}
<p><a href="${SITE}/avisos" style="display:inline-block;background:#2D5A27;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Abrir o YvY</a></p>
<p style="font-size:12px;color:#6B6B6B">Você recebe este e-mail porque ligou "Avisos por e-mail" no seu Perfil. Para parar, desligue lá.</p>
</div>`;
  return { text, html };
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cron } = await db.rpc("check_claim_cron_key", { p_key: req.headers.get("x-cron-key") ?? "" });
  if (cron !== true) return json({ error: "unauthorized" }, 401);

  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!key || !from) return json({ error: "Resend não configurado" }, 500);

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: today, error: countError } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .gt("emailed_at", since);
  if (countError) return json({ error: countError.message }, 500);
  const room = Math.min(BATCH, DAILY_CAP - (today ?? 0));
  if (room <= 0) return json({ sent: 0, capped: true });

  const { data: queue, error } = await db
    .from("notifications")
    .select("id, user_id, title, body, profiles!inner(notify_email, is_active)")
    .is("emailed_at", null)
    .is("read_at", null)
    .gt("created_at", since)
    .eq("profiles.notify_email", true)
    .eq("profiles.is_active", true)
    .order("created_at")
    .limit(room);
  if (error) return json({ error: error.message }, 500);
  if (!queue?.length) return json({ sent: 0 });

  // reserva: só manda o que esta chamada conseguiu marcar
  const { data: claimed } = await db
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .in("id", queue.map((n) => n.id))
    .is("emailed_at", null)
    .select("id");
  const mine = new Set((claimed ?? []).map((n) => n.id));

  const emails = new Map<string, string | null>();
  const batch: { id: string; mail: Record<string, unknown> }[] = [];
  for (const n of queue) {
    if (!mine.has(n.id)) continue;
    if (!emails.has(n.user_id)) {
      const { data } = await db.auth.admin.getUserById(n.user_id);
      emails.set(n.user_id, data.user?.email ?? null);
    }
    const to = emails.get(n.user_id);
    if (!to) continue;
    batch.push({ id: n.id, mail: { from, to: [to], subject: n.title, ...render(n.title, n.body) } });
  }

  let sent = 0;
  const failed: string[] = [];
  if (batch.length) {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(batch.map((b) => b.mail)),
    });
    if (res.ok) {
      sent = batch.length;
    } else {
      // sem o endereço no log
      console.error("notify-email: Resend recusou o lote:", res.status, (await res.text()).slice(0, 300));
      failed.push(...batch.map((b) => b.id));
    }
  }
  if (failed.length) await db.from("notifications").update({ emailed_at: null }).in("id", failed);
  return json({ sent, failed: failed.length });
});
