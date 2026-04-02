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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string | null
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cheer_types: {
        Row: {
          emoji: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          emoji: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          emoji?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cheers: {
        Row: {
          cheer_type_id: string
          created_at: string
          giver_id: string
          id: string
          match_id: string | null
          receiver_id: string
          session_id: string
        }
        Insert: {
          cheer_type_id: string
          created_at?: string
          giver_id: string
          id?: string
          match_id?: string | null
          receiver_id: string
          session_id: string
        }
        Update: {
          cheer_type_id?: string
          created_at?: string
          giver_id?: string
          id?: string
          match_id?: string | null
          receiver_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheers_cheer_type_id_fkey"
            columns: ["cheer_type_id"]
            isOneToOne: false
            referencedRelation: "cheer_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          completed_at: string
          id: string
          match_id: string
          winning_pair_index: number
        }
        Insert: {
          completed_at?: string
          id?: string
          match_id: string
          winning_pair_index: number
        }
        Update: {
          completed_at?: string
          id?: string
          match_id?: string
          winning_pair_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          court_number: number | null
          created_at: string
          id: string
          queue_position: number
          session_id: string
          status: Database["public"]["Enums"]["match_status"]
          team1_player1_id: string
          team1_player2_id: string
          team2_player1_id: string
          team2_player2_id: string
        }
        Insert: {
          court_number?: number | null
          created_at?: string
          id?: string
          queue_position: number
          session_id: string
          status?: Database["public"]["Enums"]["match_status"]
          team1_player1_id: string
          team1_player2_id: string
          team2_player1_id: string
          team2_player2_id: string
        }
        Update: {
          court_number?: number | null
          created_at?: string
          id?: string
          queue_position?: number
          session_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          team1_player1_id?: string
          team1_player2_id?: string
          team2_player1_id?: string
          team2_player2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cheer_stats: {
        Row: {
          cheers_given: number
          cheers_received: number
          defense_received: number
          good_sport_received: number
          movement_received: number
          offense_received: number
          player_id: string
          solid_effort_received: number
          technique_received: number
          updated_at: string
        }
        Insert: {
          cheers_given?: number
          cheers_received?: number
          defense_received?: number
          good_sport_received?: number
          movement_received?: number
          offense_received?: number
          player_id: string
          solid_effort_received?: number
          technique_received?: number
          updated_at?: string
        }
        Update: {
          cheers_given?: number
          cheers_received?: number
          defense_received?: number
          good_sport_received?: number
          movement_received?: number
          offense_received?: number
          player_id?: string
          solid_effort_received?: number
          technique_received?: number
          updated_at?: string
        }
        Relationships: []
      }
      player_pair_stats: {
        Row: {
          losses_against: number
          other_player_id: string
          player_id: string
          updated_at: string
          wins_together: number
        }
        Insert: {
          losses_against?: number
          other_player_id: string
          player_id: string
          updated_at?: string
          wins_together?: number
        }
        Update: {
          losses_against?: number
          other_player_id?: string
          player_id?: string
          updated_at?: string
          wins_together?: number
        }
        Relationships: []
      }
      player_stats: {
        Row: {
          games_played: number
          player_id: string
          sessions_attended: number
          updated_at: string
          wins: number
        }
        Insert: {
          games_played?: number
          player_id: string
          sessions_attended?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          games_played?: number
          player_id?: string
          sessions_attended?: number
          updated_at?: string
          wins?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          gender: string | null
          id: string
          level: number | null
          name_slug: string
          nickname: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          gender?: string | null
          id: string
          level?: number | null
          name_slug: string
          nickname?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          level?: number | null
          name_slug?: string
          nickname?: string | null
          role?: string
        }
        Relationships: []
      }
      session_invitations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_players: number | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_players?: number | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_players?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_invitations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_registrations: {
        Row: {
          gender: string | null
          id: string
          level: number | null
          player_id: string
          registered_at: string
          session_id: string
          source: string
        }
        Insert: {
          gender?: string | null
          id?: string
          level?: number | null
          player_id: string
          registered_at?: string
          session_id: string
          source?: string
        }
        Update: {
          gender?: string | null
          id?: string
          level?: number | null
          player_id?: string
          registered_at?: string
          session_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_registrations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          date: string
          duration: string | null
          id: string
          name: string
          price: number | null
          registration_opens_at: string | null
          session_notes: string | null
          status: Database["public"]["Enums"]["session_status"]
          time: string | null
          venue: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          date: string
          duration?: string | null
          id?: string
          name: string
          price?: number | null
          registration_opens_at?: string | null
          session_notes?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          time?: string | null
          venue?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          date?: string
          duration?: string | null
          id?: string
          name?: string
          price?: number | null
          registration_opens_at?: string | null
          session_notes?: string | null
          status?: Database["public"]["Enums"]["session_status"]
          time?: string | null
          venue?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reverse_session_stats: { Args: { p_session_id: string }; Returns: string }
    }
    Enums: {
      match_status: "queued" | "playing" | "complete"
      session_status:
        | "setup"
        | "registration_open"
        | "registration_closed"
        | "schedule_locked"
        | "in_progress"
        | "complete"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      match_status: ["queued", "playing", "complete"],
      session_status: [
        "setup",
        "registration_open",
        "registration_closed",
        "schedule_locked",
        "in_progress",
        "complete",
      ],
    },
  },
} as const
