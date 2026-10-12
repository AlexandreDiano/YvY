/**
 * Tipos do banco, espelhando supabase/migrations.
 *
 * Escrito a mao de proposito: o projeto ainda nao tem Supabase provisionado.
 * Quando houver, trocar por geracao automatica e apagar este arquivo:
 *   npx supabase gen types typescript --project-id <id> > src/lib/db.types.ts
 */

export type UserRole = 'visitor' | 'militant' | 'moderator' | 'admin';

export type MembershipStatus = 'pending' | 'active' | 'rejected';

export type ActionType =
  | 'panfletagem'
  | 'puxada_voto'
  | 'mutirao_cadastro'
  | 'comicio'
  | 'portas_portas'
  | 'outro';

export type ActionStatus = 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled';

export type PostStatus = 'pending' | 'published' | 'removed' | 'flagged';

/**
 * O enum do contexto (secao 3.1) tem 4 valores, mas a propria base inicial
 * (secao 6.2) traz um item classificado como "Exagero" — que nao e mentira
 * nem meia verdade. Adicionado 'exaggeration' em vez de forcar o conteudo
 * dentro de um selo errado.
 */
export type CheckResult = 'true' | 'half_true' | 'exaggeration' | 'false' | 'unverified';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type Profile = {
  id: string;
  role: UserRole;
  membership_status: MembershipStatus;
  full_name: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  cep: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  location_precision: number;
  avatar_url: string | null;
  show_avatar: boolean;
  is_active: boolean;
  invited_by: string | null;
  notify_actions: boolean;
  notify_feed: boolean;
  notify_pull: boolean;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** View publica: o que um militante do bairro pode ver de outro. */
export type ProfilePublic = {
  id: string;
  display_name: string;
  role: UserRole;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ActionRow = {
  id: string;
  title: string;
  description: string | null;
  type: ActionType;
  status: ActionStatus;
  scheduled_at: string;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  max_participants: number | null;
  created_by: string;
  visibility: 'base' | 'public';
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};

/** Linha da view `actions_with_counts` (lista e mapa leem daqui). */
export type ActionListed = ActionRow & {
  participant_count: number;
  creator_display_name: string | null;
};

export type ActionParticipant = {
  id: string;
  action_id: string;
  user_id: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  checked_in_at: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  neighborhood: string;
  city: string;
  state: string;
  status: PostStatus;
  moderator_id: string | null;
  moderator_note: string | null;
  flagged_count: number;
  created_at: string;
  /** Até onde o post circula (0021). Ausente em post antigo do modo local = bairro. */
  scope?: 'bairro' | 'estado' | 'regiao' | 'brasil';
};

export type AppNotification = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  ref_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type PostListed = Post & { author_display_name: string | null };

export type PostFlag = {
  id: string;
  post_id: string;
  flagger_id: string;
  reason: 'spam' | 'provocacao' | 'sem_fonte' | 'ofensa' | 'outro';
  detail: string | null;
  created_at: string;
};

export type ProposalCard = {
  id: string;
  area: string;
  title: string;
  what_they_said: string;
  source_url: string | null;
  source_name: string | null;
  /** Link achado pela busca automática (0025): a equipe confere. */
  source_auto?: boolean;
  source_date: string | null;
  what_it_means: string;
  who_is_affected: string;
  comparison: string | null;
  severity: Severity;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type FactCheck = {
  id: string;
  claim_text: string;
  result: CheckResult;
  explanation: string;
  source_url: string | null;
  source_name: string | null;
  /** Link achado pela busca automática (0025): a equipe confere. */
  source_auto?: boolean;
  is_active: boolean;
  created_at: string;
};

export type Voter = {
  id: string;
  full_name: string;
  zone: string;
  section: string;
  polling_place: string;
  cep: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  address_hint: string | null;
  registered_by: string | null;
  consent_source: 'self' | 'militant';
  pulled_by: string | null;
  pull_route_id: string | null;
  has_voted: boolean;
  voted_at: string | null;
  created_at: string;
};

export type PullRoute = {
  id: string;
  puller_id: string | null;
  neighborhood: string;
  city: string;
  state: string;
  max_voters: number;
  is_complete: boolean;
  created_at: string;
};

export type Invite = {
  id: string;
  token: string;
  created_by: string;
  used_by: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string;
  is_table_qr: boolean;
  /** Convite à distância: código de texto, só moderador/admin gera (0015). */
  is_remote: boolean;
  event_name: string | null;
  created_at: string;
};

export type Moderator = {
  id: string;
  user_id: string;
  neighborhood: string;
  city: string;
  state: string;
  is_active: boolean;
  created_at: string;
};

export type FeatureFlag = {
  key: string;
  is_enabled: boolean;
  description: string | null;
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      actions: Table<ActionRow>;
      action_participants: Table<ActionParticipant>;
      posts: Table<Post>;
      post_flags: Table<PostFlag>;
      proposal_cards: Table<ProposalCard>;
      fact_checks: Table<FactCheck>;
      voters: Table<Voter>;
      pull_routes: Table<PullRoute>;
      invites: Table<Invite>;
      moderators: Table<Moderator>;
      feature_flags: Table<FeatureFlag>;
    };
    Views: {
      profiles_public: { Row: ProfilePublic; Relationships: [] };
      actions_with_counts: { Row: ActionListed; Relationships: [] };
      posts_with_author: { Row: PostListed; Relationships: [] };
    };
    Functions: {
      search_fact_checks: {
        Args: { q: string; min_score?: number };
        Returns: FactCheck[];
      };
      // Fila de checagem automática (0012). Devolvem jsonb: tipado em src/api/claims.ts.
      request_claim_check: { Args: { p_text: string }; Returns: unknown };
      get_claim_checks: { Args: { p_ids: string[] }; Returns: unknown[] };
      list_claim_checks: { Args: { p_limit?: number }; Returns: unknown[] };
      is_militant_or_above: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      redeem_invite: {
        Args: {
          p_token: string;
          p_full_name: string;
          p_display_name: string;
          p_phone: string | null;
          p_cep: string;
          p_neighborhood: string;
          p_city: string;
          p_state: string;
          p_location_precision: number;
        };
        Returns: { profile_id: string; membership_status: MembershipStatus }[];
      };
      my_pending_invitees: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          display_name: string;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          created_at: string;
        }[];
      };
      decide_invitee: {
        Args: { p_invitee: string; p_decision: MembershipStatus };
        Returns: undefined;
      };
      build_pull_routes: {
        Args: { p_neighborhood: string; p_city: string; p_state: string; p_max: number };
        Returns: { route_id: string; voter_count: number }[];
      };
    };
    Enums: {
      user_role: UserRole;
      membership_status: MembershipStatus;
      action_type: ActionType;
      action_status: ActionStatus;
      post_status: PostStatus;
      check_result: CheckResult;
    };
    CompositeTypes: Record<string, never>;
  };
};
