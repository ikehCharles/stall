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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      booking_dates: {
        Row: {
          booking_date: string
          booking_id: string
          created_at: string
          id: string
          stall_instance_id: string
        }
        Insert: {
          booking_date: string
          booking_id: string
          created_at?: string
          id?: string
          stall_instance_id: string
        }
        Update: {
          booking_date?: string
          booking_id?: string
          created_at?: string
          id?: string
          stall_instance_id?: string
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
          days_count: number | null
          hold_expires_at: string | null
          id: string
          invoice_number: string
          market_id: string
          paid_amount: number
          price_per_day: number | null
          selected_dates: string[] | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_count?: number | null
          hold_expires_at?: string | null
          id?: string
          invoice_number: string
          market_id: string
          paid_amount?: number
          price_per_day?: number | null
          selected_dates?: string[] | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_count?: number | null
          hold_expires_at?: string | null
          id?: string
          invoice_number?: string
          market_id?: string
          paid_amount?: number
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
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_stall_date_availability: {
        Args: { dates: string[]; market_id: string; stall_id: string }
        Returns: boolean
      }
      cleanup_expired_holds: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_stall_hold: {
        Args: { p_dates: string[]; p_market_id: string; p_stall_id: string }
        Returns: Json
      }
      expire_booking: {
        Args: { booking_id: string }
        Returns: Json
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_stall_available: {
        Args: { market_id: string; stall_id: string }
        Returns: boolean
      }
      simulate_payment_failure: {
        Args: { booking_id: string }
        Returns: Json
      }
      simulate_payment_success: {
        Args: { booking_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "vendor" | "admin"
      booking_status:
        | "pending"
        | "paid"
        | "partial"
        | "cancelled"
        | "expired"
        | "completed"
        | "failed"
      kyc_status: "PENDING" | "APPROVED" | "REJECTED"
      market_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
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
  public: {
    Enums: {
      app_role: ["vendor", "admin"],
      booking_status: [
        "pending",
        "paid",
        "partial",
        "cancelled",
        "expired",
        "completed",
        "failed",
      ],
      kyc_status: ["PENDING", "APPROVED", "REJECTED"],
      market_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      stall_shape: ["RECT", "CIRCLE", "POLY"],
      stall_status: ["AVAILABLE", "BOOKED", "BLOCKED"],
    },
  },
} as const
