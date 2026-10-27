/**
 * Teste do perímetro de segurança do Yvy.
 *
 * O contexto (fase 1 do cronograma) traz "RLS policies testadas" como um
 * checkbox. Isto é o checkbox virado em código: cria usuários de cada papel em
 * dois bairros e verifica, consulta por consulta, quem lê e escreve o quê.
 *
 * Roda contra um projeto Supabase de VERDADE — nunca o de produção. Precisa de
 * .env com EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY e
 * SUPABASE_SERVICE_ROLE_KEY (a service_role só é usada para montar e desmontar
 * o cenário; as asserções usam sempre a anon key, como o app).
 *
 *   npm run test:rls
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------- env

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    for (const line of readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !out[m[1]!]) out[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // sem .env: cai nas variáveis de ambiente
  }
  return out;
}

const env = loadEnv();
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.log(
    'test:rls pulado — faltam EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
      'ou SUPABASE_SERVICE_ROLE_KEY no .env. Este teste precisa de um projeto Supabase real\n' +
      '(use um projeto de teste, nunca o de produção).',
  );
  process.exit(0);
}

// O .env do app aponta para produção e tem a service_role. Sem esta trava,
// `npm run test:rls` criaria e apagaria usuários de teste lá. Projeto remoto
// de teste só com YVY_RLS_REMOTE=1, e nunca o de produção.
const PROD_REF = 'qbxdoprekyynzcwdtvuw';
const host = new URL(URL_).hostname;
const local = host === '127.0.0.1' || host === 'localhost';
if (URL_.includes(PROD_REF) || (!local && env.YVY_RLS_REMOTE !== '1')) {
  console.error(
    `test:rls recusado: ${host} não é o Supabase local.\n` +
      'Use `npm run test:rls:local` (sobe o Supabase local e roda contra ele).\n' +
      'Para outro projeto de teste remoto: YVY_RLS_REMOTE=1 com as chaves dele no ambiente.',
  );
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

/** Sem sessão: é o que o app oferece a quem não tem convite. */
const anon = createClient(URL_, ANON, { auth: { persistSession: false } });

// ---------------------------------------------------------------- harness

let pass = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Espera uma leitura que devolve exatamente estas linhas (por id). */
async function expectRows(
  name: string,
  query: PromiseLike<{ data: unknown; error: unknown }>,
  expected: number,
): Promise<void> {
  const { data, error } = await query;
  // Sem privilégio nenhum na tabela (42501) também é "não lê nada".
  if (expected === 0 && (error as { code?: string } | null)?.code === '42501') return check(name, true);
  const rows = Array.isArray(data) ? data.length : 0;
  check(name, !error && rows === expected, error ? JSON.stringify(error) : `recebeu ${rows}, esperava ${expected}`);
}

/**
 * Espera que a escrita seja barrada. Insert barrado dá erro (42501); update
 * ou delete barrado pela RLS não dá erro, só não acha a linha. Por isso a
 * escrita tem que vir com `.select()`: zero linhas devolvidas também conta.
 */
async function expectDenied(
  name: string,
  query: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<void> {
  const { data, error } = await query;
  const touched = Array.isArray(data) ? data.length : data ? 1 : 0;
  check(name, Boolean(error) || touched === 0, error ? '' : `a escrita passou (${touched} linha(s))`);
}

// ---------------------------------------------------------------- cenário

const RUN = Date.now().toString(36);
const AREA_A = { neighborhood: `Teste-A-${RUN}`, city: `Cidade-${RUN}`, state: 'SP' };
const AREA_B = { neighborhood: `Teste-B-${RUN}`, city: `Cidade-${RUN}`, state: 'SP' };
const OTHER_CITY = `Outra-${RUN}`;

type Actor = { id: string; email: string; client: SupabaseClient };

const created: string[] = [];
const PLAN_SQ = `rls-plan-${RUN}`;

async function makeActor(
  label: string,
  role: 'militant' | 'moderator' | 'admin',
  status: 'pending' | 'active',
  area: typeof AREA_A,
): Promise<Actor> {
  const email = `rls-${label}-${RUN}@yvy.test`;
  const password = `yvy-${RUN}-${label}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  created.push(data.user.id);

  const profile = {
    id: data.user.id,
    role,
    membership_status: status,
    display_name: label.toUpperCase(),
    full_name: `Nome Completo ${label}`,
    cep: '01001000',
    ...area,
    terms_accepted_at: new Date().toISOString(),
  };
  const ins = await admin.from('profiles').insert(profile);
  if (ins.error) throw new Error(`profile(${label}): ${ins.error.message}`);

  if (role === 'moderator') {
    const mod = await admin.from('moderators').insert({ user_id: data.user.id, ...area });
    if (mod.error) throw new Error(`moderator(${label}): ${mod.error.message}`);
  }

  const client = createClient(URL_!, ANON!, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn(${label}): ${signIn.error.message}`);

  return { id: data.user.id, email, client };
}

