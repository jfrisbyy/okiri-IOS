/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievement_counters: {
        Row: {
          daily_challenges: number | null
          gaps_from_news: number | null
          gaps_from_video: number | null
          grammar_gaps: number | null
          id: string
          listening_sessions: number | null
          news_articles_read: number | null
          perfect_lessons: number | null
          phrase_gaps: number | null
          speaking_sessions: number | null
          speed_lessons: number | null
          updated_at: string | null
          user_id: string
          videos_watched: number | null
        }
        Insert: {
          daily_challenges?: number | null
          gaps_from_news?: number | null
          gaps_from_video?: number | null
          grammar_gaps?: number | null
          id?: string
          listening_sessions?: number | null
          news_articles_read?: number | null
          perfect_lessons?: number | null
          phrase_gaps?: number | null
          speaking_sessions?: number | null
          speed_lessons?: number | null
          updated_at?: string | null
          user_id: string
          videos_watched?: number | null
        }
        Update: {
          daily_challenges?: number | null
          gaps_from_news?: number | null
          gaps_from_video?: number | null
          grammar_gaps?: number | null
          id?: string
          listening_sessions?: number | null
          news_articles_read?: number | null
          perfect_lessons?: number | null
          phrase_gaps?: number | null
          speaking_sessions?: number | null
          speed_lessons?: number | null
          updated_at?: string | null
          user_id?: string
          videos_watched?: number | null
        }
        Relationships: []
      }
      achievements: {
        Row: {
          achievement_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          audio_url: string | null
          created_at: string | null
          fluency_metrics: Json | null
          grammar_errors: Json | null
          id: string
          pronunciation_score: number | null
          role: string
          sequence_number: number
          session_id: string | null
          text_content: string
          vocabulary_highlights: Json | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          fluency_metrics?: Json | null
          grammar_errors?: Json | null
          id?: string
          pronunciation_score?: number | null
          role: string
          sequence_number: number
          session_id?: string | null
          text_content: string
          vocabulary_highlights?: Json | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          fluency_metrics?: Json | null
          grammar_errors?: Json | null
          id?: string
          pronunciation_score?: number | null
          role?: string
          sequence_number?: number
          session_id?: string | null
          text_content?: string
          vocabulary_highlights?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sessions: {
        Row: {
          cefr_level_at_start: string
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          fluency_score_avg: number | null
          grammar_score_avg: number | null
          id: string
          new_vocabulary_count: number | null
          overall_score: number | null
          pronunciation_score_avg: number | null
          scenario_id: string
          status: string | null
          target_language: string
          total_messages: number | null
          user_id: string
        }
        Insert: {
          cefr_level_at_start: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          fluency_score_avg?: number | null
          grammar_score_avg?: number | null
          id?: string
          new_vocabulary_count?: number | null
          overall_score?: number | null
          pronunciation_score_avg?: number | null
          scenario_id: string
          status?: string | null
          target_language?: string
          total_messages?: number | null
          user_id: string
        }
        Update: {
          cefr_level_at_start?: string
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          fluency_score_avg?: number | null
          grammar_score_avg?: number | null
          id?: string
          new_vocabulary_count?: number | null
          overall_score?: number | null
          pronunciation_score_avg?: number | null
          scenario_id?: string
          status?: string | null
          target_language?: string
          total_messages?: number | null
          user_id?: string
        }
        Relationships: []
      }
      game_state: {
        Row: {
          combo_multiplier: number | null
          daily_xp: number | null
          hearts: number | null
          id: string
          last_activity_date: string | null
          last_heart_regen_at: string | null
          lessons_today: number | null
          max_hearts: number | null
          streak_days: number | null
          streak_start_date: string | null
          total_xp: number | null
          updated_at: string | null
          user_id: string
          xp_goal: number | null
          xp_multiplier: number | null
          xp_multiplier_expires_at: string | null
          xp_today: number | null
        }
        Insert: {
          combo_multiplier?: number | null
          daily_xp?: number | null
          hearts?: number | null
          id?: string
          last_activity_date?: string | null
          last_heart_regen_at?: string | null
          lessons_today?: number | null
          max_hearts?: number | null
          streak_days?: number | null
          streak_start_date?: string | null
          total_xp?: number | null
          updated_at?: string | null
          user_id: string
          xp_goal?: number | null
          xp_multiplier?: number | null
          xp_multiplier_expires_at?: string | null
          xp_today?: number | null
        }
        Update: {
          combo_multiplier?: number | null
          daily_xp?: number | null
          hearts?: number | null
          id?: string
          last_activity_date?: string | null
          last_heart_regen_at?: string | null
          lessons_today?: number | null
          max_hearts?: number | null
          streak_days?: number | null
          streak_start_date?: string | null
          total_xp?: number | null
          updated_at?: string | null
          user_id?: string
          xp_goal?: number | null
          xp_multiplier?: number | null
          xp_multiplier_expires_at?: string | null
          xp_today?: number | null
        }
        Relationships: []
      }
      gap_items: {
        Row: {
          added_to_deck: boolean | null
          audio_uri: string | null
          category: string | null
          concept_label: string | null
          consecutive_correct: number | null
          created_at: string | null
          difficulty: string | null
          ease_factor: number | null
          english_translation: string
          example_sentence: string | null
          example_translation: string | null
          explanation: string | null
          french_word: string
          id: string
          interval_days: number | null
          is_grammar_error: boolean | null
          is_phrase: boolean | null
          last_reviewed_at: string | null
          mastered: boolean | null
          next_review_at: string | null
          pronunciation: string | null
          review_count: number | null
          source_content_id: string | null
          source_title: string | null
          source_type: string | null
          teaching_focus: string | null
          type: string | null
          user_id: string
          user_note: string | null
        }
        Insert: {
          added_to_deck?: boolean | null
          audio_uri?: string | null
          category?: string | null
          concept_label?: string | null
          consecutive_correct?: number | null
          created_at?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          english_translation: string
          example_sentence?: string | null
          example_translation?: string | null
          explanation?: string | null
          french_word: string
          id: string
          interval_days?: number | null
          is_grammar_error?: boolean | null
          is_phrase?: boolean | null
          last_reviewed_at?: string | null
          mastered?: boolean | null
          next_review_at?: string | null
          pronunciation?: string | null
          review_count?: number | null
          source_content_id?: string | null
          source_title?: string | null
          source_type?: string | null
          teaching_focus?: string | null
          type?: string | null
          user_id: string
          user_note?: string | null
        }
        Update: {
          added_to_deck?: boolean | null
          audio_uri?: string | null
          category?: string | null
          concept_label?: string | null
          consecutive_correct?: number | null
          created_at?: string | null
          difficulty?: string | null
          ease_factor?: number | null
          english_translation?: string
          example_sentence?: string | null
          example_translation?: string | null
          explanation?: string | null
          french_word?: string
          id?: string
          interval_days?: number | null
          is_grammar_error?: boolean | null
          is_phrase?: boolean | null
          last_reviewed_at?: string | null
          mastered?: boolean | null
          next_review_at?: string | null
          pronunciation?: string | null
          review_count?: number | null
          source_content_id?: string | null
          source_title?: string | null
          source_type?: string | null
          teaching_focus?: string | null
          type?: string | null
          user_id?: string
          user_note?: string | null
        }
        Relationships: []
      }
      // One row per user holding the iOS learner state as JSON (`snapshot` is a
      // ProgressSnapshot; its `schemaVersion` is checked by the app and rows
      // from a newer app version are never applied).
      //
      // Reconcile rule (ios/FluentFrenchIOS/Services/SnapshotReconciler.swift):
      //   1. No row for the user            -> the device uploads its local state
      //      (first sign-in migration). This is the only time local state is
      //      pushed without comparing.
      //   2. `updated_at` (server clock, set by trigger — see
      //      backend/migrations/0001_progress_snapshots_updated_at_trigger.sql)
      //      is the primary tiebreak: the device remembers the row's
      //      `updated_at` from its last successful sync; if the row has not
      //      moved since, the device's newer local work is pushed; if the row
      //      moved and the device has no local work, the row is applied.
      //   3. `client_updated_at` (device clock, mirrors snapshot.clientUpdatedAt)
      //      is only the fallback when a server timestamp is missing on either
      //      side or both sides changed; newest wins, the row wins ties.
      // Fetch errors are never treated as "no row".
      ios_progress_snapshots: {
        Row: {
          client_updated_at: string
          snapshot: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          client_updated_at?: string
          snapshot: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          client_updated_at?: string
          snapshot?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      module_progress: {
        Row: {
          certification_date: string | null
          certified: boolean | null
          checkpoint_passed: boolean | null
          completed_lessons: string[] | null
          id: string
          module_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          certification_date?: string | null
          certified?: boolean | null
          checkpoint_passed?: boolean | null
          completed_lessons?: string[] | null
          id?: string
          module_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          certification_date?: string | null
          certified?: boolean | null
          checkpoint_passed?: boolean | null
          completed_lessons?: string[] | null
          id?: string
          module_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      proficiency_records: {
        Row: {
          details: Json | null
          id: string
          recorded_at: string | null
          score: number
          skill: string
          source: string | null
          user_id: string
        }
        Insert: {
          details?: Json | null
          id?: string
          recorded_at?: string | null
          score: number
          skill: string
          source?: string | null
          user_id: string
        }
        Update: {
          details?: Json | null
          id?: string
          recorded_at?: string | null
          score?: number
          skill?: string
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      proficiency_state: {
        Row: {
          grammar_score: number | null
          id: string
          listening_score: number | null
          overall_level: string | null
          pronunciation_score: number | null
          reading_score: number | null
          speaking_score: number | null
          updated_at: string | null
          user_id: string
          vocab_score: number | null
        }
        Insert: {
          grammar_score?: number | null
          id?: string
          listening_score?: number | null
          overall_level?: string | null
          pronunciation_score?: number | null
          reading_score?: number | null
          speaking_score?: number | null
          updated_at?: string | null
          user_id: string
          vocab_score?: number | null
        }
        Update: {
          grammar_score?: number | null
          id?: string
          listening_score?: number | null
          overall_level?: string | null
          pronunciation_score?: number | null
          reading_score?: number | null
          speaking_score?: number | null
          updated_at?: string | null
          user_id?: string
          vocab_score?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cefr_level: string | null
          created_at: string | null
          goal: string | null
          id: string
          level: string | null
          name: string | null
          onboarding_completed: boolean | null
          preferred_accent: string | null
          region: string | null
          updated_at: string | null
        }
        Insert: {
          cefr_level?: string | null
          created_at?: string | null
          goal?: string | null
          id: string
          level?: string | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferred_accent?: string | null
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          cefr_level?: string | null
          created_at?: string | null
          goal?: string | null
          id?: string
          level?: string | null
          name?: string | null
          onboarding_completed?: boolean | null
          preferred_accent?: string | null
          region?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      speech_recordings: {
        Row: {
          accuracy_score: number | null
          actual_duration: number | null
          audio_uri: string | null
          completeness_score: number | null
          created_at: string | null
          duration: number | null
          fluency_score: number | null
          fluency_suggestions: Json | null
          grammar_errors: Json | null
          id: string
          prompt: string | null
          pron_score_version: number | null
          pronunciation_score: number | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          actual_duration?: number | null
          audio_uri?: string | null
          completeness_score?: number | null
          created_at?: string | null
          duration?: number | null
          fluency_score?: number | null
          fluency_suggestions?: Json | null
          grammar_errors?: Json | null
          id: string
          prompt?: string | null
          pron_score_version?: number | null
          pronunciation_score?: number | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          actual_duration?: number | null
          audio_uri?: string | null
          completeness_score?: number | null
          created_at?: string | null
          duration?: number | null
          fluency_score?: number | null
          fluency_suggestions?: Json | null
          grammar_errors?: Json | null
          id?: string
          prompt?: string | null
          pron_score_version?: number | null
          pronunciation_score?: number | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      translation_cache: {
        Row: {
          context: string
          created_at: string
          direction: string
          fingerprint: string
          hits: number
          kind: string
          result: Json
          term: string
          updated_at: string
        }
        Insert: {
          context?: string
          created_at?: string
          direction?: string
          fingerprint: string
          hits?: number
          kind: string
          result: Json
          term: string
          updated_at?: string
        }
        Update: {
          context?: string
          created_at?: string
          direction?: string
          fingerprint?: string
          hits?: number
          kind?: string
          result?: Json
          term?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          average_reading_without_help: number | null
          gaps_created: number | null
          gaps_mastered: number | null
          id: string
          reading_sessions: number | null
          total_speaking_minutes: number | null
          updated_at: string | null
          user_id: string
          weekly_gaps_created: number | null
          weekly_gaps_mastered: number | null
          weekly_reading_sessions: number | null
          weekly_speaking_minutes: number | null
        }
        Insert: {
          average_reading_without_help?: number | null
          gaps_created?: number | null
          gaps_mastered?: number | null
          id?: string
          reading_sessions?: number | null
          total_speaking_minutes?: number | null
          updated_at?: string | null
          user_id: string
          weekly_gaps_created?: number | null
          weekly_gaps_mastered?: number | null
          weekly_reading_sessions?: number | null
          weekly_speaking_minutes?: number | null
        }
        Update: {
          average_reading_without_help?: number | null
          gaps_created?: number | null
          gaps_mastered?: number | null
          id?: string
          reading_sessions?: number | null
          total_speaking_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_gaps_created?: number | null
          weekly_gaps_mastered?: number | null
          weekly_reading_sessions?: number | null
          weekly_speaking_minutes?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
