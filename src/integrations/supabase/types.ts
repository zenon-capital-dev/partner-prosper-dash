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
      activity_logs: {
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
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
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
          metadata?: Json | null
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
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          rule_id: string | null
          status: string
          trigger_key: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          rule_id?: string | null
          status?: string
          trigger_key: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          rule_id?: string | null
          status?: string
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger_key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger_key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: []
      }
      client_collaborators: {
        Row: {
          added_by: string | null
          client_id: string
          collaborator_id: string
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          client_id: string
          collaborator_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          client_id?: string
          collaborator_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_collaborators_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_collaborators_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_collaborators_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      client_document_folder_providers: {
        Row: {
          folder_id: string
          granted_at: string
          granted_by: string | null
          provider_id: string
        }
        Insert: {
          folder_id: string
          granted_at?: string
          granted_by?: string | null
          provider_id: string
        }
        Update: {
          folder_id?: string
          granted_at?: string
          granted_by?: string | null
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_document_folder_providers_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "client_document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_folder_providers_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_document_folders: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_document_folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_document_requests: {
        Row: {
          client_id: string
          client_product_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          file_url: string | null
          id: string
          priority: string | null
          reviewed_at: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          client_product_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          priority?: string | null
          reviewed_at?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          client_product_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          file_url?: string | null
          id?: string
          priority?: string | null
          reviewed_at?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cdr_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_interactions: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          created_by: string | null
          done_at: string | null
          id: string
          next_action_at: string | null
          next_action_note: string | null
          occurred_at: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          channel?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          id?: string
          next_action_at?: string | null
          next_action_note?: string | null
          occurred_at?: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          done_at?: string | null
          id?: string
          next_action_at?: string | null
          next_action_note?: string | null
          occurred_at?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      client_journey_stages: {
        Row: {
          active: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          is_captation: boolean
          is_terminal: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_captation?: boolean
          is_terminal?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_captation?: boolean
          is_terminal?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_partners: {
        Row: {
          added_by: string | null
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          partner_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          partner_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          partner_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_partners_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_partners_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_delays: {
        Row: {
          client_product_id: string | null
          created_at: string | null
          delay_reason_category: string
          description: string
          id: string
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          client_product_id?: string | null
          created_at?: string | null
          delay_reason_category: string
          description: string
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          client_product_id?: string | null
          created_at?: string | null
          delay_reason_category?: string
          description?: string
          id?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_product_delays_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_pauses: {
        Row: {
          client_product_id: string | null
          created_at: string | null
          freeze_sla: boolean | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_by: string | null
          reason: string
          resumed_at: string | null
        }
        Insert: {
          client_product_id?: string | null
          created_at?: string | null
          freeze_sla?: boolean | null
          id?: string
          notes?: string | null
          paused_at?: string | null
          paused_by?: string | null
          reason: string
          resumed_at?: string | null
        }
        Update: {
          client_product_id?: string | null
          created_at?: string | null
          freeze_sla?: boolean | null
          id?: string
          notes?: string | null
          paused_at?: string | null
          paused_by?: string | null
          reason?: string
          resumed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_product_pauses_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_providers: {
        Row: {
          added_by: string | null
          client_product_id: string
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          role: string | null
          service_provider_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          client_product_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          service_provider_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          client_product_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          service_provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_product_providers_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_product_providers_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_quality_checks: {
        Row: {
          adjustment_deadline: string | null
          client_product_id: string | null
          created_at: string | null
          feedback: string | null
          id: string
          internal_notes: string | null
          reviewer_id: string | null
          status: string
        }
        Insert: {
          adjustment_deadline?: string | null
          client_product_id?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          internal_notes?: string | null
          reviewer_id?: string | null
          status: string
        }
        Update: {
          adjustment_deadline?: string | null
          client_product_id?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          internal_notes?: string | null
          reviewer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_product_quality_checks_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_status_reports: {
        Row: {
          attachments: Json
          client_product_id: string
          created_at: string
          id: string
          next_steps: string | null
          notes: string | null
          pending: string | null
          reported_by: string | null
          service_provider_id: string | null
          status: string
        }
        Insert: {
          attachments?: Json
          client_product_id: string
          created_at?: string
          id?: string
          next_steps?: string | null
          notes?: string | null
          pending?: string | null
          reported_by?: string | null
          service_provider_id?: string | null
          status: string
        }
        Update: {
          attachments?: Json
          client_product_id?: string
          created_at?: string
          id?: string
          next_steps?: string | null
          notes?: string | null
          pending?: string | null
          reported_by?: string | null
          service_provider_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_product_status_reports_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_product_status_reports_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_steps: {
        Row: {
          client_product_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          default_responsible: string | null
          description: string | null
          due_date: string | null
          id: string
          is_visible_to_client: boolean
          label: string
          notes: string | null
          position: number | null
          responsible_id: string | null
          status: Database["public"]["Enums"]["step_status"] | null
          updated_at: string | null
        }
        Insert: {
          client_product_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          default_responsible?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_visible_to_client?: boolean
          label: string
          notes?: string | null
          position?: number | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["step_status"] | null
          updated_at?: string | null
        }
        Update: {
          client_product_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          default_responsible?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_visible_to_client?: boolean
          label?: string
          notes?: string | null
          position?: number | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["step_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_product_steps_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_products: {
        Row: {
          adjustment_description: string | null
          adjustment_due_date: string | null
          adjustment_notes: string | null
          client_id: string
          company_id: string | null
          created_at: string | null
          current_step_id: string | null
          current_steps: Json | null
          custom_fields: Json | null
          custom_product_name: string | null
          custom_value: number | null
          deadline: string | null
          delay_reason: string | null
          discount: number | null
          employee_commission: number | null
          end_date: string | null
          id: string
          internal_notes: string | null
          is_sla_frozen: boolean | null
          notes: string | null
          partner_commission: number | null
          priority: Database["public"]["Enums"]["demand_priority"] | null
          product_id: string | null
          required_documents: Json | null
          responsible_employee_id: string | null
          responsible_provider_id: string | null
          sale_id: string | null
          service_provider_id: string | null
          sla_due_date: string | null
          sla_start_date: string | null
          sla_status: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          adjustment_description?: string | null
          adjustment_due_date?: string | null
          adjustment_notes?: string | null
          client_id: string
          company_id?: string | null
          created_at?: string | null
          current_step_id?: string | null
          current_steps?: Json | null
          custom_fields?: Json | null
          custom_product_name?: string | null
          custom_value?: number | null
          deadline?: string | null
          delay_reason?: string | null
          discount?: number | null
          employee_commission?: number | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          is_sla_frozen?: boolean | null
          notes?: string | null
          partner_commission?: number | null
          priority?: Database["public"]["Enums"]["demand_priority"] | null
          product_id?: string | null
          required_documents?: Json | null
          responsible_employee_id?: string | null
          responsible_provider_id?: string | null
          sale_id?: string | null
          service_provider_id?: string | null
          sla_due_date?: string | null
          sla_start_date?: string | null
          sla_status?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          adjustment_description?: string | null
          adjustment_due_date?: string | null
          adjustment_notes?: string | null
          client_id?: string
          company_id?: string | null
          created_at?: string | null
          current_step_id?: string | null
          current_steps?: Json | null
          custom_fields?: Json | null
          custom_product_name?: string | null
          custom_value?: number | null
          deadline?: string | null
          delay_reason?: string | null
          discount?: number | null
          employee_commission?: number | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          is_sla_frozen?: boolean | null
          notes?: string | null
          partner_commission?: number | null
          priority?: Database["public"]["Enums"]["demand_priority"] | null
          product_id?: string | null
          required_documents?: Json | null
          responsible_employee_id?: string | null
          responsible_provider_id?: string | null
          sale_id?: string | null
          service_provider_id?: string | null
          sla_due_date?: string | null
          sla_start_date?: string | null
          sla_status?: string | null
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
            foreignKeyName: "client_products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "product_steps"
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
            foreignKeyName: "client_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "client_products_responsible_provider_id_fkey"
            columns: ["responsible_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_products_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_providers: {
        Row: {
          added_by: string | null
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          role: string | null
          service_provider_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          service_provider_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          role?: string | null
          service_provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_providers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_providers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_providers_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_referrers: {
        Row: {
          added_by: string | null
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          referrer_id: string
          share_percent: number | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          referrer_id: string
          share_percent?: number | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          referrer_id?: string
          share_percent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_referrers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_referrers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_referrers_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          client_id: string
          from_stage_id: string | null
          from_stage_name: string | null
          id: string
          to_stage_id: string | null
          to_stage_name: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          client_id: string
          from_stage_id?: string | null
          from_stage_name?: string | null
          id?: string
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          client_id?: string
          from_stage_id?: string | null
          from_stage_name?: string | null
          id?: string
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_stage_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "client_journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "client_journey_stages"
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
            foreignKeyName: "client_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      client_support_ticket_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string
          ticket_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role: string
          ticket_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "client_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_support_tickets: {
        Row: {
          admin_notes: string | null
          assigned_to: string | null
          category: string | null
          client_id: string
          client_product_id: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string | null
          priority: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          assigned_to?: string | null
          category?: string | null
          client_id: string
          client_product_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          priority?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          assigned_to?: string | null
          category?: string | null
          client_id?: string
          client_product_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_support_tickets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_support_tickets_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
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
          {
            foreignKeyName: "client_timeline_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
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
          churn_risk: string | null
          city: string | null
          collaborator_commission_percent: number | null
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
          health_score: number | null
          id: string
          indicator_id: string | null
          internal_notes: string | null
          is_closed: boolean
          journey_stage_id: string | null
          journey_updated_at: string | null
          mandatory_steps: Json
          manual_approval_required: boolean
          notes: string | null
          onboarding_completed_at: string | null
          onboarding_progress: number | null
          onboarding_status: string | null
          origin: string | null
          partner_commission_percent: number | null
          partner_id: string | null
          payment_method: string | null
          payment_status: string | null
          phone: string | null
          priority: string | null
          provider_id: string | null
          referral_id: string | null
          referrer_commission_percent: number | null
          referrer_id: string | null
          responsible_id: string | null
          sale_date: string | null
          sale_value: number | null
          service_provider_id: string | null
          source: string
          stage_changed_at: string | null
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
          churn_risk?: string | null
          city?: string | null
          collaborator_commission_percent?: number | null
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
          health_score?: number | null
          id?: string
          indicator_id?: string | null
          internal_notes?: string | null
          is_closed?: boolean
          journey_stage_id?: string | null
          journey_updated_at?: string | null
          mandatory_steps?: Json
          manual_approval_required?: boolean
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress?: number | null
          onboarding_status?: string | null
          origin?: string | null
          partner_commission_percent?: number | null
          partner_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          priority?: string | null
          provider_id?: string | null
          referral_id?: string | null
          referrer_commission_percent?: number | null
          referrer_id?: string | null
          responsible_id?: string | null
          sale_date?: string | null
          sale_value?: number | null
          service_provider_id?: string | null
          source?: string
          stage_changed_at?: string | null
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
          churn_risk?: string | null
          city?: string | null
          collaborator_commission_percent?: number | null
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
          health_score?: number | null
          id?: string
          indicator_id?: string | null
          internal_notes?: string | null
          is_closed?: boolean
          journey_stage_id?: string | null
          journey_updated_at?: string | null
          mandatory_steps?: Json
          manual_approval_required?: boolean
          notes?: string | null
          onboarding_completed_at?: string | null
          onboarding_progress?: number | null
          onboarding_status?: string | null
          origin?: string | null
          partner_commission_percent?: number | null
          partner_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          priority?: string | null
          provider_id?: string | null
          referral_id?: string | null
          referrer_commission_percent?: number | null
          referrer_id?: string | null
          responsible_id?: string | null
          sale_date?: string | null
          sale_value?: number | null
          service_provider_id?: string | null
          source?: string
          stage_changed_at?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_journey_stage_id_fkey"
            columns: ["journey_stage_id"]
            isOneToOne: false
            referencedRelation: "client_journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
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
            foreignKeyName: "clients_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      collaborator_products: {
        Row: {
          active: boolean
          collaborator_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          collaborator_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          collaborator_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      commission_audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          amount: number | null
          beneficiary_id: string | null
          beneficiary_type: string | null
          created_at: string
          event: string
          id: string
          new_status: string | null
          old_status: string | null
          payment_id: string | null
          percent: number | null
          sale_id: string | null
          source: string | null
          source_id: string
          source_table: string
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number | null
          beneficiary_id?: string | null
          beneficiary_type?: string | null
          created_at?: string
          event: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          payment_id?: string | null
          percent?: number | null
          sale_id?: string | null
          source?: string | null
          source_id: string
          source_table: string
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number | null
          beneficiary_id?: string | null
          beneficiary_type?: string | null
          created_at?: string
          event?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          payment_id?: string | null
          percent?: number | null
          sale_id?: string | null
          source?: string | null
          source_id?: string
          source_table?: string
        }
        Relationships: []
      }
      commission_rules: {
        Row: {
          created_at: string
          id: string
          is_recurring: boolean | null
          partner_id: string | null
          product_id: string | null
          release_after_payment: boolean | null
          rule_type: string
          trigger_event: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_recurring?: boolean | null
          partner_id?: string | null
          product_id?: string | null
          release_after_payment?: boolean | null
          rule_type?: string
          trigger_event?: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_recurring?: boolean | null
          partner_id?: string | null
          product_id?: string | null
          release_after_payment?: boolean | null
          rule_type?: string
          trigger_event?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_rules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      commission_splits: {
        Row: {
          amount: number
          beneficiary_id: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          client_id: string | null
          client_product_id: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          percent: number
          sale_id: string | null
          status: Database["public"]["Enums"]["split_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          beneficiary_id: string
          beneficiary_type: Database["public"]["Enums"]["beneficiary_type"]
          client_id?: string | null
          client_product_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          percent: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["split_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string
          beneficiary_type?: Database["public"]["Enums"]["beneficiary_type"]
          client_id?: string | null
          client_product_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          percent?: number
          sale_id?: string | null
          status?: Database["public"]["Enums"]["split_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_splits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_splits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commission_splits_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
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
          applied_rule_description: string | null
          applied_rule_id: string | null
          approval_date: string | null
          approved_by: string | null
          client_id: string | null
          client_product_id: string | null
          collaborator_id: string | null
          commission_type: string | null
          created_at: string
          expected_date: string | null
          id: string
          is_recurring: boolean | null
          notes: string | null
          paid_at: string | null
          partner_id: string | null
          payment_date: string | null
          payment_id: string | null
          payment_method: string | null
          percent: number | null
          product_id: string | null
          reason: string | null
          receipt_url: string | null
          referrer_id: string | null
          rule_type: string | null
          rule_value: number | null
          sale_id: string | null
          sale_value: number | null
          service_provider_id: string | null
          status: string
          updated_at: string
          workflow_status:
            | Database["public"]["Enums"]["commission_workflow_status"]
            | null
        }
        Insert: {
          amount: number
          applied_rule_description?: string | null
          applied_rule_id?: string | null
          approval_date?: string | null
          approved_by?: string | null
          client_id?: string | null
          client_product_id?: string | null
          collaborator_id?: string | null
          commission_type?: string | null
          created_at?: string
          expected_date?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_date?: string | null
          payment_id?: string | null
          payment_method?: string | null
          percent?: number | null
          product_id?: string | null
          reason?: string | null
          receipt_url?: string | null
          referrer_id?: string | null
          rule_type?: string | null
          rule_value?: number | null
          sale_id?: string | null
          sale_value?: number | null
          service_provider_id?: string | null
          status?: string
          updated_at?: string
          workflow_status?:
            | Database["public"]["Enums"]["commission_workflow_status"]
            | null
        }
        Update: {
          amount?: number
          applied_rule_description?: string | null
          applied_rule_id?: string | null
          approval_date?: string | null
          approved_by?: string | null
          client_id?: string | null
          client_product_id?: string | null
          collaborator_id?: string | null
          commission_type?: string | null
          created_at?: string
          expected_date?: string | null
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_date?: string | null
          payment_id?: string | null
          payment_method?: string | null
          percent?: number | null
          product_id?: string | null
          reason?: string | null
          receipt_url?: string | null
          referrer_id?: string | null
          rule_type?: string | null
          rule_value?: number | null
          sale_id?: string | null
          sale_value?: number | null
          service_provider_id?: string | null
          status?: string
          updated_at?: string
          workflow_status?:
            | Database["public"]["Enums"]["commission_workflow_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_applied_rule_id_fkey"
            columns: ["applied_rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "commissions_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
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
            foreignKeyName: "commissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          client_id: string
          created_at: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          client_id: string
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          client_id?: string
          created_at?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          company_id: string
          created_at: string | null
          email: string
          id: string
          is_primary: boolean | null
          name: string
          permissions: Json | null
          profile_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          email: string
          id?: string
          is_primary?: boolean | null
          name: string
          permissions?: Json | null
          profile_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          email?: string
          id?: string
          is_primary?: boolean | null
          name?: string
          permissions?: Json | null
          profile_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_folders: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      contract_history: {
        Row: {
          action_by: string | null
          contract_id: string | null
          created_at: string | null
          file_path: string | null
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          action_by?: string | null
          contract_id?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          status: string
        }
        Update: {
          action_by?: string | null
          contract_id?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          active: boolean
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_path: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_path?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          amount: number | null
          client_id: string
          client_product_id: string | null
          contract_kind: string
          contract_type: string | null
          created_at: string | null
          expires_at: string | null
          file_path: string | null
          finished_at: string | null
          folder_id: string | null
          id: string
          internal_notes: string | null
          name: string
          partner_id: string | null
          product_id: string | null
          provider_id: string | null
          sale_id: string | null
          sent_at: string | null
          signed_at: string | null
          signed_file_path: string | null
          signed_uploaded_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          client_id: string
          client_product_id?: string | null
          contract_kind?: string
          contract_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          file_path?: string | null
          finished_at?: string | null
          folder_id?: string | null
          id?: string
          internal_notes?: string | null
          name: string
          partner_id?: string | null
          product_id?: string | null
          provider_id?: string | null
          sale_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signed_uploaded_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          client_id?: string
          client_product_id?: string | null
          contract_kind?: string
          contract_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          file_path?: string | null
          finished_at?: string | null
          folder_id?: string | null
          id?: string
          internal_notes?: string | null
          name?: string
          partner_id?: string | null
          product_id?: string | null
          provider_id?: string | null
          sale_id?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_file_path?: string | null
          signed_uploaded_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "contracts_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "contract_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "contracts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_actions: {
        Row: {
          assigned_to: string | null
          client_id: string
          client_product_id: string | null
          created_at: string
          created_by: string | null
          executed_at: string | null
          executed_by: string | null
          execution_notes: string | null
          id: string
          notes: string | null
          priority: string
          result: string | null
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          client_product_id?: string | null
          created_at?: string
          created_by?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_notes?: string | null
          id?: string
          notes?: string | null
          priority?: string
          result?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          client_product_id?: string | null
          created_at?: string
          created_by?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_notes?: string | null
          id?: string
          notes?: string | null
          priority?: string
          result?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "daily_actions_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_comments: {
        Row: {
          attachments: Json | null
          author_id: string
          client_product_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["comment_visibility"]
        }
        Insert: {
          attachments?: Json | null
          author_id: string
          client_product_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["comment_visibility"]
        }
        Update: {
          attachments?: Json | null
          author_id?: string
          client_product_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["comment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "demand_comments_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_deliveries: {
        Row: {
          client_product_id: string
          collaborator_id: string | null
          created_at: string | null
          description: string | null
          file_url: string | null
          files: Json
          id: string
          provider_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          client_product_id: string
          collaborator_id?: string | null
          created_at?: string | null
          description?: string | null
          file_url?: string | null
          files?: Json
          id?: string
          provider_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          client_product_id?: string
          collaborator_id?: string | null
          created_at?: string | null
          description?: string | null
          file_url?: string | null
          files?: Json
          id?: string
          provider_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_deliveries_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_deliveries_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_deliveries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_request_messages: {
        Row: {
          author_id: string | null
          author_role: string
          created_at: string
          id: string
          message: string
          request_id: string
        }
        Insert: {
          author_id?: string | null
          author_role: string
          created_at?: string
          id?: string
          message: string
          request_id: string
        }
        Update: {
          author_id?: string | null
          author_role?: string
          created_at?: string
          id?: string
          message?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_request_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "demand_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_requests: {
        Row: {
          client_id: string | null
          client_product_id: string
          created_at: string
          description: string | null
          id: string
          kind: string
          requested_by: string | null
          requested_role: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          target_role: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_product_id: string
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          requested_by?: string | null
          requested_role: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          target_role: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_product_id?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          requested_by?: string | null
          requested_role?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          target_role?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "demand_requests_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_shares: {
        Row: {
          can_download: boolean
          client_product_id: string
          created_at: string
          id: string
          invited_by: string | null
          message: string | null
          provider_id: string
          responded_at: string | null
          status: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          can_download?: boolean
          client_product_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          message?: string | null
          provider_id: string
          responded_at?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          can_download?: boolean
          client_product_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          message?: string | null
          provider_id?: string
          responded_at?: string | null
          status?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_shares_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_shares_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_history: {
        Row: {
          created_at: string | null
          created_by: string | null
          file_url: string
          id: string
          rejection_reason: string | null
          request_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          file_url: string
          id?: string
          rejection_reason?: string | null
          request_id?: string | null
          status: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          file_url?: string
          id?: string
          rejection_reason?: string | null
          request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          approval_date: string | null
          client_id: string
          client_product_id: string | null
          collaborator_id: string | null
          deadline: string | null
          description: string | null
          file_url: string | null
          id: string
          observations: string | null
          priority: string | null
          product_id: string | null
          provider_id: string | null
          rejection_reason: string | null
          request_title: string
          requested_at: string
          status: string
          submission_date: string | null
          updated_at: string
        }
        Insert: {
          approval_date?: string | null
          client_id: string
          client_product_id?: string | null
          collaborator_id?: string | null
          deadline?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          observations?: string | null
          priority?: string | null
          product_id?: string | null
          provider_id?: string | null
          rejection_reason?: string | null
          request_title: string
          requested_at?: string
          status?: string
          submission_date?: string | null
          updated_at?: string
        }
        Update: {
          approval_date?: string | null
          client_id?: string
          client_product_id?: string | null
          collaborator_id?: string | null
          deadline?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          observations?: string | null
          priority?: string | null
          product_id?: string | null
          provider_id?: string | null
          rejection_reason?: string | null
          request_title?: string
          requested_at?: string
          status?: string
          submission_date?: string | null
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
          {
            foreignKeyName: "document_requests_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "document_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          note: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          created_at?: string
          document_id: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          note?: string | null
          uploaded_by?: string | null
          version_number: number
        }
        Update: {
          created_at?: string
          document_id?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          note?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approved_by: string | null
          client_id: string | null
          client_product_id: string | null
          collaborator_id: string | null
          completed_file_path: string | null
          completed_file_size: number | null
          completed_mime_type: string | null
          completed_uploaded_at: string | null
          completed_uploaded_by: string | null
          created_at: string
          description: string | null
          due_date: string | null
          file_path: string | null
          file_size: number | null
          folder_id: string | null
          id: string
          internal_notes: string | null
          is_public: boolean | null
          is_required: boolean
          mime_type: string | null
          name: string
          parent_document_id: string | null
          partner_id: string | null
          phase_label: string | null
          priority: string | null
          product_id: string | null
          provider_id: string | null
          rejection_reason: string | null
          requested_at: string | null
          requested_by: string | null
          requires_signature: boolean
          reviewed_at: string | null
          sale_id: string | null
          signed_file_path: string | null
          signed_file_size: number | null
          signed_mime_type: string | null
          signed_uploaded_at: string | null
          signed_uploaded_by: string | null
          source: string
          status: Database["public"]["Enums"]["document_status_new"]
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          approved_by?: string | null
          client_id?: string | null
          client_product_id?: string | null
          collaborator_id?: string | null
          completed_file_path?: string | null
          completed_file_size?: number | null
          completed_mime_type?: string | null
          completed_uploaded_at?: string | null
          completed_uploaded_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          internal_notes?: string | null
          is_public?: boolean | null
          is_required?: boolean
          mime_type?: string | null
          name: string
          parent_document_id?: string | null
          partner_id?: string | null
          phase_label?: string | null
          priority?: string | null
          product_id?: string | null
          provider_id?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string | null
          requires_signature?: boolean
          reviewed_at?: string | null
          sale_id?: string | null
          signed_file_path?: string | null
          signed_file_size?: number | null
          signed_mime_type?: string | null
          signed_uploaded_at?: string | null
          signed_uploaded_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["document_status_new"]
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          approved_by?: string | null
          client_id?: string | null
          client_product_id?: string | null
          collaborator_id?: string | null
          completed_file_path?: string | null
          completed_file_size?: number | null
          completed_mime_type?: string | null
          completed_uploaded_at?: string | null
          completed_uploaded_by?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          internal_notes?: string | null
          is_public?: boolean | null
          is_required?: boolean
          mime_type?: string | null
          name?: string
          parent_document_id?: string | null
          partner_id?: string | null
          phase_label?: string | null
          priority?: string | null
          product_id?: string | null
          provider_id?: string | null
          rejection_reason?: string | null
          requested_at?: string | null
          requested_by?: string | null
          requires_signature?: boolean
          reviewed_at?: string | null
          sale_id?: string | null
          signed_file_path?: string | null
          signed_file_size?: number | null
          signed_mime_type?: string | null
          signed_uploaded_at?: string | null
          signed_uploaded_by?: string | null
          source?: string
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
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "documents_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "client_document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "documents_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
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
          due_date: string | null
          expense_date: string
          id: string
          notes: string | null
          paid: boolean
          paid_at: string | null
          payment_method: string | null
          receipt_url: string | null
          reference_month: string | null
          subcategory: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference_month?: string | null
          subcategory?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          paid?: boolean
          paid_at?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          reference_month?: string | null
          subcategory?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: []
      }
      financial_alerts: {
        Row: {
          alert_type: string
          client_id: string | null
          commission_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string | null
          payment_id: string | null
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          client_id?: string | null
          commission_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          payment_id?: string | null
          resolved_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          client_id?: string | null
          commission_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          payment_id?: string | null
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "financial_alerts_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_alerts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
          close_probability: number | null
          company: string | null
          conversion_date: string | null
          converted_to_client_id: string | null
          created_at: string | null
          email: string | null
          estimated_value: number | null
          full_name: string
          id: string
          next_action: string | null
          next_action_date: string | null
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
          close_probability?: number | null
          company?: string | null
          conversion_date?: string | null
          converted_to_client_id?: string | null
          created_at?: string | null
          email?: string | null
          estimated_value?: number | null
          full_name: string
          id?: string
          next_action?: string | null
          next_action_date?: string | null
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
          close_probability?: number | null
          company?: string | null
          conversion_date?: string | null
          converted_to_client_id?: string | null
          created_at?: string | null
          email?: string | null
          estimated_value?: number | null
          full_name?: string
          id?: string
          next_action?: string | null
          next_action_date?: string | null
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
            foreignKeyName: "leads_converted_to_client_id_fkey"
            columns: ["converted_to_client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
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
            foreignKeyName: "leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
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
      message_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          active?: boolean
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          client_id: string | null
          client_product_id: string | null
          content: string
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_private: boolean | null
          product_id: string | null
          task_id: string | null
        }
        Insert: {
          client_id?: string | null
          client_product_id?: string | null
          content: string
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_private?: boolean | null
          product_id?: string | null
          task_id?: string | null
        }
        Update: {
          client_id?: string | null
          client_product_id?: string | null
          content?: string
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_private?: boolean | null
          product_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "notes_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email: boolean
          id: string
          in_app: boolean
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: boolean
          id?: string
          in_app?: boolean
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: boolean
          id?: string
          in_app?: boolean
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          score: number
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          score: number
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
        ]
      }
      onboarding_documents: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          file_name: string | null
          file_url: string | null
          id: string
          is_required: boolean | null
          name: string
          product_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean | null
          name: string
          product_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean | null
          name?: string
          product_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      onboarding_history: {
        Row: {
          action: string
          client_id: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          client_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
        }
        Relationships: []
      }
      partner_contracts: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          admin_notes: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          birth_date: string | null
          company_cnpj: string | null
          company_name: string | null
          contract_signed_path: string | null
          contract_template_path: string | null
          contract_template_uploaded_at: string | null
          contract_uploaded_at: string | null
          cpf: string | null
          created_at: string
          email: string | null
          form_submitted_at: string | null
          full_name: string | null
          id: string
          legal_representative_cpf: string | null
          legal_representative_name: string | null
          legal_representative_role: string | null
          marital_status: string | null
          nationality: string | null
          nda_signed_path: string | null
          nda_template_path: string | null
          nda_template_uploaded_at: string | null
          nda_uploaded_at: string | null
          notes: string | null
          partner_id: string
          person_type: string
          phone: string | null
          pix_key: string | null
          profession: string | null
          rg: string | null
          rg_issuer: string | null
          status: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          admin_notes?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          company_cnpj?: string | null
          company_name?: string | null
          contract_signed_path?: string | null
          contract_template_path?: string | null
          contract_template_uploaded_at?: string | null
          contract_uploaded_at?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          form_submitted_at?: string | null
          full_name?: string | null
          id?: string
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          legal_representative_role?: string | null
          marital_status?: string | null
          nationality?: string | null
          nda_signed_path?: string | null
          nda_template_path?: string | null
          nda_template_uploaded_at?: string | null
          nda_uploaded_at?: string | null
          notes?: string | null
          partner_id: string
          person_type?: string
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          rg?: string | null
          rg_issuer?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          admin_notes?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          birth_date?: string | null
          company_cnpj?: string | null
          company_name?: string | null
          contract_signed_path?: string | null
          contract_template_path?: string | null
          contract_template_uploaded_at?: string | null
          contract_uploaded_at?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          form_submitted_at?: string | null
          full_name?: string | null
          id?: string
          legal_representative_cpf?: string | null
          legal_representative_name?: string | null
          legal_representative_role?: string | null
          marital_status?: string | null
          nationality?: string | null
          nda_signed_path?: string | null
          nda_template_path?: string | null
          nda_template_uploaded_at?: string | null
          nda_uploaded_at?: string | null
          notes?: string | null
          partner_id?: string
          person_type?: string
          phone?: string | null
          pix_key?: string | null
          profession?: string | null
          rg?: string | null
          rg_issuer?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contracts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_documents: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          final_path: string | null
          final_uploaded_at: string | null
          id: string
          name: string
          original_path: string | null
          original_uploaded_at: string | null
          partner_id: string
          signed_path: string | null
          signed_uploaded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          final_path?: string | null
          final_uploaded_at?: string | null
          id?: string
          name: string
          original_path?: string | null
          original_uploaded_at?: string | null
          partner_id: string
          signed_path?: string | null
          signed_uploaded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          final_path?: string | null
          final_uploaded_at?: string | null
          id?: string
          name?: string
          original_path?: string | null
          original_uploaded_at?: string | null
          partner_id?: string
          signed_path?: string | null
          signed_uploaded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_materials: {
        Row: {
          active: boolean
          audience: string
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          external_url: string | null
          file_path: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_path?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_url?: string | null
          file_path?: string | null
          id?: string
          title?: string
          updated_at?: string
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
          {
            foreignKeyName: "partner_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      partner_support_ticket_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string
          created_at: string
          id: string
          sender_role: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body: string
          created_at?: string
          id?: string
          sender_role: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string
          created_at?: string
          id?: string
          sender_role?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "partner_support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_support_tickets: {
        Row: {
          admin_notes: string | null
          admin_responded_at: string | null
          admin_response: string | null
          assigned_at: string | null
          assigned_to: string | null
          created_at: string
          id: string
          message: string
          partner_id: string
          priority: string
          responded_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          admin_responded_at?: string | null
          admin_response?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          message: string
          partner_id: string
          priority?: string
          responded_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          admin_responded_at?: string | null
          admin_response?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string
          partner_id?: string
          priority?: string
          responded_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_support_tickets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          active: boolean
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          bank_account: string | null
          bank_account_type: string | null
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
          is_full_carteira: boolean
          notes: string | null
          partner_category:
            | Database["public"]["Enums"]["partner_type_enum"]
            | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          phone: string | null
          pix_key: string | null
          profile_locked_at: string | null
          show_product_name: boolean
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
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
          is_full_carteira?: boolean
          notes?: string | null
          partner_category?:
            | Database["public"]["Enums"]["partner_type_enum"]
            | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          pix_key?: string | null
          profile_locked_at?: string | null
          show_product_name?: boolean
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
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
          is_full_carteira?: boolean
          notes?: string | null
          partner_category?:
            | Database["public"]["Enums"]["partner_type_enum"]
            | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          phone?: string | null
          pix_key?: string | null
          profile_locked_at?: string | null
          show_product_name?: boolean
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      payment_audit_log: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          amount: number | null
          client_id: string | null
          created_at: string
          event: string
          id: string
          new_amount_paid: number | null
          new_status: string | null
          old_amount_paid: number | null
          old_status: string | null
          payment_id: string
          sale_id: string | null
          source: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number | null
          client_id?: string | null
          created_at?: string
          event: string
          id?: string
          new_amount_paid?: number | null
          new_status?: string | null
          old_amount_paid?: number | null
          old_status?: string | null
          payment_id: string
          sale_id?: string | null
          source?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          amount?: number | null
          client_id?: string | null
          created_at?: string
          event?: string
          id?: string
          new_amount_paid?: number | null
          new_status?: string | null
          old_amount_paid?: number | null
          old_status?: string | null
          payment_id?: string
          sale_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_paid: number | null
          cancellation_reason: string | null
          client_id: string
          client_product_id: string | null
          collaborator_id: string | null
          competence_month: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          installment_number: number | null
          installments_count: number | null
          is_recurring: boolean | null
          notes: string | null
          paid_at: string | null
          partner_id: string | null
          payment_method: string | null
          product_id: string | null
          receipt_url: string | null
          recurrence_period: string | null
          referrer_id: string | null
          refund_amount: number | null
          refunded_at: string | null
          sale_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          cancellation_reason?: string | null
          client_id: string
          client_product_id?: string | null
          collaborator_id?: string | null
          competence_month?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          installment_number?: number | null
          installments_count?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_method?: string | null
          product_id?: string | null
          receipt_url?: string | null
          recurrence_period?: string | null
          referrer_id?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          cancellation_reason?: string | null
          client_id?: string
          client_product_id?: string | null
          collaborator_id?: string | null
          competence_month?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          installment_number?: number | null
          installments_count?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          paid_at?: string | null
          partner_id?: string | null
          payment_method?: string | null
          product_id?: string | null
          receipt_url?: string | null
          recurrence_period?: string | null
          referrer_id?: string | null
          refund_amount?: number | null
          refunded_at?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "payments_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "payments_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_document_files: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          folder_id: string
          id: string
          mime_type: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          folder_id: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          folder_id?: string
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_document_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "product_document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_document_folders: {
        Row: {
          client_product_id: string
          created_at: string
          created_by: string
          id: string
          name: string
          owner_provider_user_id: string | null
          scope: string
          updated_at: string
        }
        Insert: {
          client_product_id: string
          created_at?: string
          created_by?: string
          id?: string
          name: string
          owner_provider_user_id?: string | null
          scope: string
          updated_at?: string
        }
        Update: {
          client_product_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          owner_provider_user_id?: string | null
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_document_folders_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_required_documents: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_mandatory: boolean | null
          name: string
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          name: string
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_mandatory?: boolean | null
          name?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_required_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_required_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      product_steps: {
        Row: {
          created_at: string | null
          default_due_offset_days: number | null
          default_responsible: string
          description: string | null
          id: string
          is_visible_to_client: boolean
          name: string
          product_id: string | null
          step_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_due_offset_days?: number | null
          default_responsible?: string
          description?: string | null
          id?: string
          is_visible_to_client?: boolean
          name: string
          product_id?: string | null
          step_order: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_due_offset_days?: number | null
          default_responsible?: string
          description?: string | null
          id?: string
          is_visible_to_client?: boolean
          name?: string
          product_id?: string | null
          step_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_steps_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          allow_partner: boolean
          auto_tasks_template: Json | null
          avg_delivery_time: number | null
          base_price: number | null
          billing_type: string | null
          client_welcome_message: string | null
          created_at: string
          custom_fields_template: Json | null
          default_commission_percent: number | null
          default_contract_template_id: string | null
          default_employee_commission: number | null
          default_provider_value: number | null
          default_sla_days: number | null
          description: string | null
          doc_allowed_types: string[] | null
          doc_max_size_mb: number | null
          id: string
          initial_status: string | null
          installments_count: number | null
          installments_due_day: number | null
          installments_entry: number | null
          name: string
          provider_welcome_message: string | null
          recommended_contract_model_id: string | null
          recommended_provider_type: string | null
          recurring: boolean
          required_documents: Json | null
          sla_day_type: string | null
          standard_steps: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_partner?: boolean
          auto_tasks_template?: Json | null
          avg_delivery_time?: number | null
          base_price?: number | null
          billing_type?: string | null
          client_welcome_message?: string | null
          created_at?: string
          custom_fields_template?: Json | null
          default_commission_percent?: number | null
          default_contract_template_id?: string | null
          default_employee_commission?: number | null
          default_provider_value?: number | null
          default_sla_days?: number | null
          description?: string | null
          doc_allowed_types?: string[] | null
          doc_max_size_mb?: number | null
          id?: string
          initial_status?: string | null
          installments_count?: number | null
          installments_due_day?: number | null
          installments_entry?: number | null
          name: string
          provider_welcome_message?: string | null
          recommended_contract_model_id?: string | null
          recommended_provider_type?: string | null
          recurring?: boolean
          required_documents?: Json | null
          sla_day_type?: string | null
          standard_steps?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_partner?: boolean
          auto_tasks_template?: Json | null
          avg_delivery_time?: number | null
          base_price?: number | null
          billing_type?: string | null
          client_welcome_message?: string | null
          created_at?: string
          custom_fields_template?: Json | null
          default_commission_percent?: number | null
          default_contract_template_id?: string | null
          default_employee_commission?: number | null
          default_provider_value?: number | null
          default_sla_days?: number | null
          description?: string | null
          doc_allowed_types?: string[] | null
          doc_max_size_mb?: number | null
          id?: string
          initial_status?: string | null
          installments_count?: number | null
          installments_due_day?: number | null
          installments_entry?: number | null
          name?: string
          provider_welcome_message?: string | null
          recommended_contract_model_id?: string | null
          recommended_provider_type?: string | null
          recurring?: boolean
          required_documents?: Json | null
          sla_day_type?: string | null
          standard_steps?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_default_contract_template_fk"
            columns: ["default_contract_template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_recommended_contract_model_id_fkey"
            columns: ["recommended_contract_model_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
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
          admission_date: string | null
          avatar_url: string | null
          created_at: string
          department: string | null
          document_number: string | null
          email: string | null
          full_name: string | null
          has_system_access: boolean | null
          id: string
          internal_notes: string | null
          manual_approval_required: boolean | null
          onboarding_completed: boolean | null
          onboarding_started_at: string | null
          onboarding_step: number | null
          phone: string | null
          position: string | null
          referral_id: string | null
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
          admission_date?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          document_number?: string | null
          email?: string | null
          full_name?: string | null
          has_system_access?: boolean | null
          id: string
          internal_notes?: string | null
          manual_approval_required?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          phone?: string | null
          position?: string | null
          referral_id?: string | null
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
          admission_date?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          document_number?: string | null
          email?: string | null
          full_name?: string | null
          has_system_access?: boolean | null
          id?: string
          internal_notes?: string | null
          manual_approval_required?: boolean | null
          onboarding_completed?: boolean | null
          onboarding_started_at?: string | null
          onboarding_step?: number | null
          phone?: string | null
          position?: string | null
          referral_id?: string | null
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
      profit_reserves: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          reference_month: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          reference_month: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          reference_month?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          created_at: string
          description: string | null
          discount: number
          id: string
          position: number
          product_id: string | null
          product_name: string
          proposal_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          position?: number
          product_id?: string | null
          product_name: string
          proposal_id: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount?: number
          id?: string
          position?: number
          product_id?: string | null
          product_name?: string
          proposal_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          client_id: string | null
          converted_at: string | null
          converted_sale_id: string | null
          created_at: string
          created_by: string | null
          discount: number
          id: string
          internal_notes: string | null
          lead_id: string | null
          notes: string | null
          payment_terms: string | null
          proposal_number: string | null
          recipient_company: string | null
          recipient_document: string | null
          recipient_email: string | null
          recipient_name: string | null
          rejected_at: string | null
          rejected_reason: string | null
          sent_at: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          approved_at?: string | null
          client_id?: string | null
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          notes?: string | null
          payment_terms?: string | null
          proposal_number?: string | null
          recipient_company?: string | null
          recipient_document?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          approved_at?: string | null
          client_id?: string | null
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string
          created_by?: string | null
          discount?: number
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          notes?: string | null
          payment_terms?: string | null
          proposal_number?: string | null
          recipient_company?: string | null
          recipient_document?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "proposals_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_interactions: {
        Row: {
          channel: string
          client_id: string
          client_product_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          occurred_at: string
          provider_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          channel?: string
          client_id: string
          client_product_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          occurred_at?: string
          provider_id: string
          summary: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          client_product_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          occurred_at?: string
          provider_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "provider_interactions_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_interactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_schedule: {
        Row: {
          client_id: string
          client_product_id: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          priority: string
          provider_id: string
          scheduled_date: string
          scheduled_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          client_product_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string
          provider_id: string
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_product_id?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          priority?: string
          provider_id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_schedule_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_schedule_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "provider_schedule_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_schedule_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
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
      resource_pool_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          movement_type: string
          occurred_at: string
          pool_id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          movement_type: string
          occurred_at?: string
          pool_id: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          movement_type?: string
          occurred_at?: string
          pool_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_pool_movements_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_pools: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          created_by: string | null
          current_balance: number
          description: string | null
          funding_rule: Json | null
          id: string
          name: string
          pool_type: string
          project_id: string | null
          target_amount: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          description?: string | null
          funding_rule?: Json | null
          id?: string
          name: string
          pool_type?: string
          project_id?: string | null
          target_amount?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          description?: string | null
          funding_rule?: Json | null
          id?: string
          name?: string
          pool_type?: string
          project_id?: string | null
          target_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_pools_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          client_id: string
          closed_at: string | null
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
          project_id: string | null
          provider_cost: number
          recurrence_months: number | null
          recurrence_start: string | null
          referrer_id: string | null
          referrer_percent: number | null
          resource_pool_id: string | null
          revenue_type: string
          sale_date: string
          service_provider_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          updated_at: string
          zenon_cost: number
        }
        Insert: {
          amount?: number
          client_id: string
          closed_at?: string | null
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
          project_id?: string | null
          provider_cost?: number
          recurrence_months?: number | null
          recurrence_start?: string | null
          referrer_id?: string | null
          referrer_percent?: number | null
          resource_pool_id?: string | null
          revenue_type?: string
          sale_date?: string
          service_provider_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
          zenon_cost?: number
        }
        Update: {
          amount?: number
          client_id?: string
          closed_at?: string | null
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
          project_id?: string | null
          provider_cost?: number
          recurrence_months?: number | null
          recurrence_start?: string | null
          referrer_id?: string | null
          referrer_percent?: number | null
          resource_pool_id?: string | null
          revenue_type?: string
          sale_date?: string
          service_provider_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          updated_at?: string
          zenon_cost?: number
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
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "referrers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_resource_pool_id_fkey"
            columns: ["resource_pool_id"]
            isOneToOne: false
            referencedRelation: "resource_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          actual_value: number
          created_at: string
          created_by: string | null
          goal_type: string
          id: string
          notes: string | null
          period_month: string
          responsible_id: string | null
          target_value: number
          updated_at: string
        }
        Insert: {
          actual_value?: number
          created_at?: string
          created_by?: string | null
          goal_type: string
          id?: string
          notes?: string | null
          period_month: string
          responsible_id?: string | null
          target_value?: number
          updated_at?: string
        }
        Update: {
          actual_value?: number
          created_at?: string
          created_by?: string | null
          goal_type?: string
          id?: string
          notes?: string | null
          period_month?: string
          responsible_id?: string | null
          target_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
            foreignKeyName: "service_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "service_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
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
      service_provider_products: {
        Row: {
          active: boolean
          created_at: string
          custom_value: number | null
          id: string
          notes: string | null
          product_id: string
          service_provider_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          custom_value?: number | null
          id?: string
          notes?: string | null
          product_id: string
          service_provider_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          custom_value?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          service_provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_provider_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_provider_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "view_performance_by_product"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "service_provider_products_service_provider_id_fkey"
            columns: ["service_provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          active: boolean | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          bio: string | null
          created_at: string | null
          document_number: string | null
          email: string | null
          id: string
          internal_notes: string | null
          internal_rating: number | null
          name: string
          phone: string | null
          pix_key: string | null
          specialty: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp: string | null
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
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bio?: string | null
          created_at?: string | null
          document_number?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          internal_rating?: number | null
          name: string
          phone?: string | null
          pix_key?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
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
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bio?: string | null
          created_at?: string | null
          document_number?: string | null
          email?: string | null
          id?: string
          internal_notes?: string | null
          internal_rating?: number | null
          name?: string
          phone?: string | null
          pix_key?: string | null
          specialty?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      signature_stages: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          order_index: number
          parent_type: string
          party: string
          status: string
          updated_at: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          order_index?: number
          parent_type: string
          party?: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          order_index?: number
          parent_type?: string
          party?: string
          status?: string
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_stages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_stages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          label: string
          position: number
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label: string
          position?: number
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          label?: string
          position?: number
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          client_product_id: string | null
          completed_at: string | null
          contract_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          document_id: string | null
          due_date: string | null
          duration_minutes: number | null
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          location: string | null
          meeting_url: string | null
          outcome: string | null
          partner_id: string | null
          payment_id: string | null
          priority: string | null
          provider_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          related_to_id: string | null
          related_to_type: string | null
          reminder_minutes: number | null
          status: string | null
          status_new: Database["public"]["Enums"]["task_status_new"] | null
          title: string
          updated_at: string | null
          visible_to_client: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          client_product_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          location?: string | null
          meeting_url?: string | null
          outcome?: string | null
          partner_id?: string | null
          payment_id?: string | null
          priority?: string | null
          provider_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          related_to_id?: string | null
          related_to_type?: string | null
          reminder_minutes?: number | null
          status?: string | null
          status_new?: Database["public"]["Enums"]["task_status_new"] | null
          title: string
          updated_at?: string | null
          visible_to_client?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          client_product_id?: string | null
          completed_at?: string | null
          contract_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          due_date?: string | null
          duration_minutes?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          location?: string | null
          meeting_url?: string | null
          outcome?: string | null
          partner_id?: string | null
          payment_id?: string | null
          priority?: string | null
          provider_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          related_to_id?: string | null
          related_to_type?: string | null
          reminder_minutes?: number | null
          status?: string | null
          status_new?: Database["public"]["Enums"]["task_status_new"] | null
          title?: string
          updated_at?: string | null
          visible_to_client?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "view_client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "tasks_client_product_id_fkey"
            columns: ["client_product_id"]
            isOneToOne: false
            referencedRelation: "client_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted: boolean | null
          id: string
          permission_key: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission_key: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission_key?: string
          user_id?: string | null
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
      v_commissions_unified: {
        Row: {
          amount: number | null
          beneficiary_id: string | null
          beneficiary_name: string | null
          beneficiary_type: string | null
          client_name: string | null
          created_at: string | null
          id: string | null
          paid_at: string | null
          percent: number | null
          product_name: string | null
          sale_amount: number | null
          sale_date: string | null
          sale_id: string | null
          status: string | null
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
      view_client_financial_summary: {
        Row: {
          active_products: number | null
          client_id: string | null
          full_name: string | null
          total_contracted: number | null
          total_overdue: number | null
          total_paid: number | null
          total_pending: number | null
        }
        Relationships: []
      }
      view_performance_by_product: {
        Row: {
          gross_revenue: number | null
          net_revenue: number | null
          product_id: string | null
          product_name: string | null
          total_commissions: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      view_performance_by_source: {
        Row: {
          converted_sales: number | null
          source: string | null
          total_leads: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_dashboard_snapshot: {
        Args: { p_range_key?: string }
        Returns: Json
      }
      admin_delete_client_cascade: {
        Args: { _client_id: string }
        Returns: undefined
      }
      admin_delete_product_cascade: {
        Args: { _force?: boolean; _product_id: string }
        Returns: Json
      }
      calculate_sla_due_date: {
        Args: { day_type: string; days_to_add: number; start_date: string }
        Returns: string
      }
      can_access_product_folder: {
        Args: { _folder_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_signature_object: { Args: { _name: string }; Returns: boolean }
      can_access_signature_stage: {
        Args: { _stage_id: string }
        Returns: boolean
      }
      check_is_admin: { Args: { _user_id?: string }; Returns: boolean }
      check_overdue_documents: { Args: never; Returns: undefined }
      check_pending_commissions: { Args: never; Returns: undefined }
      check_user_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      client_submit_payment_receipt: {
        Args: { _payment_id: string; _receipt_path: string }
        Returns: undefined
      }
      complete_client_onboarding: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      financial_consistency_report: {
        Args: never
        Returns: {
          check_code: string
          check_name: string
          problems: number
          severity: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      is_assigned_provider: {
        Args: { _cp_id: string; _user_id: string }
        Returns: boolean
      }
      is_client_of_product: {
        Args: { _client_product_id: string; _user_id: string }
        Returns: boolean
      }
      is_delegated_provider: {
        Args: { _client_product_id: string; _user_id: string }
        Returns: boolean
      }
      is_provider_owner: {
        Args: { _provider_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      log_action: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_new_value?: Json
          p_old_value?: Json
        }
        Returns: undefined
      }
      log_demand_activity: {
        Args: {
          _action: string
          _client_product_id: string
          _description?: string
          _metadata?: Json
        }
        Returns: string
      }
      mark_overdue_payments: { Args: never; Returns: undefined }
      notification_enabled: {
        Args: { _type: string; _user_id: string }
        Returns: boolean
      }
      notify_admins: {
        Args: {
          p_link: string
          p_message: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      notify_tasks_due_today: { Args: never; Returns: undefined }
      provider_has_demand_access: {
        Args: { _client_product_id: string; _user_id: string }
        Returns: boolean
      }
      recompute_sales_goals_for_month: {
        Args: { p_month: string }
        Returns: undefined
      }
      sync_commissions_for_payment: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      sync_splits_for_payment: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      user_involved_in_demand: {
        Args: { _client_product_id: string; _user_id: string }
        Returns: boolean
      }
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
        | "indicador"
        | "super_admin"
      beneficiary_type:
        | "partner"
        | "referrer"
        | "collaborator"
        | "service_provider"
      billing_cycle: "mensal" | "trimestral" | "semestral" | "anual" | "unico"
      client_status:
        | "ativo"
        | "inativo"
        | "prospecto"
        | "novo_cliente"
        | "aguardando_atendimento"
        | "aguardando_documentos"
        | "documentos_enviados"
        | "documentos_analise"
        | "documentos_aprovados"
        | "documentos_reprovados"
        | "aguardando_contrato"
        | "contrato_enviado"
        | "contrato_assinado"
        | "pagamento_pendente"
        | "pagamento_parcial"
        | "pagamento_confirmado"
        | "em_andamento"
        | "aguardando_terceiro"
        | "finalizado"
        | "cancelado"
        | "reembolso"
      comment_visibility:
        | "internal"
        | "provider"
        | "client"
        | "system"
        | "admin"
      commission_status: "pendente" | "pago" | "cancelado"
      commission_status_enum:
        | "gerada"
        | "em_analise"
        | "aprovada"
        | "paga"
        | "cancelada"
        | "bloqueada"
      commission_workflow_status:
        | "aguardando_confirmacao"
        | "pendente"
        | "liberada"
        | "em_pagamento"
        | "paga"
        | "cancelada"
        | "estornada"
      contract_status:
        | "criado"
        | "enviado"
        | "aguardando_assinatura"
        | "assinado"
        | "pendente_correcao"
        | "cancelado"
        | "finalizado"
        | "rascunho"
        | "vencido"
      demand_priority: "baixa" | "normal" | "alta" | "urgente"
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
      payment_status:
        | "pago"
        | "pendente"
        | "parcialmente_pago"
        | "atrasado"
        | "cancelado"
        | "reembolsado"
        | "parcial"
        | "vencido"
        | "em_aberto"
      project_status:
        | "previsto"
        | "ativo"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      sale_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      split_status: "pendente" | "pago" | "cancelado"
      step_status:
        | "pendente"
        | "em_andamento"
        | "bloqueado"
        | "concluido"
        | "cancelado"
      subscription_status: "ativa" | "pausada" | "cancelada" | "inadimplente"
      task_kind:
        | "tarefa"
        | "reuniao"
        | "ligacao"
        | "pendencia_documento"
        | "lembrete"
        | "follow_up"
      task_priority_new: "baixa" | "normal" | "alta" | "urgente"
      task_status_new:
        | "a_fazer"
        | "em_andamento"
        | "aguardando_terceiros"
        | "bloqueada"
        | "concluida"
        | "cancelada"
        | "sem_atuacao"
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
        "indicador",
        "super_admin",
      ],
      beneficiary_type: [
        "partner",
        "referrer",
        "collaborator",
        "service_provider",
      ],
      billing_cycle: ["mensal", "trimestral", "semestral", "anual", "unico"],
      client_status: [
        "ativo",
        "inativo",
        "prospecto",
        "novo_cliente",
        "aguardando_atendimento",
        "aguardando_documentos",
        "documentos_enviados",
        "documentos_analise",
        "documentos_aprovados",
        "documentos_reprovados",
        "aguardando_contrato",
        "contrato_enviado",
        "contrato_assinado",
        "pagamento_pendente",
        "pagamento_parcial",
        "pagamento_confirmado",
        "em_andamento",
        "aguardando_terceiro",
        "finalizado",
        "cancelado",
        "reembolso",
      ],
      comment_visibility: ["internal", "provider", "client", "system", "admin"],
      commission_status: ["pendente", "pago", "cancelado"],
      commission_status_enum: [
        "gerada",
        "em_analise",
        "aprovada",
        "paga",
        "cancelada",
        "bloqueada",
      ],
      commission_workflow_status: [
        "aguardando_confirmacao",
        "pendente",
        "liberada",
        "em_pagamento",
        "paga",
        "cancelada",
        "estornada",
      ],
      contract_status: [
        "criado",
        "enviado",
        "aguardando_assinatura",
        "assinado",
        "pendente_correcao",
        "cancelado",
        "finalizado",
        "rascunho",
        "vencido",
      ],
      demand_priority: ["baixa", "normal", "alta", "urgente"],
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
      payment_status: [
        "pago",
        "pendente",
        "parcialmente_pago",
        "atrasado",
        "cancelado",
        "reembolsado",
        "parcial",
        "vencido",
        "em_aberto",
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
      step_status: [
        "pendente",
        "em_andamento",
        "bloqueado",
        "concluido",
        "cancelado",
      ],
      subscription_status: ["ativa", "pausada", "cancelada", "inadimplente"],
      task_kind: [
        "tarefa",
        "reuniao",
        "ligacao",
        "pendencia_documento",
        "lembrete",
        "follow_up",
      ],
      task_priority_new: ["baixa", "normal", "alta", "urgente"],
      task_status_new: [
        "a_fazer",
        "em_andamento",
        "aguardando_terceiros",
        "bloqueada",
        "concluida",
        "cancelada",
        "sem_atuacao",
      ],
    },
  },
} as const
