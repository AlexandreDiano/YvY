/**
 * Tipos do banco, espelhando supabase/migrations. Escritos à mão; quando
 * alguém tiver tempo dá para trocar pela geração automática:
 *   npx supabase gen types typescript --project-id <id> > src/lib/db.types.ts
 */

export type UserRole = 'visitor' | 'militant' | 'moderator' | 'admin';

export type MembershipStatus = 'pending' | 'active' | 'rejected';

export type ActionType =
  | 'panfletagem'
  | 'mutirao_cadastro'
  | 'comicio'
  | 'portas_portas'
  | 'outro';

export type ActionStatus = 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled';

export type PostStatus = 'pending' | 'published' | 'removed' | 'flagged';

/**
 * O enum do contexto (seção 3.1) tem 4 valores, mas a própria base inicial
 * (seção 6.2) tem um item marcado como "Exagero", que não é mentira nem meia
 * verdade. Entrou 'exaggeration' para não enfiar o conteúdo num selo errado.
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
  terms_accepted_at: string | null;
  /** Consentimento para dado de participação política (LGPD art. 11, migration 0039). */
  sensitive_consent_at: string | null;
  created_at: string;
  updated_at: string;
};

/** View pública: o que um membro do bairro pode ver de outro. */
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
  /** Link achado pela busca automática (0025). A equipe confere. */
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
  /** Link achado pela busca automática (0025). A equipe confere. */
  source_auto?: boolean;
  is_active: boolean;
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
  /** Até quando o QRCode atual pode ser escaneado (0035). */
  scan_expires_at: string;
  is_table_qr: boolean;
  /** Convite à distância, código de texto que só moderador/admin gera (0015). */
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
      // fila de checagem automática (0012). Devolvem jsonb, tipado em src/api/claims.ts
      request_claim_check: { Args: { p_text: string }; Returns: unknown };
      get_claim_checks: { Args: { p_ids: string[] }; Returns: unknown[] };
      list_claim_checks: { Args: { p_limit?: number }; Returns: unknown[] };
      is_militant_or_above: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      claim_invite: {
        Args: { p_token: string };
        Returns: { claim: string; claim_expires_at: string }[];
      };
      rotate_table_invite: {
        Args: { p_invite: string };
        Returns: { token: string; scan_expires_at: string }[];
      };
      redeem_invite: {
        Args: {
          /** Segredo da reserva (claim_invite), não o token do QRCode. */
          p_claim: string;
          p_full_name: string;
          p_display_name: string;
          p_phone: string | null;
          p_cep: string;
          p_neighborhood: string;
          p_city: string;
          p_state: string;
          p_location_precision: number;
          p_sensitive_consent: boolean;
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
