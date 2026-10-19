/**
 * Conversas de ponta a ponta: três navegadores headless (duas pessoas e um
 * moderador) contra o Supabase local e o site exportado servido em :8765.
 * Rodar por scripts/e2e-chat.sh, que monta tudo.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BIN = process.env.CHROME_BIN;
const URL_ = process.env.LOCAL_API_URL;
const ANON = process.env.LOCAL_ANON_KEY;
const SRV = process.env.LOCAL_SERVICE_ROLE_KEY;
const S = mkdtempSync(join(tmpdir(), 'yvy-e2e-'));
if (!BIN || !URL_ || !ANON || !SRV || !/127\.0\.0\.1|localhost/.test(URL_)) {
  console.error('e2e recusado: rode por scripts/e2e-chat.sh (só contra o Supabase local).');
  process.exit(1);
}
const admin = createClient(URL_, SRV, { auth: { persistSession: false } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN = Date.now().toString(36);
const results = [];
const ok = (name, cond, extra = '') => {
  results.push([cond, name]);
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

async function user(label, role = 'militant') {
  const email = `e2e-${label}-${RUN}@yvy.test`;
  const password = `Yvy-${RUN}-${label}!`;
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const id = data.user.id;
  const r = await admin.from('profiles').insert({
    id, role, membership_status: 'active', display_name: label.toUpperCase(), full_name: 'Nome ' + label,
    cep: '01001000', neighborhood: 'E2E-' + RUN, city: 'Cidade-E2E', state: 'SP',
    terms_accepted_at: new Date().toISOString(), sensitive_consent_at: new Date().toISOString(),
  });
  if (r.error) throw new Error(r.error.message);
  if (role === 'moderator') await admin.from('moderators').insert({ user_id: id, neighborhood: 'E2E-' + RUN, city: 'Cidade-E2E', state: 'SP' });
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  return { id, session: s.data.session };
}

async function browser(port, name) {
  const proc = spawn(BIN, [`--remote-debugging-port=${port}`, '--no-sandbox', `--user-data-dir=${S}/e2e-${name}-${RUN}`, 'about:blank'], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 50 && !list; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { await wait(200); } }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {}; const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending[d.id]) { pending[d.id](d.result); delete pending[d.id]; }
    if (d.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(d.params.exceptionDetails).slice(0, 300));
  };
  const send = (method, params = {}) => new Promise((r) => { pending[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value;
  return {
    errors,
    ev,
    async go(path) { await send('Page.navigate', { url: 'http://127.0.0.1:8765' + path }); await wait(4500); },
    text: () => ev('document.body.innerText'),
    async click(label) {
      const r = await ev(`(() => { const els = [...document.querySelectorAll('[role=button],button')]; const el = els.find(e => e.innerText.trim() === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
      await wait(2500);
      return r;
    },
    async type(selector, value) {
      return ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    },
    close() { ws.close(); proc.kill(); },
  };
}

const A = await user('ana');
const B = await user('bia');
const pa = await browser(9341, 'a');
const pb = await browser(9342, 'b');
try {
  for (const [p, u] of [[pa, A], [pb, B]]) {
    await p.go('/welcome');
    await p.ev(`localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(u.session))}); window.confirm = () => true; true`);
  }

  // primeira abertura pela lista: duas chamadas em paralelo não podem virar dois aparelhos
  await pb.go('/conversas');
  await wait(1500);
  const devs = await admin.from('chat_devices').select('id').eq('user_id', B.id);
  ok('primeira abertura registra um aparelho só', (devs.data ?? []).length === 1, `aparelhos: ${(devs.data ?? []).length}`);

  await pa.go('/conversas/adicionar');
  const tA = await pa.text();
  const code = (tA.match(/\b([A-Z2-9]{5}) ([A-Z2-9]{5})\b/) || []).slice(1).join('');
  ok('A vê o próprio QRCode/código', code.length === 10, code || tA.slice(0, 200));
  const fp = (tA.match(/impressão digital: ([0-9A-F ]{24})/) || [])[1]?.replace(/\s/g, '');

  await pb.go(`/conversas/adicionar?c=${code}&f=${fp}`);
  await pb.ev('window.confirm = () => true');
  ok('B pede para conversar pelo link', await pb.click('Pedir para conversar'));
  await wait(1500);
  ok('pedido enviado', (await pb.text()).includes('Pedido enviado'), (await pb.text()).slice(0, 200));

  await pb.go(`/conversas/${A.id}`);
  ok('antes de aceitar, B não abre a conversa', (await pb.text()).includes('Conversa não encontrada'));

  await pa.go('/conversas');
  ok('A vê o pedido de B', (await pa.text()).includes('Camarada BIA'), (await pa.text()).slice(0, 400));
  ok('A aceita', await pa.click('Aceitar'));

  await pb.go(`/conversas/${A.id}`);
  await pb.ev('window.confirm = () => true');
  ok('B abre a conversa', (await pb.text()).includes('Nenhuma mensagem ainda'), (await pb.text()).slice(0, 300));
  await pb.type('textarea', 'Oi Ana, ato amanhã às 18h na praça');
  ok('B envia', await pb.click('Enviar'));
  await wait(1500);

  const q = await admin.from('message_queue').select('body, recipient').eq('sender', B.id);
  ok('na fila só vai texto cifrado', (q.data ?? []).length === 1 && !q.data[0].body.includes('praça'), JSON.stringify(q.data).slice(0, 120));

  await pa.go(`/conversas/${B.id}`);
  await wait(1500);
  const conv = await pa.text();
  ok('A recebe e decifra a mensagem', conv.includes('Oi Ana, ato amanhã às 18h na praça'), conv.slice(0, 300));
  ok('assinatura confere (sem aviso)', !conv.includes('assinatura não confere'));
  ok('QRCode confere com a chave (sem aviso)', !conv.includes('não bate com o QRCode'));
  const left = await admin.from('message_queue').select('id').eq('sender', B.id);
  ok('A apagou da fila depois de baixar', (left.data ?? []).length === 0);

  await pa.type('textarea', 'Combinado, vou levar os panfletos');
  await pa.click('Enviar');
  await pb.go(`/conversas/${A.id}`);
  ok('B recebe a resposta', (await pb.text()).includes('vou levar os panfletos'));

  await pa.go(`/conversas/${B.id}`);
  await pa.ev('window.confirm = () => true');
  ok('A bloqueia e denuncia', await pa.click('Bloquear e denunciar'));
  await wait(1500);
  const rep = await admin.from('chat_reports').select('*').eq('reporter', A.id);
  const r0 = rep.data?.[0];
  ok('denúncia salva com as mensagens decifradas', Boolean(r0) && JSON.stringify(r0.messages).includes('praça'), JSON.stringify(rep.error ?? r0 ?? {}).slice(0, 200));
  ok('denúncia guarda chaves das duas partes', r0 && Object.keys(r0.sign_keys).length === 2);
  ok('bloqueio registrado', r0?.blocked === true);

  {
    const M = await user('mod', 'moderator');
    const pm = await browser(9343, 'm');
    await pm.go('/welcome');
    await pm.ev(`localStorage.setItem('sb-127-auth-token', ${JSON.stringify(JSON.stringify(M.session))}); true`);
    await pm.go('/denuncias');
    await wait(1500);
    const t = await pm.text();
    ok('moderador vê a denúncia com o texto', t.includes('Camarada BIA denunciado por Camarada ANA') && t.includes('na praça'), t.slice(0, 300));
    ok('moderação confere a assinatura de cada mensagem', t.includes('assinatura confere') && !t.includes('não confere'));
    await pm.type('textarea', 'Conversa normal, sem problema');
    ok('moderador resolve', await pm.click('Resolver'));
    const res = await admin.from('chat_reports').select('status, resolution').eq('reporter', A.id).single();
    ok('denúncia resolvida com a decisão', res.data?.status === 'resolved' && res.data.resolution.includes('sem problema'), JSON.stringify(res.data));
    ok('sem erro de JS na moderação', pm.errors.length === 0, pm.errors.join(' | ').slice(0, 300));
    pm.close();
    await admin.from('moderators').delete().eq('user_id', M.id);
    await admin.from('profiles').delete().eq('id', M.id);
    await admin.auth.admin.deleteUser(M.id);
  }

  await pb.go(`/conversas/${A.id}`);
  await pb.type('textarea', 'mensagem depois do bloqueio');
  await pb.click('Enviar');
  ok('B bloqueado não consegue mandar', (await pb.text()).includes('Não dá para mandar'), (await pb.text()).slice(-300));

  await pa.go('/conversas/bloqueados');
  ok('A vê B na lista de bloqueados', (await pa.text()).includes('Camarada BIA'));
  ok('A desbloqueia', await pa.click('Desbloquear'));
  await pa.go('/conversas/bloqueados');
  ok('lista de bloqueados vazia', (await pa.text()).includes('Ninguém bloqueado'));

  for (const [n, p] of [['A', pa], ['B', pb]]) ok(`sem erro de JS no navegador ${n}`, p.errors.length === 0, p.errors.join(' | ').slice(0, 400));
} finally {
  pa.close(); pb.close();
  await admin.from('chat_reports').delete().in('reporter', [A.id, B.id]);
  for (const u of [A, B]) { await admin.from('profiles').delete().eq('id', u.id); await admin.auth.admin.deleteUser(u.id); }
}
const fails = results.filter(([c]) => !c).length;
console.log(`\n${results.length - fails} ok, ${fails} falhas`);
process.exit(fails ? 1 : 0);
