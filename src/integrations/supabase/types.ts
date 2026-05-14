export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      case_items: {
        Row: {
          case_id: string
          created_at: string
          heading: string | null
          highlight_color: string | null
          id: string
          identifier: string
          note: string | null
          pinned: boolean
          section_label: string | null
          source_code: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          heading?: string | null
          highlight_color?: string | null
          id?: string
          identifier: string
          note?: string | null
          pinned?: boolean
          section_label?: string | null
          source_code?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          heading?: string | null
          highlight_color?: string | null
          id?: string
          identifier?: string
          note?: string | null
          pinned?: boolean
          section_label?: string | null
          source_code?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doc_citations: {
        Row: {
          context_snippet: string | null
          created_at: string
          from_document_id: string
          id: string
          to_document_id: string | null
          to_identifier: string
        }
        Insert: {
          context_snippet?: string | null
          created_at?: string
          from_document_id: string
          id?: string
          to_document_id?: string | null
          to_identifier: string
        }
        Update: {
          context_snippet?: string | null
          created_at?: string
          from_document_id?: string
          id?: string
          to_document_id?: string | null
          to_identifier?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_citations_from_document_id_fkey"
            columns: ["from_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_citations_to_document_id_fkey"
            columns: ["to_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_views: {
        Row: {
          identifier: string
          last_viewed_at: string
          view_count: number
        }
        Insert: {
          identifier: string
          last_viewed_at?: string
          view_count?: number
        }
        Update: {
          identifier?: string
          last_viewed_at?: string
          view_count?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          body_md: string | null
          body_text: string | null
          created_at: string
          heading: string | null
          hierarchy: Json | null
          id: string
          identifier: string
          parent_label: string | null
          search_tsv: unknown
          section_label: string | null
          sort_key: string | null
          source_code: string
          word_count: number | null
        }
        Insert: {
          body_md?: string | null
          body_text?: string | null
          created_at?: string
          heading?: string | null
          hierarchy?: Json | null
          id?: string
          identifier: string
          parent_label?: string | null
          search_tsv?: unknown
          section_label?: string | null
          sort_key?: string | null
          source_code: string
          word_count?: number | null
        }
        Update: {
          body_md?: string | null
          body_text?: string | null
          created_at?: string
          heading?: string | null
          hierarchy?: Json | null
          id?: string
          identifier?: string
          parent_label?: string | null
          search_tsv?: unknown
          section_label?: string | null
          sort_key?: string | null
          source_code?: string
          word_count?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      forum_post_citations: {
        Row: {
          created_at: string
          heading_snapshot: string | null
          id: string
          identifier: string
          post_id: string
          section_label_snapshot: string | null
          source_code: string | null
        }
        Insert: {
          created_at?: string
          heading_snapshot?: string | null
          id?: string
          identifier: string
          post_id: string
          section_label_snapshot?: string | null
          source_code?: string | null
        }
        Update: {
          created_at?: string
          heading_snapshot?: string | null
          id?: string
          identifier?: string
          post_id?: string
          section_label_snapshot?: string | null
          source_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_post_citations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          pinned?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          supporter_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          supporter_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          supporter_opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_events: {
        Row: {
          created_at: string
          exact_hit: boolean
          hit_count: number
          id: string
          q: string
          q_normalized: string
          source_filter: string | null
        }
        Insert: {
          created_at?: string
          exact_hit?: boolean
          hit_count?: number
          id?: string
          q: string
          q_normalized: string
          source_filter?: string | null
        }
        Update: {
          created_at?: string
          exact_hit?: boolean
          hit_count?: number
          id?: string
          q?: string
          q_normalized?: string
          source_filter?: string | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          version_date: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          version_date?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          version_date?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      usc_citations: {
        Row: {
          context_snippet: string | null
          created_at: string
          from_section_id: string
          id: string
          to_identifier: string
          to_section_id: string | null
        }
        Insert: {
          context_snippet?: string | null
          created_at?: string
          from_section_id: string
          id?: string
          to_identifier: string
          to_section_id?: string | null
        }
        Update: {
          context_snippet?: string | null
          created_at?: string
          from_section_id?: string
          id?: string
          to_identifier?: string
          to_section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usc_citations_from_section_id_fkey"
            columns: ["from_section_id"]
            isOneToOne: false
            referencedRelation: "usc_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usc_citations_to_section_id_fkey"
            columns: ["to_section_id"]
            isOneToOne: false
            referencedRelation: "usc_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      usc_sections: {
        Row: {
          body_html: string | null
          body_text: string | null
          chapter: string | null
          created_at: string
          heading: string | null
          hierarchy: Json | null
          id: string
          identifier: string
          search_tsv: unknown
          section_num: string
          title_num: number
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          chapter?: string | null
          created_at?: string
          heading?: string | null
          hierarchy?: Json | null
          id?: string
          identifier: string
          search_tsv?: unknown
          section_num: string
          title_num: number
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          chapter?: string | null
          created_at?: string
          heading?: string | null
          hierarchy?: Json | null
          id?: string
          identifier?: string
          search_tsv?: unknown
          section_num?: string
          title_num?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_doc_view: { Args: { p_identifier: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      resolve_doc_citations: { Args: never; Returns: number }
      resolve_usc_citations: { Args: never; Returns: number }
      source_toc: {
        Args: { p_source: string }
        Returns: {
          doc_count: number
          part_group: string
          title_group: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
