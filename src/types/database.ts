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
    PostgrestVersion: "14.18"
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
      account_members: {
        Row: {
          created_at: string
          member_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          member_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          member_id?: string
          owner_id?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount_cop: number
          created_at: string
          id: string
          kind: string
          method: string | null
          moved_on: string
          note: string | null
          order_id: string | null
          owner_id: string
        }
        Insert: {
          amount_cop: number
          created_at?: string
          id?: string
          kind: string
          method?: string | null
          moved_on?: string
          note?: string | null
          order_id?: string | null
          owner_id?: string
        }
        Update: {
          amount_cop?: number
          created_at?: string
          id?: string
          kind?: string
          method?: string | null
          moved_on?: string
          note?: string | null
          order_id?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          description: string
          from_stock: boolean
          id: string
          markup_pct: number | null
          order_id: string
          owner_id: string
          product_id: string | null
          qty: number
          shipment_id: string | null
          shipping_charged_cop: number
          store: string | null
          trm: number
          unit_cost_usd: number
          unit_price_cop: number | null
        }
        Insert: {
          created_at?: string
          description: string
          from_stock?: boolean
          id?: string
          markup_pct?: number | null
          order_id: string
          owner_id?: string
          product_id?: string | null
          qty: number
          shipment_id?: string | null
          shipping_charged_cop?: number
          store?: string | null
          trm?: number
          unit_cost_usd?: number
          unit_price_cop?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          from_stock?: boolean
          id?: string
          markup_pct?: number | null
          order_id?: string
          owner_id?: string
          product_id?: string | null
          qty?: number
          shipment_id?: string | null
          shipping_charged_cop?: number
          store?: string | null
          trm?: number
          unit_cost_usd?: number
          unit_price_cop?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          ordered_on: string
          owner_id: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          ordered_on?: string
          owner_id?: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          ordered_on?: string
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cop: number
          created_at: string
          id: string
          method: string | null
          note: string | null
          order_id: string
          owner_id: string
          paid_on: string
        }
        Insert: {
          amount_cop: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          order_id: string
          owner_id?: string
          paid_on?: string
        }
        Update: {
          amount_cop?: number
          created_at?: string
          id?: string
          method?: string | null
          note?: string | null
          order_id?: string
          owner_id?: string
          paid_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          category: string | null
          created_at: string
          default_markup: number | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          default_markup?: number | null
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          default_markup?: number | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          arrived_on: string | null
          carrier: string | null
          code: string
          created_at: string
          expected_on: string | null
          id: string
          notes: string | null
          owner_id: string
          products_count: number | null
          real_cost_cop: number | null
          shipped_on: string | null
        }
        Insert: {
          arrived_on?: string | null
          carrier?: string | null
          code: string
          created_at?: string
          expected_on?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          products_count?: number | null
          real_cost_cop?: number | null
          shipped_on?: string | null
        }
        Update: {
          arrived_on?: string | null
          carrier?: string | null
          code?: string
          created_at?: string
          expected_on?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          products_count?: number | null
          real_cost_cop?: number | null
          shipped_on?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          kind: string
          moved_on: string
          note: string | null
          owner_id: string
          product_id: string
          qty: number
          shipment_id: string | null
          trm: number | null
          unit_cost_usd: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          moved_on?: string
          note?: string | null
          owner_id?: string
          product_id: string
          qty: number
          shipment_id?: string | null
          trm?: number | null
          unit_cost_usd?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          moved_on?: string
          note?: string | null
          owner_id?: string
          product_id?: string
          qty?: number
          shipment_id?: string | null
          trm?: number | null
          unit_cost_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "stock_movements_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cash_flow: {
        Row: {
          amount_cop: number | null
          created_at: string | null
          direction: string | null
          id: string | null
          label: string | null
          method: string | null
          moved_on: string | null
          note: string | null
          order_id: string | null
          owner_id: string | null
          shipment_id: string | null
          signed_cop: number | null
          source: string | null
        }
        Relationships: []
      }
      v_order_items: {
        Row: {
          cost_cop: number | null
          created_at: string | null
          description: string | null
          from_stock: boolean | null
          id: string | null
          incomplete: boolean | null
          markup_effective: number | null
          markup_pct: number | null
          order_id: string | null
          owner_id: string | null
          price_cop: number | null
          product_id: string | null
          profit_cop: number | null
          qty: number | null
          shipment_id: string | null
          shipping_charged_cop: number | null
          store: string | null
          trm: number | null
          unit_cost_usd: number | null
          unit_price_cop: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "v_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      v_orders: {
        Row: {
          balance_cop: number | null
          created_at: string | null
          customer_id: string | null
          id: string | null
          incomplete_items: number | null
          items_cost_cop: number | null
          items_price_cop: number | null
          items_profit_cop: number | null
          notes: string | null
          ordered_on: string | null
          owner_id: string | null
          paid_cop: number | null
          payment_status: string | null
          shipping_charged_cop: number | null
          status: string | null
          stock_shipping_cop: number | null
          total_cop: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v_shipments: {
        Row: {
          arrived_on: string | null
          carrier: string | null
          charged_cop: number | null
          client_units: number | null
          clients_real_cop: number | null
          code: string | null
          cost_per_unit_cop: number | null
          created_at: string | null
          difference_cop: number | null
          expected_on: string | null
          id: string | null
          items_count: number | null
          notes: string | null
          other_real_cop: number | null
          owner_id: string | null
          products_count: number | null
          real_cost_cop: number | null
          shipped_on: string | null
          state: string | null
          stock_units: number | null
          units_total: number | null
        }
        Relationships: []
      }
      v_stock: {
        Row: {
          available_qty: number | null
          entered_qty: number | null
          in_transit_qty: number | null
          name: string | null
          owner_id: string | null
          product_id: string | null
          sold_qty: number | null
          state: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_order: {
        Args: {
          p_customer_id?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_initial_payment_cop?: number
          p_items: Json
          p_notes?: string
          p_ordered_on?: string
          p_payment_method?: string
          p_status?: string
        }
        Returns: string
      }
      create_shipment: {
        Args: {
          p_carrier?: string
          p_code: string
          p_expected_on?: string
          p_notes?: string
          p_products_count?: number
          p_real_cost_cop?: number
          p_shipped_on?: string
          p_stock?: Json
        }
        Returns: string
      }
      current_owner_id: { Args: never; Returns: string }
      update_order: {
        Args: {
          p_customer_id?: string
          p_customer_name?: string
          p_customer_phone?: string
          p_items: Json
          p_notes?: string
          p_order_id: string
          p_ordered_on?: string
        }
        Returns: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
