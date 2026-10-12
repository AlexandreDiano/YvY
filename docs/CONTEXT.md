# YVY — Documento de Contexto para Desenvolvimento
## App de Organização de Base e Mobilização Eleitoral
### Eleições Presidenciais Brasil 2026 — 2º Turno: Lula (PT) × Flávio Bolsonaro (PL)
### Data de criação: 10/10/2026 | Votação: 25/10/2026

---

## 1. VISÃO GERAL

### 1.1 O que é
O **Yvy** é um aplicativo mobile (iOS + Android) de organização de militância,
informação e ação local. "Yvy" vem do guarani e significa **terra**.

Tem dois objetivos simultâneos:

- **Curto prazo (15 dias):** mobilizar a base para o 2º turno presidencial
  (25/10/2026). Puxada de voto, checagem de propostas, logística de votação.
- **Longo prazo (pós-eleição):** infraestrutura permanente de organização de
  base. Acompanhamento de promessas, participação local, memória política.

### 1.2 Contexto político
- 1º turno (04/10/2026): Flávio Bolsonaro (PL) 47,03% × Lula (PT) 45,16%.
  Diferença: ~2,2 milhões de votos.
- Pesquisas de 2º turno (Ipespe, 06–08/10): Flávio 49–52,7% × Lula 44–47,3%.
- A direita está à frente e crescendo. A esquerda precisa de mobilização
  organizada, não apenas de discurso.
- A direita não tem app de organização de base. Tem WhatsApp, Telegram, Instagram.
  O Yvy é a primeira ferramenta digital própria da esquerda brasileira.

### 1.3 Proposta de valor em uma frase
"O app que transforma militantes dispersos em uma máquina de mobilização
local, com informação concreta no lugar de narrativa vaga."

### 1.4 Princípios de design
- **Funcional antes de bonito.** O app precisa funcionar em celular de R$ 800
  com internet 3G. Performance > estética.
- **Anonimato funcional.** Ninguém precisa revelar quem é. Iniciais, bairro,
  nunca nome completo + rua exata.
- **Local antes de nacional.** O feed é por bairro. O mapa é por raio de 2 km.
  A política nacional entra nos cards de proposta, não no feed.
- **Aberto por fora, fechado por dentro.** Conteúdo público (cards, checagem)
  é acessível a todos. Estrutura de mobilização (mapa, feed, ações) é por convite.
- **Código aberto.** Repositório GitHub público. Transparência mata o argumento
  de "propaganda paga".

### 1.5 Identidade visual

| Elemento | Especificação |
|----------|---------------|
| Nome | **YVY** (sempre em caixa alta no logo) |
| Subtítulo | "Do guarani: terra" |
| Cor primária | Verde-terra (#2D5A27) — raiz, chão, crescimento |
| Cor de destaque | Terracota (#C45D3A) — ação, urgência, barro |
| Cor de sucesso | Verde (#2ECC71) |
| Cor de alerta | Amarelo (#F1C40F) |
| Cor de erro | Vermelho (#E74C3C) |
| Fundo | Branco (#FFFFFF) / Areia clara (#FAF8F5) |
| Tipografia | Inter (Google Fonts) — títulos em bold, corpo em regular |
| Ícone do app | Semente brotando do solo (silhueta simples, verde-terra sobre fundo areia) |
| Tagline | "A terra é de quem a organiza." |

**Nota sobre o nome:** "Yvy" é uma palavra do guarani (língua indígena mais
falada no Brasil, ~1,5M de falantes). Significa terra, chão, solo. É a raiz de
*yvyra* (árvore), *yvyporã* (lugar bonito), *Yvy Marãe'õ* (Terra Grande =
América do Sul). O nome não é apropriativo: o guarani é língua viva, falada
em ruas, igrejas e escolas do Brasil. Usar "Yvy" é usar uma palavra que já
pertence ao português brasileiro.

---

## 2. ARQUITETURA DO SISTEMA

### 2.1 Stack técnica

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend (mobile) | React Native + Expo | Um código para iOS e Android. Expo simplifica build e deploy. |
| UI Components | NativeWind (Tailwind para RN) ou React Native Paper | Velocidade de desenvolvimento. |
| Mapa | Mapbox GL JS (via react-native-mapbox-gl) | Gratuito até 100k loads/mês. Melhor rendering que Google Maps em RN. |
| Backend / BaaS | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) | Postgres com RLS (Row Level Security). Realtime para mapa e feed. Auth já integrada. Storage para imagens. Edge Functions para lógica server-side. |
| Banco de dados | PostgreSQL (via Supabase) | Relacional, transacional, RLS nativa. |
| Notificações push | OneSignal | Gratuito até 10k pushes/dia. Simples de integrar. |
| Hospedagem frontend | Expo EAS Build (iOS) + EAS Update (OTA updates) | Sem need de App Store review para patches. |
| Hospedagem backend | Supabase Cloud (plano Pro, ~$25/mês) | Inclui auth, storage, realtime, edge functions. |
| CI/CD | GitHub Actions | Build automático no push. Deploy via EAS. |
| Analytics | PostHog (self-hosted ou cloud free tier) | Event tracking sem depender de Google Analytics. |
| Feature flags | Supabase Edge Function + tabela `feature_flags` | Ligar/desligar módulos sem rebuild do app. |
| QRCode | react-native-qrcode-svg | Geração de QRCode para convites presenciais. |
| OCR (checagem por foto) | Google ML Kit Text Recognition (offline) | Extrai texto de prints de WhatsApp sem enviar imagem ao servidor. |

### 2.2 Diagrama de arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (React Native)                │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Mapa    │ │  Cards   │ │   Feed   │ │  Puxada   │  │
│  │ Mobiliz. │ │Propostas │ │ Local    │ │  de Voto  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│  ┌────┴─────────────┴────────────┴──────────────┴─────┐ │
│  │              SUPABASE CLIENT SDK                    │ │
│  │   (auth + queries + realtime subscriptions)        │ │
│  └────────────────────┬───────────────────────────────┘ │
└────────────────────────┼────────────────────────────────┘
                         │ HTTPS / WebSocket
┌────────────────────────┼────────────────────────────────┐
│                    SUPABASE CLOUD                        │
│                         │                                │
│  ┌──────────────────────┼────────────────────────────┐   │
│  │              POSTGRESQL                          │   │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ │   │
│  │  │ profiles│ │  actions │ │  posts │ │ voters │ │   │
│  │  │         │ │          │ │        │ │        │ │   │
│  │  └─────────┘ └──────────┘ └────────┘ └────────┘ │   │
│  │  + RLS policies em todas as tabelas              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Auth    │ │Realtime  │ │ Storage  │ │Edge Funcs │  │
│  │(phone+  │ │(mapa,    │ │(imagens, │ │(checagem, │  │
│  │ email)  │ │ feed)    │ │ avatares)│ │ notificaç)│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │    OneSignal        │
              │  (push notifications)│
              └─────────────────────┘
```

### 2.3 Decisões de arquitetura e porquês

**Por que Supabase e não Firebase?**
- RLS (Row Level Security) é nativa no Postgres. No Firebase, você escreve
  security rules em uma linguagem própria que é mais frágil.
- Postgres é SQL. Quando precisar de query complexa (ex: "todos os militantes
  num raio de 2 km que confirmaram presença na ação X"), SQL é mais direto.
- Edge Functions permitem lógica server-side sem manter um servidor próprio.
- Realtime é nativo e funciona bem para o mapa e o feed.

**Por que React Native e não Flutter?**
- Ecossistema JavaScript/TypeScript unificado entre mobile e (futuramente) web.
- Se o app precisar de uma versão web (dashboard de coordenação), o mesmo
  código TypeScript serve.
- Expo simplifica o ciclo de build/deploy enormemente.

**Por que Mapbox e não Google Maps?**
- Mapbox tem plano gratuito generoso (100k loads/mês).
- Em React Native, o react-native-mapbox-gl é mais estável que o
  react-native-maps (Google) em termos de clustering e performance.
- Permite customizar o estilo do mapa (cores, ícones) para identidade visual.

**Por que OneSignal e não Firebase Cloud Messaging?**
- FCM exige Firebase como backend. Como estamos usando Supabase, OneSignal
  é independente e tem SDK mais simples para React Native.
- Permite segmentação por tags (ex: "militantes do bairro X") sem lógica extra.

**Linguagem do servidor: TypeScript/Node.js**
- O frontend já é TypeScript (React Native).
- Supabase Edge Functions rodam Deno, que é TypeScript.
- Se precisar de serviço extra (OCR, algoritmo de rotas), Node.js tem
  biblioteca para tudo.
- Um só idioma do início ao fim. Menos context switching, menos bugs de tipo.

---

## 3. MODELO DE DADOS

### 3.1 Tabelas do banco (Postgres / Supabase)

```sql
-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('visitor', 'militant', 'moderator', 'admin');

CREATE TYPE action_type AS ENUM (
  'panfletagem',
  'puxada_voto',
  'mutirao_cadastro',
  'comicio',
  'portas_portas',
  'outro'
);

CREATE TYPE action_status AS ENUM ('draft', 'open', 'confirmed', 'completed', 'cancelled');

CREATE TYPE post_status AS ENUM ('pending', 'published', 'removed', 'flagged');

CREATE TYPE check_result AS ENUM ('true', 'half_true', 'false', 'unverified');

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfil de usuário
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'visitor',
  full_name     TEXT,                          -- só para admin/moderator ver
  display_name  TEXT NOT NULL,                 -- "Camarada J.S." (iniciais)
  phone         TEXT UNIQUE,                   -- para auth por telefone
  email         TEXT UNIQUE,
  cep           TEXT,                          -- CEP (8 dígitos)
  neighborhood  TEXT,                          -- nome do bairro (derivado do CEP)
  city          TEXT,
  state         TEXT,                          -- UF
  location      GEOGRAPHY(POINT, 4326),        -- lat/lng aproximado (precisão de bairro)
  location_precision SMALLINT DEFAULT 3,       -- 1=rua, 2=quadra, 3=bairro, 4=cidade
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  invited_by    UUID REFERENCES profiles(id),  -- quem convidou
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Ações de mobilização
CREATE TABLE actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  type          action_type NOT NULL,
  status        action_status DEFAULT 'draft',
  scheduled_at  TIMESTAMPTZ NOT NULL,
  location_name TEXT,                          -- "Praça da Matriz"
  location      GEOGRAPHY(POINT, 4326),
  neighborhood  TEXT,
  city          TEXT,
  state         TEXT,
  max_participants INT,                        -- NULL = ilimitado
  created_by    UUID NOT NULL REFERENCES profiles(id),
  visibility    TEXT DEFAULT 'base',           -- 'base' = só militantes, 'public' = todos
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Participação em ações
CREATE TABLE action_participants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id     UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'confirmed',      -- 'confirmed', 'pending', 'cancelled'
  checked_in_at TIMESTAMPTZ,                   -- quando a pessoa confirmou presença no dia
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(action_id, user_id)
);

-- Posts no feed local
CREATE TABLE posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES profiles(id),
  content       TEXT NOT NULL,                 -- texto do post (máx 500 chars)
  image_url     TEXT,
  neighborhood  TEXT NOT NULL,                 -- bairro do autor
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  status        post_status DEFAULT 'pending',
  moderator_id  UUID REFERENCES profiles(id),  -- quem moderou
  moderator_note TEXT,                         -- motivo da remoção (se removido)
  flagged_count INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Denúncias de posts
CREATE TABLE post_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  flagger_id    UUID NOT NULL REFERENCES profiles(id),
  reason        TEXT,                          -- 'spam', 'provocacao', 'sem_fonte', 'ofensa', 'outro'
  detail        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, flagger_id)
);

-- Cards de propostas (conteúdo editorial, mantido pela equipe central)
CREATE TABLE proposal_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area          TEXT NOT NULL,                 -- 'trabalho', 'saude', 'educacao', 'judiciario', 'economia', 'meio_ambiente'
  title         TEXT NOT NULL,                 -- "PEC 12: Pagamento por Hora"
  what_they_said TEXT NOT NULL,                -- citação direta com fonte
  source_url    TEXT,
  source_date   DATE,
  what_it_means TEXT NOT NULL,                 -- tradução para o eleitor
  who_is_affected TEXT NOT NULL,               -- "você, seu bairro, seu filho"
  severity      TEXT DEFAULT 'medium',         -- 'low', 'medium', 'high', 'critical'
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Checagem de fatos
CREATE TABLE fact_checks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_text    TEXT NOT NULL,                 -- o que foi checado
  result        check_result NOT NULL,
  explanation   TEXT NOT NULL,                 -- 3 linhas explicando
  source_url    TEXT,
  source_name   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Eleitores para puxada de voto (cadastro aberto no dia 25)
CREATE TABLE voters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  zone          TEXT NOT NULL,                 -- zona eleitoral
  section       TEXT NOT NULL,                 -- seção eleitoral
  polling_place TEXT NOT NULL,                 -- local de votação
  cep           TEXT,
  neighborhood  TEXT,
  city          TEXT,
  state         TEXT,
  location      GEOGRAPHY(POINT, 4326),
  pulled_by     UUID REFERENCES profiles(id),  -- quem vai puxar
  pull_route_id UUID,                          -- grupo de puxada
  has_voted     BOOLEAN DEFAULT FALSE,
  voted_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Rotas de puxada (grupos de até 5 eleitores por puxador)
CREATE TABLE pull_routes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puller_id     UUID NOT NULL REFERENCES profiles(id),
  neighborhood  TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  max_voters    INT DEFAULT 5,
  is_complete   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Convites (QRCode presencial)
CREATE TABLE invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token         UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_by    UUID NOT NULL REFERENCES profiles(id),
  used_by       UUID REFERENCES profiles(id),
  max_uses      INT DEFAULT 1,
  use_count     INT DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  is_table_qr   BOOLEAN DEFAULT FALSE,         -- true = QRCode de mesa (evento)
  event_name    TEXT,                          -- nome do evento (se for QRCode de mesa)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Moderadores por bairro
CREATE TABLE moderators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  neighborhood  TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, neighborhood, city)
);

