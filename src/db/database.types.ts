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
      companies: {
        Row: {
          erp_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          tax_id: string | null
          type: string | null
        }
        Insert: {
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          tax_id?: string | null
          type?: string | null
        }
        Update: {
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          tax_id?: string | null
          type?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          city: string
          company_id: string
          country: string
          erp_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          postal_code: string
          street_and_number: string
        }
        Insert: {
          city: string
          company_id: string
          country: string
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          postal_code: string
          street_and_number: string
        }
        Update: {
          city?: string
          company_id?: string
          country?: string
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          postal_code?: string
          street_and_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_change_log: {
        Row: {
          changed_at: string
          changed_by_user_id: string
          field_name: string
          id: number
          new_value: string | null
          old_value: string | null
          order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id: string
          field_name: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          order_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string
          field_name?: string
          id?: number
          new_value?: string | null
          old_value?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_change_log_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_change_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          default_loading_method_snapshot: string | null
          id: string
          loading_method_code: string | null
          notes: string | null
          order_id: string
          product_id: string | null
          product_name_snapshot: string | null
          quantity_tons: number | null
        }
        Insert: {
          default_loading_method_snapshot?: string | null
          id?: string
          loading_method_code?: string | null
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity_tons?: number | null
        }
        Update: {
          default_loading_method_snapshot?: string | null
          id?: string
          loading_method_code?: string | null
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity_tons?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_no_counters: {
        Row: {
          year: number
          last_seq: number
        }
        Insert: {
          year: number
          last_seq?: number
        }
        Update: {
          year?: number
          last_seq?: number
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by_user_id: string
          id: number
          new_status_code: string
          old_status_code: string
          order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id: string
          id?: number
          new_status_code: string
          old_status_code: string
          order_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string
          id?: number
          new_status_code?: string
          old_status_code?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_new_status_code_fkey"
            columns: ["new_status_code"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "order_status_history_old_status_code_fkey"
            columns: ["old_status_code"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_statuses: {
        Row: {
          code: string
          is_editable: boolean
          name: string
          sort_order: number | null
          view_group: string
        }
        Insert: {
          code: string
          is_editable: boolean
          name: string
          sort_order?: number | null
          view_group: string
        }
        Update: {
          code?: string
          is_editable?: boolean
          name?: string
          sort_order?: number | null
          view_group?: string
        }
        Relationships: []
      }
      order_stops: {
        Row: {
          address_snapshot: string | null
          company_name_snapshot: string | null
          date_local: string | null
          id: string
          kind: string
          location_id: string | null
          location_name_snapshot: string | null
          notes: string | null
          order_id: string
          sequence_no: number
          time_local: string | null
        }
        Insert: {
          address_snapshot?: string | null
          company_name_snapshot?: string | null
          date_local?: string | null
          id?: string
          kind: string
          location_id?: string | null
          location_name_snapshot?: string | null
          notes?: string | null
          order_id: string
          sequence_no: number
          time_local?: string | null
        }
        Update: {
          address_snapshot?: string | null
          company_name_snapshot?: string | null
          date_local?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          location_name_snapshot?: string | null
          notes?: string | null
          order_id?: string
          sequence_no?: number
          time_local?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_stops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transport_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          default_loading_method_code: string
          description: string | null
          erp_id: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          default_loading_method_code: string
          description?: string | null
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          default_loading_method_code?: string
          description?: string | null
          erp_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      transport_orders: {
        Row: {
          carrier_address_snapshot: string | null
          carrier_cell_color: string | null
          carrier_company_id: string | null
          carrier_location_name_snapshot: string | null
          carrier_name_snapshot: string | null
          complaint_reason: string | null
          confidentiality_clause: string | null
          created_at: string
          created_by_user_id: string
          currency_code: string
          first_loading_country: string | null
          first_loading_date: string | null
          first_loading_time: string | null
          first_unloading_country: string | null
          first_unloading_date: string | null
          first_unloading_time: string | null
          general_notes: string | null
          id: string
          is_entry_fixed: boolean | null
          last_loading_date: string | null
          last_loading_time: string | null
          last_unloading_date: string | null
          last_unloading_time: string | null
          locked_at: string | null
          locked_by_user_id: string | null
          main_product_name: string | null
          notification_details: string | null
          order_no: string
          order_seq_no: number | null
          payment_method: string | null
          payment_term_days: number | null
          price_amount: number | null
          receiver_address_snapshot: string | null
          receiver_location_id: string | null
          receiver_name_snapshot: string | null
          required_documents_text: string | null
          search_text: string | null
          sender_contact_email: string | null
          sender_contact_name: string | null
          sender_contact_phone: string | null
          sent_at: string | null
          sent_by_user_id: string | null
          shipper_address_snapshot: string | null
          shipper_location_id: string | null
          shipper_name_snapshot: string | null
          special_requirements: string | null
          status_code: string
          summary_route: string | null
          total_load_tons: number | null
          total_load_volume_m3: number | null
          transport_type_code: string
          transport_year: number | null
          updated_at: string
          updated_by_user_id: string | null
          vehicle_capacity_volume_m3: number | null
          vehicle_type_text: string | null
          vehicle_variant_code: string | null
          week_number: number | null
        }
        Insert: {
          carrier_address_snapshot?: string | null
          carrier_cell_color?: string | null
          carrier_company_id?: string | null
          carrier_location_name_snapshot?: string | null
          carrier_name_snapshot?: string | null
          complaint_reason?: string | null
          confidentiality_clause?: string | null
          created_at?: string
          created_by_user_id: string
          currency_code: string
          first_loading_country?: string | null
          first_loading_date?: string | null
          first_loading_time?: string | null
          first_unloading_country?: string | null
          first_unloading_date?: string | null
          first_unloading_time?: string | null
          general_notes?: string | null
          id?: string
          is_entry_fixed?: boolean | null
          last_loading_date?: string | null
          last_loading_time?: string | null
          last_unloading_date?: string | null
          last_unloading_time?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          main_product_name?: string | null
          notification_details?: string | null
          order_no: string
          order_seq_no?: number | null
          payment_method?: string | null
          payment_term_days?: number | null
          price_amount?: number | null
          receiver_address_snapshot?: string | null
          receiver_location_id?: string | null
          receiver_name_snapshot?: string | null
          required_documents_text?: string | null
          search_text?: string | null
          sender_contact_email?: string | null
          sender_contact_name?: string | null
          sender_contact_phone?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          shipper_address_snapshot?: string | null
          shipper_location_id?: string | null
          shipper_name_snapshot?: string | null
          special_requirements?: string | null
          status_code: string
          summary_route?: string | null
          total_load_tons?: number | null
          total_load_volume_m3?: number | null
          transport_type_code: string
          transport_year?: number | null
          updated_at?: string
          updated_by_user_id?: string | null
          vehicle_capacity_volume_m3?: number | null
          vehicle_type_text?: string | null
          vehicle_variant_code?: string | null
          week_number?: number | null
        }
        Update: {
          carrier_address_snapshot?: string | null
          carrier_cell_color?: string | null
          carrier_company_id?: string | null
          carrier_location_name_snapshot?: string | null
          carrier_name_snapshot?: string | null
          complaint_reason?: string | null
          confidentiality_clause?: string | null
          created_at?: string
          created_by_user_id?: string
          currency_code?: string
          first_loading_country?: string | null
          first_loading_date?: string | null
          first_loading_time?: string | null
          first_unloading_country?: string | null
          first_unloading_date?: string | null
          first_unloading_time?: string | null
          general_notes?: string | null
          id?: string
          is_entry_fixed?: boolean | null
          last_loading_date?: string | null
          last_loading_time?: string | null
          last_unloading_date?: string | null
          last_unloading_time?: string | null
          locked_at?: string | null
          locked_by_user_id?: string | null
          main_product_name?: string | null
          notification_details?: string | null
          order_no?: string
          order_seq_no?: number | null
          payment_method?: string | null
          payment_term_days?: number | null
          price_amount?: number | null
          receiver_address_snapshot?: string | null
          receiver_location_id?: string | null
          receiver_name_snapshot?: string | null
          required_documents_text?: string | null
          search_text?: string | null
          sender_contact_email?: string | null
          sender_contact_name?: string | null
          sender_contact_phone?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          shipper_address_snapshot?: string | null
          shipper_location_id?: string | null
          shipper_name_snapshot?: string | null
          special_requirements?: string | null
          status_code?: string
          summary_route?: string | null
          total_load_tons?: number | null
          total_load_volume_m3?: number | null
          transport_type_code?: string
          transport_year?: number | null
          updated_at?: string
          updated_by_user_id?: string | null
          vehicle_capacity_volume_m3?: number | null
          vehicle_type_text?: string | null
          vehicle_variant_code?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_orders_carrier_company_id_fkey"
            columns: ["carrier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_locked_by_user_id_fkey"
            columns: ["locked_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_receiver_location_id_fkey"
            columns: ["receiver_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_shipper_location_id_fkey"
            columns: ["shipper_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_orders_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transport_orders_transport_type_code_fkey"
            columns: ["transport_type_code"]
            isOneToOne: false
            referencedRelation: "transport_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transport_orders_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_types: {
        Row: {
          code: string
          description: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          description?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          description?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          location_id: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          location_id?: string | null
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_variants: {
        Row: {
          capacity_tons: number
          capacity_volume_m3: number | null
          code: string
          description: string | null
          is_active: boolean
          name: string
          vehicle_type: string
        }
        Insert: {
          capacity_tons: number
          capacity_volume_m3?: number | null
          code: string
          description?: string | null
          is_active?: boolean
          name: string
          vehicle_type: string
        }
        Update: {
          capacity_tons?: number
          capacity_volume_m3?: number | null
          code?: string
          description?: string | null
          is_active?: boolean
          name?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      warehouse_report_recipients: {
        Row: {
          id: string
          location_id: string
          email: string
          name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          location_id: string
          email: string
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          email?: string
          name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_report_recipients_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_is_admin_or_planner: { Args: never; Returns: boolean }
      generate_next_order_no: { Args: never; Returns: string }
      filter_order_ids: {
        Args: {
          p_product_id?: string | null
          p_loading_location_id?: string | null
          p_unloading_location_id?: string | null
          p_loading_company_id?: string | null
          p_unloading_company_id?: string | null
        }
        Returns: {
          order_id: string
        }[]
      }
      require_write_role: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      try_lock_order: {
        Args: {
          p_lock_expiry_minutes?: number
          p_order_id: string
          p_user_id: string
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
    Enums: {},
  },
} as const

