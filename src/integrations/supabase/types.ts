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
      activities: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_products: {
        Row: {
          client_id: string
          created_at: string | null
          current_steps: Json | null
          custom_product_name: string | null
          custom_value: number | null
          deadline: string | null
          discount: number | null
          employee_commission: number | null
          end_date: string | null
          id: string
          notes: string | null
          partner_commission: number | null
          product_id: string | null
          required_documents: Json | null
          responsible_employee_id: string | null
          responsible_provider_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          current_steps?: Json | null
          custom_product_name?: string | null
          custom_value?: number | null
          deadline?: string | null
          discount?: number | null
          employee_commission?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_commission?: number | null
          product_id?: string | null
          required_documents?: Json | null
          responsible_employee_id?: string | null
          responsible_provider_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          current_steps?: Json | null
          custom_product_name?: string | null
          custom_value?: number | null
          deadline?: string | null
          discount?: number | null
          employee_commission?: number | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_commission?: number | null
          product_id?: string | null
          required_documents?: Json | null
          responsible_employee_id?: string | null
          responsible_provider_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_responsible_provider_id_fkey"
            columns: ["responsible_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subscriptions: {
        Row: {
          amount: number
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          client_id: string
          created_at: string
          created_by: string | null
          custom_name: string | null
          end_date: string | null
          id: string
          next_billing_date: string | null
          notes: string | null
          product_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_id: string
          created_at?: string
          created_by?: string | null
          custom_name?: string | null
          end_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          product_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_id?: string
          created_at?: string
          created_by?: string | null
          custom_name?: string | null
          end_date?: string | null
          id?: string
          next_billing_date?: string | null
          notes?: string | null
          product_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_timeline: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          title: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          birth_date: string | null
          city: string | null
          collaborator_id: string | null
          commission_value: number | null
          company: string | null
          completion_date: string | null
          contract_value: number | null
          created_at: string
          created_by: string | null
          document: string | null
          document_type: string | null
          email: string | null
          entry_date: string | null
          full_name: string
          id: string
          indicator_id: string | null
          internal_notes: string | null
          notes: string | null
          origin: string | null
          partner_id: string | null
          payment_method: string | null
          payment_status: string | null
          phone: string | null
          priority: string | null
          provider_id: string | null
          referral_id: string | null
          referrer_id: string | null
          responsible_id: string | null
          sale_date: string | null
          sale_value: number | null
          service_provider_id: string | null
          source: string
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          tags: string[] | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          birth_date?: string | null
          city?: string | null
          collaborator_id?: string | null
          commission_value?: number | null
          company?: string | null
          completion_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          entry_date?: string | null
          full_name: string
          id?: string
          indicator_id?: string | null
          internal_notes?: string | null
          notes?: string | null
          origin?: string | null
          partner_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          priority?: string | null
          provider_id?: string | null
          referral_id?: string | null
          referrer_id?: string | null
          responsible_id?: string | null
          sale_date?: string | null
          sale_value?: number | null
          service_provider_id?: string | null
          source?: string
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          birth_date?: string | null
          city?: string | null
          collaborator_id?: string | null
          commission_value?: number | null
          company?: string | null
          completion_date?: string | null
          contract_value?: number | null
          created_at?: string
          created_by?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          entry_date?: string | null
          full_name?: string
          id?: string
          indicator_id?: string | null
          internal_notes?: string | null
          notes?: string | null
          origin?: string | null
          partner_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          priority?: string | null
          provider_id?: string | null
          referral_id?: string | null
          referrer_id?: string | null
          responsible_id?: string | null
          sale_date?: string | null
          sale_value?: number | null
          service_provider_id?: string | null
          source?: string
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_splits: {
        Row: {
          amount: number
          beneficiary_id: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          percent: number
          sale_id: string
          status: Database["public"]["Enums"]["split_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          beneficiary_id: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          percent: number
          sale_id: string
          status?: Database["public"]["Enums"]["split_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string
          beneficiary_type?: Database["public"]["Enums"]["beneficiary_type"]
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          percent?: number
          sale_id?: string
          status?: Database["public"]["Enums"]["split_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_splits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          approval_date: string | null
          approved_by: string | null
          client_id: string | null
          created_at: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          paid_at: string | null
          partner_id: string
          payment_date: string | null
          payment_method: string | null
          percent: number
          product_id: string | null
          reason: string | null
          rule_type: string | null
          sale_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approval_date?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          paid_at?: string | null
          partner_id: string
          payment_date?: string | null
          payment_method?: string | null
          percent: number
          product_id?: string | null
          reason?: string | null
          rule_type?: string | null
          sale_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_date?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string
          payment_date?: string | null
          payment_method?: string | null
          percent?: number
          product_id?: string | null
          reason?: string | null
          rule_type?: string | null
          sale_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          client_id: string
          description: string | null
          file_url: string | null
          id: string
          request_title: string
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          description?: string | null
          file_url?: string | null
          id?: string
          request_title: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          description?: string | null
          file_url?: string | null
          id?: string
          request_title?: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          file_path: string | null
          file_size: number | null
          id: string
          internal_notes: string | null
          mime_type: string | null
          name: string
          product_id: string | null
          rejection_reason: string | null
          requested_at: string | null
          requested_by: string | null
          reviewed_at: string | null
          sale_id: string | null
          status: Database["public"]["Enums"]["document_status_new"]
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          internal_notes?: string | null
          mime_type?: string | null
          name: string
          product_id?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["document_status_new"]
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          internal_notes?: string | null
          mime_type?: string | null
          name?: string
          product_id?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["document_status_new"]
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          function: string | null
          has_system_access: boolean | null
          id: string
          name: string
          notes: string | null
          permissions: Json | null
          phone: string | null
          role: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          function?: string | null
          has_system_access?: boolean | null
          id?: string
          name: string
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          function?: string | null
          has_system_access?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          permissions?: Json | null
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
        }
        Relationships: []
      }
      lead_history: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          conversion_date: string | null
          converted_to_client_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          partner_id: string | null
          phone: string | null
          product_id: string | null
          referral_id: string | null
          responsible_id: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          conversion_date?: string | null
          converted_to_client_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          product_id?: string | null
          referral_id?: string | null
          responsible_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          conversion_date?: string | null
          converted_to_client_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          partner_id?: string | null
          phone?: string | null
          product_id?: string | null
          referral_id?: string | null
          responsible_id?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_products: {
        Row: {
          active: boolean
          commission_percent: number
          created_at: string
          custom_price: number | null
          id: string
          notes: string | null
          partner_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_percent?: number
          created_at?: string
          custom_price?: number | null
          id?: string
          notes?: string | null
          partner_id: string
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_percent?: number
          created_at?: string
          custom_price?: number | null
          id?: string
          notes?: string | null
          partner_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_products_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          commission_percent: number | null
          created_at: string
          default_commission_value: number | null
          document: string | null
          email: string | null
          full_name: string
          has_system_access: boolean | null
          id: string
          notes: string | null
          partner_category:
            | Database["public"]["Enums"]["partner_type_enum"]
            | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          phone: string | null
          pix_key: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          commission_percent?: number | null
          created_at?: string
          default_commission_value?: number | null
          document?: string | null
          email?: string | null
          full_name: string
          has_system_access?: boolean | null
          id?: string
          notes?: string | null
          partner_category?:
            | Database["public"]["Enums"]["partner_type_enum"]
            | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          commission_percent?: number | null
          created_at?: string
          default_commission_value?: number | null
          document?: string | null
          email?: string | null
          full_name?: string
          has_system_access?: boolean | null
          id?: string
          notes?: string | null
          partner_category?:
            | Database["public"]["Enums"]["partner_type_enum"]
            | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          allow_partner: boolean
          avg_delivery_time: number | null
          base_price: number | null
          billing_type: string | null
          category_id: string | null
          created_at: string
          default_commission_percent: number | null
          default_employee_commission: number | null
          default_provider_value: number | null
          description: string | null
          id: string
          name: string
          recurring: boolean
          required_documents: Json | null
          standard_steps: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_partner?: boolean
          avg_delivery_time?: number | null
          base_price?: number | null
          billing_type?: string | null
          category_id?: string | null
          created_at?: string
          default_commission_percent?: number | null
          default_employee_commission?: number | null
          default_provider_value?: number | null
          description?: string | null
          id?: string
          name: string
          recurring?: boolean
          required_documents?: Json | null
          standard_steps?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_partner?: boolean
          avg_delivery_time?: number | null
          base_price?: number | null
          billing_type?: string | null
          category_id?: string | null
          created_at?: string
          default_commission_percent?: number | null
          default_employee_commission?: number | null
          default_provider_value?: number | null
          description?: string | null
          id?: string
          name?: string
          recurring?: boolean
          required_documents?: Json | null
          standard_steps?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          address_zip_code: string | null
          avatar_url: string | null
          created_at: string
          document_number: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          referral_id: string | null
          temp_password: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          address_zip_code?: string | null
          avatar_url?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          referral_id?: string | null
          temp_password?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          address_zip_code?: string | null
          avatar_url?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referral_id?: string | null
          temp_password?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          amount: number
          budget: number | null
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          name: string
          notes: string | null
          partner_id: string | null
          priority: string | null
          product_id: string | null
          progress: number
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          budget?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          name: string
          notes?: string | null
          partner_id?: string | null
          priority?: string | null
          product_id?: string | null
          progress?: number
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          budget?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          partner_id?: string | null
          priority?: string | null
          product_id?: string | null
          progress?: number
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: []
      }
      referrers: {
        Row: {
          active: boolean
          commission_percent: number
          created_at: string
          document: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          pix_key: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          commission_percent?: number
          created_at?: string
          document?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          commission_percent?: number
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sales: {
        Row: {
          amount: number
          client_id: string
          collaborator_id: string | null
          collaborator_percent: number | null
          commission_percent: number | null
          created_at: string
          created_by: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          partner_id: string | null
          payment_method: string | null
          product_id: string
          referrer_id: string | null
          referrer_percent: number | null
          sale_date: string
          status: Database["public"]["Enums"]["sale_status"]
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id: string
          collaborator_id?: string | null
          collaborator_percent?: number | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_method?: string | null
          product_id: string
          referrer_id?: string | null
          referrer_percent?: number | null
          sale_date?: string
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          collaborator_id?: string | null
          collaborator_percent?: number | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_method?: string | null
          product_id?: string
          referrer_id?: string | null
          referrer_percent?: number | null
          sale_date?: string
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_assignments: {
        Row: {
          client_id: string | null
          collaborator_id: string | null
          created_at: string | null
          due_date: string | null
          id: string
          notes: string | null
          product_id: string | null
          provider_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          provider_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          provider_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_assignments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          active: boolean | null
          created_at: string | null
          document_number: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          specialty: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          document_number?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          document_number?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialty?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          related_to_id: string | null
          related_to_type: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_to_id?: string | null
          related_to_type?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_to_id?: string | null
          related_to_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "vendedor"
        | "parceiro"
        | "cliente"
        | "colaborador"
        | "prestador"
        | "admin_secondary"
        | "lead"
      beneficiary_type: "partner" | "referrer" | "collaborator"
      billing_cycle: "mensal" | "trimestral" | "semestral" | "anual" | "unico"
      client_status: "ativo" | "inativo" | "prospecto"
      commission_status: "pendente" | "pago" | "cancelado"
      commission_status_enum:
        | "gerada"
        | "em_analise"
        | "aprovada"
        | "paga"
        | "cancelada"
        | "bloqueada"
      document_status: "solicitado" | "enviado" | "aprovado" | "rejeitado"
      document_status_new:
        | "solicitado"
        | "enviado"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "pendente_correcao"
        | "vencido"
      partner_type: "parceiro" | "indicador"
      partner_type_enum:
        | "indicador"
        | "afiliado"
        | "consultoria"
        | "agencia"
        | "outro"
      project_status:
        | "previsto"
        | "ativo"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      sale_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      split_status: "pendente" | "pago" | "cancelado"
      subscription_status: "ativa" | "pausada" | "cancelada" | "inadimplente"
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
      app_role: [
        "admin",
        "vendedor",
        "parceiro",
        "cliente",
        "colaborador",
        "prestador",
        "admin_secondary",
        "lead",
      ],
      beneficiary_type: ["partner", "referrer", "collaborator"],
      billing_cycle: ["mensal", "trimestral", "semestral", "anual", "unico"],
      client_status: ["ativo", "inativo", "prospecto"],
      commission_status: ["pendente", "pago", "cancelado"],
      commission_status_enum: [
        "gerada",
        "em_analise",
        "aprovada",
        "paga",
        "cancelada",
        "bloqueada",
      ],
      document_status: ["solicitado", "enviado", "aprovado", "rejeitado"],
      document_status_new: [
        "solicitado",
        "enviado",
        "em_analise",
        "aprovado",
        "reprovado",
        "pendente_correcao",
        "vencido",
      ],
      partner_type: ["parceiro", "indicador"],
      partner_type_enum: [
        "indicador",
        "afiliado",
        "consultoria",
        "agencia",
        "outro",
      ],
      project_status: [
        "previsto",
        "ativo",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      sale_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      split_status: ["pendente", "pago", "cancelado"],
      subscription_status: ["ativa", "pausada", "cancelada", "inadimplente"],
    },
  },
} as const
