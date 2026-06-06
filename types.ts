export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          short_name: string
          flag_url: string | null
          group_name: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      fixtures: {
        Row: {
          id: string
          home_team_id: string
          away_team_id: string
          kickoff_at: string
          stage: string
          group_name: string | null
          venue: string | null
          actual_home_score: number | null
          actual_away_score: number | null
          status: 'upcoming' | 'live' | 'completed'
          external_id: string | null
          last_synced_at: string | null
          round_number: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fixtures']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fixtures']['Insert']>
      }
      predictions: {
        Row: {
          id: string
          user_id: string
          match_id: string
          home_score: number
          away_score: number
          points_earned: number | null
          submitted_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['predictions']['Row'], 'id' | 'submitted_at' | 'updated_at' | 'points_earned'>
        Update: Partial<Pick<Database['public']['Tables']['predictions']['Row'], 'home_score' | 'away_score'>>
      }
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          phone: string
          pin_hash: string | null
          auth_user_id: string | null
          is_registered: boolean
          requires_pin_reset: boolean
          avatar_url: string | null
          total_points: number
          last_login_at: string | null
          login_attempts: number
          locked_until: string | null
          pin_reset_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Pick<Database['public']['Tables']['profiles']['Row'], 'username' | 'display_name' | 'phone'>
        Update: Partial<Pick<Database['public']['Tables']['profiles']['Row'],
          'username' | 'display_name' | 'avatar_url'>>
      }
      notification_log: {
        Row: {
          id: string
          user_id: string | null
          type: 'match_alert' | 'leaderboard_summary'
          match_id: string | null
          phone: string
          message: string
          twilio_sid: string | null
          status: 'pending' | 'sent' | 'failed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notification_log']['Row'], 'id' | 'created_at' | 'status'>
        Update: Partial<Pick<Database['public']['Tables']['notification_log']['Row'], 'twilio_sid' | 'status'>>
      }
    }
    Views: {
      leaderboard: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          total_points: number
          rank: number
          predictions_made: number
          exact_scores: number
          correct_results: number
          wrong_picks: number
        }
      }
    }
    Functions: {
      lookup_profile_by_phone: {
        Args: { p_phone: string }
        Returns: Array<{
          id: string
          display_name: string | null
          is_registered: boolean
          locked_until: string | null
          login_attempts: number
        }>
      }
      verify_pin_and_get_session: {
        Args: { p_phone: string; p_pin: string }
        Returns: Array<{
          success: boolean
          profile_id: string | null
          auth_user_id: string | null
          error_code: string | null
        }>
      }
      register_pin: {
        Args: { p_phone: string; p_pin: string; p_auth_uid: string }
        Returns: Array<{ success: boolean; error_code: string | null }>
      }
      admin_settle_match: {
        Args: { p_match_id: string; p_home_score: number; p_away_score: number; p_admin_uid: string }
        Returns: Array<{ success: boolean; predictions_settled: number; error_code: string | null }>
      }
      settle_predictions: {
        Args: { p_match_id: string }
        Returns: void
      }
      admin_reset_pin: {
        Args: { p_profile_phone: string; p_temp_pin: string; p_admin_uid: string }
        Returns: Array<{ success: boolean; display_name: string | null; error_code: string | null }>
      }
      set_new_pin_after_reset: {
        Args: { p_phone: string; p_new_pin: string }
        Returns: Array<{ success: boolean; error_code: string | null }>
      }
      admin_bulk_import_players: {
        Args: { p_players: unknown; p_admin_uid: string }
        Returns: Array<{ phone: string; display_name: string; status: string; message: string }>
      }
      admin_upsert_fixture: {
        Args: {
          p_external_id: string; p_home_team_id: string; p_away_team_id: string
          p_kickoff_at: string; p_stage: string; p_group_name: string | null
          p_venue: string | null; p_round_number: number; p_admin_uid: string
        }
        Returns: Array<{ success: boolean; fixture_id: string; action: string; error_code: string | null }>
      }
    }
  }
}

// Convenience types — pin_hash is omitted from the client-safe version
export type Team = Database['public']['Tables']['teams']['Row']
export type Fixture = Database['public']['Tables']['fixtures']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']
export type LeaderboardEntry = Database['public']['Views']['leaderboard']['Row']

// Client-safe profile (never includes pin_hash)
export type Profile = Omit<Database['public']['Tables']['profiles']['Row'], 'pin_hash'>

export type FixtureWithTeams = Fixture & {
  home_team: Team
  away_team: Team
  user_prediction?: Prediction | null
}

// Auth flow states
export type AuthStep =
  | 'phone_entry'       // Enter phone number
  | 'not_invited'       // Phone not in profiles
  | 'set_pin'           // First time — set a PIN
  | 'enter_pin'         // Returning user — enter PIN
  | 'locked'            // Too many attempts
  | 'authenticated'     // Session active