-- Feature flags
CREATE TABLE feature_flags (
  key           TEXT PRIMARY KEY,
  is_enabled    BOOLEAN DEFAULT FALSE,
  description   TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de auditoria
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id),
  action        TEXT NOT NULL,                 -- 'login', 'create_action', 'approve_post', etc.
  entity_type   TEXT,                          -- 'action', 'post', 'profile', etc.
  entity_id     UUID,
  metadata      JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_profiles_neighborhood ON profiles(neighborhood, city, state) WHERE is_active;
CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
CREATE INDEX idx_actions_location ON actions USING GIST(location);
CREATE INDEX idx_actions_neighborhood ON actions(neighborhood, city, state) WHERE status = 'open';
CREATE INDEX idx_posts_neighborhood ON posts(neighborhood, city, state, created_at DESC) WHERE status = 'published';
CREATE INDEX idx_voters_neighborhood ON voters(neighborhood, city, state);
CREATE INDEX idx_voters_location ON voters USING GIST(location);
CREATE INDEX idx_pull_routes_puller ON pull_routes(puller_id);
CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_expires ON invites(expires_at) WHERE use_count < max_uses;
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderators ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper: função para verificar papel do usuário atual
CREATE OR REPLACE FUNCTION is_militant_or_above() RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'visitor'
  ) IN ('militant', 'moderator', 'admin');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_moderator_for_neighborhood(nh TEXT, city TEXT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM moderators
    WHERE user_id = auth.uid()
      AND neighborhood = nh
      AND city = city
      AND is_active
  );
$$ LANGUAGE sql STABLE;

