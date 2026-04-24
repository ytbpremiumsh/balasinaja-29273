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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: string | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: string | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          question: string
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          question: string
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          question?: string
          user_id?: string | null
        }
        Relationships: []
      }
      autoreplies: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_type: string
          trigger: string
          url_image: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_type?: string
          trigger: string
          url_image?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string
          trigger?: string
          url_image?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      broadcast_logs: {
        Row: {
          category_id: string | null
          created_at: string
          delay_max: number | null
          delay_min: number | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          scheduled_at: string | null
          status: string
          template_id: string | null
          total_failed: number
          total_recipients: number
          total_sent: number
          use_personalization: boolean | null
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          delay_max?: number | null
          delay_min?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          total_failed?: number
          total_recipients?: number
          total_sent?: number
          use_personalization?: boolean | null
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          delay_max?: number | null
          delay_min?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          scheduled_at?: string | null
          status?: string
          template_id?: string | null
          total_failed?: number
          total_recipients?: number
          total_sent?: number
          use_personalization?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_logs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "broadcast_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_queue: {
        Row: {
          broadcast_log_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          name: string | null
          phone: string
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          broadcast_log_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          name?: string | null
          phone: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          broadcast_log_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          name?: string | null
          phone?: string
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_queue_broadcast_log_id_fkey"
            columns: ["broadcast_log_id"]
            isOneToOne: false
            referencedRelation: "broadcast_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_templates: {
        Row: {
          created_at: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_categories: {
        Row: {
          category_id: string
          contact_id: string
          created_at: string
          id: string
        }
        Insert: {
          category_id: string
          contact_id: string
          created_at?: string
          id?: string
        }
        Update: {
          category_id?: string
          contact_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_categories_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          id: string
          name: string | null
          phone: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string | null
          phone: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dashboard_embed_tokens: {
        Row: {
          created_at: string
          duration: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      inbox: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          inbox_message: string | null
          inbox_type: string | null
          message_id: string
          name: string | null
          phone: string
          reply_image: string | null
          reply_message: string | null
          reply_type: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          inbox_message?: string | null
          inbox_type?: string | null
          message_id: string
          name?: string | null
          phone: string
          reply_image?: string | null
          reply_message?: string | null
          reply_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          inbox_message?: string | null
          inbox_type?: string | null
          message_id?: string
          name?: string | null
          phone?: string
          reply_image?: string | null
          reply_message?: string | null
          reply_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_content: {
        Row: {
          button_text: string | null
          button_url: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          items: Json | null
          section_key: string
          sort_order: number | null
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          items?: Json | null
          section_key: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          button_text?: string | null
          button_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          items?: Json | null
          section_key?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string | null
          description: string | null
          duration_days: number
          id: string
          is_active: boolean | null
          name: string
          price: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      payment_proofs: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          package_id: string | null
          payment_method: string
          proof_image_url: string
          status: string
          user_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          payment_method: string
          proof_image_url: string
          status?: string
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          package_id?: string | null
          payment_method?: string
          proof_image_url?: string
          status?: string
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string | null
          id: string
          qris_code: string | null
          qris_image_url: string | null
          updated_at: string | null
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          qris_code?: string | null
          qris_image_url?: string | null
          updated_at?: string | null
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          id?: string
          qris_code?: string | null
          qris_image_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          expire_at: string | null
          id: string
          mpwa_device_connected: boolean
          mpwa_device_number: string | null
          name: string | null
          phone: string | null
          plan: string | null
          status: string | null
          user_id: string
          webhook_token: string
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expire_at?: string | null
          id?: string
          mpwa_device_connected?: boolean
          mpwa_device_number?: string | null
          name?: string | null
          phone?: string | null
          plan?: string | null
          status?: string | null
          user_id: string
          webhook_token?: string
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expire_at?: string | null
          id?: string
          mpwa_device_connected?: boolean
          mpwa_device_number?: string | null
          name?: string | null
          phone?: string | null
          plan?: string | null
          status?: string | null
          user_id?: string
          webhook_token?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          user_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          user_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          user_id?: string | null
          value?: string
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          priority: string
          replied_at: string | null
          replied_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          priority?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          priority?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_gateway_settings: {
        Row: {
          active_gateway: string
          created_at: string
          id: string
          mpwa_admin_device_connected: boolean
          mpwa_admin_device_number: string | null
          mpwa_api_key: string | null
          mpwa_api_url: string | null
          mpwa_footer: string
          updated_at: string
        }
        Insert: {
          active_gateway?: string
          created_at?: string
          id?: string
          mpwa_admin_device_connected?: boolean
          mpwa_admin_device_number?: string | null
          mpwa_api_key?: string | null
          mpwa_api_url?: string | null
          mpwa_footer?: string
          updated_at?: string
        }
        Update: {
          active_gateway?: string
          created_at?: string
          id?: string
          mpwa_admin_device_connected?: boolean
          mpwa_admin_device_number?: string | null
          mpwa_api_key?: string | null
          mpwa_api_url?: string | null
          mpwa_footer?: string
          updated_at?: string
        }
        Relationships: []
      }
      web_chats: {
        Row: {
          created_at: string
          id: string
          message: string
          message_type: string
          sender: string
          session_id: string
          user_id: string
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          message_type?: string
          sender?: string
          session_id: string
          user_id: string
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          message_type?: string
          sender?: string
          session_id?: string
          user_id?: string
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          message_template: string
          name: string
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "support"
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
      app_role: ["admin", "user", "support"],
    },
  },
} as const
