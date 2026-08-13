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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      announcement_banners: {
        Row: {
          background_color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          message: string
          priority: number | null
          text_color: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          created_by?: string | null
          id: string
          is_active?: boolean | null
          message: string
          priority?: number | null
          text_color?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          priority?: number | null
          text_color?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          description: string | null
          discount_percent: number
          id: string
          is_active: boolean | null
          partner_user_id: string | null
          times_used: number | null
          usage_limit: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percent?: number
          id: string
          is_active?: boolean | null
          partner_user_id?: string | null
          times_used?: number | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean | null
          partner_user_id?: string | null
          times_used?: number | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      global_premium_mode: {
        Row: {
          created_at: string | null
          created_by: string | null
          ends_at: string
          event_description: string | null
          event_name: string | null
          id: string
          is_active: boolean | null
          starts_at: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          ends_at: string
          event_description?: string | null
          event_name?: string | null
          id: string
          is_active?: boolean | null
          starts_at: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          ends_at?: string
          event_description?: string | null
          event_name?: string | null
          id?: string
          is_active?: boolean | null
          starts_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_premium_mode_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      global_settings: {
        Row: {
          commission_rate: number | null
          discount_reduction: number | null
          id: string
          partner_commission_rate: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          commission_rate?: number | null
          discount_reduction?: number | null
          id?: string
          partner_commission_rate?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          commission_rate?: number | null
          discount_reduction?: number | null
          id?: string
          partner_commission_rate?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          price_at_purchase: number
          product_id: string | null
          product_image: string | null
          product_price: number
          product_title: string | null
          quantity: number | null
          seller_id: string | null
          seller_name: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          order_id?: string | null
          price_at_purchase: number
          product_id?: string | null
          product_image?: string | null
          product_price: number
          product_title?: string | null
          quantity?: number | null
          seller_id?: string | null
          seller_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          price_at_purchase?: number
          product_id?: string | null
          product_image?: string | null
          product_price?: number
          product_title?: string | null
          quantity?: number | null
          seller_id?: string | null
          seller_name?: string | null
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          completed_at: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_name: string | null
          delivery_phone: string | null
          has_review: boolean | null
          id: string
          paid_at: string | null
          payment_method: string | null
          rejected_at: string | null
          rejection_reason: string | null
          shipped_at: string | null
          status: string | null
          total_amount: number
          user_id: string | null
          user_name: string | null
          user_phone: string | null
          validated_at: string | null
          wave_transaction_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          has_review?: boolean | null
          id: string
          paid_at?: string | null
          payment_method?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          shipped_at?: string | null
          status?: string | null
          total_amount: number
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
          validated_at?: string | null
          wave_transaction_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_phone?: string | null
          has_review?: boolean | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          shipped_at?: string | null
          status?: string | null
          total_amount?: number
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
          validated_at?: string | null
          wave_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commission_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          paid_by: string | null
          partner_user_id: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          partner_user_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          paid_by?: string | null
          partner_user_id?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_commission_payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commission_payments_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referred_clients: {
        Row: {
          client_seller_id: string | null
          commission_earned: number | null
          created_at: string | null
          discount_code_used: string | null
          first_product_id: string | null
          first_product_price: number | null
          first_product_title: string | null
          id: string
          partner_user_id: string | null
          total_commission_earned: number | null
          total_products_count: number | null
          updated_at: string | null
        }
        Insert: {
          client_seller_id?: string | null
          commission_earned?: number | null
          created_at?: string | null
          discount_code_used?: string | null
          first_product_id?: string | null
          first_product_price?: number | null
          first_product_title?: string | null
          id?: string
          partner_user_id?: string | null
          total_commission_earned?: number | null
          total_products_count?: number | null
          updated_at?: string | null
        }
        Update: {
          client_seller_id?: string | null
          commission_earned?: number | null
          created_at?: string | null
          discount_code_used?: string | null
          first_product_id?: string | null
          first_product_price?: number | null
          first_product_title?: string | null
          id?: string
          partner_user_id?: string | null
          total_commission_earned?: number | null
          total_products_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_referred_clients_client_seller_id_fkey"
            columns: ["client_seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referred_clients_first_product_id_fkey"
            columns: ["first_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referred_clients_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          average_rating: number | null
          category: string
          commission_amount: number | null
          condition: string | null
          created_at: string | null
          description: string | null
          discount_code: string | null
          discount_code_applied: boolean | null
          discount_percent: number | null
          has_discount: boolean | null
          id: string
          images: string[] | null
          is_out_of_stock: boolean | null
          listing_type: string | null
          location: string | null
          original_price: number | null
          partner_code_used: string | null
          partner_id: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          price: number
          rejected_at: string | null
          rejection_reason: string | null
          review_count: number | null
          seller_avatar: string | null
          seller_id: string | null
          seller_name: string | null
          seller_phone: string | null
          service_details: Json | null
          status: string | null
          stock_quantity: number | null
          sub_category: string | null
          title: string
          wave_payment_reference: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          average_rating?: number | null
          category: string
          commission_amount?: number | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          discount_code?: string | null
          discount_code_applied?: boolean | null
          discount_percent?: number | null
          has_discount?: boolean | null
          id: string
          images?: string[] | null
          is_out_of_stock?: boolean | null
          listing_type?: string | null
          location?: string | null
          original_price?: number | null
          partner_code_used?: string | null
          partner_id?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          price: number
          rejected_at?: string | null
          rejection_reason?: string | null
          review_count?: number | null
          seller_avatar?: string | null
          seller_id?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          service_details?: Json | null
          status?: string | null
          stock_quantity?: number | null
          sub_category?: string | null
          title: string
          wave_payment_reference?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          average_rating?: number | null
          category?: string
          commission_amount?: number | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          discount_code?: string | null
          discount_code_applied?: boolean | null
          discount_percent?: number | null
          has_discount?: boolean | null
          id?: string
          images?: string[] | null
          is_out_of_stock?: boolean | null
          listing_type?: string | null
          location?: string | null
          original_price?: number | null
          partner_code_used?: string | null
          partner_id?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          price?: number
          rejected_at?: string | null
          rejection_reason?: string | null
          review_count?: number | null
          seller_avatar?: string | null
          seller_id?: string | null
          seller_name?: string | null
          seller_phone?: string | null
          service_details?: Json | null
          status?: string | null
          stock_quantity?: number | null
          sub_category?: string | null
          title?: string
          wave_payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          order_id: string | null
          product_id: string | null
          rating: number | null
          seller_id: string | null
          user_avatar: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id: string
          order_id?: string | null
          product_id?: string | null
          rating?: number | null
          seller_id?: string | null
          user_avatar?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          rating?: number | null
          seller_id?: string | null
          user_avatar?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar: string | null
          bio: string | null
          created_at: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_phone: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          is_partner: boolean | null
          is_super_admin: boolean | null
          joined_date: string | null
          location: string | null
          name: string
          partner_referral_code: string | null
          password: string | null
          phone: string | null
          premium_payment_pending: boolean | null
          premium_request_date: string | null
          rating: number | null
          referred_by_partner_id: string | null
          review_count: number | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_phone?: string | null
          email?: string | null
          id: string
          is_admin?: boolean | null
          is_partner?: boolean | null
          is_super_admin?: boolean | null
          joined_date?: string | null
          location?: string | null
          name: string
          partner_referral_code?: string | null
          password?: string | null
          phone?: string | null
          premium_payment_pending?: boolean | null
          premium_request_date?: string | null
          rating?: number | null
          referred_by_partner_id?: string | null
          review_count?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          created_at?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_phone?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          is_partner?: boolean | null
          is_super_admin?: boolean | null
          joined_date?: string | null
          location?: string | null
          name?: string
          partner_referral_code?: string | null
          password?: string | null
          phone?: string | null
          premium_payment_pending?: boolean | null
          premium_request_date?: string | null
          rating?: number | null
          referred_by_partner_id?: string | null
          review_count?: number | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_partner_id_fkey"
            columns: ["referred_by_partner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_banners: {
        Args: never
        Returns: {
          background_color: string
          id: string
          message: string
          priority: number
          text_color: string
        }[]
      }
      get_active_user_partners: {
        Args: never
        Returns: {
          avatar: string
          bio: string
          created_at: string
          email: string
          id: string
          name: string
          partner_referral_code: string
          phone: string
          total_commission_earned: number
          total_referrals: number
          total_sales: number
        }[]
      }
      get_partner_client_details: {
        Args: { client_seller_id: string; partner_user_id: string }
        Returns: {
          commission_earned: number
          created_at: string
          product_id: string
          product_price: number
          product_title: string
        }[]
      }
      get_partner_referred_clients: {
        Args: { partner_user_id: string }
        Returns: {
          client_avatar: string
          client_name: string
          client_phone: string
          client_seller_id: string
          first_product_price: number
          first_product_title: string
          joined_at: string
          total_commission: number
          total_products: number
        }[]
      }
      get_partner_stats: {
        Args: { partner_user_id: string }
        Returns: {
          pending_commission: number
          total_commission: number
          total_referrals: number
          total_sales: number
        }[]
      }
      is_global_premium_active: { Args: never; Returns: boolean }
      update_partner_referral_code: {
        Args: { new_code: string; partner_user_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      user_id: { Args: never; Returns: string }
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