-- PROFILES
CREATE POLICY "profiles_self" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_militant_same_area" ON profiles
  FOR SELECT USING (
    is_militant_or_above()
    AND neighborhood = (SELECT neighborhood FROM profiles WHERE id = auth.uid())
    AND city = (SELECT city FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_admin_all" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "profiles_update_self" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE USING (is_admin());

CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ACTIONS
CREATE POLICY "actions_public_read" ON actions
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "actions_militant_area" ON actions
  FOR SELECT USING (
    is_militant_or_above()
    AND neighborhood = (SELECT neighborhood FROM profiles WHERE id = auth.uid())
    AND city = (SELECT city FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "actions_creator" ON actions
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "actions_admin_all" ON actions
  FOR SELECT USING (is_admin());

CREATE POLICY "actions_militant_insert" ON actions
  FOR INSERT WITH CHECK (
    is_militant_or_above()
    AND created_by = auth.uid()
  );

CREATE POLICY "actions_creator_update" ON actions
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "actions_admin_update" ON actions
  FOR UPDATE USING (is_admin());

-- ACTION_PARTICIPANTS
CREATE POLICY "participants_self" ON action_participants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "participants_action_creator" ON action_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM actions
      WHERE actions.id = action_id AND actions.created_by = auth.uid()
    )
  );

CREATE POLICY "participants_admin_all" ON action_participants
  FOR SELECT USING (is_admin());

CREATE POLICY "participants_insert" ON action_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "participants_update_self" ON action_participants
  FOR UPDATE USING (user_id = auth.uid());

-- POSTS
CREATE POLICY "posts_published_area" ON posts
  FOR SELECT USING (
    status = 'published'
    AND is_militant_or_above()
    AND neighborhood = (SELECT neighborhood FROM profiles WHERE id = auth.uid())
    AND city = (SELECT city FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "posts_pending_moderator" ON posts
  FOR SELECT USING (
    status = 'pending'
    AND (
      is_moderator_for_neighborhood(neighborhood, city)
      OR is_admin()
    )
  );

CREATE POLICY "posts_author" ON posts
  FOR SELECT USING (author_id = auth.uid());

CREATE POLICY "posts_admin_all" ON posts
  FOR SELECT USING (is_admin());

CREATE POLICY "posts_militant_insert" ON posts
  FOR INSERT WITH CHECK (
    is_militant_or_above()
    AND author_id = auth.uid()
  );

CREATE POLICY "posts_moderator_update" ON posts
  FOR UPDATE USING (
    is_moderator_for_neighborhood(neighborhood, city)
    OR is_admin()
  );

-- PROPOSAL_CARDS
CREATE POLICY "cards_public_read" ON proposal_cards
  FOR SELECT USING (is_active AND auth.uid() IS NOT NULL);

CREATE POLICY "cards_admin_write" ON proposal_cards
  FOR ALL USING (is_admin());

-- FACT_CHECKS
CREATE POLICY "checks_public_read" ON fact_checks
  FOR SELECT USING (is_active AND auth.uid() IS NOT NULL);

CREATE POLICY "checks_admin_write" ON fact_checks
  FOR ALL USING (is_admin());

-- VOTERS
CREATE POLICY "voters_self" ON voters
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "voters_puller" ON voters
  FOR SELECT USING (
    pulled_by = auth.uid()
    OR pull_route_id IN (
      SELECT id FROM pull_routes WHERE puller_id = auth.uid()
    )
  );

CREATE POLICY "voters_admin_all" ON voters
  FOR SELECT USING (is_admin());

CREATE POLICY "voters_insert" ON voters
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "voters_update" ON voters
  FOR UPDATE USING (
    pulled_by = auth.uid()
    OR is_admin()
  );

-- PULL_ROUTES
CREATE POLICY "routes_self" ON pull_routes
  FOR SELECT USING (puller_id = auth.uid());

CREATE POLICY "routes_admin_all" ON pull_routes
  FOR SELECT USING (is_admin());

CREATE POLICY "routes_insert" ON pull_routes
  FOR INSERT WITH CHECK (puller_id = auth.uid() AND is_militant_or_above());

CREATE POLICY "routes_update" ON pull_routes
  FOR UPDATE USING (puller_id = auth.uid() OR is_admin());

-- INVITES
CREATE POLICY "invites_creator" ON invites
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "invites_admin_all" ON invites
  FOR SELECT USING (is_admin());

CREATE POLICY "invites_insert" ON invites
  FOR INSERT WITH CHECK (created_by = auth.uid() AND is_militant_or_above());

-- MODERATORS
CREATE POLICY "moderators_self" ON moderators
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "moderators_admin_all" ON moderators
  FOR SELECT USING (is_admin());

CREATE POLICY "moderators_admin_write" ON moderators
  FOR ALL USING (is_admin());

-- FEATURE_FLAGS
CREATE POLICY "flags_read" ON feature_flags
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "flags_admin_write" ON feature_flags
  FOR ALL USING (is_admin());

-- AUDIT_LOG
CREATE POLICY "audit_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_admin_read" ON audit_log
  FOR SELECT USING (is_admin());
```

### 3.2 Diagrama entidade-relacionamento (resumo)

```
profiles (1) ──── (N) actions              [created_by]
profiles (1) ──── (N) action_participants  [user_id]
actions  (1) ──── (N) action_participants  [action_id]
profiles (1) ──── (N) posts                [author_id]
posts    (1) ──── (N) post_flags           [post_id]
profiles (1) ──── (N) post_flags           [flagger_id]
profiles (1) ──── (N) voters               [pulled_by]
profiles (1) ──── (N) pull_routes          [puller_id]
pull_routes (1) ── (N) voters              [pull_route_id]
profiles (1) ──── (N) invites              [created_by]
profiles (1) ──── (N) invites              [used_by]
profiles (1) ──── (N) moderators           [user_id]
```

---

## 4. FLUXOS DE USUÁRIO

### 4.1 Fluxo: Cadastro como Visitante (Público B)

```
1. Abre o app pela primeira vez.
2. Tela de boas-vindas: "YVY — Do guarani: terra."
   - Botão: "Explorar como visitante"
   - Botão: "Entrar com convite"
3. Clica em "Explorar como visitante".
4. Pede: nome (opcional), telefone (para push), CEP.
5. App deriva bairro/cidade/UF do CEP (API ViaCEP).
6. App cria perfil com role = 'visitor'.
7. Usuário vê:
   ✓ Cards de propostas ("O Que Ele Vai Cortar")
   ✓ Checagem rápida
   ✓ Puxada de voto (cadastro de eleitor)
   ✗ Mapa de mobilização
   ✗ Feed local
   ✗ Ações
8. Banner permanente: "Quer organizar sua base? Peça um convite
   a um camarada." → Botão "Como funciona?"
```

### 4.2 Fluxo: Cadastro como Militante (Público A — por QRCode presencial)

#### Decisão de design

O convite para entrar no Yvy é feito **exclusivamente por QRCode gerado
presencialmente**, nunca por código textual compartilhável.

**Por quê:**
- Código textual vaza: postou no Instagram, é público para sempre.
- Código por influenciador atribui a militância a uma pessoa, não à base.
- QRCode presencial exige as duas pessoas juntas. Não tem como postar.
  Não tem como mandar no WhatsApp (expira em 24h, vale 1 uso).
- Cria relação: as duas pessoas se veem. O militante sabe quem convidou.
  O novo sabe quem o convidou.
- Escala organicamente: cada militante convida 2–3 pessoas. Em 3 semanas,
  10x os iniciais. Sem depender de influenciador.
- É auditável: no banco, cada convite tem quem gerou, quem escaneou,
  timestamp, IP.

#### O papel dos influenciadores

Os influenciadores **não dão código**. Eles fazem outra coisa:

| O que fazem | Como |
|---|---|
| Difundir a existência do app | "Existe um app pra organizar a base. Pede pra um camarada te mostrar." |
| Levar gente ao evento presencial | "Sábado tem mutirão na Praça X. Vai lá, conhece a galera, alguém te mostra o app." |
| Explicar o que é | Vídeo de 60s: "O Yvy é isso. Não é pra você se cadastrar sozinho. É pra você ir num ponto de organização e um camarada te cadastrar." |
| Criar pontos de cadastro | Monta um "ponto Yvy" num evento. 3–5 militantes ficam com o app aberto, gerando QRCode para quem chegar. |

**Regra: o influenciador é o megafone, não a porta.**
Ele grita "tem uma porta ali". Quem abre a porta é o militante local.

#### Fluxo passo a passo

```
Militante (já validado)          Novo camarada
      │                                │
      │  Abre app → "Convidar"         │
      │  Gera QRCode único             │
      │  (vale 1 uso, expira em 24h)   │
      │                                │
      │         ┌──────────┐           │
      │         │  QRCode  │           │
      │         │  (na tela)│          │
      │         └──────────┘           │
      │              ▲                 │
      │              │ escaneia        │
      │         ┌────┴─────┐           │
      │         │  Celular │           │
      │         │  novo    │           │
      │         └──────────┘           │
      │                                │
      │   ◄──── confirmação ──────────►│
      │   [Confirmar] [Rejeitar]       │
```

1. Militante abre app → aba "Perfil" → botão "Convidar camarada".
2. App gera QRCode contendo:
   - Token único (UUID)
   - Expiração: 24h a partir da geração
   - ID do convidador
   - Máximo de usos: 1
3. QRCode aparece na tela com instrução:
   "Peça para o camarada escanear este código."
   Abaixo: "Convite de Camarada J.S." (apelido do convidador).
4. Novo camarada abre o app → tela inicial → "Entrar com convite".
5. Aponta câmera para o QRCode.
6. App valida:
   - Token existe?
   - Expirou? (se sim: "Este convite expirou. Peça outro.")
   - Já foi usado? (se sim: "Este convite já foi utilizado.")
7. Se válido → fluxo de cadastro:
   - Nome completo
   - Telefone
   - CEP (→ deriva bairro/cidade/UF via API ViaCEP)
   - Apelido (sugere iniciais, ex: "J.S.")
   - Precisão da localização (rua / quadra / bairro / cidade)
8. Conta criada com role = 'militant', status = 'pending'.
9. Push para o convidador:
   "Fulano de Tal acabou de entrar com seu convite.
    Bairro: Centro, São Paulo/SP.
    [Confirmar] [Rejeitar]"
10. Convidador confirma em até 24h:
    - Confirmar → status = 'active'. Acesso total à base.
    - Rejeitar → status = 'visitor'. Só conteúdo público.
    - Não responder em 24h → status = 'pending'
      (só conteúdo público até ser confirmado).
11. Novo militante recebe push:
    "Bem-vindo, camarada! Seu convite foi confirmado.
     Toque para ver as ações no seu bairro."

#### Variação para eventos grandes (comícios, mutirões)

Num evento com 200+ pessoas, gerar QRCode um por um é lento.

**QRCode de mesa:**
- O coordenador do evento gera um QRCode "de mesa".
- Vale para **até 20 usos** e expira em **4h**.
- Fica impresso num cartaz na mesa de cadastro.
- Qualquer militante presente pode escanear e indicar.
- No banco, o registro fica:
  "convite da mesa X, evento Y, indicado pelo militante Z".
- O coordenador vê depois quem entrou e valida em lote.

Mantém a regra de presença física (precisa estar no evento para escanear
o cartaz) mas acelera o fluxo para grupos grandes.

#### Regras de ouro

1. **Nunca** exibir o token do convite como texto legível na tela.
   Só QRCode. Fallback (celular sem câmera): token aparece com aviso
   "Este código vale 1 uso e expira em 24h. Não compartilhe."
2. **Nunca** permitir que um mesmo QRCode pessoal seja usado por mais de
   1 pessoa. (QRCode de mesa tem limite explícito de 20.)
3. **Sempre** registrar no banco: quem gerou, quem escaneou, timestamp, IP.
4. **Sempre** dar ao convidador 24h para confirmar/rejeitar.
5. **Nunca** permitir auto-confirmação. O novo militante não confirma a si
   mesmo. O convidador confirma.
6. **Se o convidador desativar a conta**, os convidados pendentes dele
   viram 'visitor' automaticamente.

#### Implementação técnica

**Tabela `invites`:** (ver seção 3.1)

**Edge Function `generate-invite`:**
- Input: `{ type: 'personal' | 'table', event_name?: string }`
- Valida: usuário é militant ou acima.
- Cria registro em `invites` com `expires_at = NOW() + 24h`
  (ou `+ 4h` se for table).
- Retorna: `{ token: UUID, expires_at: ISO }`.
- Frontend gera QRCode a partir do token usando `react-native-qrcode-svg`.

**Edge Function `redeem-invite`:**
- Input: `{ token: UUID, new_user_data: { name, phone, cep } }`
- Valida: token existe, não expirou, não esgotado, usuário não tem conta.
- Cria perfil com role = 'militant', status = 'pending'.
- Incrementa `use_count`. Se `use_count >= max_uses`, marca como usado.
- Dispara push para o convidador.
- Retorna: `{ profile_id, status: 'pending' }`.

**Geração do QRCode no frontend:**
- Biblioteca: `react-native-qrcode-svg`
- O QRCode codifica: `yvy://invite/{token}`
- Tamanho: 250x250 px
- Cor: verde-terra (#2D5A27) sobre branco
- Abaixo do QRCode: "Escaneie para entrar no Yvy" + apelido do convidador

### 4.3 Fluxo: Criar uma Ação de Mobilização

```
1. Militante abre aba "Ações" → botão "+ Nova Ação".
2. Formulário:
   - Título: "Panfletagem na Praça da Matriz"
   - Tipo: panfletagem / puxada de voto / mutirão / comício / portas-portas / outro
   - Descrição: "Levar 200 panfletes. Trazer boné da campanha."
   - Data e hora: 18/10/2026 às 09:00
   - Localização: busca por nome ("Praça da Matriz") → geocodifica
   - Bairro/cidade/UF: preenchidos automaticamente
   - Máximo de participantes: 15 (ou ilimitado)
   - Visibilidade: "Só base" (padrão) / "Público"
3. Salva → status = 'draft'.
4. Militante revisa → clica "Publicar" → status = 'open'.
5. Push para todos os militantes do bairro:
   "Nova ação: Panfletagem na Praça da Matriz — sábado 9h. Toque para confirmar."
6. Militantes tocam → confirmam presença → aparecem no mapa.
7. No dia da ação: push às 8h: "Sua ação começa em 1h. Local: Praça da Matriz."
8. No dia da ação: militantes fazem check-in (botão "Estou aqui").
9. 2h após o horário: ação vira 'completed' automaticamente.
10. Criador pode marcar como 'cancelled' a qualquer momento (com motivo).
```

### 4.4 Fluxo: Feed Local ("Fala Camarada")

```
POSTAR:
1. Militante abre aba "Base" → campo de texto no topo.
2. Escreve post (máx 500 chars). Pode anexar 1 imagem.
3. Clica "Publicar".
4. Post vai para status = 'pending'.
5. Moderadores do bairro recebem push: "Novo post aguardando moderação."
6. Moderador abre → lê → aprova ou remove.
   - Aprovar → status = 'published'. Post aparece no feed do bairro.
   - Remover → status = 'removed'. Autor recebe notificação com motivo.
   - Se nenhum moderador responder em 2h → auto-aprova (status = 'published').
7. Post publicado aparece no feed cronológico dos militantes do bairro.

DENUNCIAR:
1. Qualquer militante do bairro toca "⚑" num post.
2. Escolhe motivo: spam / provocação / sem fonte / ofensa / outro.
3. Opcional: detalhe (100 chars).
4. flag_count incrementa.
5. Se flag_count >= 3 → post vai para status = 'flagged' + push para moderadores.
6. Moderador decide: manter, remover, ou ignorar denúncia.

VER FEED:
1. Militante abre aba "Base".
2. Vê posts publicados do próprio bairro, em ordem cronológica (mais recente no topo).
3. Cada post mostra: apelido do autor ("Camarada J.S."), texto, imagem (se houver),
   tempo ("2h"), bairro.
4. Não mostra: nome completo, rua, foto de perfil (a menos que o autor tenha ativado).
5. Pull-to-refresh. Paginação: 20 posts por página.
```

### 4.5 Fluxo: Puxada de Voto (Dia 25)

```
FASE 1 — CADASTRO DE ELEITORES (15–24/10):
1. Qualquer usuário (visitante ou militante) abre aba "Votar".
2. Preenche: nome completo, zona, seção, local de votação, CEP.
3. App salva em voters.
4. Confirmação: "Você está cadastrado. No dia 25, receberá sua rota de puxada."
5. (Opcional) Militante pode cadastrar vizinhos: "Cadastrar eleitor" →
   mesmo formulário, mas sem criar conta.

FASE 2 — FORMAÇÃO DE ROTAS (24/10, noite):
1. Admin ou coordenador local abre painel "Rotas de Puxada".
2. App agrupa eleitores por proximidade geográfica (bairro + quadra).
3. Algoritmo:
   - Agrupa por CEP (mesmo bairro).
   - Dentro do bairro, agrupa por distância (Haversine) entre locais de votação.
   - Cada rota tem no máximo 5 eleitores.
   - Prioriza eleitores que moram perto do local de votação (caminhada < 10 min).
4. Coordenador atribui rotas a puxadores (militantes do bairro).
5. Puxador recebe push: "Sua rota: 4 eleitores. Rua X, Rua Y, Rua Z.
   Toque para ver detalhes."

FASE 3 — DIA 25:
1. Push às 06:00: "Seu dia de puxada começa. Rota: [nomes + endereços]."
2. Puxador abre app → vê lista de eleitores com nome, endereço, local de votação.
3. Puxador vai de casa em casa (ou liga).
4. Para cada eleitor puxado: toca "Confirmou voto" → has_voted = TRUE,
   voted_at = NOW().
5. Progresso: "3 de 4 confirmados."
6. Ao completar: "Rota completa! Obrigado, camarada." 🎉
7. Painel do coordenador: tempo real de quantos eleitores foram puxados
   por rota, por bairro, por cidade.

FASE 4 — PÓS-VOTAÇÃO:
1. Rotas são arquivadas (não apagadas, mas não visíveis no app).
2. Dados ficam disponíveis para análise (quantos foram puxados, taxa de
   comparecimento por bairro, etc.).
3. Push para todos: "Obrigado por ter organizado a base. Os resultados
   estão na aba 'Resultados'."
```

### 4.6 Fluxo: Checagem Rápida

```
1. Usuário (qualquer papel) abre aba "Checar".
2. Duas opções:
   a) Digita/cola o texto da fake news.
   b) Tira foto de um print (OCR extraí o texto).
3. App envia texto para Edge Function "check-fact".
4. Edge Function:
   - Normaliza texto (minúsculas, remove pontuação).
   - Busca em fact_checks por similaridade (pg_trgm, threshold 0.7).
   - Se encontrar match → retorna resultado + explicação + fonte.
   - Se não encontrar → retorna "Não verificamos este fato ainda."
     + sugestão: "Quer reportar para nossa equipe de checagem?"
5. Tela de resultado:
   - Selo colorido: VERDE (verdade) / AMARELO (meio verdade) / VERMELHO (mentira) / CINZA (não verificado)
   - 3 linhas explicando.
   - Fonte com link.
   - Botão "Compartilhar" → gera imagem com o resultado para WhatsApp.
```

### 4.7 Fluxo: Cards de Propostas ("O Que Ele Vai Cortar")

```
1. Usuário abre aba "Propostas".
2. Vê lista de cards organizados por área:
   - Trabalho
   - Saúde
   - Educação
   - Judiciário
   - Economia
   - Meio Ambiente
3. Toca numa área → expande cards daquela área.
4. Cada card mostra:
   - Título: "PEC 12: Pagamento por Hora"
   - O que ele disse: citação direta + fonte + data
   - O que significa: tradução em linguagem simples
   - Quem é afetado: "você, seu bairro, seu filho"
   - Selo de severidade: 🟡 médio / 🔴 alto / 🔴🔴 crítico
5. Card expande para mostrar detalhes completos.
6. Botão "Compartilhar" → gera imagem do card para WhatsApp.
7. Cards são mantidos pela equipe central (admins editam no painel web).
```

---

## 5. SEGURANÇA E ANONIMATO

### 5.1 Modelos de acesso

| Papel | Quem vê | Quem faz |
|-------|---------|----------|
| **Visitor** | Cards, checagem, puxada de voto | Cadastrar-se como eleitor, checar fatos, compartilhar cards |
| **Militant** | Tudo do visitor + mapa de ações, feed local, criar ações, participar | Criar ações, postar no feed, puxar votos, denunciar posts |
| **Moderator** | Tudo do militant + posts pendentes do bairro, denúncias | Aprovar/remover posts, ver novos cadastros no bairro |
| **Admin** | Tudo + todos os bairros, audit log, feature flags, cards, checagens | Gerenciar moderadores, editar cards, gerenciar feature flags, ver analytics |

### 5.2 Regras de anonimato

| Dado | Visitor | Militant | Moderator | Admin |
|------|---------|----------|-----------|-------|
| Nome completo | Próprio | Próprio | Próprio | Todos |
| Apelido (iniciais) | — | Todos do bairro | Todos do bairro | Todos |
| CEP | Próprio | Próprio | Próprio | Todos |
| Bairro | Próprio | Todos do bairro | Todos do bairro | Todos |
| Rua exata | Nunca | Nunca (a menos que o militante ative) | Nunca | Nunca |
| Telefone | Próprio | Próprio | Próprio | Todos |
| Foto de perfil | Opcional | Opcional (desativada por padrão) | Opcional | Opcional |

### 5.3 Medidas técnicas de segurança

1. **TLS 1.3** em todas as conexões (Supabase já faz).
2. **Row Level Security** ativa em todas as tabelas (ver schema acima).
3. **Hash de senha:** Argon2id (padrão do Supabase Auth).
4. **Sessões:** token JWT com expiração de 1h. Refresh token com rotação.
5. **Rate limiting:** 60 requests/min por usuário na API. 100/min por IP.
6. **Criptografia local:** dados sensíveis no dispositivo (nome completo + CEP)
   armazenados em Keychain (iOS) / Keystore (Android) via react-native-keychain.
7. **Logs de auditoria:** toda ação relevante (login, criar ação, moderar post,
   mudar papel) é logada em audit_log com IP e timestamp. Retenção: 90 dias.
8. **Backups:** diários, criptografados, em região AWS diferente da principal.
9. **Secrets:** chaves de API em environment variables (Expo constants +
   Supabase env vars). Nunca no código.
10. **CORS:** restrito ao domínio do app.
11. **HTTPS only:** HSTS header ativo.
12. **App attestation:** (opcional, fase 2) verificar que o app não foi
    descompilado/modificado antes de liberar dados sensíveis.

### 5.4 Plano de contingência para invasão

| Cenário | Ação |
|---------|------|
| 10+ cadastros novos num bairro em 24h | Push automático para moderadores: "Atenção: N novos cadastros no seu bairro." Moderadores validam/rejeitam. |
| Post provocativo no feed | Moderação remove em < 2h. Sem resposta pública. Silêncio. |
| Print do mapa compartilhado | Post calmo no feed: "Nosso mapa mostra bairros, não ruas. Se viu um print, fale com seu moderador." |
| Militante vira | Conta desativada por admin. Dados criados ficam. Dados vistos não são rastreáveis. |
| DDoS | Supabase + Vercel têm proteção básica. Página de status: "Instabilidade detectada. Equipe trabalhando." |
| Bug que vaza dados | Feature flag desliga o módulo afetado. Patch em < 4h. Comunicado transparente. |
| Ataque à API (injeção, etc.) | Supabase usa prepared statements. RLS impede acesso cruzado. Edge Functions validam input. |

---

## 6. CONTEÚDO EDITORIAL

### 6.1 Cards de Propostas — Conteúdo Inicial

Estes são os cards que a equipe central publica no lançamento.
Cada card tem: área, título, o que ele disse (citação + fonte + data),
o que significa, quem é afetado, severidade.

#### TRABALHO

**Card 1: PEC 12 — Pagamento por Hora**
- O que ele disse: "Flexibilizar a CLT para permitir o pagamento por hora (PEC 12/2026)."
  Fonte: Plano de governo, setembro/2026.
- O que significa: O trabalhador só recebe pelas horas efetivamente trabalhadas.
  Na escala 5×2, o salário mínimo pode cair de R$ 1.518 para R$ 1.297.
  Férias, 13º e FGTS continuam, mas a base de cálculo muda.
- Quem é afetado: Todo trabalhador CLT, especialmente quem faz escala 6x1
  ou 5x2. Você, seu filho, seu vizinho.
- Severidade: 🔴🔴 Crítico

**Card 2: Fim da 6x1? Não.**
- O que ele disse: A campanha de Flávio chama o debate da escala 6x1 de
  "tentativa de mudar o foco". O plano de governo NÃO propõe acabar com a 6x1.
  Fonte: R7, 27/08/2026.
- O que significa: Enquanto Lula promete fim da 6x1, Flávio quer o contrário:
  pagamento por hora, que na prática reduz a renda de quem trabalha 6 dias.
- Quem é afetado: Trabalhadores de comércio, serviços, saúde, educação.
- Severidade: 🔴 Alto

**Card 3: Contrato Jovem (18–24 anos)**
- O que ele disse: "Criar contratos de trabalho para jovens de 18 a 24 anos
  em busca do primeiro emprego." Fonte: Plano de governo.
- O que significa: Contrato com regras diferentes da CLT para jovens.
  Na prática: salário menor, menos direitos, mais fácil demitir.
- Quem é afetado: Jovens que entram no mercado de trabalho.
- Severidade: 🟡 Médio

#### SAÚDE

**Card 4: "Plano Real da Saúde"**
- O que ele disse: "Reformular o SUS, alterando o financiamento e valorizando
  os profissionais de saúde. Contratar serviços e exames na rede privada
  nos horários ociosos." Fonte: Plano de governo.
- O que significa: "Reformular o financiamento" = mudar de onde vem o dinheiro
  do SUS. "Contratar rede privada" = o SUS paga particular. Tradução:
  menos investimento em hospital público, mais convênio com privado.
- Quem é afetado: Quem depende do SUS. Ou seja: a maioria do Brasil.
- Severidade: 🔴 Alto

**Card 5: Prontuário Eletrônico Único**
- O que ele disse: "Estabelecer o prontuário eletrônico único, vinculado ao
  CPF e integrado ao Gov.br." Fonte: Plano de governo.
- O que significa: Seus dados de saúde ficam num sistema único, ligado ao
  seu CPF, acessível pelo governo. Conveniente? Sim. Risco de vigilância?
  Também.
- Quem é afetado: Todo cidadão.
- Severidade: 🟡 Médio

#### EDUCAÇÃO

**Card 6: Voucher Escolar**
- O que ele disse: "Criar 'voucher' para escolas particulares em locais em
  que faltam vagas em escolas públicas." Fonte: Plano de governo.
- O que significa: O dinheiro público que iria para a escola pública vai para
  a escola particular. A escola pública perde recurso. A particular ganha
  cliente. Ciclo de privatização gradual.
- Quem é afetado: Alunos da escola pública e seus pais.
- Severidade: 🔴 Alto

**Card 7: Escolas Cívico-Militares**
- O que ele disse: "Ampliar escolas cívico-militares." Fonte: Plano de governo.
- O que significa: Mais escolas sob comando militar. Uniforme, hierarquia,
  disciplina. Menos autonomia pedagógica.
- Quem é afetado: Alunos e professores.
- Severidade: 🟡 Médio

#### JUDICIÁRIO

**Card 8: Anistia do 8 de Janeiro**
- O que ele disse: "Anistiar os envolvidos no 8 de janeiro de 2023, incluindo
  os condenados pelo STF como seu pai, Jair Bolsonaro." Fonte: Plano de governo.
- O que significa: Quem invadiu os três poderes em 8/1/2023 sai da prisão.
  Jair Bolsonaro, condenado, é anistiado. O precedente: crime político
  comete-se sem consequência.
- Quem é afetado: A democracia. O estado de direito. Você.
- Severidade: 🔴🔴 Crítico

**Card 9: Limitar o STF**
- O que ele disse: "Extinguir as competências criminais originárias do STF.
  Limitar as decisões monocráticas do STF. Indicar 'patriotas' para vagas no STF."
  Fonte: Plano de governo.
- O que significa: O STF perde poder para julgar crimes de autoridades.
  Decisões de um único ministro perdem força. Novos ministros são escolhidos
  por afinidade política, não por mérito jurídico.
- Quem é afetado: Quem depende do Judiciário para conter o Executivo.
- Severidade: 🔴🔴 Crítico

**Card 10: Acabar com a Reeleição**
- O que ele disse: "Acabar com a reeleição." Fonte: Plano de governo.
- O que significa: Ninguém pode ser reeleito para o mesmo cargo. Parece justo.
  Mas na prática: o presidente não pode se reeleger, então o vice (ou aliado)
  vira o candidato natural. Cria dinastias de outra forma.
- Quem é afetado: O sistema político como um todo.
- Severidade: 🟡 Médio

#### ECONOMIA

**Card 11: Cortar 10+ Ministérios**
- O que ele disse: "Reduzir os ministérios, corte de cargos comissionados e
  enxugamento da máquina pública." Fonte: Plano de governo. Forbes: "cortar
  ao menos dez ministérios."
- O que significa: Menos ministérios = menos políticas públicas específicas.
  Quem perde: ministérios ligados a saúde, educação, assistência social,
  meio ambiente. Quem ganha: "eficiência" (sem detalhar onde).
- Quem é afetado: Servidores públicos, programas sociais, políticas setoriais.
- Severidade: 🔴 Alto

**Card 12: Suspender Reforma Tributária**
- O que ele disse: "Suspender por um ano a entrada em vigor da reforma
  tributária." Fonte: Plano de governo.
- O que significa: A reforma tributária (que simplifica impostos sobre
  consumo) fica parada por 1 ano. Empresas ganham prazo. Consumidor continua
  pagando o mesmo.
- Quem é afetado: Empresas (ganham), consumidores (perdem clareza).
- Severidade: 🟡 Médio

**Card 13: Retomar Desestatização**
- O que ele disse: "Retomar o Programa Nacional de Desestatização."
  Fonte: Plano de governo.
- O que significa: Privatizar estatais. O coordenador econômico (Adolfo
  Sachsida) descarta privatizar Petrobras, BB e Caixa "por enquanto",
  mas o programa está de volta.
- Quem é afetado: Acionistas (ganham), trabalhadores das estatais (risco),
  usuários de serviços públicos (risco de aumento de preço).
- Severidade: 🔴 Alto

#### MEIO AMBIENTE

**Card 14: Eliminar Sobreposições Ibama/Funai/ICMBio**
- O que ele disse: "Eliminar superposições entre Ibama, Funai e ICMBio."
  Fonte: Plano de governo.
- O que significa: Três órgãos que fiscalizam meio ambiente e terras indígenas
  viram um. Menos fiscalização. Menos proteção. Mais abertura para
  agronegócio e mineração.
- Quem é afetado: Florestas, rios, povos indígenas, clima.
- Severidade: 🔴 Alto

### 6.2 Base de Checagem — Itens Iniciais

| Claim | Resultado | Explicação | Fonte |
|-------|-----------|------------|-------|
| "Flávio vai privatizar a Petrobras" | Meio verdade | O coordenador econômico descarta privatizar Petrobras, BB e Caixa "por enquanto", mas o programa de desestatização está de volta. | Forbes, 10/2026 |
| "Flávio vai cortar o Bolsa Família" | Mentira | O plano de governo diz "manter programas assistenciais existentes". O que muda é o piso do BPC (só inflação, sem aumento real). | Plano de governo |
| "Lula quer aumentar impostos" | Meio verdade | Lula propõe manter o arcabouço fiscal e fazer concessões em infraestrutura. Não há proposta de novo imposto, mas a reforma tributária (suspensa por Flávio) muda a alíquota de consumo. | Invest News, 10/2026 |
| "Flávio vai acabar com o SUS" | Exagero | Ele propõe "reformular o financiamento" e contratar rede privada. Não é extinção, mas é mudança estrutural que reduz o papel do SUS. | Plano de governo |
| "Lula é responsável pela inflação" | Meio verdade | A inflação é multifatorial (ciclo global, câmbio, energia). Lula mantém o arcabouço fiscal, mas o BC controla a taxa de juros. Culpar só o governo é simplificar. | Banco Central, 2026 |
| "Flávio vai anistiar só o pai" | Mentira | A anistia proposta cobre TODOS os envolvidos no 8 de janeiro, incluindo condenados pelo STF. Jair Bolsonaro é um deles, mas não o único. | Plano de governo |

---

## 7. TELAS DO APP (Wireframe Textual)

### 7.1 Estrutura de navegação

```
Bottom Tab Bar (5 abas):
┌─────────────────────────────────────────────────────────┐
│  [Início]  [Ações]  [Base]  [Votar]  [Perfil]          │
│   🏠        📍      💬       🗳️      👤                 │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Tela: Início (Home)

```
┌─────────────────────────────────────────┐
│  YVY                   [🔔] [👤]        │
│  Do guarani: terra                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  📊 14 dias para o 2º turno      │  │
│  │  Votação: 25/10/2026             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── O QUE ELE VAI CORTAR ──             │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔴🔴 PEC 12: Pagamento por Hora   │  │
│  │ Seu salário pode cair R$ 221      │  │
│  │ [Toque para ver detalhes →]       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔴🔴 Anistia do 8 de Janeiro      │  │
│  │ Crime político sem consequência   │  │
│  │ [Toque para ver detalhes →]       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔴   Voucher Escolar              │  │
│  │ Dinheiro público → escola privada │  │
│  │ [Toque para ver detalhes →]       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Ver todas as propostas →]             │
│                                         │
│  ── CHECAR FAKE NEWS ──                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Colou um print? Cheque aqui.  │  │
│  │ [Checar agora]                    │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── AÇÕES NO SEU BAIRRO ──              │
│  (só para militantes)                   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📍 Panfletagem — Praça Matriz    │  │
│  │ Sáb 18/10, 9h · 8/15 confirmados │  │
│  │ [Confirmar presença]              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 📍 Mutirão Cadastro — CEF Centro │  │
│  │ Dom 19/10, 14h · 3/10 confirm.   │  │
│  │ [Confirmar presença]              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Ver mapa de ações →]                  │
│                                         │
└─────────────────────────────────────────┘
```

### 7.3 Tela: Ações (Mapa)

```
┌─────────────────────────────────────────┐
│  AÇÕES NO SEU BAIRRO       [+ Nova]    │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │         MAPA INTERATIVO           │  │
│  │                                   │  │
│  │    📍 ● ●  (ações abertas)       │  │
│  │       ●                           │  │
│  │    ●          (você está aqui)    │  │
│  │                                   │  │
│  │  Legenda:                         │  │
│  │  🟢 Ação aberta                   │  │
│  │  🔵 Ação confirmada por você     │  │
│  │  ⚪ Você                          │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Filtro: [Todos] [Panfletagem] [Puxada]│
│         [Mutirão] [Comício] [Portas]   │
│                                         │
│  ── LISTA ──                            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Panfletagem — Praça Matriz       │  │
│  │ Sáb 18/10, 9h                     │  │
│  │ 8/15 confirmados                  │  │
│  │ [Detalhes] [Confirmar]            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Mutirão Cadastro — CEF Centro    │  │
│  │ Dom 19/10, 14h                    │  │
│  │ 3/10 confirmados                  │  │
│  │ [Detalhes] [Confirmar]            │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### 7.4 Tela: Base (Feed Local)

```
┌─────────────────────────────────────────┐
│  BASE — Seu Bairro          [⚙️]       │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Escreva algo...           [📷] [→]│  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── HOJE ──                             │
│                                         │
│  Camarada M.A. · 2h ago                 │
│  ┌───────────────────────────────────┐  │
│  │ Alguém sabe se a creche da Rua   │  │
│  │ das Flores vai abrir segunda?    │  │
│  │ Meus filhos precisam. 🙏         │  │
│  └───────────────────────────────────┘  │
│  [💬 3]  [🔁 Compartilhar]  [⚑]        │
│                                         │
│  Camarada R.P. · 5h ago                 │
│  ┌───────────────────────────────────┐  │
│  │ [Imagem: panfleto na rua]        │  │
│  │ Vi esse panfleto na minha rua.   │  │
│  │ Alguém sabe de quem é?           │  │
│  └───────────────────────────────────┘  │
│  [💬 7]  [🔁 Compartilhar]  [⚑]        │
│                                         │
│  ── ONTEM ──                            │
│                                         │
│  Camarada J.S. · Ontem, 18:32           │
│  ┌───────────────────────────────────┐  │
│  │ A panfletagem de sábado foi      │  │
│  │ excelente! 12 pessoas foram.     │  │
│  │ Obrigado a todos. 👊             │  │
│  └───────────────────────────────────┘  │
│  [💬 5]  [🔁 Compartilhar]  [⚑]        │
│                                         │
│  [Carregar mais...]                     │
│                                         │
└─────────────────────────────────────────┘
```

### 7.5 Tela: Votar (Puxada de Voto)

```
┌─────────────────────────────────────────┐
│  VOTAR — 25/10/2026                     │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  🗳️ 14 dias para votar           │  │
│  │  Dom, 25/10/2026                  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── CADASTRAR ELEITOR ──                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Nome:    [___________________]    │  │
│  │ Zona:    [____]                   │  │
│  │ Seção:   [____]                   │  │
│  │ Local:   [___________________]    │  │
│  │ CEP:     [________]               │  │
│  │                                     │  │
│  │ [Cadastrar]                        │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── MINHA ROTA DE PUXADA ──             │
│  (aparece a partir de 24/10)            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Sua rota: 4 eleitores             │  │
│  │                                     │  │
│  │ 1. Maria da Silva                  │  │
│  │    Rua X, 123                      │  │
│  │    Vota em: Escola Municipal A     │  │
│  │    [☐ Confirmou voto]             │  │
│  │                                     │  │
│  │ 2. João Pereira                    │  │
│  │    Rua Y, 456                      │  │
│  │    Vota em: Escola Municipal A     │  │
│  │    [☐ Confirmou voto]             │  │
│  │                                     │  │
│  │ 3. Ana Costa                       │  │
│  │    Rua Z, 789                      │  │
│  │    Vota em: CEM B                  │  │
│  │    [☐ Confirmou voto]             │  │
│  │                                     │  │
│  │ 4. Carlos Santos                   │  │
│  │    Rua W, 321                      │  │
│  │    Vota em: CEM B                  │  │
│  │    [☐ Confirmou voto]             │  │
│  │                                     │  │
│  │ Progresso: 0/4                      │  │
│  │ [██████████░░░░░░░░░░] 0%          │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── PAINEL DO COORDENADOR ──            │
│  (só para moderadores/admins)           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Bairro: Centro                    │  │
│  │ Eleitores cadastrados: 340        │  │
│  │ Rotas formadas: 68                │  │
│  │ Puxadores atribuídos: 52/68       │  │
│  │ Votos confirmados: 0/340          │  │
│  │ [Gerenciar rotas →]               │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### 7.6 Tela: Perfil

```
┌─────────────────────────────────────────┐
│  PERFIL                                 │
├─────────────────────────────────────────┤
│                                         │
│  Camarada J.S.                          │
│  Bairro: Centro · São Paulo/SP          │
│  Papel: Militant                        │
│  Membro desde: 10/10/2026               │
│                                         │
│  ── MINHAS INFORMAÇÕES ──               │
│                                         │
│  Nome:    [_______________] [Editar]    │
│  Telefone:[_______________] [Editar]    │
│  E-mail:  [_______________] [Editar]    │
│  CEP:     [________]        [Editar]    │
│  Precisão da localização: [Bairro ▼]   │
│                                         │
│  ── CONVIDAR ──                         │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ [Gerar QRCode de convite]        │  │
│  │                                     │  │
│  │ O QRCode vale 1 uso e expira      │  │
│  │ em 24h. Compartilhe presencial-   │  │
│  │ mente com um camarada.            │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── NOTIFICAÇÕES ──                     │
│                                         │
│  [🔔 Ativas]  [Configurar →]           │
│                                         │
│  ── SOBRE ──                            │
│                                         │
│  [Quem somos →]                         │
│  [Privacidade →]                        │
│  [Código-fonte (GitHub) →]              │
│  [Termos de uso →]                      │
│                                         │
│  [Sair]                                 │
│                                         │
└─────────────────────────────────────────┘
```

### 7.7 Tela: Detalhe de Card de Proposta

```
┌─────────────────────────────────────────┐
│  ← Voltar                               │
├─────────────────────────────────────────┤
│                                         │
│  🔴🔴 CRÍTICO                           │
│                                         │
│  PEC 12: Pagamento por Hora             │
│  Área: Trabalho                          │
│                                         │
│  ── O QUE ELE DISSE ──                  │
│  ┌───────────────────────────────────┐  │
│  │ "Flexibilizar a CLT para permitir│  │
│  │  o pagamento por hora (PEC 12/   │  │
│  │  2026)."                         │  │
│  │                                     │  │
│  │ Fonte: Plano de governo,          │  │
│  │ setembro/2026                     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── O QUE SIGNIFICA ──                  │
│  O trabalhador só recebe pelas horas    │
│  efetivamente trabalhadas. Na escala    │
│  5×2, o salário mínimo pode cair de    │
│  R$ 1.518 para R$ 1.297. Férias, 13º   │
│  e FGTS continuam, mas a base de        │
│  cálculo muda.                          │
│                                         │
│  ── QUEM É AFETADO ──                   │
│  Todo trabalhador CLT, especialmente    │
│  quem faz escala 6x1 ou 5x2.           │
│  Você, seu filho, seu vizinho.          │
│                                         │
│  ── COMPARAÇÃO COM LULA ──              │
│  Lula propõe o fim da escala 6x1       │
│  (PEC em tramitação no Senado).        │
│  Flávio propõe o oposto: pagamento     │
│  por hora, que reduz a renda de        │
│  quem trabalha 6 dias.                 │
│                                         │
│  [🔁 Compartilhar]  [🔗 Copiar link]   │
│                                         │
└─────────────────────────────────────────┘
```

### 7.8 Tela: Checagem de Fatos

```
┌─────────────────────────────────────────┐
│  CHECAR FAKE NEWS                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  [Colar ou digite o texto aqui]  │  │
│  │                                   │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Ou: [📷 Tirar foto do print]           │
│                                         │
│  [Checar]                               │
│                                         │
│  ── RESULTADO ──                        │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  ❌ MENTIRA                       │  │
│  │                                     │  │
│  │  "Flávio vai cortar o Bolsa       │  │
│  │   Família"                         │  │
│  │                                     │  │
│  │  O plano de governo diz "manter   │  │
│  │  programas assistenciais           │  │
│  │  existentes". O que muda é o      │  │
│  │  piso do BPC (só inflação).       │  │
│  │                                     │  │
│  │  Fonte: Plano de governo,         │  │
│  │ setembro/2026                     │  │
│  │                                     │  │
│  │  [🔁 Compartilhar resultado]      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ── RECENTES ──                         │
│                                         │
│  ✅ "Lula vai aumentar o salário       │
│     mínimo para R$ 2.000"              │
│     → Meio verdade. Proposta é         │
│     R$ 1.800, não R$ 2.000.            │
│                                         │
│  ❌ "Flávio vai privatizar a           │
│     Petrobras amanhã"                  │
│     → Mentira. Sachsida descarta       │
│     privatização "por enquanto".       │
│                                         │
└─────────────────────────────────────────┘
```

---

## 8. NOTIFICAÇÕES PUSH

### 8.1 Estratégia

| Gatilho | Mensagem | Frequência |
|---------|----------|------------|
| Nova ação no bairro | "Nova ação: {título} — {dia}, {hora}. Toque para confirmar." | Immediata |
| Ação em 24h | "Sua ação {título} começa amanhã às {hora}. Local: {local}." | 1x |
| Ação em 1h | "Sua ação começa em 1h. {local}. Estará lá?" | 1x |
| Dia da ação (6h) | "Hoje: {título}. {local}. Boa mobilização!" | 1x |
| Novo post no feed (se notificações ativas) | "Novo post no seu bairro: {primeiros 50 chars}..." | Máx 3/dia |
| Post aprovado (autor) | "Seu post foi publicado." | 1x |
| Post removido (autor) | "Seu post foi removido. Motivo: {motivo}." | 1x |
| Convite aceito (convidador) | "{Nome} aceitou seu convite e entrou no Yvy de {bairro}." | 1x |
| Convite pendente (convidador) | "{Nome} está pendente. Confirme em 24h." | 1x + lembrete 12h |
| Denúncia recebida (moderador) | "Post denunciado no seu bairro. Toque para moderar." | Immediata |
| Rota de puxada atribuída | "Sua rota: {N} eleitores. Toque para ver detalhes." | 1x |
| Dia 25 (6h) | "Seu dia de puxada. {N} eleitores. Boa sorte, camarada!" | 1x |
| Resultado da eleição | "A apuração começou. Toque para acompanhar." | 1x |

### 8.2 Configurações do usuário

- [x] Notificações de ações (padrão: ON)
- [ ] Notificações de feed (padrão: OFF)
- [x] Notificações de puxada de voto (padrão: ON)
- [x] Notificações importantes (convites, moderação) (padrão: ON, não pode desligar)

---

## 9. CRONOGRAMA DE DESENVOLVIMENTO

### Fase 0 — Fundação (Dias 1–2)
- [ ] Criar repositório GitHub (público)
- [ ] Setup do projeto Expo (React Native + TypeScript)
- [ ] Setup do Supabase (projeto, tabelas, RLS, índices)
- [ ] Configurar CI/CD (GitHub Actions → EAS Build)
- [ ] Definir identidade visual (cores, tipografia, ícones)
  - Cor primária: verde-terra (#2D5A27)
  - Cor de destaque: terracota (#C45D3A)
  - Cor de sucesso: verde (#2ECC71)
  - Cor de alerta: amarelo (#F1C40F)
  - Cor de erro: vermelho (#E74C3C)
  - Fundo: branco (#FFFFFF) / areia clara (#FAF8F5)
  - Tipografia: Inter (Google Fonts)
  - Ícone: semente brotando do solo
- [ ] Criar tela de splash + onboarding (3 telas)

### Fase 1 — Auth + Perfil (Dias 3–4)
- [ ] Tela de login/cadastro (telefone + e-mail)
- [ ] Fluxo de convite por QRCode (gerar → escanear → confirmar)
- [ ] Tela de perfil (editar dados, precisão de localização)
- [ ] RLS policies testadas
- [ ] Testes: cadastro visitante, cadastro militante, fluxo de QRCode

### Fase 2 — Cards de Propostas (Dias 5–6)
- [ ] Tela de listagem de cards (por área)
- [ ] Tela de detalhe do card
- [ ] Painel admin (web) para criar/editar cards
- [ ] Seed dos 14 cards iniciais
- [ ] Botão de compartilhar (gera imagem via react-native-share)
- [ ] Testes: navegação, compartilhamento, filtro por área

### Fase 3 — Mapa de Ações (Dias 7–8)
- [ ] Integração Mapbox (mapa interativo)
- [ ] Tela de listagem de ações (com filtro por tipo)
- [ ] Formulário de criação de ação
- [ ] Confirmação de presença
- [ ] Realtime: ações aparecem no mapa em tempo real
- [ ] Testes: criar ação, confirmar, ver no mapa, filtro

### Fase 4 — Feed Local (Dias 9–10)
- [ ] Tela de feed (cronológico, por bairro)
- [ ] Formulário de post (texto + imagem)
- [ ] Fluxo de moderação (pendente → publicado/removido)
- [ ] Sistema de denúncia
- [ ] Realtime: posts aparecem em tempo real
- [ ] Testes: postar, moderar, denunciar, feed atualiza

### Fase 5 — Puxada de Voto (Dias 11–12)
- [ ] Tela de cadastro de eleitor
- [ ] Algoritmo de formação de rotas (Edge Function)
- [ ] Painel do coordenador (atribuir rotas a puxadores)
- [ ] Tela de rota do puxador (lista + check-in)
- [ ] Push no dia 25
- [ ] Testes: cadastro, formação de rota, check-in, progresso

### Fase 6 — Checagem de Fatos (Dia 13)
- [ ] Tela de checagem (input + foto)
- [ ] Edge Function de busca (pg_trgm)
- [ ] Seed da base de checagem (6 itens iniciais)
- [ ] Tela de resultado (selo + explicação + fonte)
- [ ] Botão de compartilhar resultado
- [ ] Testes: busca, resultado, compartilhamento

### Fase 7 — Polimento + Testes (Dias 14–15)
- [ ] Testes de usabilidade com 10–20 pessoas
- [ ] Correções de bugs
- [ ] Otimização de performance (loading states, lazy loading)
- [ ] Testes em celular de baixa gama (Android 8, 2GB RAM)
- [ ] Testes offline (app funciona sem internet? mostra cache)
- [ ] Build final: iOS (TestFlight) + Android (APK direto)
- [ ] Publicar no GitHub (README, LICENSE, CONTRIBUTING)

### Fase 8 — Lançamento (Dia 15 → 25/10)
- [ ] Instalar em 3–5 bairros estratégicos
- [ ] Treinar 2–3 moderadores por bairro
- [ ] Monitorar cadastros, bugs, feedback
- [ ] Iterar diariamente
- [ ] Dia 24: ativar módulo de puxada de voto
- [ ] Dia 25: operação de puxada
- [ ] Pós-25: coletar dados, analisar, planejar próximo passo

---

## 10. ESTRATÉGIA DE LANÇAMENTO

### 10.1 Onde lançar primeiro

Escolher 3–5 bairros onde:
1. A diferença entre Flávio e Lula no 1º turno foi menor (mais disputado).
2. Há estrutura de militância existente (comitês, lideranças locais).
3. A população é urbana (facilidade de mobilização a pé).

Critérios de seleção:
- Cruzar dados do TSE (resultado por seção) com mapa de comitês.
- Priorizar bairros com 10+ militantes ativos.
- Evitar bairros muito grandes (difícil cobrir) ou muito pequenos (pouco impacto).

### 10.2 Como anunciar

1. **WhatsApp (principal canal):**
   - Grupos de militância: "Chegou o Yvy. App da nossa base. Instala aí."
   - Story com QRCode: "Escaneie e entre na base do seu bairro."
   - Áudio de 30s explicando o que é e como funciona.

2. **Instagram:**
   - Post no perfil da campanha/comitê local.
   - Stories com contagem regressiva (14 dias).
   - Reels: "3 coisas que o Flávio vai cortar que você não sabe."

3. **Boa-old-fashioned porta a porta:**
   - Militantes mostram o app no celular durante a panfletagem.
   - "Viu esse app? É pra organizar a gente. Um camarada te cadastra."

4. **Não usar:** TV, rádio, jornal. O app é para a base, não para o
   eleitor flutuante. O eleitor flutuante é alcançado pelos cards
   compartilhados no WhatsApp.

### 10.3 Métricas de sucesso

| Métrica | Meta (dia 25) |
|---------|---------------|
| Downloads | 5.000 |
| Cadastros de militantes | 1.500 |
| Cadastros de visitantes | 3.500 |
| Ações criadas | 200 |
| Participações em ações | 800 |
| Posts no feed | 500 |
| Eleitores cadastrados p/ puxada | 2.000 |
| Rotas de puxada formadas | 400 |
| Votos puxados (confirmados) | 1.200 |
| Checagens realizadas | 1.000 |
| Cards compartilhados | 3.000 |

---

## 11. RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Poucos downloads | Alta | Alto | Foco em WhatsApp + porta a porta. Não depender de loja de apps. APK direto para Android. |
| Bug crítico no dia 25 | Média | Crítico | Testes extensos em dias 14–15. Feature flags para desligar módulos. Plano B: planilha + WhatsApp. |
| Invasão da direita | Alta | Médio | Arquitetura de dois públicos. Anonimato funcional. Moderação local. |
| Falta de moderadores | Média | Médio | Treinar 2–3 por bairro. Auto-aprovação em 2h. |
| Problema de internet no dia 25 | Baixa | Alto | App funciona offline (cache). Puxada de voto tem modo "offline first": salva localmente, sincroniza depois. |
| Cansaço do time dev | Alta | Médio | MVP enxuto. Não adicionar features novas após dia 12. Foco em estabilidade. |
| TSE proíbe app eleitoral | Baixa | Alto | O app não é "propaganda eleitoral" — é "organização de base". Cards citam fontes. Checagem é factual. Consultar advogado eleitoral. |

---

## 12. QUESTÕES EM ABERTO

1. **Financiamento:** Quem paga? Comitê? Doações? Patrocínio?
   - Custo estimado: R$ 500–2.000/mês (Supabase Pro + OneSignal + Mapbox + EAS).
   - Para 15 dias: R$ 1.000–4.000.
   - Para 1 ano: R$ 6.000–24.000.

2. **Licença do código:** MIT (aberto, permissivo) ou AGPL (copyleft,
   obriga derivados a serem abertos)? Recomendação: MIT para adoção fácil.

3. **Versão web:** Dashboard de coordenação (painel do admin) será
   React (web) ou parte do app mobile? Recomendação: React web separado,
   mesmo backend Supabase.

4. **Advogado eleitoral:** Consultar se o app se enquadra como
   "propaganda eleitoral" (regulada pelo TSE) ou "organização de partido"
   (menos regulada). Os cards de proposta podem ser considerados
   propaganda. Mitigação: citar sempre fonte e data. Usar linguagem
   factual, não opinativa.

5. **Verificar disponibilidade:**
   - Domínio: yvy.app, yvy.org.br, getyvy.com.br
   - App Store / Google Play: "Yvy"
   - GitHub: yvy-app
   - Instagram: @yvy.app

---

## 13. REFERÊNCIAS E FONTES

- BBC News Brasil: "Flávio Bolsonaro e Lula: as propostas dos candidatos
  que disputam o 2º turno" (06/10/2026)
- G1: "Flávio Bolsonaro no segundo turno: veja o que o candidato propõe"
  (05/10/2026)
- Forbes: "'Tesouraço': O que prevê a cartilha de Flávio Bolsonaro para
  a economia" (10/2026)
- R7: "PEC assinada por Flávio Bolsonaro abre brecha para salário mínimo
  de R$ 1.297"
- BBC: "Como é o projeto de trabalho flexível apoiado por Flávio Bolsonaro"
- UOL: "Propostas de Flávio Bolsonaro: veja principais pontos do plano
  de governo" (27/09/2026)
- TSE: Dados do 1º turno (04/10/2026)
- Ipespe: Pesquisa 2º turno (06–08/10/2026)
- Gazeta do Povo: "Lula cobra detalhes do ajuste fiscal de Flávio"
- Estadao: "Reforma administrativa é defendida por Flávio"

---

## 14. GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| Yvy | Palavra do guarani que significa "terra, chão, solo". Nome do app. |
| Base | Conjunto de militantes organizados num território (bairro, cidade) |
| Puxada de voto | Ação de levar eleitores até a urna no dia da votação |
| Card | Unidade de conteúdo editorial (proposta traduzida) |
| Rota | Grupo de até 5 eleitores atribuídos a um puxador |
| Puxador | Militante responsável por levar eleitores à urna |
| Moderador | Militante que aprova/remove posts no feed local |
| Visitante | Usuário com acesso ao conteúdo público (não é militante) |
| Militant | Usuário com acesso à estrutura de mobilização (por convite) |
| Feature flag | Interruptor que liga/desliga um módulo do app sem rebuild |
| RLS | Row Level Security — controle de acesso por linha no banco de dados |
| Edge Function | Função server-side executada na borda da rede (Supabase) |
| QRCode de mesa | QRCode impresso para eventos grandes (até 20 usos, 4h) |

---

## 15. PRÓXIMOS PASSOS IMEDIATOS

1. [ ] Verificar disponibilidade de domínio (yvy.app, yvy.org.br)
2. [ ] Verificar disponibilidade nas lojas de apps ("Yvy")
3. [ ] Criar repositório GitHub (público)
4. [ ] Criar projeto Supabase
5. [ ] Rodar o schema SQL (seção 3.1)
6. [ ] Setup do projeto Expo
7. [ ] Implementar tela de splash + onboarding
8. [ ] Implementar auth (telefone + e-mail)
9. [ ] Implementar fluxo de convite por QRCode
10. [ ] Commit. Push. Repetir.

---

*Documento vivo. Atualizar a cada decisão tomada.*
*Última atualização: 11/10/2026.*
