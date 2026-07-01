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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string | null
          id: number
          payload: Json | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          payload?: Json | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          payload?: Json | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      agent_roles: {
        Row: {
          color: string | null
          created_at: string | null
          description_fr: string | null
          icon: string | null
          id: string
          is_selectable: boolean | null
          label_en: string
          label_fr: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_fr?: string | null
          icon?: string | null
          id?: string
          is_selectable?: boolean | null
          label_en: string
          label_fr: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_fr?: string | null
          icon?: string | null
          id?: string
          is_selectable?: boolean | null
          label_en?: string
          label_fr?: string
          slug?: string
        }
        Relationships: []
      }
      agent_titles: {
        Row: {
          agent_id: string | null
          id: string
          source: string | null
          title_id: string | null
          unlocked_at: string | null
        }
        Insert: {
          agent_id?: string | null
          id?: string
          source?: string | null
          title_id?: string | null
          unlocked_at?: string | null
        }
        Update: {
          agent_id?: string | null
          id?: string
          source?: string | null
          title_id?: string | null
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_titles_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      botanica_mutation_pots: {
        Row: {
          growth_stage: number | null
          id: string
          quality_tier_id: number | null
          ready_at: string | null
          result_species_id: number | null
          species_a_id: number | null
          species_b_id: number | null
          started_at: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          growth_stage?: number | null
          id?: string
          quality_tier_id?: number | null
          ready_at?: string | null
          result_species_id?: number | null
          species_a_id?: number | null
          species_b_id?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          growth_stage?: number | null
          id?: string
          quality_tier_id?: number | null
          ready_at?: string | null
          result_species_id?: number | null
          species_a_id?: number | null
          species_b_id?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mutation_pots_result_species_id_fkey"
            columns: ["result_species_id"]
            isOneToOne: false
            referencedRelation: "botanica_species"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutation_pots_species_a_id_fkey"
            columns: ["species_a_id"]
            isOneToOne: false
            referencedRelation: "botanica_species"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutation_pots_species_b_id_fkey"
            columns: ["species_b_id"]
            isOneToOne: false
            referencedRelation: "botanica_species"
            referencedColumns: ["id"]
          },
        ]
      }
      botanica_player_data: {
        Row: {
          avatar_url: string | null
          codex_count: number
          coins: number
          created_at: string | null
          display_name: string | null
          last_active: string | null
          last_seed_claimed_at: string | null
          level: number
          onboarded_at: string | null
          onboarding_completed: boolean
          onboarding_done: boolean
          onboarding_done_at: string | null
          pot_slots: number
          user_id: string
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          codex_count?: number
          coins?: number
          created_at?: string | null
          display_name?: string | null
          last_active?: string | null
          last_seed_claimed_at?: string | null
          level?: number
          onboarded_at?: string | null
          onboarding_completed?: boolean
          onboarding_done?: boolean
          onboarding_done_at?: string | null
          pot_slots?: number
          user_id: string
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          codex_count?: number
          coins?: number
          created_at?: string | null
          display_name?: string | null
          last_active?: string | null
          last_seed_claimed_at?: string | null
          level?: number
          onboarded_at?: string | null
          onboarding_completed?: boolean
          onboarding_done?: boolean
          onboarding_done_at?: string | null
          pot_slots?: number
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      cards: {
        Row: {
          artwork_url: string | null
          created_at: string
          description: string | null
          energy: number
          id: string
          is_banned: boolean
          name: string
          power: number
          rarity: string
          set_code: string | null
          shield: number
          skill: Json | null
          slots: number
          type: string
          updated_at: string
        }
        Insert: {
          artwork_url?: string | null
          created_at?: string
          description?: string | null
          energy?: number
          id: string
          is_banned?: boolean
          name: string
          power?: number
          rarity: string
          set_code?: string | null
          shield?: number
          skill?: Json | null
          slots?: number
          type: string
          updated_at?: string
        }
        Update: {
          artwork_url?: string | null
          created_at?: string
          description?: string | null
          energy?: number
          id?: string
          is_banned?: boolean
          name?: string
          power?: number
          rarity?: string
          set_code?: string | null
          shield?: number
          skill?: Json | null
          slots?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chronicles_ledger: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          meta: Json | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          meta?: Json | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          meta?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pack_types: {
        Row: {
          card_count: number
          created_at: string
          id: string
          image_name: string | null
          is_active: boolean
          name: string
          price: number
          set_id: string
          updated_at: string
        }
        Insert: {
          card_count?: number
          created_at?: string
          id?: string
          image_name?: string | null
          is_active?: boolean
          name: string
          price?: number
          set_id: string
          updated_at?: string
        }
        Update: {
          card_count?: number
          created_at?: string
          id?: string
          image_name?: string | null
          is_active?: boolean
          name?: string
          price?: number
          set_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_roles: {
        Row: {
          assigned_at: string | null
          id: string
          profile_id: string
          role_slug: string
        }
        Insert: {
          assigned_at?: string | null
          id?: string
          profile_id: string
          role_slug: string
        }
        Update: {
          assigned_at?: string | null
          id?: string
          profile_id?: string
          role_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_role_slug_fkey"
            columns: ["role_slug"]
            isOneToOne: false
            referencedRelation: "agent_roles"
            referencedColumns: ["slug"]
          },
        ]
      }
      profile_titles: {
        Row: {
          id: string
          profile_id: string | null
          title_slug: string | null
          unlocked_at: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          title_slug?: string | null
          unlocked_at?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          title_slug?: string | null
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_titles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_titles_title_slug_fkey"
            columns: ["title_slug"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          active_title: string | null
          avatar_frame: string | null
          avatar_url: string | null
          bio: string | null
          chronicles: number
          created_at: string | null
          email: string | null
          gaming_cache: Json | null
          id: string
          joined_at: string | null
          lang: string | null
          lol_id: string | null
          onboarding_done: boolean
          rl_id: string | null
          role: string | null
          specialty: string | null
          specialty_id: string | null
          titles: string[] | null
          username: string | null
        }
        Insert: {
          active_title?: string | null
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          chronicles?: number
          created_at?: string | null
          email?: string | null
          gaming_cache?: Json | null
          id: string
          joined_at?: string | null
          lang?: string | null
          lol_id?: string | null
          onboarding_done?: boolean
          rl_id?: string | null
          role?: string | null
          specialty?: string | null
          specialty_id?: string | null
          titles?: string[] | null
          username?: string | null
        }
        Update: {
          active_title?: string | null
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          chronicles?: number
          created_at?: string | null
          email?: string | null
          gaming_cache?: Json | null
          id?: string
          joined_at?: string | null
          lang?: string | null
          lol_id?: string | null
          onboarding_done?: boolean
          rl_id?: string | null
          role?: string | null
          specialty?: string | null
          specialty_id?: string | null
          titles?: string[] | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: string | null
          code_name: string
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          display_name: string
          icon: string | null
          id: string
          is_active: boolean
          require_login: boolean
          sort_order: number | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          category?: string | null
          code_name: string
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_active?: boolean
          require_login?: boolean
          sort_order?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          category?: string | null
          code_name?: string
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          require_login?: boolean
          sort_order?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      specialties: {
        Row: {
          color: string | null
          created_at: string | null
          description_fr: string | null
          icon: string | null
          id: string
          is_selectable: boolean | null
          label_en: string
          label_fr: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_fr?: string | null
          icon?: string | null
          id?: string
          is_selectable?: boolean | null
          label_en: string
          label_fr: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_fr?: string | null
          icon?: string | null
          id?: string
          is_selectable?: boolean | null
          label_en?: string
          label_fr?: string
          slug?: string
        }
        Relationships: []
      }
      tcg_players: {
        Row: {
          cards_count: number
          chronicles: number
          created_at: string
          daily_streak: number
          duels_won: number
          has_legendary: boolean
          id: string
          last_daily_at: string | null
          pack_count: number
          updated_at: string
          username: string | null
        }
        Insert: {
          cards_count?: number
          chronicles?: number
          created_at?: string
          daily_streak?: number
          duels_won?: number
          has_legendary?: boolean
          id: string
          last_daily_at?: string | null
          pack_count?: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          cards_count?: number
          chronicles?: number
          created_at?: string
          daily_streak?: number
          duels_won?: number
          has_legendary?: boolean
          id?: string
          last_daily_at?: string | null
          pack_count?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      titles: {
        Row: {
          category: string | null
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          id: string
          is_active: boolean | null
          label_en: string
          label_fr: string
          price_coins: number | null
          rarity: string | null
          slug: string
          unlock_type: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          id?: string
          is_active?: boolean | null
          label_en: string
          label_fr: string
          price_coins?: number | null
          rarity?: string | null
          slug: string
          unlock_type?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          id?: string
          is_active?: boolean | null
          label_en?: string
          label_fr?: string
          price_coins?: number | null
          rarity?: string | null
          slug?: string
          unlock_type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      botanica_leaderboard: {
        Row: {
          avatar_url: string | null
          codex_count: number | null
          display_name: string | null
          level: number | null
          rank: number | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _is_superuser: { Args: never; Returns: boolean }
      admin_grant_chronicles: {
        Args: { p_amount: number; p_target_user_id: string }
        Returns: Json
      }
      claim_daily_login: { Args: never; Returns: Json }
      claim_quest: { Args: { p_quest_id: string }; Returns: Json }
      complete_onboarding: { Args: never; Returns: Json }
      ensure_tcg_player: { Args: never; Returns: Json }
      get_tcg_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          cards_count: number
          duels_won: number
          gold: number
          has_legendary: boolean
          id: string
          username: string
        }[]
      }
      grant_title: {
        Args: { p_slug: string; p_user_id: string }
        Returns: undefined
      }
      load_squad: { Args: { p_squad_id?: string }; Returns: Json }
      save_squad: { Args: { p_squad: Json }; Returns: Json }
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

export const Constants = {
  public: {
    Enums: {},
  },
} as const
