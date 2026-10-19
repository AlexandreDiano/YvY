// GERADO por scripts/gen-db-types.sh a partir das migrations. Não editar à mão.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "action_participants": {
                  Row: {
                    "action_id": string,"checked_in_at": string | null,"created_at": string,"id": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_id": string,"checked_in_at"?: string | null,"created_at"?: string,"id"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "action_id"?: string,"checked_in_at"?: string | null,"created_at"?: string,"id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "action_participants_action_id_fkey"
      columns: ["action_id"]
isOneToOne: false
      referencedRelation: "actions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_participants_action_id_fkey"
      columns: ["action_id"]
isOneToOne: false
      referencedRelation: "actions_with_counts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"actions": {
                  Row: {
                    "cancel_reason": string | null,"city": string | null,"created_at": string,"created_by": string,"description": string | null,"id": string,"lat": number | null,"lng": number | null,"location": unknown,"location_name": string | null,"max_participants": number | null,"neighborhood": string | null,"scheduled_at": string,"state": string | null,"status": Database["public"]['Enums']["action_status"],"title": string,"type": Database["public"]['Enums']["action_type"],"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"city"?: string | null,"created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"location"?: never,"location_name"?: string | null,"max_participants"?: number | null,"neighborhood"?: string | null,"scheduled_at": string,"state"?: string | null,"status"?: Database["public"]['Enums']["action_status"],"title": string,"type": Database["public"]['Enums']["action_type"],"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"city"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string,"lat"?: number | null,"lng"?: number | null,"location"?: never,"location_name"?: string | null,"max_participants"?: number | null,"neighborhood"?: string | null,"scheduled_at"?: string,"state"?: string | null,"status"?: Database["public"]['Enums']["action_status"],"title"?: string,"type"?: Database["public"]['Enums']["action_type"],"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "actions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_name": string | null,"created_at": string,"entity_id": string | null,"entity_type": string | null,"id": number,"ip_address": unknown,"metadata": Json | null,"user_agent": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_name"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: number,"ip_address"?: unknown,"metadata"?: Json | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_name"?: string | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string | null,"id"?: number,"ip_address"?: unknown,"metadata"?: Json | null,"user_agent"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"chat_access_log": {
                  Row: {
                    "created_at": string,"ip": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ip": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ip"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"chat_add_codes": {
                  Row: {
                    "code": string,"expires_at": string,"user_id": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"expires_at": string,"user_id": string,"uses"?: number
                  }
                  Update: {
                    "code"?: string,"expires_at"?: string,"user_id"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_add_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_add_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_blocks": {
                  Row: {
                    "blocked": string,"blocker": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked": string,"blocker": string,"created_at"?: string
                  }
                  Update: {
                    "blocked"?: string,"blocker"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_blocks_blocked_fkey"
      columns: ["blocked"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_blocks_blocked_fkey"
      columns: ["blocked"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_blocks_blocker_fkey"
      columns: ["blocker"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_blocks_blocker_fkey"
      columns: ["blocker"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_contacts": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"id": string,"requested_by": string,"status": string,"user_a": string,"user_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"id"?: string,"requested_by": string,"status"?: string,"user_a": string,"user_b": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"id"?: string,"requested_by"?: string,"status"?: string,"user_a"?: string,"user_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_contacts_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_contacts_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_contacts_user_a_fkey"
      columns: ["user_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_contacts_user_a_fkey"
      columns: ["user_a"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_contacts_user_b_fkey"
      columns: ["user_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_contacts_user_b_fkey"
      columns: ["user_b"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_devices": {
                  Row: {
                    "box_pk": string,"created_at": string,"id": string,"sign_pk": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "box_pk": string,"created_at"?: string,"id"?: string,"sign_pk": string,"user_id": string
                  }
                  Update: {
                    "box_pk"?: string,"created_at"?: string,"id"?: string,"sign_pk"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_reports": {
                  Row: {
                    "blocked": boolean,"created_at": string,"id": string,"messages": NonNullable<Json>,"reported": string,"reported_city": string | null,"reported_ips": NonNullable<Json>,"reported_name": string | null,"reported_neighborhood": string | null,"reporter": string,"reporter_ip": string | null,"reporter_name": string | null,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"sign_keys": NonNullable<Json>,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked"?: boolean,"created_at"?: string,"id"?: string,"messages": NonNullable<Json>,"reported": string,"reported_city"?: string | null,"reported_ips"?: NonNullable<Json>,"reported_name"?: string | null,"reported_neighborhood"?: string | null,"reporter": string,"reporter_ip"?: string | null,"reporter_name"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"sign_keys": NonNullable<Json>,"status"?: string
                  }
                  Update: {
                    "blocked"?: boolean,"created_at"?: string,"id"?: string,"messages"?: NonNullable<Json>,"reported"?: string,"reported_city"?: string | null,"reported_ips"?: NonNullable<Json>,"reported_name"?: string | null,"reported_neighborhood"?: string | null,"reporter"?: string,"reporter_ip"?: string | null,"reporter_name"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"sign_keys"?: NonNullable<Json>,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"claim_checks": {
                  Row: {
                    "attempts": number,"checked_at": string | null,"claim_text": string | null,"created_at": string,"error": string | null,"explanation": string | null,"fact_check_id": string | null,"id": string,"input_hash": string,"input_text": string | null,"model": string | null,"queued_at": string,"requested_count": number,"result": Database["public"]['Enums']["check_result"] | null,"reviewed_at": string | null,"reviewed_by": string | null,"source_name": string | null,"source_url": string | null,"status": Database["public"]['Enums']["claim_status"],"claim_check_view": Json | null
                  }
                  ComputedFields: "claim_check_view"
                  Insert: {
                    "attempts"?: number,"checked_at"?: string | null,"claim_text"?: string | null,"created_at"?: string,"error"?: string | null,"explanation"?: string | null,"fact_check_id"?: string | null,"id"?: string,"input_hash": string,"input_text"?: string | null,"model"?: string | null,"queued_at"?: string,"requested_count"?: number,"result"?: Database["public"]['Enums']["check_result"] | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source_name"?: string | null,"source_url"?: string | null,"status"?: Database["public"]['Enums']["claim_status"]
                  }
                  Update: {
                    "attempts"?: number,"checked_at"?: string | null,"claim_text"?: string | null,"created_at"?: string,"error"?: string | null,"explanation"?: string | null,"fact_check_id"?: string | null,"id"?: string,"input_hash"?: string,"input_text"?: string | null,"model"?: string | null,"queued_at"?: string,"requested_count"?: number,"result"?: Database["public"]['Enums']["check_result"] | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source_name"?: string | null,"source_url"?: string | null,"status"?: Database["public"]['Enums']["claim_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_checks_fact_check_id_fkey"
      columns: ["fact_check_id"]
isOneToOne: false
      referencedRelation: "fact_checks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_checks_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_checks_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"elected_2026": {
                  Row: {
                    "cargo": string,"nome": string,"nome_urna": string,"partido": string,"situacao": string,"sq_candidato": string,"uf": string,"votos": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cargo": string,"nome": string,"nome_urna": string,"partido": string,"situacao": string,"sq_candidato": string,"uf": string,"votos": number
                  }
                  Update: {
                    "cargo"?: string,"nome"?: string,"nome_urna"?: string,"partido"?: string,"situacao"?: string,"sq_candidato"?: string,"uf"?: string,"votos"?: number
                  }
                  Relationships: [
                    
                  ]
                },"fact_checks": {
                  Row: {
                    "claim_text": string,"created_at": string,"explanation": string,"id": string,"is_active": boolean,"result": Database["public"]['Enums']["check_result"],"source_auto": boolean,"source_name": string | null,"source_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_text": string,"created_at"?: string,"explanation": string,"id"?: string,"is_active"?: boolean,"result": Database["public"]['Enums']["check_result"],"source_auto"?: boolean,"source_name"?: string | null,"source_url"?: string | null
                  }
                  Update: {
                    "claim_text"?: string,"created_at"?: string,"explanation"?: string,"id"?: string,"is_active"?: boolean,"result"?: Database["public"]['Enums']["check_result"],"source_auto"?: boolean,"source_name"?: string | null,"source_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"feature_flags": {
                  Row: {
                    "description": string | null,"is_enabled": boolean,"key": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"is_enabled"?: boolean,"key": string,"updated_at"?: string
                  }
                  Update: {
                    "description"?: string | null,"is_enabled"?: boolean,"key"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feedback": {
                  Row: {
                    "author_id": string,"created_at": string,"group_id": string | null,"id": string,"kind": string,"message": string,"staff_note": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"group_id"?: string | null,"id"?: string,"kind": string,"message": string,"staff_note"?: string | null,"status"?: string
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"group_id"?: string | null,"id"?: string,"kind"?: string,"message"?: string,"staff_note"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "feedback_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback_groups": {
                  Row: {
                    "created_at": string,"id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"government_plans": {
                  Row: {
                    "cargo": string,"items": NonNullable<Json>,"nome_urna": string,"pages": number | null,"partido": string,"pdf_url": string,"sq_candidato": string,"uf": string,"updated_at": string,"verified": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "cargo": string,"items"?: NonNullable<Json>,"nome_urna": string,"pages"?: number | null,"partido": string,"pdf_url": string,"sq_candidato": string,"uf": string,"updated_at"?: string,"verified"?: boolean
                  }
                  Update: {
                    "cargo"?: string,"items"?: NonNullable<Json>,"nome_urna"?: string,"pages"?: number | null,"partido"?: string,"pdf_url"?: string,"sq_candidato"?: string,"uf"?: string,"updated_at"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"invite_claims": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"invite_id": string,"net_bucket": string | null,"redeemed_at": string | null,"redeemed_by": string | null,"secret": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"invite_id": string,"net_bucket"?: string | null,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"secret"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"invite_id"?: string,"net_bucket"?: string | null,"redeemed_at"?: string | null,"redeemed_by"?: string | null,"secret"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_claims_invite_id_fkey"
      columns: ["invite_id"]
isOneToOne: false
      referencedRelation: "invites"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_claims_redeemed_by_fkey"
      columns: ["redeemed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_claims_redeemed_by_fkey"
      columns: ["redeemed_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"invite_grants": {
                  Row: {
                    "granted_at": string,"granted_by": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_grants_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_grants_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_grants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "created_at": string,"created_by": string,"created_ip": unknown,"event_name": string | null,"expires_at": string,"id": string,"is_remote": boolean,"is_table_qr": boolean,"max_uses": number,"scan_expires_at": string,"token": string,"use_count": number,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"created_ip"?: unknown,"event_name"?: string | null,"expires_at": string,"id"?: string,"is_remote"?: boolean,"is_table_qr"?: boolean,"max_uses"?: number,"scan_expires_at": string,"token"?: string,"use_count"?: number,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"created_ip"?: unknown,"event_name"?: string | null,"expires_at"?: string,"id"?: string,"is_remote"?: boolean,"is_table_qr"?: boolean,"max_uses"?: number,"scan_expires_at"?: string,"token"?: string,"use_count"?: number,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"message_queue": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"msg_id": string,"nonce": string,"recipient": string,"recipient_device": string,"sender": string,"sender_device": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"msg_id": string,"nonce": string,"recipient": string,"recipient_device": string,"sender": string,"sender_device": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"msg_id"?: string,"nonce"?: string,"recipient"?: string,"recipient_device"?: string,"sender"?: string,"sender_device"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_queue_recipient_device_fkey"
      columns: ["recipient_device"]
isOneToOne: false
      referencedRelation: "chat_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_queue_recipient_fkey"
      columns: ["recipient"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_queue_recipient_fkey"
      columns: ["recipient"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_queue_sender_device_fkey"
      columns: ["sender_device"]
isOneToOne: false
      referencedRelation: "chat_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_queue_sender_fkey"
      columns: ["sender"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_queue_sender_fkey"
      columns: ["sender"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"moderators": {
                  Row: {
                    "city": string,"created_at": string,"id": string,"is_active": boolean,"neighborhood": string,"state": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"neighborhood": string,"state": string,"user_id": string
                  }
                  Update: {
                    "city"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"neighborhood"?: string,"state"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderators_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderators_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"municipios": {
                  Row: {
                    "ibge": number,"nome": string,"regiao_id": number,"regiao_nome": string,"uf": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ibge": number,"nome": string,"regiao_id": number,"regiao_nome": string,"uf": string
                  }
                  Update: {
                    "ibge"?: number,"nome"?: string,"regiao_id"?: number,"regiao_nome"?: string,"uf"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"emailed_at": string | null,"id": string,"kind": string,"read_at": string | null,"ref_id": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"kind": string,"read_at"?: string | null,"ref_id"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"emailed_at"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null,"ref_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"plain_texts": {
                  Row: {
                    "created_at": string,"hash": string,"model": string,"original": string,"simple": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"hash": string,"model": string,"original": string,"simple": string
                  }
                  Update: {
                    "created_at"?: string,"hash"?: string,"model"?: string,"original"?: string,"simple"?: string
                  }
                  Relationships: [
                    
                  ]
                },"post_flags": {
                  Row: {
                    "created_at": string,"detail": string | null,"flagger_id": string,"id": string,"post_id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: string | null,"flagger_id": string,"id"?: string,"post_id": string,"reason": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string | null,"flagger_id"?: string,"id"?: string,"post_id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_flags_flagger_id_fkey"
      columns: ["flagger_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_flags_flagger_id_fkey"
      columns: ["flagger_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_flags_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_flags_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts_with_author"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "author_id": string,"city": string,"content": string,"created_at": string,"flagged_count": number,"id": string,"image_url": string | null,"moderator_id": string | null,"moderator_note": string | null,"neighborhood": string,"scope": string,"state": string,"status": Database["public"]['Enums']["post_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"city": string,"content": string,"created_at"?: string,"flagged_count"?: number,"id"?: string,"image_url"?: string | null,"moderator_id"?: string | null,"moderator_note"?: string | null,"neighborhood": string,"scope"?: string,"state": string,"status"?: Database["public"]['Enums']["post_status"]
                  }
                  Update: {
                    "author_id"?: string,"city"?: string,"content"?: string,"created_at"?: string,"flagged_count"?: number,"id"?: string,"image_url"?: string | null,"moderator_id"?: string | null,"moderator_note"?: string | null,"neighborhood"?: string,"scope"?: string,"state"?: string,"status"?: Database["public"]['Enums']["post_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"cep": string | null,"city": string | null,"created_at": string,"display_name": string,"email": string | null,"full_name": string | null,"id": string,"invited_by": string | null,"is_active": boolean,"location_precision": number,"membership_status": Database["public"]['Enums']["membership_status"],"neighborhood": string | null,"notify_actions": boolean,"notify_email": boolean | null,"notify_feed": boolean,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"sensitive_consent_at": string | null,"show_avatar": boolean,"state": string | null,"terms_accepted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"cep"?: string | null,"city"?: string | null,"created_at"?: string,"display_name": string,"email"?: string | null,"full_name"?: string | null,"id": string,"invited_by"?: string | null,"is_active"?: boolean,"location_precision"?: number,"membership_status"?: Database["public"]['Enums']["membership_status"],"neighborhood"?: string | null,"notify_actions"?: boolean,"notify_email"?: boolean | null,"notify_feed"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"sensitive_consent_at"?: string | null,"show_avatar"?: boolean,"state"?: string | null,"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"cep"?: string | null,"city"?: string | null,"created_at"?: string,"display_name"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"invited_by"?: string | null,"is_active"?: boolean,"location_precision"?: number,"membership_status"?: Database["public"]['Enums']["membership_status"],"neighborhood"?: string | null,"notify_actions"?: boolean,"notify_email"?: boolean | null,"notify_feed"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"sensitive_consent_at"?: string | null,"show_avatar"?: boolean,"state"?: string | null,"terms_accepted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"proposal_cards": {
                  Row: {
                    "area": string,"comparison": string | null,"created_at": string,"id": string,"is_active": boolean,"severity": string,"sort_order": number,"source_auto": boolean,"source_date": string | null,"source_name": string | null,"source_url": string | null,"title": string,"updated_at": string,"what_it_means": string,"what_they_said": string,"who_is_affected": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"comparison"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"severity"?: string,"sort_order"?: number,"source_auto"?: boolean,"source_date"?: string | null,"source_name"?: string | null,"source_url"?: string | null,"title": string,"updated_at"?: string,"what_it_means": string,"what_they_said": string,"who_is_affected": string
                  }
                  Update: {
                    "area"?: string,"comparison"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"severity"?: string,"sort_order"?: number,"source_auto"?: boolean,"source_date"?: string | null,"source_name"?: string | null,"source_url"?: string | null,"title"?: string,"updated_at"?: string,"what_it_means"?: string,"what_they_said"?: string,"who_is_affected"?: string
                  }
                  Relationships: [
                    
                  ]
                },"region_follows": {
                  Row: {
                    "created_at": string,"regiao_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"regiao_id": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"regiao_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "region_follows_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "region_follows_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"role_managers": {
                  Row: {
                    "granted_at": string,"granted_by": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_managers_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_managers_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_managers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "role_managers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "actions_with_counts": {
                  Row: {
                    "cancel_reason": string | null,"city": string | null,"created_at": string | null,"created_by": string | null,"creator_display_name": string | null,"description": string | null,"id": string | null,"lat": number | null,"lng": number | null,"location_name": string | null,"max_participants": number | null,"neighborhood": string | null,"participant_count": number | null,"scheduled_at": string | null,"state": string | null,"status": Database["public"]['Enums']["action_status"] | null,"title": string | null,"type": Database["public"]['Enums']["action_type"] | null,"updated_at": string | null,"visibility": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "cancel_reason"?: string | null,"city"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"creator_display_name"?: never,"description"?: string | null,"id"?: string | null,"lat"?: number | null,"lng"?: number | null,"location_name"?: string | null,"max_participants"?: number | null,"neighborhood"?: string | null,"participant_count"?: never,"scheduled_at"?: string | null,"state"?: string | null,"status"?: Database["public"]['Enums']["action_status"] | null,"title"?: string | null,"type"?: Database["public"]['Enums']["action_type"] | null,"updated_at"?: string | null,"visibility"?: string | null
                         }
                        Update: {
                           "cancel_reason"?: string | null,"city"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"creator_display_name"?: never,"description"?: string | null,"id"?: string | null,"lat"?: number | null,"lng"?: number | null,"location_name"?: string | null,"max_participants"?: number | null,"neighborhood"?: string | null,"participant_count"?: never,"scheduled_at"?: string | null,"state"?: string | null,"status"?: Database["public"]['Enums']["action_status"] | null,"title"?: string | null,"type"?: Database["public"]['Enums']["action_type"] | null,"updated_at"?: string | null,"visibility"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "actions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "actions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback_with_author": {
                  Row: {
                    "author_display_name": string | null,"author_id": string | null,"created_at": string | null,"group_id": string | null,"group_title": string | null,"id": string | null,"kind": string | null,"message": string | null,"staff_note": string | null,"status": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "feedback_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "feedback_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "feedback_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"posts_with_author": {
                  Row: {
                    "author_display_name": string | null,"author_id": string | null,"city": string | null,"content": string | null,"created_at": string | null,"flagged_count": number | null,"id": string | null,"image_url": string | null,"moderator_id": string | null,"moderator_note": string | null,"neighborhood": string | null,"scope": string | null,"state": string | null,"status": Database["public"]['Enums']["post_status"] | null
                  }
                  ComputedFields: never
                  Insert: {
                           "author_display_name"?: never,"author_id"?: string | null,"city"?: string | null,"content"?: string | null,"created_at"?: string | null,"flagged_count"?: number | null,"id"?: string | null,"image_url"?: string | null,"moderator_id"?: string | null,"moderator_note"?: string | null,"neighborhood"?: string | null,"scope"?: string | null,"state"?: string | null,"status"?: Database["public"]['Enums']["post_status"] | null
                         }
                        Update: {
                           "author_display_name"?: never,"author_id"?: string | null,"city"?: string | null,"content"?: string | null,"created_at"?: string | null,"flagged_count"?: number | null,"id"?: string | null,"image_url"?: string | null,"moderator_id"?: string | null,"moderator_note"?: string | null,"neighborhood"?: string | null,"scope"?: string | null,"state"?: string | null,"status"?: Database["public"]['Enums']["post_status"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_moderator_id_fkey"
      columns: ["moderator_id"]
isOneToOne: false
      referencedRelation: "profiles_public"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles_public": {
                  Row: {
                    "avatar_url": string | null,"city": string | null,"created_at": string | null,"display_name": string | null,"id": string | null,"membership_status": Database["public"]['Enums']["membership_status"] | null,"neighborhood": string | null,"role": Database["public"]['Enums']["user_role"] | null,"state": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: never,"city"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string | null,"membership_status"?: Database["public"]['Enums']["membership_status"] | null,"neighborhood"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null,"state"?: string | null
                         }
                        Update: {
                           "avatar_url"?: never,"city"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"id"?: string | null,"membership_status"?: Database["public"]['Enums']["membership_status"] | null,"neighborhood"?: string | null,"role"?: Database["public"]['Enums']["user_role"] | null,"state"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "audit_attach":
{ Args: { "p_table": string }; Returns: undefined
                           },
"auto_approve_posts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"auto_complete_actions":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"can_grant_invites_for":
{ Args: { "p_user": string }; Returns: boolean
                           },
"can_invite":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_manage_roles":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_claim_request":
{ Args: { "p_id": string }; Returns: undefined
                           },
"chat_block":
{ Args: { "p_user": string }; Returns: undefined
                           },
"chat_blocked_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"peer_id": string,"peer_name": string,"peer_neighborhood": string
            }[]
                           },
"chat_can_send":
{ Args: { "p_from": string,"p_to": string }; Returns: boolean
                           },
"chat_client_ip":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"chat_contacts_list":
{ Args: Record<PropertyKey, never>; Returns: {
              "blocked": boolean,"contact_id": string,"created_at": string,"incoming": boolean,"peer_city": string,"peer_id": string,"peer_name": string,"peer_neighborhood": string,"status": string
            }[]
                           },
"chat_decide_contact":
{ Args: { "p_accept": boolean,"p_contact": string }; Returns: undefined
                           },
"chat_devices_match":
{ Args: { "p_from": string,"p_from_dev": string,"p_to": string,"p_to_dev": string }; Returns: boolean
                           },
"chat_new_add_code":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"chat_peer_devices":
{ Args: { "p_peer": string }; Returns: {
              "box_pk": string,"id": string,"sign_pk": string
            }[]
                           },
"chat_purge":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"chat_report":
{ Args: { "p_block": boolean,"p_messages": Json,"p_reported": string }; Returns: string
                           },
"chat_request_contact":
{ Args: { "p_code": string }; Returns: string
                           },
"chat_resolve_report":
{ Args: { "p_id": string,"p_resolution": string }; Returns: undefined
                           },
"chat_unblock":
{ Args: { "p_user": string }; Returns: undefined
                           },
"check_claim_cron_key":
{ Args: { "p_key": string }; Returns: boolean
                           },
"claim_check_by_id":
{ Args: { "p_id": string }; Returns: {
              "attempts": number,
"checked_at": string | null,
"claim_text": string | null,
"created_at": string,
"error": string | null,
"explanation": string | null,
"fact_check_id": string | null,
"id": string,
"input_hash": string,
"input_text": string | null,
"model": string | null,
"queued_at": string,
"requested_count": number,
"result": Database["public"]['Enums']["check_result"] | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"source_name": string | null,
"source_url": string | null,
"status": Database["public"]['Enums']["claim_status"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "claim_checks"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_check_view":
{ Args: { "c": Omit<Database["public"]['Tables']["claim_checks"]['Row'], Database["public"]['Tables']["claim_checks"]['ComputedFields']> }; Returns: Json
                           },
"claim_invite":
{ Args: { "p_token": string }; Returns: {
              "claim": string,"claim_expires_at": string
            }[]
                           },
"claim_next_checks":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"checked_at": string | null,
"claim_text": string | null,
"created_at": string,
"error": string | null,
"explanation": string | null,
"fact_check_id": string | null,
"id": string,
"input_hash": string,
"input_text": string | null,
"model": string | null,
"queued_at": string,
"requested_count": number,
"result": Database["public"]['Enums']["check_result"] | null,
"reviewed_at": string | null,
"reviewed_by": string | null,
"source_name": string | null,
"source_url": string | null,
"status": Database["public"]['Enums']["claim_status"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "claim_checks"
        isOneToOne: false
        isSetofReturn: true
      } },
"decide_invitee":
{ Args: { "p_decision": Database["public"]['Enums']["membership_status"],"p_invitee": string }; Returns: undefined
                           },
"delete_claim_check":
{ Args: { "p_id": string }; Returns: undefined
                           },
"display_name_of":
{ Args: { "p_id": string }; Returns: string
                           },
"fail_claim_check":
{ Args: { "p_error": string,"p_id": string }; Returns: undefined
                           },
"finish_claim_check":
{ Args: { "p_claim": string,"p_explanation": string,"p_id": string,"p_model": string,"p_result": Database["public"]['Enums']["check_result"],"p_source_name": string,"p_source_url": string }; Returns: undefined
                           },
"follow_region":
{ Args: { "p_follow": boolean,"p_regiao": number }; Returns: undefined
                           },
"follows_region_of":
{ Args: { "p_city": string,"p_uf": string }; Returns: boolean
                           },
"get_claim_checks":
{ Args: { "p_ids": (string)[] }; Returns: Json[]
                           },
"get_plain_texts":
{ Args: { "p_hashes": (string)[] }; Returns: {
              "hash": string,"simple": string
            }[]
                           },
"give_sensitive_consent":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"health_watch":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"invite_claim_stats":
{ Args: { "p_invite": string }; Returns: {
              "pending": number,"redeemed": number
            }[]
                           },
"invitees_of":
{ Args: { "p_user": string }; Returns: {
              "city": string,"created_at": string,"display_name": string,"id": string,"membership_status": Database["public"]['Enums']["membership_status"],"neighborhood": string,"state": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_militant_or_above":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_moderator_for":
{ Args: { "p_city": string,"p_neighborhood": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_claim_checks":
{ Args: { "p_limit"?: number }; Returns: Json[]
                           },
"list_claim_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "attempts": number,"checked_at": string,"claim_text": string,"error": string,"id": string,"input_text": string,"queued_at": string,"requested_count": number,"result": Database["public"]['Enums']["check_result"],"status": Database["public"]['Enums']["claim_status"]
            }[]
                           },
"list_members":
{ Args: { "p_query"?: string }; Returns: {
              "can_invite": boolean,"city": string,"display_name": string,"id": string,"invited_by_name": string,"invited_count": number,"is_role_manager": boolean,"neighborhood": string,"role": Database["public"]['Enums']["user_role"],"state": string
            }[]
                           },
"list_regions":
{ Args: { "p_uf": string }; Returns: {
              "cidades": number,"regiao_id": number,"regiao_nome": string,"uf": string
            }[]
                           },
"members_by_area":
{ Args: Record<PropertyKey, never>; Returns: {
              "city": string,"members": number,"mine": boolean,"neighborhood": string,"state": string
            }[]
                           },
"my_area":
{ Args: Record<PropertyKey, never>; Returns: {
              "city": string,"neighborhood": string
            }[]
                           },
"my_followed_regions":
{ Args: Record<PropertyKey, never>; Returns: {
              "cidades": (string)[],"regiao_id": number,"regiao_nome": string,"uf": string
            }[]
                           },
"my_invitees":
{ Args: Record<PropertyKey, never>; Returns: {
              "can_invite": boolean,"city": string,"created_at": string,"display_name": string,"id": string,"invited_count": number,"membership_status": Database["public"]['Enums']["membership_status"],"neighborhood": string,"role": Database["public"]['Enums']["user_role"],"state": string
            }[]
                           },
"my_pending_invitees":
{ Args: Record<PropertyKey, never>; Returns: {
              "city": string,"created_at": string,"display_name": string,"id": string,"neighborhood": string,"state": string
            }[]
                           },
"my_region":
{ Args: Record<PropertyKey, never>; Returns: {
              "cidades": (string)[],"regiao_id": number,"regiao_nome": string,"uf": string
            }[]
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["user_role"]
                           },
"my_state":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"norm_city":
{ Args: { "t": string }; Returns: string
                           },
"participant_count":
{ Args: { "p_action": string }; Returns: number
                           },
"promote_claim_check":
{ Args: { "p_claim"?: string,"p_explanation"?: string,"p_id": string,"p_result"?: Database["public"]['Enums']["check_result"],"p_source_name"?: string,"p_source_url"?: string }; Returns: string
                           },
"purge_audit_log":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"purge_invite_claims":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"redact_pii":
{ Args: { "t": string }; Returns: string
                           },
"redeem_invite":
{ Args: { "p_cep"?: string,"p_city"?: string,"p_claim": string,"p_display_name": string,"p_full_name": string,"p_location_precision"?: number,"p_neighborhood"?: string,"p_phone"?: string,"p_sensitive_consent"?: boolean,"p_state"?: string }; Returns: {
              "membership_status": Database["public"]['Enums']["membership_status"],"profile_id": string
            }[]
                           },
"region_of":
{ Args: { "p_uf": string }; Returns: string
                           },
"region_of_city":
{ Args: { "p_city": string,"p_uf": string }; Returns: number
                           },
"release_claim_check":
{ Args: { "p_error": string,"p_id": string }; Returns: undefined
                           },
"release_invite_claims":
{ Args: { "p_invite": string }; Returns: number
                           },
"request_claim_check":
{ Args: { "p_text": string }; Returns: Json
                           },
"request_inet":
{ Args: Record<PropertyKey, never>; Returns: unknown
                           },
"request_ip":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"role_of":
{ Args: { "p_user": string }; Returns: string
                           },
"rotate_table_invite":
{ Args: { "p_invite": string }; Returns: {
              "scan_expires_at": string,"token": string
            }[]
                           },
"same_region":
{ Args: { "p_city1": string,"p_city2": string,"p_uf1": string,"p_uf2": string }; Returns: boolean
                           },
"search_fact_checks":
{ Args: { "min_score"?: number,"q": string }; Returns: {
              "claim_text": string,
"created_at": string,
"explanation": string,
"id": string,
"is_active": boolean,
"result": Database["public"]['Enums']["check_result"],
"source_auto": boolean,
"source_name": string | null,
"source_url": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "fact_checks"
        isOneToOne: false
        isSetofReturn: true
      } },
"send_post_to_review":
{ Args: { "p_post": string,"p_reason": string }; Returns: undefined
                           },
"set_auto_source":
{ Args: { "p_id": string,"p_table": string,"p_url": string }; Returns: undefined
                           },
"set_invite_permission":
{ Args: { "p_enabled": boolean,"p_user": string }; Returns: undefined
                           },
"set_member_active":
{ Args: { "p_active": boolean,"p_reason"?: string,"p_user": string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user": string }; Returns: undefined
                           },
"set_role_manager":
{ Args: { "p_enabled": boolean,"p_user": string }; Returns: undefined
                           },
"unpublish_fact_check":
{ Args: { "p_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "action_status": "draft"|"open"|"confirmed"|"completed"|"cancelled","action_type": "panfletagem"|"puxada_voto"|"mutirao_cadastro"|"comicio"|"portas_portas"|"outro","check_result": "true"|"half_true"|"exaggeration"|"false"|"unverified","claim_status": "queued"|"processing"|"done"|"failed","membership_status": "pending"|"active"|"rejected","post_status": "pending"|"published"|"removed"|"flagged","user_role": "visitor"|"militant"|"moderator"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "action_status": ["draft", "open", "confirmed", "completed", "cancelled"],"action_type": ["panfletagem", "puxada_voto", "mutirao_cadastro", "comicio", "portas_portas", "outro"],"check_result": ["true", "half_true", "exaggeration", "false", "unverified"],"claim_status": ["queued", "processing", "done", "failed"],"membership_status": ["pending", "active", "rejected"],"post_status": ["pending", "published", "removed", "flagged"],"user_role": ["visitor", "militant", "moderator", "admin"]
          }
        }
} as const
