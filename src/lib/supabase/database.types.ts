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
      addon_groups: {
        Row: {
          allow_repeat: boolean
          created_at: string
          flavor_price_rule: string | null
          id: string
          kind: string
          max_select: number
          min_select: number
          name: string
          owner_id: string
          position: number
          required: boolean
          updated_at: string
          vitrine_id: string
        }
        Insert: {
          allow_repeat?: boolean
          created_at?: string
          flavor_price_rule?: string | null
          id?: string
          kind?: string
          max_select?: number
          min_select?: number
          name: string
          owner_id?: string
          position?: number
          required?: boolean
          updated_at?: string
          vitrine_id: string
        }
        Update: {
          allow_repeat?: boolean
          created_at?: string
          flavor_price_rule?: string | null
          id?: string
          kind?: string
          max_select?: number
          min_select?: number
          name?: string
          owner_id?: string
          position?: number
          required?: boolean
          updated_at?: string
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_groups_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      addon_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          owner_id: string
          position: number
          price_cents: number
          sold_out: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          owner_id?: string
          position?: number
          price_cents?: number
          sold_out?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          price_cents?: number
          sold_out?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          blocked_until: string
          cancelled_at: string | null
          code: string
          completed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id: string
          item_id: string | null
          notes: string | null
          owner_id: string
          price_text: string | null
          service_name: string
          starts_at: string
          status: string
          vitrine_id: string
        }
        Insert: {
          blocked_until: string
          cancelled_at?: string | null
          code: string
          completed_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          duration_minutes: number
          ends_at: string
          id?: string
          item_id?: string | null
          notes?: string | null
          owner_id: string
          price_text?: string | null
          service_name: string
          starts_at: string
          status?: string
          vitrine_id: string
        }
        Update: {
          blocked_until?: string
          cancelled_at?: string | null
          code?: string
          completed_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          duration_minutes?: number
          ends_at?: string
          id?: string
          item_id?: string | null
          notes?: string | null
          owner_id?: string
          price_text?: string | null
          service_name?: string
          starts_at?: string
          status?: string
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          owner_id: string
          reason: string | null
          starts_at: string
          vitrine_id: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          owner_id?: string
          reason?: string | null
          starts_at: string
          vitrine_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          owner_id?: string
          reason?: string | null
          starts_at?: string
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_blocks_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          position: number
          updated_at: string
          vitrine_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
          position?: number
          updated_at?: string
          vitrine_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_settings: {
        Row: {
          created_at: string
          fulfillment_mode: string
          id: string
          name_mode: string
          notes_mode: string
          owner_id: string
          payment_mode: string
          payment_options: string[]
          schedule_mode: string
          updated_at: string
          vitrine_id: string
        }
        Insert: {
          created_at?: string
          fulfillment_mode?: string
          id?: string
          name_mode?: string
          notes_mode?: string
          owner_id: string
          payment_mode?: string
          payment_options?: string[]
          schedule_mode?: string
          updated_at?: string
          vitrine_id: string
        }
        Update: {
          created_at?: string
          fulfillment_mode?: string
          id?: string
          name_mode?: string
          notes_mode?: string
          owner_id?: string
          payment_mode?: string
          payment_options?: string[]
          schedule_mode?: string
          updated_at?: string
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_settings_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: true
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      item_addon_groups: {
        Row: {
          created_at: string
          group_id: string
          item_id: string
          owner_id: string
          position: number
        }
        Insert: {
          created_at?: string
          group_id: string
          item_id: string
          owner_id?: string
          position?: number
        }
        Update: {
          created_at?: string
          group_id?: string
          item_id?: string
          owner_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_addon_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "addon_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_addon_groups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_code_counters: {
        Row: {
          next_value: number
          owner_id: string
        }
        Insert: {
          next_value?: number
          owner_id: string
        }
        Update: {
          next_value?: number
          owner_id?: string
        }
        Relationships: []
      }
      item_codes: {
        Row: {
          code: string
          created_at: string
          item_id: string | null
          owner_id: string
        }
        Insert: {
          code: string
          created_at?: string
          item_id?: string | null
          owner_id: string
        }
        Update: {
          code?: string
          created_at?: string
          item_id?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_codes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_variations: {
        Row: {
          created_at: string
          id: string
          item_id: string
          name: string
          owner_id: string
          position: number
          price_cents: number
          promo_price_cents: number | null
          sold_out: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          name: string
          owner_id?: string
          position?: number
          price_cents: number
          promo_price_cents?: number | null
          sold_out?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          name?: string
          owner_id?: string
          position?: number
          price_cents?: number
          promo_price_cents?: number | null
          sold_out?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_variations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          button_text: string | null
          category_id: string | null
          code: string
          created_at: string
          custom_message: string | null
          deleted_at: string | null
          description: string
          duration_minutes: number | null
          id: string
          name: string
          notice: string | null
          owner_id: string
          position: number
          price_cents: number | null
          price_type: string
          promo_price_cents: number | null
          sold_out: boolean
          tags: string[]
          updated_at: string
          vitrine_id: string
          whatsapp_id: string | null
        }
        Insert: {
          button_text?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          custom_message?: string | null
          deleted_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          name: string
          notice?: string | null
          owner_id?: string
          position?: number
          price_cents?: number | null
          price_type?: string
          promo_price_cents?: number | null
          sold_out?: boolean
          tags?: string[]
          updated_at?: string
          vitrine_id: string
          whatsapp_id?: string | null
        }
        Update: {
          button_text?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          custom_message?: string | null
          deleted_at?: string | null
          description?: string
          duration_minutes?: number | null
          id?: string
          name?: string
          notice?: string | null
          owner_id?: string
          position?: number
          price_cents?: number | null
          price_type?: string
          promo_price_cents?: number | null
          sold_out?: boolean
          tags?: string[]
          updated_at?: string
          vitrine_id?: string
          whatsapp_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_whatsapp_id_fkey"
            columns: ["whatsapp_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          aspect: string | null
          bytes: number | null
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          item_id: string | null
          kind: string
          mux_asset_id: string | null
          mux_playback_id: string | null
          mux_upload_id: string | null
          owner_id: string
          position: number
          role: string
          status: string
          storage_paths: Json | null
          thumbnail_url: string | null
          updated_at: string
          vitrine_id: string
          width: number | null
        }
        Insert: {
          aspect?: string | null
          bytes?: number | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          item_id?: string | null
          kind: string
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          mux_upload_id?: string | null
          owner_id: string
          position?: number
          role: string
          status?: string
          storage_paths?: Json | null
          thumbnail_url?: string | null
          updated_at?: string
          vitrine_id: string
          width?: number | null
        }
        Update: {
          aspect?: string | null
          bytes?: number | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          item_id?: string | null
          kind?: string
          mux_asset_id?: string | null
          mux_playback_id?: string | null
          mux_upload_id?: string | null
          owner_id?: string
          position?: number
          role?: string
          status?: string
          storage_paths?: Json | null
          thumbnail_url?: string | null
          updated_at?: string
          vitrine_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      order_snapshots: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          owner_id: string
          payload: Json
          vitrine_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          owner_id: string
          payload: Json
          vitrine_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_snapshots_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          allow_branding: boolean
          id: string
          max_items_per_vitrine: number
          max_video_seconds: number
          max_video_upload_mb: number
          max_videos_per_account: number | null
          max_videos_per_vitrine: number
          max_vitrines: number
          monthly_video_gb: number
          name: string
          show_watermark: boolean
        }
        Insert: {
          allow_branding: boolean
          id: string
          max_items_per_vitrine: number
          max_video_seconds: number
          max_video_upload_mb: number
          max_videos_per_account?: number | null
          max_videos_per_vitrine: number
          max_vitrines: number
          monthly_video_gb: number
          name: string
          show_watermark: boolean
        }
        Update: {
          allow_branding?: boolean
          id?: string
          max_items_per_vitrine?: number
          max_video_seconds?: number
          max_video_upload_mb?: number
          max_videos_per_account?: number | null
          max_videos_per_vitrine?: number
          max_vitrines?: number
          monthly_video_gb?: number
          name?: string
          show_watermark?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_session_id: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active_session_id?: string | null
          created_at?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          active_session_id?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string
          type: string
        }
        Insert: {
          id: string
          processed_at?: string
          type: string
        }
        Update: {
          id?: string
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          grace_until: string | null
          interval: string | null
          plan_id: string
          pro_ended_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          grace_until?: string | null
          interval?: string | null
          plan_id?: string
          pro_ended_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          grace_until?: string | null
          interval?: string | null
          plan_id?: string
          pro_ended_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      video_usage_monthly: {
        Row: {
          bytes_delivered: number
          created_at: string
          month: string
          over_quota: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes_delivered?: number
          created_at?: string
          month: string
          over_quota?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes_delivered?: number
          created_at?: string
          month?: string
          over_quota?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vitrines: {
        Row: {
          address: string | null
          banner_enabled: boolean
          banner_media_id: string | null
          booking_buffer_minutes: number
          booking_max_days_ahead: number
          booking_min_notice_minutes: number
          brand_color: string | null
          business_hours: Json | null
          cart_button_text: string
          cart_enabled: boolean
          created_at: string
          default_button_text: string
          description: string
          id: string
          instagram: string | null
          logo_media_id: string | null
          name: string
          owner_id: string
          position: number
          primary_whatsapp_id: string | null
          service_segment: string | null
          show_media: boolean
          show_prices: boolean
          status: string
          subdomain: string
          theme: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          banner_enabled?: boolean
          banner_media_id?: string | null
          booking_buffer_minutes?: number
          booking_max_days_ahead?: number
          booking_min_notice_minutes?: number
          brand_color?: string | null
          business_hours?: Json | null
          cart_button_text?: string
          cart_enabled?: boolean
          created_at?: string
          default_button_text: string
          description?: string
          id?: string
          instagram?: string | null
          logo_media_id?: string | null
          name: string
          owner_id?: string
          position?: number
          primary_whatsapp_id?: string | null
          service_segment?: string | null
          show_media?: boolean
          show_prices?: boolean
          status?: string
          subdomain: string
          theme?: string
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          banner_enabled?: boolean
          banner_media_id?: string | null
          booking_buffer_minutes?: number
          booking_max_days_ahead?: number
          booking_min_notice_minutes?: number
          brand_color?: string | null
          business_hours?: Json | null
          cart_button_text?: string
          cart_enabled?: boolean
          created_at?: string
          default_button_text?: string
          description?: string
          id?: string
          instagram?: string | null
          logo_media_id?: string | null
          name?: string
          owner_id?: string
          position?: number
          primary_whatsapp_id?: string | null
          service_segment?: string | null
          show_media?: boolean
          show_prices?: boolean
          status?: string
          subdomain?: string
          theme?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitrines_banner_media_fk"
            columns: ["banner_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrines_logo_media_fk"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrines_primary_whatsapp_fk"
            columns: ["primary_whatsapp_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          id: string
          label: string
          owner_id: string
          phone_e164: string
          position: number
          updated_at: string
          vitrine_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          owner_id?: string
          phone_e164: string
          position?: number
          updated_at?: string
          vitrine_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          phone_e164?: string
          position?: number
          updated_at?: string
          vitrine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_vitrine_id_fkey"
            columns: ["vitrine_id"]
            isOneToOne: false
            referencedRelation: "vitrines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accounts_to_warn_video_cleanup: {
        Args: { p_warn_days?: number }
        Returns: {
          pro_ended_at: string
          user_id: string
          videos_to_delete: number
        }[]
      }
      add_video_usage: {
        Args: { p_bytes: number; p_media_id: string }
        Returns: {
          crossed_quota: boolean
          usage_owner_id: string
        }[]
      }
      book_appointment: {
        Args: {
          p_code: string
          p_customer_name: string
          p_customer_phone: string
          p_item_id: string
          p_notes: string
          p_price_text: string
          p_starts_at: string
          p_vitrine_id: string
        }
        Returns: string
      }
      choose_active_vitrine: {
        Args: { p_vitrine_id: string }
        Returns: string[]
      }
      claim_session: { Args: never; Returns: undefined }
      cleanup_expired_rows: {
        Args: never
        Returns: {
          orders_deleted: number
          rate_limits_deleted: number
        }[]
      }
      create_vitrine: {
        Args: {
          p_address?: string
          p_business_hours?: Json
          p_categories: string[]
          p_default_button_text: string
          p_instagram?: string
          p_name: string
          p_service_segment?: string
          p_subdomain: string
          p_theme: string
          p_type: string
          p_whatsapp_label: string
          p_whatsapp_phone: string
        }
        Returns: string
      }
      current_video_month: { Args: never; Returns: string }
      default_checkout_settings: {
        Args: { p_owner_id: string; p_type: string; p_vitrine_id: string }
        Returns: undefined
      }
      effective_plan_id: { Args: { p_user_id: string }; Returns: string }
      excess_video_media: {
        Args: { p_user_ids: string[] }
        Returns: {
          id: string
          mux_asset_id: string
          owner_id: string
          storage_paths: Json
          subdomain: string
        }[]
      }
      hit_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      insert_order_snapshot: {
        Args: { p_code: string; p_payload: Json; p_vitrine_id: string }
        Returns: boolean
      }
      is_item_code_available: {
        Args: { p_code: string; p_item_id?: string }
        Returns: boolean
      }
      is_over_video_quota: { Args: { p_user_id: string }; Returns: boolean }
      is_reserved_subdomain: { Args: { p_value: string }; Returns: boolean }
      is_subdomain_available: {
        Args: { p_except_vitrine_id?: string; p_subdomain: string }
        Returns: boolean
      }
      media_cleanup_candidates: {
        Args: { p_older_than?: string }
        Returns: {
          id: string
          mux_asset_id: string
          storage_paths: Json
        }[]
      }
      my_entitlements: {
        Args: never
        Returns: {
          allow_branding: boolean
          id: string
          max_items_per_vitrine: number
          max_video_seconds: number
          max_video_upload_mb: number
          max_videos_per_account: number | null
          max_videos_per_vitrine: number
          max_vitrines: number
          monthly_video_gb: number
          name: string
          show_watermark: boolean
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_video_usage: {
        Args: never
        Returns: {
          bytes_delivered: number
          over_quota: boolean
          videos_count: number
        }[]
      }
      next_item_code: { Args: { p_owner_id: string }; Returns: string }
      peek_next_item_code: { Args: never; Returns: string }
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_starts_at: string }
        Returns: undefined
      }
      session_state: { Args: never; Returns: string }
      subdomains_over_quota_last_month: { Args: never; Returns: string[] }
      sync_vitrine_status: {
        Args: { p_keep_id?: string; p_user_id: string }
        Returns: string[]
      }
      users_pro_ended_between: {
        Args: { p_from_days: number; p_to_days?: number }
        Returns: string[]
      }
      videos_to_delete_after_pro: {
        Args: { p_days?: number }
        Returns: {
          id: string
          mux_asset_id: string
          owner_id: string
          storage_paths: Json
          subdomain: string
        }[]
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

