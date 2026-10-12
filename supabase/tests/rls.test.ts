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
  const rows = Array.isArray(data) ? data.length : 0;
  check(name, !error && rows === expected, error ? JSON.stringify(error) : `recebeu ${rows}, esperava ${expected}`);
}

/** Espera que a escrita seja barrada (erro, tipicamente 42501). */
async function expectDenied(
  name: string,
  query: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<void> {
  const { error } = await query;
  check(name, Boolean(error), error ? '' : 'a escrita passou');
}

// ---------------------------------------------------------------- cenário

const RUN = Date.now().toString(36);
const AREA_A = { neighborhood: `Teste-A-${RUN}`, city: `Cidade-${RUN}`, state: 'SP' };
const AREA_B = { neighborhood: `Teste-B-${RUN}`, city: `Cidade-${RUN}`, state: 'SP' };

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
  await admin.from('voters').delete().eq('city', AREA_A.city);
  await admin.from('pull_routes').delete().eq('city', AREA_A.city);
  await admin.from('posts').delete().eq('city', AREA_A.city);
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
      .insert({ author_id: milA.id, content: 'post pendente do bairro A', status: 'pending', ...AREA_A })
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

  const voterOfB = (
    await admin
      .from('voters')
      .insert({
        full_name: 'Eleitor Cadastrado Por B',
        zone: '001',
        section: '0002',
        polling_place: 'Escola Teste',
        registered_by: milB.id,
        consent_source: 'militant',
        ...AREA_B,
      })
      .select('id')
      .single()
  ).data as { id: string };

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
  await expectRows('anônimo não lê eleitores', anon.from('voters').select('id').limit(1), 0);
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
          p_token: '00000000-0000-4000-8000-000000000000',
          p_full_name: 'Token Inventado',
          p_display_name: 'T.I.',
          p_neighborhood: AREA_A.neighborhood,
          p_city: AREA_A.city,
          p_state: AREA_A.state,
        });
        check('token inventado não vira perfil', Boolean(error), error ? '' : 'a RPC aceitou');
      }
    }
  }

  {
    // Convite real gerado pelo militante A, resgatado por conta nova.
    const invite = await admin
      .from('invites')
      .insert({ created_by: milA.id, expires_at: new Date(Date.now() + 3600000).toISOString() })
      .select('token')
      .single();
    const token = (invite.data as { token: string } | null)?.token;

    const email = `rls-convidado-${RUN}@yvy.test`;
    const password = `yvy-${RUN}-convidado!`;
    const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (data.user && token) {
      created.push(data.user.id);
      const guest = createClient(URL_!, ANON!, { auth: { persistSession: false } });
      await guest.auth.signInWithPassword({ email, password });

      const { data: redeemed, error } = await guest.rpc('redeem_invite', {
        p_token: token,
        p_full_name: 'Convidado de Teste',
        p_display_name: 'C.T.',
        p_cep: '01001000',
        p_neighborhood: AREA_A.neighborhood,
        p_city: AREA_A.city,
        p_state: AREA_A.state,
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
        const again = await guest.rpc('redeem_invite', {
          p_token: token,
          p_full_name: 'Convidado de Teste',
          p_display_name: 'C.T.',
          p_neighborhood: AREA_A.neighborhood,
          p_city: AREA_A.city,
          p_state: AREA_A.state,
        });
        check('convite de uso único não serve duas vezes', Boolean(again.error), again.error ? '' : 'aceitou de novo');
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
    milA.client.from('posts').update({ status: 'published' }).eq('id', postPend.id),
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

  console.log('\neleitores — dado pessoal de terceiro');
  await expectRows(
    'militante A não lê eleitor cadastrado por B',
    milA.client.from('voters').select('id').eq('id', voterOfB.id),
    0,
  );
  await expectRows(
    'militante pendente não lê a tabela de eleitores',
    pending.client.from('voters').select('id'),
    0,
  );
  await expectRows(
    'quem cadastrou lê o próprio cadastro',
    milB.client.from('voters').select('id').eq('id', voterOfB.id),
    1,
  );
  await expectDenied(
    'ninguém cadastra eleitor no nome de outro militante',
    milA.client.from('voters').insert({
      full_name: 'Eleitor Forjado',
      zone: '001',
      section: '0003',
      polling_place: 'Escola Teste',
      registered_by: milB.id,
      ...AREA_A,
    }),
  );
  await expectDenied(
    'militante não marca voto de eleitor que não é da rota dele',
    milA.client.from('voters').update({ has_voted: true }).eq('id', voterOfB.id),
  );
  await expectRows('admin lê eleitores', adm.client.from('voters').select('id').eq('id', voterOfB.id), 1);

  console.log('\nconvites e flags');
  await expectDenied(
    'militante pendente não gera convite',
    pending.client.from('invites').insert({
      created_by: pending.id,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }),
  );
  {
    const { error } = await milA.client
      .from('invites')
      .insert({ created_by: milA.id, expires_at: new Date(Date.now() + 3600000).toISOString() });
    check('militante confirmado gera convite', !error, error?.message);
  }
  await expectRows(
    'militante não lê convite de outro',
    milB.client.from('invites').select('id').eq('created_by', milA.id),
    0,
  );
  await expectDenied(
    'militante não liga feature flag',
    milA.client.from('feature_flags').update({ is_enabled: true }).eq('key', 'module_puxada'),
  );
  await expectRows(
    'militante não lê audit_log',
    milA.client.from('audit_log').select('id').limit(1),
    0,
  );

  console.log('\nRPCs');
  {
    const { error } = await milA.client.rpc('build_pull_routes', {
      p_neighborhood: AREA_A.neighborhood,
      p_city: AREA_A.city,
      p_state: AREA_A.state,
      p_max: 5,
    });
    check('militante comum não forma rotas', Boolean(error), error ? '' : 'a RPC aceitou');
  }
  {
    const { error } = await modA.client.rpc('build_pull_routes', {
      p_neighborhood: AREA_A.neighborhood,
      p_city: AREA_A.city,
      p_state: AREA_A.state,
      p_max: 5,
    });
    check('coordenador do bairro forma rotas', !error, error?.message);
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
