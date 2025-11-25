export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      booking_dates: {
        Row: {
          booking_date: string
          booking_id: string
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          id: string
          stall_instance_id: string
          status: Database["public"]["Enums"]["stall_date_status"]
        }
        Insert: {
          booking_date: string
          booking_id: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          id?: string
          stall_instance_id: string
          status?: Database["public"]["Enums"]["stall_date_status"]
        }
        Update: {
          booking_date?: string
          booking_id?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          id?: string
          stall_instance_id?: string
          status?: Database["public"]["Enums"]["stall_date_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_dates_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_dates_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_dates_stall_instance_id_fkey"
            columns: ["stall_instance_id"]
            isOneToOne: false
            referencedRelation: "stall_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_stalls: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          price_at_booking: number
          stall_instance_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          price_at_booking: number
          stall_instance_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          price_at_booking?: number
          stall_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_stalls_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_stalls_stall_instance_id_fkey"
            columns: ["stall_instance_id"]
            isOneToOne: false
            referencedRelation: "stall_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          created_by_fca_id: string | null
          days_count: number | null
          fca_notes: string | null
          hold_expires_at: string | null
          id: string
          invoice_number: string
          market_id: string
          offline_invoice_id: string | null
          offline_synced_at: string | null
          paid_amount: number
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          price_per_day: number | null
          selected_dates: string[] | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_fca_id?: string | null
          days_count?: number | null
          fca_notes?: string | null
          hold_expires_at?: string | null
          id?: string
          invoice_number: string
          market_id: string
          offline_invoice_id?: string | null
          offline_synced_at?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          price_per_day?: number | null
          selected_dates?: string[] | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_fca_id?: string | null
          days_count?: number | null
          fca_notes?: string | null
          hold_expires_at?: string | null
          id?: string
          invoice_number?: string
          market_id?: string
          offline_invoice_id?: string | null
          offline_synced_at?: string | null
          paid_amount?: number
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          price_per_day?: number | null
          selected_dates?: string[] | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      cred: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          key: string
          meta: Json
          source: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active: boolean
          key: string
          meta: Json
          source: string
          value: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          key?: string
          meta?: Json
          source?: string
          value?: string
        }
        Relationships: []
      }
      email_verifications: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_code: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      kyc_applications: {
        Row: {
          business_address: string | null
          business_name: string
          business_type: string | null
          contact_email: string
          contact_phone: string
          created_at: string
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_address?: string | null
          business_name: string
          business_type?: string | null
          contact_email: string
          contact_phone: string
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_address?: string | null
          business_name?: string
          business_type?: string | null
          contact_email?: string
          contact_phone?: string
          created_at?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
          tax_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_kyc_applications_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_audit_log: {
        Row: {
          created_at: string
          from_status: Database["public"]["Enums"]["kyc_status"] | null
          id: string
          kyc_id: string
          reason: string | null
          reviewed_by: string | null
          to_status: Database["public"]["Enums"]["kyc_status"]
        }
        Insert: {
          created_at?: string
          from_status?: Database["public"]["Enums"]["kyc_status"] | null
          id?: string
          kyc_id: string
          reason?: string | null
          reviewed_by?: string | null
          to_status: Database["public"]["Enums"]["kyc_status"]
        }
        Update: {
          created_at?: string
          from_status?: Database["public"]["Enums"]["kyc_status"] | null
          id?: string
          kyc_id?: string
          reason?: string | null
          reviewed_by?: string | null
          to_status?: Database["public"]["Enums"]["kyc_status"]
        }
        Relationships: [
          {
            foreignKeyName: "kyc_audit_log_kyc_id_fkey"
            columns: ["kyc_id"]
            isOneToOne: false
            referencedRelation: "kyc_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      market_layouts: {
        Row: {
          canvas_height: number
          canvas_width: number
          grid_size: number
          id: string
          market_id: string
          unit: string
        }
        Insert: {
          canvas_height?: number
          canvas_width?: number
          grid_size?: number
          id?: string
          market_id: string
          unit?: string
        }
        Update: {
          canvas_height?: number
          canvas_width?: number
          grid_size?: number
          id?: string
          market_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_market_layouts_market"
            columns: ["market_id"]
            isOneToOne: true
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string
          end_at: string
          id: string
          name: string
          start_at: string
          status: Database["public"]["Enums"]["market_status"]
          theme: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by: string
          end_at: string
          id?: string
          name: string
          start_at: string
          status?: Database["public"]["Enums"]["market_status"]
          theme?: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string
          end_at?: string
          id?: string
          name?: string
          start_at?: string
          status?: Database["public"]["Enums"]["market_status"]
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_sync: {
        Row: {
          account_id: string | null
          created_at: string | null
          id: string
          last_synced_at: string | null
          metadata: Json | null
          provider: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          provider: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          booking_id: string | null
          created_at: string
          currency: string | null
          id: string
          invoice_number: string | null
          metadata: Json | null
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          provider_payment_id: string
          raw_payload: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          invoice_number?: string | null
          metadata?: Json | null
          processed_at?: string | null
          provider: string
          provider_event_id?: string | null
          provider_payment_id: string
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          booking_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          invoice_number?: string | null
          metadata?: Json | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          provider_payment_id?: string
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          business_logo_url: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rbac_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stall_holds: {
        Row: {
          created_at: string
          expires_at: string
          hold_date: string | null
          id: string
          market_id: string
          selected_dates: string[]
          stall_instance_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          hold_date?: string | null
          id?: string
          market_id: string
          selected_dates: string[]
          stall_instance_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          hold_date?: string | null
          id?: string
          market_id?: string
          selected_dates?: string[]
          stall_instance_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stall_holds_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stall_holds_stall_instance_id_fkey"
            columns: ["stall_instance_id"]
            isOneToOne: false
            referencedRelation: "stall_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      stall_instances: {
        Row: {
          height: number
          id: string
          label: string
          market_id: string
          price_override: number | null
          rotation: number
          status: Database["public"]["Enums"]["stall_status"]
          template_id: string
          width: number
          x: number
          y: number
        }
        Insert: {
          height: number
          id?: string
          label: string
          market_id: string
          price_override?: number | null
          rotation?: number
          status?: Database["public"]["Enums"]["stall_status"]
          template_id: string
          width: number
          x: number
          y: number
        }
        Update: {
          height?: number
          id?: string
          label?: string
          market_id?: string
          price_override?: number | null
          rotation?: number
          status?: Database["public"]["Enums"]["stall_status"]
          template_id?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_stall_instances_market"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_stall_instances_template"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "stall_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      stall_templates: {
        Row: {
          capacity: number | null
          created_at: string
          fill_color: string
          height: number
          id: string
          name: string
          price: number
          radius: number | null
          shape: Database["public"]["Enums"]["stall_shape"]
          stroke_color: string
          tags: string[] | null
          width: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          fill_color?: string
          height?: number
          id?: string
          name: string
          price?: number
          radius?: number | null
          shape?: Database["public"]["Enums"]["stall_shape"]
          stroke_color?: string
          tags?: string[] | null
          width?: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          fill_color?: string
          height?: number
          id?: string
          name?: string
          price?: number
          radius?: number | null
          shape?: Database["public"]["Enums"]["stall_shape"]
          stroke_color?: string
          tags?: string[] | null
          width?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_booking: { Args: { p_booking_id: string }; Returns: Json }
      admin_decline_booking: { Args: { p_booking_id: string }; Returns: Json }
      cancel_booking: { Args: { p_booking_id: string }; Returns: Json }
      check_stall_date_availability: {
        Args: { dates: string[]; market_id: string; stall_id: string }
        Returns: boolean
      }
      checkin_vendor: {
        Args: { p_booking_date_id: string; p_booking_id: string }
        Returns: Json
      }
      cleanup_expired_holds: { Args: never; Returns: number }
      create_credentials: {
        Args: { p_key: string; p_meta: Json; p_source: string; p_value: string }
        Returns: undefined
      }
      create_stall_hold: {
        Args: { p_dates: string[]; p_market_id: string; p_stall_id: string }
        Returns: Json
      }
      expire_booking: { Args: { p_booking_id: string }; Returns: Json }
      generate_invoice_number: { Args: never; Returns: string }
      generate_stall_label: { Args: { p_market_id: string }; Returns: string }
      get_unpaid_invoice_for_stall: {
        Args: { p_stall_id: string; p_vendor_id: string }
        Returns: {
          booking_dates: string[]
          booking_id: string
          invoice_number: string
          outstanding_amount: number
          paid_amount: number
          total_amount: number
        }[]
      }
      get_user_permissions: { Args: { user_uuid: string }; Returns: string[] }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role_id: { Args: { user_uuid: string }; Returns: string }
      get_user_role_key: { Args: { user_uuid: string }; Returns: string }
      get_user_role_with_permissions: {
        Args: { user_uuid: string }
        Returns: {
          permissions: string[]
          role_key: string
          role_name: string
        }[]
      }
      has_all_permissions: {
        Args: { permission_keys: string[]; user_uuid: string }
        Returns: boolean
      }
      has_any_permission: {
        Args: { permission_keys: string[]; user_uuid: string }
        Returns: boolean
      }
      has_permission: {
        Args: { permission_key: string; user_uuid: string }
        Returns: boolean
      }
      is_stall_available: {
        Args: { market_id: string; stall_id: string }
        Returns: boolean
      }
      lookup_vendor_by_email: {
        Args: { p_email: string }
        Returns: {
          company_name: string
          email: string
          full_name: string
          has_unpaid_bookings: boolean
          kyc_id: string
          kyc_status: string
          phone_number: string
          user_id: string
        }[]
      }
      lookup_vendor_in_market: {
        Args: { p_email: string; p_market_id: string }
        Returns: Json
      }
      profile_checks: { Args: { p_phone: string }; Returns: Json }
      reserve_booking: { Args: { p_booking_id: string }; Returns: Json }
      save_role_with_permissions: {
        Args: {
          p_description: string
          p_key: string
          p_name: string
          p_permission_keys: string[]
          p_role_id?: string
        }
        Returns: string
      }
      simulate_booking_confirm_admin: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_cancelled_admin: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_failure: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_failure_admin: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_refund: { Args: { p_booking_id: string }; Returns: Json }
      simulate_payment_refund_admin: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_reserved_admin: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_success: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      simulate_payment_success_admin: {
        Args: { p_booking_id: string }
        Returns: Json
      }
      undo_checkin_vendor: {
        Args: { p_booking_date_id: string; p_booking_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "vendor" | "admin"
      booking_status:
        | "pending"
        | "approved"
        | "completed"
        | "cancelled"
        | "expired"
        | "reserved"
      kyc_status: "PENDING" | "APPROVED" | "REJECTED"
      market_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      payment_status:
        | "pending"
        | "success"
        | "failed"
        | "cancelled"
        | "authorized"
        | "refunded"
      stall_date_status: "available" | "reserved" | "booked"
      stall_shape: "RECT" | "CIRCLE" | "POLY"
      stall_status: "AVAILABLE" | "BOOKED" | "BLOCKED"
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
      app_role: ["vendor", "admin"],
      booking_status: [
        "pending",
        "approved",
        "completed",
        "cancelled",
        "expired",
        "reserved",
      ],
      kyc_status: ["PENDING", "APPROVED", "REJECTED"],
      market_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      payment_status: [
        "pending",
        "success",
        "failed",
        "cancelled",
        "authorized",
        "refunded",
      ],
      stall_date_status: ["available", "reserved", "booked"],
      stall_shape: ["RECT", "CIRCLE", "POLY"],
      stall_status: ["AVAILABLE", "BOOKED", "BLOCKED"],
    },
  },
} as const