async function teardown(): Promise<void> {
  // denúncia não tem FK (sobrevive à conta apagada): sai à mão
  if (created.length) await admin.from('chat_reports').delete().in('reporter', created);
  await admin.from('posts').delete().eq('city', AREA_A.city);
  await admin.from('posts').delete().eq('city', OTHER_CITY);
  await admin.from('actions').delete().eq('city', AREA_A.city);
  // histórico de promessa sai junto (on delete cascade)
  await admin.from('government_plans').delete().eq('sq_candidato', PLAN_SQ);
  for (const id of created) {
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
}

// ---------------------------------------------------------------- testes

async function main(): Promise<void> {
  console.log(`\nCenário ${RUN}: dois bairros, anônimo + quatro papéis.\n`);

  const pending = await makeActor('pending', 'militant', 'pending', AREA_A);
  const milA = await makeActor('milA', 'militant', 'active', AREA_A);
  const milB = await makeActor('milB', 'militant', 'active', AREA_B);
  const modA = await makeActor('modA', 'moderator', 'active', AREA_A);
  const adm = await makeActor('admin', 'admin', 'active', AREA_A);
  const sjp = await makeActor('sjp', 'militant', 'active', { neighborhood: `Teste-${RUN}`, city: 'São José dos Pinhais', state: 'PR' });
  const londrina = await makeActor('londrina', 'militant', 'active', { neighborhood: `Teste-${RUN}`, city: 'Londrina', state: 'PR' });

  // conteúdo de apoio, inserido com service_role
  const postA = (
    await admin
      .from('posts')
      .insert({ author_id: milA.id, content: 'post publicado do bairro A', status: 'published', ...AREA_A })
      .select('id')
      .single()
  ).data as { id: string };
  const postPend = (
    await admin
      .from('posts')
      // autor vê o próprio post pendente (posts_select_author); o pendente é de
      // outra pessoa para testar que militante comum não lê a fila
      .insert({ author_id: adm.id, content: 'post pendente do bairro A', status: 'pending', ...AREA_A })
      .select('id')
      .single()
  ).data as { id: string };
  await admin
    .from('posts')
    .insert({ author_id: milB.id, content: 'post publicado do bairro B', status: 'published', ...AREA_B });

  await admin.from('actions').insert({
    title: 'Panfletagem de teste A',
    type: 'panfletagem',
    status: 'open',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    created_by: milA.id,
    visibility: 'base',
    ...AREA_A,
  });

  console.log('conteúdo público — sem conta nenhuma');
  await expectRows('anônimo lê cards de proposta', anon.from('proposal_cards').select('id').limit(1), 1);
  await expectRows('anônimo lê checagens', anon.from('fact_checks').select('id').limit(1), 1);
  await expectRows('anônimo lê feature flags', anon.from('feature_flags').select('key').limit(1), 1);
  {
    const { error } = await anon.rpc('search_fact_checks', { q: 'bolsa familia', min_score: 0.1 });
    check('anônimo usa a RPC de checagem', !error, error?.message);
  }
  await expectRows('anônimo não lê perfis', anon.from('profiles').select('id').limit(1), 0);
  await expectRows('anônimo não lê o feed', anon.from('posts').select('id').limit(1), 0);
  await expectRows('anônimo não lê ações', anon.from('actions').select('id').limit(1), 0);
  await expectRows('anônimo não lê convites', anon.from('invites').select('id').limit(1), 0);
  await expectDenied(
    'anônimo não escreve nos cards',
    anon.from('proposal_cards').update({ title: 'pichado' }).eq('is_active', true),
  );

  console.log('\nperfis — nome completo não circula');
  await expectRows(
    'militante A não lê a linha de profiles do militante B',
    milA.client.from('profiles').select('id').eq('id', milB.id),
    0,
  );
  await expectRows(
    'militante A lê a própria linha',
    milA.client.from('profiles').select('id').eq('id', milA.id),
    1,
  );
  {
    const { data } = await milA.client.from('profiles_public').select('*').eq('id', milA.id);
    const row = (data as Record<string, unknown>[] | null)?.[0] ?? {};
    check('profiles_public não expõe full_name/phone/cep', !('full_name' in row) && !('phone' in row) && !('cep' in row));
  }
  await expectRows(
    'profiles_public não mostra perfil de outro bairro',
    milA.client.from('profiles_public').select('id').eq('id', milB.id),
    0,
  );
  await expectRows(
    'admin lê qualquer perfil',
    adm.client.from('profiles').select('id').eq('id', milB.id),
    1,
  );

  console.log('\nescalada de privilégio — colunas de papel');
  await expectDenied(
    'ninguém se promove a admin',
    milA.client.from('profiles').update({ role: 'admin' }).eq('id', milA.id),
  );
  await expectDenied(
    'militante pendente não se autoconfirma',
    pending.client.from('profiles').update({ membership_status: 'active' }).eq('id', pending.id),
  );
  await expectDenied(
    'ninguém reativa a própria conta desativada',
    milA.client.from('profiles').update({ is_active: true }).eq('id', milA.id),
  );
  {
    // Sessão nova, sem perfil: é o caminho que um atacante com a anon key tem.
    // Depois da mudança "QRCode antes da conta", não existe policy de insert em
    // profiles — perfil nasce só pela RPC redeem_invite.
    const email = `rls-naked-${RUN}@yvy.test`;
    const password = `yvy-${RUN}-naked!`;
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (data.user) {
      created.push(data.user.id);
      const naked = createClient(URL_!, ANON!, { auth: { persistSession: false } });
      await naked.auth.signInWithPassword({ email, password });

      await expectDenied(
        'conta sem convite não cria perfil',
        naked.from('profiles').insert({
          id: data.user.id,
          role: 'militant',
          membership_status: 'active',
          display_name: 'SEM CONVITE',
          ...AREA_A,
        }),
      );
      await expectDenied(
        'perfil não pode nascer admin',
        naked.from('profiles').insert({
          id: data.user.id,
          role: 'admin',
          membership_status: 'active',
          display_name: 'ATACANTE',
          ...AREA_A,
        }),
      );
      {
        const { error } = await naked.rpc('redeem_invite', {
          p_claim: '00000000-0000-4000-8000-000000000000',
          p_full_name: 'Token Inventado',
          p_display_name: 'T.I.',
          p_neighborhood: AREA_A.neighborhood,
          p_city: AREA_A.city,
          p_state: AREA_A.state,
          p_sensitive_consent: true,
        });
        check('token inventado não vira perfil', Boolean(error), error ? '' : 'a RPC aceitou');
      }
    }
  }

  {
    // Convite real gerado pelo militante A: escaneado (reserva, sem conta) e
    // resgatado por conta nova com o segredo da reserva (0035).
    const invite = await admin
      .from('invites')
      .insert({ created_by: milA.id, expires_at: new Date(Date.now() + 3600000).toISOString() })
      .select('token,expires_at,scan_expires_at')
      .single();
    const inv = invite.data as { token: string; expires_at: string; scan_expires_at: string } | null;
    const token = inv?.token;
    check(
      'convite pessoal: servidor corta a janela para 2 min',
      Boolean(inv) && new Date(inv!.scan_expires_at).getTime() - Date.now() <= 2 * 60_000 + 5_000,
      inv?.scan_expires_at,
    );

    const scanner = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const claimed = token ? await scanner.rpc('claim_invite', { p_token: token }) : null;
    const claim = (claimed?.data as { claim: string }[] | null)?.[0]?.claim;
    check('anônimo reserva convite válido ao escanear', Boolean(claim), claimed?.error?.message);
    if (token) {
      const again = await scanner.rpc('claim_invite', { p_token: token });
      check('convite de 1 uso não reserva duas vezes', Boolean(again.error), again.error ? '' : 'reservou de novo');
    }
    await expectDenied('anônimo não lê reservas', anon.from('invite_claims').select('id').limit(1));

    const email = `rls-convidado-${RUN}@yvy.test`;
    const password = `yvy-${RUN}-convidado!`;
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (data.user && token && claim) {
      created.push(data.user.id);
      const guest = createClient(URL_!, ANON!, { auth: { persistSession: false } });
      await guest.auth.signInWithPassword({ email, password });

      {
        const raw = await guest.rpc('redeem_invite', {
          p_claim: token,
          p_full_name: 'Convidado de Teste',
          p_display_name: 'C.T.',
          p_neighborhood: AREA_A.neighborhood,
          p_city: AREA_A.city,
          p_state: AREA_A.state,
          p_sensitive_consent: true,
        });
        check('token do QRCode sem reserva não vira perfil', Boolean(raw.error), raw.error ? '' : 'aceitou token cru');
      }

      const { data: redeemed, error } = await guest.rpc('redeem_invite', {
        p_claim: claim,
        p_full_name: 'Convidado de Teste',
        p_display_name: 'C.T.',
        p_cep: '01001000',
        p_neighborhood: AREA_A.neighborhood,
        p_city: AREA_A.city,
        p_state: AREA_A.state,
        p_sensitive_consent: true,
      });
      check('convite válido cria perfil', !error, error?.message);
      check(
        'quem resgata nasce pendente, não ativo',
        Array.isArray(redeemed) && redeemed[0]?.membership_status === 'pending',
        JSON.stringify(redeemed),
      );
      await expectRows(
        'pendente não lê o feed do bairro',
        guest.from('posts').select('id').eq('status', 'published'),
        0,
      );
      {
        // Reserva já usada, por OUTRA conta nova (a mesma já tem perfil e
        // falharia por isso, sem testar a reserva).
        const email2 = `rls-convidado2-${RUN}@yvy.test`;
        const second = await admin.auth.admin.createUser({ email: email2, password, email_confirm: true });
        if (second.data.user) {
          created.push(second.data.user.id);
          const guest2 = createClient(URL_!, ANON!, { auth: { persistSession: false } });
          await guest2.auth.signInWithPassword({ email: email2, password });
          const again = await guest2.rpc('redeem_invite', {
            p_claim: claim,
            p_full_name: 'Outra Pessoa',
            p_display_name: 'O.P.',
            p_neighborhood: AREA_A.neighborhood,
            p_city: AREA_A.city,
            p_state: AREA_A.state,
            p_sensitive_consent: true,
          });
          check('reserva usada não serve para outra conta', Boolean(again.error), again.error ? '' : 'aceitou de novo');
        }
      }
    }
  }

  await expectDenied(
    'cliente não grava no audit_log',
    adm.client.from('audit_log').insert({ user_id: adm.id, action: 'forjado' }),
  );

  console.log('\nfeed — fechado por dentro');
  await expectRows(
    'militante pendente não lê o feed',
    pending.client.from('posts').select('id').eq('id', postA.id),
    0,
  );
  await expectRows(
    'militante A lê post publicado do bairro A',
    milA.client.from('posts').select('id').eq('id', postA.id),
    1,
  );
  await expectRows(
    'militante B não lê post do bairro A',
    milB.client.from('posts').select('id').eq('id', postA.id),
    0,
  );
  {
    // região imediata (0043). A e B são bairros da mesma cidade inventada (fora
    // do IBGE): cai na comparação pela própria cidade
    const cityPost = (
      await admin
        .from('posts')
        .insert({ author_id: milA.id, content: 'post para a cidade', status: 'published', scope: 'regiao_imediata', ...AREA_A })
        .select('id')
        .single()
    ).data as { id: string };
    await expectRows(
      'militante B lê post de região da mesma cidade',
      milB.client.from('posts').select('id').eq('id', cityPost.id),
      1,
    );
    const otherCity = (
      await admin
        .from('posts')
        .insert({
          author_id: milB.id,
          content: 'post de outra cidade',
          status: 'published',
          scope: 'regiao_imediata',
          ...AREA_A,
          city: OTHER_CITY,
        })
        .select('id')
        .single()
    ).data as { id: string };
    await expectRows(
      'militante A não lê post de região de outra cidade',
      milA.client.from('posts').select('id').eq('id', otherCity.id),
      0,
    );
    // caso real: quem mora em São José dos Pinhais vê post de região de Curitiba
    const curitiba = (
      await admin
        .from('posts')
        .insert({
          author_id: milA.id,
          content: `post para a região de Curitiba ${RUN}`,
          status: 'published',
          scope: 'regiao_imediata',
          neighborhood: 'Centro',
          city: 'Curitiba',
          state: 'PR',
        })
        .select('id')
        .single()
    ).data as { id: string };
    await expectRows(
      'morador de São José dos Pinhais lê post de região de Curitiba',
      sjp.client.from('posts').select('id').eq('id', curitiba.id),
      1,
    );
    await expectRows(
      'morador de Londrina não lê post de região de Curitiba',
      londrina.client.from('posts').select('id').eq('id', curitiba.id),
      0,
    );
    // 0045: seguir região
    const regs = await londrina.client.rpc('list_regions', { p_uf: 'PR' });
    const regList = (regs.data as { regiao_id: number; regiao_nome: string }[] | null) ?? [];
    const cwb = regList.find((x) => x.regiao_nome === 'Curitiba')?.regiao_id;
    check('lista as regiões do PR', regList.length > 20 && !!cwb, regs.error?.message);
    if (cwb) {
      const pf = await pending.client.rpc('follow_region', { p_regiao: cwb, p_follow: true });
      check('pendente não segue região', Boolean(pf.error), pf.error ? '' : 'seguiu');
      const f = await londrina.client.rpc('follow_region', { p_regiao: cwb, p_follow: true });
      check('membro segue outra região', !f.error, f.error?.message);
      await expectRows(
        'quem segue a região de Curitiba lê o post de lá',
        londrina.client.from('posts').select('id').eq('id', curitiba.id),
        1,
      );
      await expectRows(
        'ninguém lê a lista de regiões seguidas de outro',
        sjp.client.from('region_follows').select('user_id').eq('user_id', londrina.id),
        0,
      );
      const others = regList.filter((x) => x.regiao_id !== cwb).slice(0, 5);
      const results = [];
      for (const o of others) results.push(await londrina.client.rpc('follow_region', { p_regiao: o.regiao_id, p_follow: true }));
      check('no máximo 5 regiões seguidas', results.filter((x) => !x.error).length === 4 && Boolean(results[4]?.error));
      await londrina.client.rpc('follow_region', { p_regiao: cwb, p_follow: false });
      await expectRows(
        'deixou de seguir, deixou de ler',
        londrina.client.from('posts').select('id').eq('id', curitiba.id),
        0,
      );
    }
    await admin.from('posts').delete().eq('id', curitiba.id);
    const reg = await sjp.client.rpc('my_region');
    const row = (reg.data as { regiao_nome: string; cidades: string[] }[] | null)?.[0];
    check(
      'my_region de SJP é a região de Curitiba, com as cidades vizinhas',
      row?.regiao_nome === 'Curitiba' && !!row?.cidades.includes('Pinhais'),
      reg.error?.message ?? JSON.stringify(row?.regiao_nome),
    );
    const anonReg = await anon.rpc('my_region');
    check('anônimo não chama my_region', Boolean(anonReg.error), anonReg.error ? '' : 'chamou');
  }
  await expectRows(
    'militante A não lê post pendente (só moderação lê)',
    milA.client.from('posts').select('id').eq('id', postPend.id).eq('status', 'pending'),
    0,
  );
  await expectRows(
    'moderador A lê post pendente do bairro dele',
    modA.client.from('posts').select('id').eq('id', postPend.id),
    1,
  );
  await expectDenied(
    'militante pendente não publica post',
    pending.client.from('posts').insert({ author_id: pending.id, content: 'tentativa de pendente', status: 'pending', ...AREA_A }),
  );
  await expectDenied(
    'militante não publica no bairro de outro',
    milA.client.from('posts').insert({ author_id: milA.id, content: 'tentativa fora de área', status: 'pending', ...AREA_B }),
  );
  await expectDenied(
    'militante não publica já aprovado',
    milA.client.from('posts').insert({ author_id: milA.id, content: 'tentativa de pular moderação', status: 'published', ...AREA_A }),
  );
  await expectDenied(
    'militante comum não modera',
    milA.client.from('posts').update({ status: 'published' }).eq('id', postPend.id).select('id'),
  );

  console.log('\nações');
  await expectRows('militante pendente não lê ação da base', pending.client.from('actions').select('id'), 0);
  await expectRows(
    'militante A lê ação do bairro',
    milA.client.from('actions').select('id').eq('neighborhood', AREA_A.neighborhood),
    1,
  );
  await expectRows(
    'militante B não lê ação do bairro A',
    milB.client.from('actions').select('id').eq('neighborhood', AREA_A.neighborhood),
    0,
  );
  await expectDenied(
    'militante pendente não cria ação',
    pending.client.from('actions').insert({
      title: 'Ação de pendente',
      type: 'outro',
      scheduled_at: new Date().toISOString(),
      created_by: pending.id,
      ...AREA_A,
    }),
  );

  console.log('\nconvites e flags');
  await expectDenied(
    'militante pendente não gera convite',
    pending.client.from('invites').insert({
      created_by: pending.id,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }),
  );
  // 0036: militante comum só convida se alguém liberar
  await expectDenied(
    'militante sem liberação não gera convite',
    milA.client.from('invites').insert({ created_by: milA.id, expires_at: new Date(Date.now() + 3600000).toISOString() }),
  );
  {
    const other = await milB.client.rpc('set_invite_permission', { p_user: milA.id, p_enabled: true });
    check('militante não libera convite para outro', Boolean(other.error), other.error ? '' : 'liberou');
    const grant = await adm.client.rpc('set_invite_permission', { p_user: milA.id, p_enabled: true });
    check('admin libera convite para militante', !grant.error, grant.error?.message);
    const { error } = await milA.client
      .from('invites')
      .insert({ created_by: milA.id, expires_at: new Date(Date.now() + 3600000).toISOString() });
    check('militante liberado gera convite', !error, error?.message);
  }
  await expectRows(
    'militante não lê convite de outro',
    milB.client.from('invites').select('id').eq('created_by', milA.id),
    0,
  );
  {
    const table = await milA.client
      .from('invites')
      .insert({ created_by: milA.id, expires_at: new Date().toISOString(), is_table_qr: true, max_uses: 20 })
      .select('id')
      .single();
    const tableId = (table.data as { id: string } | null)?.id;
    check('militante gera QRCode de mesa', Boolean(tableId), table.error?.message);
    if (tableId) {
      const other = await milB.client.rpc('rotate_table_invite', { p_invite: tableId });
      check('militante não renova QRCode de mesa alheio', Boolean(other.error), other.error ? '' : 'renovou');
      const own = await milA.client.rpc('rotate_table_invite', { p_invite: tableId });
      check('dono renova o próprio QRCode de mesa', !own.error, own.error?.message);
    }
  }
  await expectDenied(
    'militante não liga feature flag',
    milA.client.from('feature_flags').update({ is_enabled: false }).eq('key', 'module_checagem').select('key'),
  );
  await expectRows(
    'militante não lê audit_log',
    milA.client.from('audit_log').select('id').limit(1),
    0,
  );

  console.log('\nRPCs');
  {
    const { error } = await milA.client.rpc('promote_claim_check', { p_id: crypto.randomUUID() });
    check('militante comum não publica checagem por IA', Boolean(error), error ? '' : 'a RPC aceitou');
  }
  {
    const { error } = await anon.rpc('promote_claim_check', { p_id: crypto.randomUUID() });
    check('anônimo não publica checagem por IA', Boolean(error), error ? '' : 'a RPC aceitou');
  }
  {
    // 0044: revisão de post publicado
    const r1 = await milB.client.rpc('send_post_to_review', { p_post: postA.id, p_reason: 'teste de revisão' });
    check('militante comum não manda post para revisão', Boolean(r1.error), r1.error ? '' : 'mandou');
    const r2 = await modA.client.rpc('send_post_to_review', { p_post: postA.id, p_reason: 'teste de revisão' });
    check('moderador manda post publicado para revisão', !r2.error, r2.error?.message);
    await expectRows(
      'post em revisão sai do feed',
      milA.client.from('posts').select('id').eq('id', postA.id).eq('status', 'published'),
      0,
    );
    const u = await milA.client.rpc('unpublish_fact_check', { p_id: crypto.randomUUID() });
    check('militante comum não tira checagem do ar', Boolean(u.error), u.error ? '' : 'tirou');
  }
  {
    // 0041/0044: IA não concluiu, a equipe acha a fonte, publica e depois tira do ar
    const cc = (
      await admin
        .from('claim_checks')
        .insert({
          input_hash: `rls-${RUN}`,
          status: 'done',
          claim_text: 'Afirmação de teste do RLS',
          result: 'unverified',
          explanation: 'A IA não achou fonte.',
          checked_at: new Date().toISOString(),
        })
        .select('id')
        .single()
    ).data as { id: string } | null;
    if (cc) {
      const noSrc = await modA.client.rpc('promote_claim_check', { p_id: cc.id, p_result: 'false' });
      check('não publica checagem sem fonte', Boolean(noSrc.error), noSrc.error ? '' : 'publicou');
      const pub = await modA.client.rpc('promote_claim_check', {
        p_id: cc.id,
        p_result: 'false',
        p_explanation: 'Fonte oficial desmente a afirmação.',
        p_source_url: 'https://www.gov.br/teste',
      });
      check('moderador publica com fonte achada pela equipe', !pub.error, pub.error?.message);
      const factId = pub.data as string | null;
      if (factId) {
        await expectRows('checagem publicada aparece para anônimo', anon.from('fact_checks').select('id').eq('id', factId), 1);
        const off = await modA.client.rpc('unpublish_fact_check', { p_id: factId });
        check('moderador tira checagem do ar', !off.error, off.error?.message);
        await expectRows('checagem tirada do ar some para anônimo', anon.from('fact_checks').select('id').eq('id', factId), 0);
        await admin.from('fact_checks').delete().eq('id', factId);
      }
      await admin.from('claim_checks').delete().eq('id', cc.id);
    }
  }
  {
    // 0044: suspensão. O alvo é o militante pendente do bairro A, que não é
    // usado depois daqui.
    const s1 = await milA.client.rpc('set_member_active', { p_user: pending.id, p_active: false, p_reason: 'teste' });
    check('militante comum não suspende ninguém', Boolean(s1.error), s1.error ? '' : 'suspendeu');
    const s2 = await modA.client.rpc('set_member_active', { p_user: milB.id, p_active: false, p_reason: 'teste' });
    check('moderador não suspende membro de outro bairro', Boolean(s2.error), s2.error ? '' : 'suspendeu');
    const s3 = await modA.client.rpc('set_member_active', { p_user: adm.id, p_active: false, p_reason: 'teste' });
    check('ninguém suspende admin pelo app', Boolean(s3.error), s3.error ? '' : 'suspendeu');
    const s4 = await modA.client.rpc('set_member_active', { p_user: pending.id, p_active: false, p_reason: 'teste' });
    check('moderador suspende membro do bairro dele', !s4.error, s4.error?.message);
    const s5 = await modA.client.rpc('set_member_active', { p_user: pending.id, p_active: true });
    check('moderador não reativa conta', Boolean(s5.error), s5.error ? '' : 'reativou');
    const s6 = await adm.client.rpc('set_member_active', { p_user: pending.id, p_active: true });
    check('admin reativa conta', !s6.error, s6.error?.message);
  }
  {
    const { error } = await milB.client.rpc('decide_invitee', {
      p_invitee: pending.id,
      p_decision: 'active',
    });
    check('quem não convidou não confirma militante', Boolean(error), error ? '' : 'a RPC aceitou');
  }

  // 0046: quem convidou libera o convite do próprio convidado; lista por membro
  {
    const guest = await makeActor('guest', 'militant', 'active', AREA_B);
    await admin.from('profiles').update({ invited_by: milA.id }).eq('id', guest.id);

    const g1 = await milB.client.rpc('set_invite_permission', { p_user: guest.id, p_enabled: true });
    check('quem não convidou não libera convite do convidado', Boolean(g1.error), g1.error ? '' : 'liberou');
    const g2 = await milA.client.rpc('set_invite_permission', { p_user: guest.id, p_enabled: true });
    check('quem convidou libera convite do próprio convidado', !g2.error, g2.error?.message);

    const mine = await milA.client.rpc('my_invitees');
    const row = ((mine.data ?? []) as { id: string; can_invite: boolean }[]).find((r) => r.id === guest.id);
    check('my_invitees mostra que o convidado pode convidar', row?.can_invite === true, mine.error?.message);

    const v1 = await milB.client.rpc('invitees_of', { p_user: milA.id });
    check('militante comum não vê convidados de outro', Boolean(v1.error), v1.error ? '' : 'viu');
    const v2 = await modA.client.rpc('invitees_of', { p_user: milA.id });
    check(
      'moderador vê convidados de membro do bairro dele',
      ((v2.data ?? []) as { id: string }[]).some((r) => r.id === guest.id),
      v2.error?.message,
    );
    const v3 = await modA.client.rpc('invitees_of', { p_user: milB.id });
    check('moderador não vê convidados de outro bairro', Boolean(v3.error), v3.error ? '' : 'viu');
    const v4 = await adm.client.rpc('invitees_of', { p_user: milA.id });
    check('admin vê convidados de qualquer membro', !v4.error && (v4.data ?? []).length > 0, v4.error?.message);
    const v5 = await anon.rpc('invitees_of', { p_user: milA.id });
    check('anônimo não chama invitees_of', Boolean(v5.error), v5.error ? '' : 'chamou');
  }

  // 0047: cada um liga/desliga o próprio aviso por e-mail, e só o próprio
  {
    const own = await milA.client.from('profiles').update({ notify_email: true }).eq('id', milA.id).select('id');
    check('membro liga o próprio aviso por e-mail', !own.error && (own.data ?? []).length === 1, own.error?.message);
    await expectDenied(
      'membro não mexe no aviso por e-mail de outro',
      milA.client.from('profiles').update({ notify_email: false }).eq('id', milB.id).select('id'),
    );
  }

  // 0048: escrita de usuário vai ao log com autor e conteúdo; cliente não lê o log
  {
    const { data } = await admin
      .from('audit_log')
      .select('action, actor_name, metadata')
      .eq('user_id', milA.id)
      .eq('entity_type', 'invite_grants');
    const hit = (data ?? []).find((r) => r.action === 'insert');
    check('escrita do usuário entra no log com apelido', hit?.actor_name === 'MILA', JSON.stringify(data));
    const inv = await admin.from('audit_log').select('metadata').eq('user_id', milA.id).eq('entity_type', 'invites').limit(1);
    const meta = inv.data?.[0]?.metadata as { new?: Record<string, unknown> } | undefined;
    check('log não guarda o token do convite', Boolean(meta?.new) && !('token' in (meta?.new ?? {})), JSON.stringify(meta));
    await expectRows('militante não lê o log', milA.client.from('audit_log').select('id'), 0);
  }

  console.log('\nconversas (0050) — contato aceito, bloqueio, fila cifrada, denúncia');
  {
    const key = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
    const device = async (who: Actor) => {
      const r = await who.client.from('chat_devices').insert({ user_id: who.id, box_pk: key(), sign_pk: key() }).select('id').single();
      return { id: (r.data as { id: string } | null)?.id ?? '', error: r.error };
    };
    const msg = (from: Actor, fromDev: string, to: Actor, toDev: string) => ({
      msg_id: crypto.randomUUID(),
      sender: from.id,
      sender_device: fromDev,
      recipient: to.id,
      recipient_device: toDev,
      nonce: key(),
      body: 'texto-cifrado-de-teste',
    });

    const devA = await device(milA);
    const devB = await device(milB);
    check('membro registra o próprio aparelho', Boolean(devA.id) && Boolean(devB.id), devA.error?.message ?? devB.error?.message);
    await expectDenied(
      'pendente não registra aparelho',
      pending.client.from('chat_devices').insert({ user_id: pending.id, box_pk: key(), sign_pk: key() }).select('id'),
    );
    await expectDenied(
      'ninguém registra aparelho em nome de outro',
      milA.client.from('chat_devices').insert({ user_id: milB.id, box_pk: key(), sign_pk: key() }).select('id'),
    );
    {
      for (let i = 0; i < 6; i++) await device(milB);
      const n = await admin.from('chat_devices').select('id', { count: 'exact', head: true }).eq('user_id', milB.id);
      const still = await admin.from('chat_devices').select('id').eq('id', devB.id);
      check('6º aparelho tira o mais antigo (fica no máximo 5)', n.count === 5 && (still.data ?? []).length === 0, `count=${n.count}`);
      const keep = await device(milB);
      devB.id = keep.id;
    }
    await expectRows('aparelho de outro não aparece direto', milA.client.from('chat_devices').select('id').eq('user_id', milB.id), 0);
    await expectRows('sem contato, chave do outro não sai', milA.client.rpc('chat_peer_devices', { p_peer: milB.id }), 0);
    await expectDenied('sem contato, não manda mensagem', milA.client.from('message_queue').insert(msg(milA, devA.id, milB, devB.id)).select('id'));

    {
      const r = await anon.rpc('chat_new_add_code');
      check('anônimo não gera código de adicionar', Boolean(r.error));
      const p = await pending.client.rpc('chat_new_add_code');
      check('pendente não gera código de adicionar', Boolean(p.error));
    }
    const code = ((await milB.client.rpc('chat_new_add_code')).data as { code: string }[] | null)?.[0]?.code ?? '';
    check('membro gera código de adicionar', code.length === 10, code);
    {
      const own = await milB.client.rpc('chat_request_contact', { p_code: code });
      check('não adiciona o próprio código', Boolean(own.error));
      const bad = await milA.client.rpc('chat_request_contact', { p_code: 'XXXXXXXXXX' });
      check('código inventado não adiciona', Boolean(bad.error));
    }
    const req = await milA.client.rpc('chat_request_contact', { p_code: code.toLowerCase() });
    const contactId = req.data as string | null;
    check('pedido de conversa pelo código', Boolean(contactId) && !req.error, req.error?.message);
    await expectDenied('pedido pendente ainda não deixa mandar', milA.client.from('message_queue').insert(msg(milA, devA.id, milB, devB.id)).select('id'));
    {
      const self = await milA.client.rpc('chat_decide_contact', { p_contact: contactId, p_accept: true });
      check('quem pediu não aceita o próprio pedido', Boolean(self.error));
      const other = await londrina.client.rpc('chat_decide_contact', { p_contact: contactId, p_accept: true });
      check('terceiro não aceita pedido dos outros', Boolean(other.error));
      const ok = await milB.client.rpc('chat_decide_contact', { p_contact: contactId, p_accept: true });
      check('dono do código aceita', !ok.error, ok.error?.message);
    }
    await expectRows('contato aceito: chave dos 5 aparelhos do outro sai', milA.client.rpc('chat_peer_devices', { p_peer: milB.id }), 5);
    await expectRows('terceiro não vê o contato dos outros', londrina.client.from('chat_contacts').select('id'), 0);

    const sent = msg(milA, devA.id, milB, devB.id);
    {
      const r = await milA.client.from('message_queue').insert(sent);
      check('contato aceito manda mensagem', !r.error, r.error?.message);
    }
    await expectDenied(
      'não manda em nome de outro',
      milA.client.from('message_queue').insert({ ...msg(milA, devA.id, milB, devB.id), sender: milB.id, sender_device: devB.id }).select('id'),
    );
    await expectDenied(
      'não usa aparelho de terceiro como destino',
      milA.client.from('message_queue').insert(msg(milA, devA.id, milB, devA.id)).select('id'),
    );
    await expectRows('remetente não lê de volta a fila', milA.client.from('message_queue').select('id').eq('msg_id', sent.msg_id), 0);
    await expectRows('terceiro não lê a fila', modA.client.from('message_queue').select('id').eq('msg_id', sent.msg_id), 0);
    await expectRows('anônimo não lê a fila', anon.from('message_queue').select('id'), 0);
    await expectRows('destinatário lê a fila', milB.client.from('message_queue').select('id').eq('msg_id', sent.msg_id), 1);
    {
      const del = await milB.client.from('message_queue').delete().eq('msg_id', sent.msg_id).select('id');
      check('destinatário apaga ao baixar', (del.data ?? []).length === 1, del.error?.message);
    }
    await expectRows('ninguém lê o log de IP do chat', adm.client.from('chat_access_log').select('user_id'), 0);

    {
      const b = await milB.client.rpc('chat_block', { p_user: milA.id });
      check('bloqueia', !b.error, b.error?.message);
    }
    await expectDenied('bloqueado não manda', milA.client.from('message_queue').insert(msg(milA, devA.id, milB, devB.id)).select('id'));
    await expectDenied('quem bloqueou também não manda', milB.client.from('message_queue').insert(msg(milB, devB.id, milA, devA.id)).select('id'));
    await expectRows('lista de bloqueados de quem bloqueou', milB.client.rpc('chat_blocked_list'), 1);
    await expectRows('bloqueado não sabe quem bloqueou', milA.client.from('chat_blocks').select('blocked'), 0);

    const report = await milB.client.rpc('chat_report', {
      p_reported: milA.id,
      p_messages: [{ id: sent.msg_id, from: milA.id, at: new Date().toISOString(), env: '{}', sig: 'x', dev: devA.id }],
      p_block: true,
    });
    check('denuncia quem conversou', Boolean(report.data) && !report.error, report.error?.message);
    {
      const stranger = await londrina.client.rpc('chat_report', { p_reported: milA.id, p_messages: [], p_block: false });
      check('não denuncia quem nunca conversou', Boolean(stranger.error));
    }
    await expectRows('denunciado não lê a denúncia', milA.client.from('chat_reports').select('id'), 0);
    await expectRows('quem denunciou não relê a denúncia', milB.client.from('chat_reports').select('id'), 0);
    await expectRows('moderador do bairro do denunciado lê', modA.client.from('chat_reports').select('id'), 1);
    await expectRows('admin lê a denúncia', adm.client.from('chat_reports').select('id'), 1);
    {
      const rep = await admin.from('chat_reports').select('sign_keys').eq('id', report.data as string).single();
      const keys = (rep.data?.sign_keys ?? {}) as Record<string, unknown>;
      check('denúncia guarda as chaves de assinatura das duas partes', devA.id in keys && devB.id in keys, JSON.stringify(keys));
      const noPerm = await milA.client.rpc('chat_resolve_report', { p_id: report.data, p_resolution: 'nada' });
      check('denunciado não resolve a denúncia', Boolean(noPerm.error));
      const ok = await modA.client.rpc('chat_resolve_report', { p_id: report.data, p_resolution: 'advertido' });
      check('moderador resolve a denúncia', !ok.error, ok.error?.message);
    }
    {
      await milB.client.rpc('chat_unblock', { p_user: milA.id });
      const r = await milA.client.from('message_queue').insert(msg(milA, devA.id, milB, devB.id));
      check('desbloqueou: volta a mandar', !r.error, r.error?.message);
    }
  }

  console.log('\nMonitor de promessas (0051)');
  {
    const ins = await admin.from('government_plans').insert({
      sq_candidato: PLAN_SQ,
      nome_urna: 'PLANO TESTE',
      cargo: 'Presidente',
      uf: 'BR',
      partido: 'TST',
      pdf_url: 'https://example.org/plano.pdf',
      items: [
        { tema: 'Saúde', texto: 'Trecho literal de teste um.', pagina: 3 },
        { tema: 'Educação', texto: 'Trecho literal de teste dois.', pagina: 7 },
      ],
      verified: true,
    });
    if (ins.error) throw new Error(`government_plans: ${ins.error.message}`);
    const list = await anon.from('plan_promises').select('promise_key,status').eq('sq_candidato', PLAN_SQ).order('position');
    const rows = (list.data ?? []) as { promise_key: string; status: string | null }[];
    check('anônimo lê as promessas do plano', !list.error && rows.length === 2, list.error?.message ?? `recebeu ${rows.length}`);
    check('promessa sem registro vem sem status', rows.every((r) => r.status === null));
    const key = rows[0]?.promise_key ?? 'x';
    const ok = {
      p_sq: PLAN_SQ,
      p_key: key,
      p_status: 'in_progress',
      p_source_url: 'https://www.planalto.gov.br/teste',
      p_evidence_date: '2026-10-01',
      p_note: 'Decreto de teste publicado.',
    };

    await expectRows('anônimo não lê a tabela do histórico', anon.from('plan_promise_updates').select('id'), 0);
    await expectRows('membro não lê a tabela do histórico', milA.client.from('plan_promise_updates').select('id'), 0);
    await expectDenied(
      'moderador não grava direto na tabela',
      modA.client
        .from('plan_promise_updates')
        .insert({ ...{ sq_candidato: PLAN_SQ, promise_key: key, status: 'fulfilled' }, source_url: ok.p_source_url, evidence_date: ok.p_evidence_date, note: 'x' })
        .select('id'),
    );
    {
      const r = await anon.rpc('set_plan_promise_status', ok);
      check('anônimo não muda status de promessa', Boolean(r.error), r.error ? '' : 'mudou');
    }
    {
      const r = await milA.client.rpc('set_plan_promise_status', ok);
      check('membro comum não muda status de promessa', Boolean(r.error), r.error ? '' : 'mudou');
    }
    {
      const r = await modA.client.rpc('set_plan_promise_status', { ...ok, p_source_url: '' });
      check('não muda status sem link da fonte', Boolean(r.error), r.error ? '' : 'mudou');
      const r2 = await modA.client.rpc('set_plan_promise_status', { ...ok, p_note: '  ' });
      check('não muda status sem nota', Boolean(r2.error), r2.error ? '' : 'mudou');
      const r3 = await modA.client.rpc('set_plan_promise_status', { ...ok, p_evidence_date: '2999-01-01' });
      check('não aceita data da prova no futuro', Boolean(r3.error), r3.error ? '' : 'mudou');
      const r4 = await modA.client.rpc('set_plan_promise_status', { ...ok, p_key: 'nao-existe' });
      check('não aceita promessa fora do plano conferido', Boolean(r4.error), r4.error ? '' : 'mudou');
    }
    {
      const r = await modA.client.rpc('set_plan_promise_status', ok);
      check('moderador muda status com prova', !r.error, r.error?.message);
      const r2 = await adm.client.rpc('set_plan_promise_status', { ...ok, p_status: 'fulfilled', p_evidence_date: '2026-10-20' });
      check('admin muda status com prova', !r2.error, r2.error?.message);
      const cur = await anon.from('plan_promises').select('status').eq('promise_key', key).single();
      check('anônimo vê o status mais recente', (cur.data as { status?: string } | null)?.status === 'fulfilled', JSON.stringify(cur.data ?? cur.error));
      const hist = await anon.from('plan_promise_history').select('*').eq('promise_key', key);
      const h = (hist.data ?? []) as Record<string, unknown>[];
      check('anônimo lê o histórico com as duas mudanças', !hist.error && h.length === 2, hist.error?.message ?? `recebeu ${h.length}`);
      check('histórico público não diz quem registrou', h.every((x) => !('created_by' in x)));
      const log = await admin.from('audit_log').select('id').eq('action', 'plan_promise_status').eq('user_id', modA.id);
      check('mudança de status vai ao audit_log', (log.data ?? []).length === 1, log.error?.message);
    }
    {
      await admin.from('government_plans').update({ verified: false }).eq('sq_candidato', PLAN_SQ);
      await expectRows('plano não conferido não aparece', anon.from('plan_promises').select('promise_key').eq('sq_candidato', PLAN_SQ), 0);
      const r = await modA.client.rpc('set_plan_promise_status', ok);
      check('não muda status de plano não conferido', Boolean(r.error), r.error ? '' : 'mudou');
    }
  }

  console.log(`\n${pass} ok, ${failures.length} falhas`);
  if (failures.length) {
    console.log('\nfalhas:');
    for (const f of failures) console.log(` - ${f}`);
  }
}

main()
  .then(teardown)
  .then(() => process.exit(failures.length ? 1 : 0))
  .catch(async (err) => {
    console.error('\nerro no cenário:', err instanceof Error ? err.message : err);
    await teardown();
    process.exit(1);
  });
