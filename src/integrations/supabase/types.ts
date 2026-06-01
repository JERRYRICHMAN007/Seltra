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
      agent_invocations: {
        Row: {
          action_type: string | null
          created_at: string
          error_message: string | null
          id: string
          input_tokens: number | null
          latency_ms: number | null
          merchant_id: string | null
          model: string | null
          output_tokens: number | null
          success: boolean
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          merchant_id?: string | null
          model?: string | null
          output_tokens?: number | null
          success?: boolean
        }
        Update: {
          action_type?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_tokens?: number | null
          latency_ms?: number | null
          merchant_id?: string | null
          model?: string | null
          output_tokens?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "agent_invocations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          created_at: string
          endpoint: string | null
          id: string
          latency_ms: number | null
          merchant_id: string | null
          method: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          id?: string
          latency_ms?: number | null
          merchant_id?: string | null
          method?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          id?: string
          latency_ms?: number | null
          merchant_id?: string | null
          method?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_usage: {
        Row: {
          feature: string
          id: string
          merchant_id: string | null
          used_at: string
        }
        Insert: {
          feature: string
          id?: string
          merchant_id?: string | null
          used_at?: string
        }
        Update: {
          feature?: string
          id?: string
          merchant_id?: string | null
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_usage_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_applications: {
        Row: {
          ai_familiarity: string | null
          allow_ai_responses: boolean | null
          approved_at: string | null
          based_in: string | null
          business_name: string | null
          business_type: string | null
          created_at: string
          email: string | null
          existing_links: string | null
          full_name: string
          id: string
          merchant_id: string | null
          monthly_revenue: string | null
          phone: string | null
          review_notes: string | null
          reviewed_by: string | null
          status: string
          store_name: string | null
          what_you_sell: string | null
        }
        Insert: {
          ai_familiarity?: string | null
          allow_ai_responses?: boolean | null
          approved_at?: string | null
          based_in?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          email?: string | null
          existing_links?: string | null
          full_name: string
          id?: string
          merchant_id?: string | null
          monthly_revenue?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          store_name?: string | null
          what_you_sell?: string | null
        }
        Update: {
          ai_familiarity?: string | null
          allow_ai_responses?: boolean | null
          approved_at?: string | null
          based_in?: string | null
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          email?: string | null
          existing_links?: string | null
          full_name?: string
          id?: string
          merchant_id?: string | null
          monthly_revenue?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          status?: string
          store_name?: string | null
          what_you_sell?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "ops_users"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          based_in: string | null
          business_type: string | null
          created_at: string
          id: string
          last_active_at: string | null
          monthly_revenue_stage: string | null
          name: string
          onboarded_at: string | null
          owner_email: string | null
          owner_name: string | null
          slug: string
          status: string
          store_url: string | null
        }
        Insert: {
          based_in?: string | null
          business_type?: string | null
          created_at?: string
          id?: string
          last_active_at?: string | null
          monthly_revenue_stage?: string | null
          name: string
          onboarded_at?: string | null
          owner_email?: string | null
          owner_name?: string | null
          slug: string
          status?: string
          store_url?: string | null
        }
        Update: {
          based_in?: string | null
          business_type?: string | null
          created_at?: string
          id?: string
          last_active_at?: string | null
          monthly_revenue_stage?: string | null
          name?: string
          onboarded_at?: string | null
          owner_email?: string | null
          owner_name?: string | null
          slug?: string
          status?: string
          store_url?: string | null
        }
        Relationships: []
      }
      ops_users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          last_login_at: string | null
          name: string | null
          role: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          last_login_at?: string | null
          name?: string | null
          role?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string | null
          role?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          disbursed: boolean
          id: string
          items: Json | null
          merchant_amount: number
          merchant_id: string | null
          paystack_ref: string | null
          seltra_fee: number
          status: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          disbursed?: boolean
          id?: string
          items?: Json | null
          merchant_amount?: number
          merchant_id?: string | null
          paystack_ref?: string | null
          seltra_fee?: number
          status?: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          disbursed?: boolean
          id?: string
          items?: Json | null
          merchant_amount?: number
          merchant_id?: string | null
          paystack_ref?: string | null
          seltra_fee?: number
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          disbursed: boolean
          disbursed_at: string | null
          id: string
          merchant_amount: number
          merchant_id: string | null
          paystack_ref: string | null
          seltra_fee: number
          status: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          disbursed?: boolean
          disbursed_at?: string | null
          id?: string
          merchant_amount?: number
          merchant_id?: string | null
          paystack_ref?: string | null
          seltra_fee?: number
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          disbursed?: boolean
          disbursed_at?: string | null
          id?: string
          merchant_amount?: number
          merchant_id?: string | null
          paystack_ref?: string | null
          seltra_fee?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          merchant_id: string | null
          payload: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          merchant_id?: string | null
          payload?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          merchant_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_events_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health: {
        Row: {
          checked_at: string
          error_rate: number | null
          id: string
          latency_ms: number | null
          service: string
          status: string
        }
        Insert: {
          checked_at?: string
          error_rate?: number | null
          id?: string
          latency_ms?: number | null
          service: string
          status: string
        }
        Update: {
          checked_at?: string
          error_rate?: number | null
          id?: string
          latency_ms?: number | null
          service?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_ops_user: { Args: never; Returns: boolean }
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
