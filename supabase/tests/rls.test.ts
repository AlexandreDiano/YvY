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
  await admin.from('posts').delete().eq('city', AREA_A.city);
  await admin.from('posts').delete().eq('city', OTHER_CITY);
  await admin.from('actions').delete().eq('city', AREA_A.city);
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
