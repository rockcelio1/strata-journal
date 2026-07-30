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
      ai_usage_limits: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          request_count: number
          tokens_used: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          request_count?: number
          tokens_used?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          request_count?: number
          tokens_used?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_limits_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      app_modulos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          key: string
          nome: string
          ordem: number
          rota: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          key: string
          nome: string
          ordem?: number
          rota?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          key?: string
          nome?: string
          ordem?: number
          rota?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_recursos: {
        Row: {
          acoes: string[]
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          key: string
          modulo_key: string
          nome: string
          ordem: number
          rota: string | null
          updated_at: string
        }
        Insert: {
          acoes?: string[]
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          key: string
          modulo_key: string
          nome: string
          ordem?: number
          rota?: string | null
          updated_at?: string
        }
        Update: {
          acoes?: string[]
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          key?: string
          modulo_key?: string
          nome?: string
          ordem?: number
          rota?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_recursos_modulo_key_fkey"
            columns: ["modulo_key"]
            isOneToOne: false
            referencedRelation: "app_modulos"
            referencedColumns: ["key"]
          },
        ]
      }
      audit_logs_usuarios: {
        Row: {
          acao: string
          alvo_email: string | null
          alvo_user_id: string | null
          autor_id: string | null
          created_at: string
          detalhes: Json | null
          empresa_id: string
          id: string
        }
        Insert: {
          acao: string
          alvo_email?: string | null
          alvo_user_id?: string | null
          autor_id?: string | null
          created_at?: string
          detalhes?: Json | null
          empresa_id: string
          id?: string
        }
        Update: {
          acao?: string
          alvo_email?: string | null
          alvo_user_id?: string | null
          autor_id?: string | null
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_history: {
        Row: {
          arquivo_path: string | null
          arquivo_tamanho_bytes: number | null
          autor_email: string | null
          autor_id: string | null
          buckets_selecionados: string[]
          contagens: Json
          created_at: string
          criptografado: boolean
          duracao_ms: number | null
          empresa_id: string
          grupos_selecionados: string[]
          id: string
          mensagem: string | null
          modo_restore: string | null
          operacao: string
          origem: string
          resultado: string
          schedule_id: string | null
          since_iso: string | null
          tipo_backup: string | null
          validacoes: Json | null
        }
        Insert: {
          arquivo_path?: string | null
          arquivo_tamanho_bytes?: number | null
          autor_email?: string | null
          autor_id?: string | null
          buckets_selecionados?: string[]
          contagens?: Json
          created_at?: string
          criptografado?: boolean
          duracao_ms?: number | null
          empresa_id: string
          grupos_selecionados?: string[]
          id?: string
          mensagem?: string | null
          modo_restore?: string | null
          operacao: string
          origem?: string
          resultado: string
          schedule_id?: string | null
          since_iso?: string | null
          tipo_backup?: string | null
          validacoes?: Json | null
        }
        Update: {
          arquivo_path?: string | null
          arquivo_tamanho_bytes?: number | null
          autor_email?: string | null
          autor_id?: string | null
          buckets_selecionados?: string[]
          contagens?: Json
          created_at?: string
          criptografado?: boolean
          duracao_ms?: number | null
          empresa_id?: string
          grupos_selecionados?: string[]
          id?: string
          mensagem?: string | null
          modo_restore?: string | null
          operacao?: string
          origem?: string
          resultado?: string
          schedule_id?: string | null
          since_iso?: string | null
          tipo_backup?: string | null
          validacoes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "backup_history_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_restore_tests: {
        Row: {
          created_at: string
          empresa_id: string
          evidencia_url: string | null
          executed_at: string
          executed_by: string
          id: string
          observacoes: string | null
          resultado: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          evidencia_url?: string | null
          executed_at?: string
          executed_by: string
          id?: string
          observacoes?: string | null
          resultado: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          evidencia_url?: string | null
          executed_at?: string
          executed_by?: string
          id?: string
          observacoes?: string | null
          resultado?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_restore_tests_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_schedules: {
        Row: {
          alerta_100mb: boolean
          ativo: boolean
          buckets: string[]
          created_at: string
          created_by: string | null
          dia_mes: number | null
          dia_semana: number | null
          empresa_id: string
          frequencia: string
          grupos: string[]
          hora_utc: number
          id: string
          nome: string
          proxima_execucao: string | null
          retencao_dias: number
          tipo_backup: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          alerta_100mb?: boolean
          ativo?: boolean
          buckets?: string[]
          created_at?: string
          created_by?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa_id: string
          frequencia: string
          grupos?: string[]
          hora_utc?: number
          id?: string
          nome: string
          proxima_execucao?: string | null
          retencao_dias?: number
          tipo_backup?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          alerta_100mb?: boolean
          ativo?: boolean
          buckets?: string[]
          created_at?: string
          created_by?: string | null
          dia_mes?: number | null
          dia_semana?: number | null
          empresa_id?: string
          frequencia?: string
          grupos?: string[]
          hora_utc?: number
          id?: string
          nome?: string
          proxima_execucao?: string | null
          retencao_dias?: number
          tipo_backup?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_schedules_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      button_effect_settings: {
        Row: {
          button_key: string
          button_label: string
          created_at: string
          effect_type: string
          id: string
          is_active: boolean
          screen_key: string
          screen_name: string
          updated_at: string
        }
        Insert: {
          button_key: string
          button_label: string
          created_at?: string
          effect_type?: string
          id?: string
          is_active?: boolean
          screen_key: string
          screen_name: string
          updated_at?: string
        }
        Update: {
          button_key?: string
          button_label?: string
          created_at?: string
          effect_type?: string
          id?: string
          is_active?: boolean
          screen_key?: string
          screen_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      convites: {
        Row: {
          aceito: boolean
          created_at: string
          email: string
          empresa_id: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          aceito?: boolean
          created_at?: string
          email: string
          empresa_id: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          aceito?: boolean
          created_at?: string
          email?: string
          empresa_id?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          ativo: boolean
          created_at: string
          edge_function_name: string | null
          empresa_id: string
          from_email: string | null
          from_name: string
          mailgun_domain: string | null
          max_tentativas: number
          modo: string
          provider: string
          reply_to: string | null
          ses_region: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          edge_function_name?: string | null
          empresa_id: string
          from_email?: string | null
          from_name?: string
          mailgun_domain?: string | null
          max_tentativas?: number
          modo?: string
          provider?: string
          reply_to?: string | null
          ses_region?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          edge_function_name?: string | null
          empresa_id?: string
          from_email?: string | null
          from_name?: string
          mailgun_domain?: string | null
          max_tentativas?: number
          modo?: string
          provider?: string
          reply_to?: string | null
          ses_region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_credentials: {
        Row: {
          api_key: string | null
          api_secret: string | null
          created_at: string
          empresa_id: string
          extra: Json
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          empresa_id: string
          extra?: Json
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          created_at?: string
          empresa_id?: string
          extra?: Json
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_credentials_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          destinatario: string | null
          detalhes: Json
          empresa_id: string
          evento: string
          id: string
          provider: string | null
          queue_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          destinatario?: string | null
          detalhes?: Json
          empresa_id: string
          evento: string
          id?: string
          provider?: string | null
          queue_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          destinatario?: string | null
          detalhes?: Json
          empresa_id?: string
          evento?: string
          id?: string
          provider?: string | null
          queue_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          assunto: string
          corpo_html: string
          corpo_texto: string | null
          created_at: string
          created_by: string | null
          destinatario: string
          empresa_id: string
          enviado_em: string | null
          id: string
          idempotency_key: string | null
          max_tentativas: number
          provider: string | null
          provider_message_id: string | null
          proxima_tentativa_em: string
          status: string
          template_chave: string | null
          tentativas: number
          ultimo_erro: string | null
          updated_at: string
        }
        Insert: {
          assunto: string
          corpo_html: string
          corpo_texto?: string | null
          created_at?: string
          created_by?: string | null
          destinatario: string
          empresa_id: string
          enviado_em?: string | null
          id?: string
          idempotency_key?: string | null
          max_tentativas?: number
          provider?: string | null
          provider_message_id?: string | null
          proxima_tentativa_em?: string
          status?: string
          template_chave?: string | null
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
        }
        Update: {
          assunto?: string
          corpo_html?: string
          corpo_texto?: string | null
          created_at?: string
          created_by?: string | null
          destinatario?: string
          empresa_id?: string
          enviado_em?: string | null
          id?: string
          idempotency_key?: string | null
          max_tentativas?: number
          provider?: string | null
          provider_message_id?: string | null
          proxima_tentativa_em?: string
          status?: string
          template_chave?: string | null
          tentativas?: number
          ultimo_erro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          assunto: string
          ativo: boolean
          chave: string
          corpo_html: string
          corpo_texto: string | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          assunto: string
          ativo?: boolean
          chave: string
          corpo_html: string
          corpo_texto?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          chave?: string
          corpo_html?: string
          corpo_texto?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_logo_versions: {
        Row: {
          autor_id: string | null
          created_at: string
          empresa_id: string
          height: number | null
          id: string
          logo_url: string
          mime_type: string | null
          storage_path: string | null
          tamanho_bytes: number | null
          width: number | null
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          empresa_id: string
          height?: number | null
          id?: string
          logo_url: string
          mime_type?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          width?: number | null
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          empresa_id?: string
          height?: number | null
          id?: string
          logo_url?: string
          mime_type?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_logo_versions_autor_id_profiles_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_logo_versions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          alerta_backup_ultimo_envio: string | null
          app_android_url: string | null
          app_ios_url: string | null
          cnpj: string | null
          created_at: string
          id: string
          logo_url: string | null
          logo_wallpaper_opacity: number
          mfa_required: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          alerta_backup_ultimo_envio?: string | null
          app_android_url?: string | null
          app_ios_url?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          logo_wallpaper_opacity?: number
          mfa_required?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          alerta_backup_ultimo_envio?: string | null
          app_android_url?: string | null
          app_ios_url?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          logo_wallpaper_opacity?: number
          mfa_required?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          ativo: boolean
          controla_horas: boolean
          controla_quantidade: boolean
          created_at: string
          disciplina: string | null
          empresa_id: string
          id: string
          identificacao: string | null
          nome: string
          obrigatorio: boolean
          observacoes: string | null
          status: Database["public"]["Enums"]["equipamento_status"]
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          controla_horas?: boolean
          controla_quantidade?: boolean
          created_at?: string
          disciplina?: string | null
          empresa_id: string
          id?: string
          identificacao?: string | null
          nome: string
          obrigatorio?: boolean
          observacoes?: string | null
          status?: Database["public"]["Enums"]["equipamento_status"]
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          controla_horas?: boolean
          controla_quantidade?: boolean
          created_at?: string
          disciplina?: string | null
          empresa_id?: string
          id?: string
          identificacao?: string | null
          nome?: string
          obrigatorio?: boolean
          observacoes?: string | null
          status?: Database["public"]["Enums"]["equipamento_status"]
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          arquivo_url: string | null
          created_at: string
          empresa_id: string
          erro: string | null
          filtros: Json
          finished_at: string | null
          formato: Database["public"]["Enums"]["export_job_format"]
          id: string
          recurso: string
          started_at: string | null
          status: Database["public"]["Enums"]["export_job_status"]
          total_linhas: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          empresa_id: string
          erro?: string | null
          filtros?: Json
          finished_at?: string | null
          formato: Database["public"]["Enums"]["export_job_format"]
          id?: string
          recurso: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["export_job_status"]
          total_linhas?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          empresa_id?: string
          erro?: string | null
          filtros?: Json
          finished_at?: string | null
          formato?: Database["public"]["Enums"]["export_job_format"]
          id?: string
          recurso?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["export_job_status"]
          total_linhas?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_membros: {
        Row: {
          created_at: string
          grupo_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grupo_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          grupo_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_membros_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          obra_id: string | null
          tipo: Database["public"]["Enums"]["grupo_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          obra_id?: string | null
          tipo: Database["public"]["Enums"]["grupo_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          obra_id?: string | null
          tipo?: Database["public"]["Enums"]["grupo_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      help_article_feedback: {
        Row: {
          article_id: string
          comment: string | null
          created_at: string
          empresa_id: string | null
          helpful: boolean
          id: string
          user_id: string | null
        }
        Insert: {
          article_id: string
          comment?: string | null
          created_at?: string
          empresa_id?: string | null
          helpful: boolean
          id?: string
          user_id?: string | null
        }
        Update: {
          article_id?: string
          comment?: string | null
          created_at?: string
          empresa_id?: string | null
          helpful?: boolean
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_article_feedback_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_article_feedback_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      help_article_media: {
        Row: {
          article_id: string
          caption: string | null
          created_at: string
          empresa_id: string | null
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          sort_order: number
        }
        Insert: {
          article_id: string
          caption?: string | null
          created_at?: string
          empresa_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          sort_order?: number
        }
        Update: {
          article_id?: string
          caption?: string | null
          created_at?: string
          empresa_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "help_article_media_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_article_media_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          category_id: string | null
          content: string
          created_at: string
          created_by: string | null
          empresa_id: string | null
          id: string
          is_featured: boolean
          module_key: string | null
          published_at: string | null
          route_path: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["help_article_status"]
          summary: string | null
          tags: string[]
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          updated_at: string
          updated_by: string | null
          version: string | null
        }
        Insert: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          is_featured?: boolean
          module_key?: string | null
          published_at?: string | null
          route_path?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["help_article_status"]
          summary?: string | null
          tags?: string[]
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Update: {
          category_id?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          empresa_id?: string | null
          id?: string
          is_featured?: boolean
          module_key?: string | null
          published_at?: string | null
          route_path?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["help_article_status"]
          summary?: string | null
          tags?: string[]
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_articles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          empresa_id: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          empresa_id?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          empresa_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_categories_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      help_search_logs: {
        Row: {
          clicked_article_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          results_count: number
          search_term: string
          user_id: string | null
        }
        Insert: {
          clicked_article_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          results_count?: number
          search_term: string
          user_id?: string | null
        }
        Update: {
          clicked_article_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          results_count?: number
          search_term?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_search_logs_clicked_article_id_fkey"
            columns: ["clicked_article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_search_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      help_tutorial_steps: {
        Row: {
          action_required: boolean
          created_at: string
          description: string
          id: string
          position: string
          selector: string | null
          step_order: number
          title: string
          tutorial_id: string
          updated_at: string
        }
        Insert: {
          action_required?: boolean
          created_at?: string
          description: string
          id?: string
          position?: string
          selector?: string | null
          step_order: number
          title: string
          tutorial_id: string
          updated_at?: string
        }
        Update: {
          action_required?: boolean
          created_at?: string
          description?: string
          id?: string
          position?: string
          selector?: string | null
          step_order?: number
          title?: string
          tutorial_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_tutorial_steps_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "help_tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      help_tutorials: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          empresa_id: string | null
          id: string
          module_key: string | null
          route_path: string | null
          slug: string
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          empresa_id?: string | null
          id?: string
          module_key?: string | null
          route_path?: string | null
          slug: string
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          empresa_id?: string | null
          id?: string
          module_key?: string | null
          route_path?: string | null
          slug?: string
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_tutorials_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      help_user_progress: {
        Row: {
          article_id: string | null
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          do_not_show_again: boolean
          empresa_id: string | null
          id: string
          status: Database["public"]["Enums"]["help_progress_status"]
          tutorial_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          article_id?: string | null
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          do_not_show_again?: boolean
          empresa_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["help_progress_status"]
          tutorial_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          article_id?: string | null
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          do_not_show_again?: boolean
          empresa_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["help_progress_status"]
          tutorial_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_user_progress_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_user_progress_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_user_progress_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "help_tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs_tarefas: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          error_log: Json | null
          error_rows: number | null
          file_name: string | null
          id: string
          import_type: string | null
          imported_rows: number | null
          obra_id: string | null
          status: string
          template_id: string | null
          total_rows: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          error_log?: Json | null
          error_rows?: number | null
          file_name?: string | null
          id?: string
          import_type?: string | null
          imported_rows?: number | null
          obra_id?: string | null
          status?: string
          template_id?: string | null
          total_rows?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          error_log?: Json | null
          error_rows?: number | null
          file_name?: string | null
          id?: string
          import_type?: string | null
          imported_rows?: number | null
          obra_id?: string | null
          status?: string
          template_id?: string | null
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_tarefas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_tarefas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_requests: {
        Row: {
          created_at: string
          descricao: string | null
          due_at: string
          empresa_id: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          protocolo: string
          request_type: Database["public"]["Enums"]["lgpd_request_type"]
          requester_email: string
          requester_nome: string
          requester_user_id: string | null
          resposta: string | null
          status: Database["public"]["Enums"]["lgpd_request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          due_at?: string
          empresa_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          protocolo: string
          request_type: Database["public"]["Enums"]["lgpd_request_type"]
          requester_email: string
          requester_nome: string
          requester_user_id?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["lgpd_request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          due_at?: string
          empresa_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          protocolo?: string
          request_type?: Database["public"]["Enums"]["lgpd_request_type"]
          requester_email?: string
          requester_nome?: string
          requester_user_id?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["lgpd_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_requests_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_tarefas_itens: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          empresa_id: string
          id: string
          is_etapa: boolean
          nome: string
          obra_id: string | null
          ordem: number
          parent_id: string | null
          percentual: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          empresa_id: string
          id?: string
          is_etapa?: boolean
          nome: string
          obra_id?: string | null
          ordem?: number
          parent_id?: string | null
          percentual?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          empresa_id?: string
          id?: string
          is_etapa?: boolean
          nome?: string
          obra_id?: string | null
          ordem?: number
          parent_id?: string | null
          percentual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_tarefas_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_tarefas_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_tarefas_itens_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lista_tarefas_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_tarefas_progresso_hist: {
        Row: {
          autor_id: string | null
          created_at: string
          empresa_id: string
          id: string
          item_id: string
          obra_id: string | null
          percentual_anterior: number | null
          percentual_novo: number
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          item_id: string
          obra_id?: string | null
          percentual_anterior?: number | null
          percentual_novo: number
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          item_id?: string
          obra_id?: string | null
          percentual_anterior?: number | null
          percentual_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "lista_tarefas_progresso_hist_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_tarefas_progresso_hist_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "lista_tarefas_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_tarefas_progresso_hist_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      log_retention_policies: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          retencao_dias: number
          tipo_log: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          retencao_dias: number
          tipo_log: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          retencao_dias?: number
          tipo_log?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_retention_policies_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      mao_de_obra: {
        Row: {
          ativo: boolean
          contato: string | null
          created_at: string
          disciplina: string | null
          empresa_id: string
          empresa_terceira: string | null
          funcao: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contato?: string | null
          created_at?: string
          disciplina?: string | null
          empresa_id: string
          empresa_terceira?: string | null
          funcao: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contato?: string | null
          created_at?: string
          disciplina?: string | null
          empresa_id?: string
          empresa_terceira?: string | null
          funcao?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mao_de_obra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      media_load_events: {
        Row: {
          cache_status: string
          created_at: string
          duration_ms: number | null
          empresa_id: string | null
          http_status: number | null
          id: string
          onedrive_item_id: string | null
          thumb_size: string | null
        }
        Insert: {
          cache_status: string
          created_at?: string
          duration_ms?: number | null
          empresa_id?: string | null
          http_status?: number | null
          id?: string
          onedrive_item_id?: string | null
          thumb_size?: string | null
        }
        Update: {
          cache_status?: string
          created_at?: string
          duration_ms?: number | null
          empresa_id?: string | null
          http_status?: number | null
          id?: string
          onedrive_item_id?: string | null
          thumb_size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_load_events_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          lida_em: string | null
          mensagem: string | null
          rdo_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          lida_em?: string | null
          mensagem?: string | null
          rdo_id?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          lida_em?: string | null
          mensagem?: string | null
          rdo_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_anexos: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          file_name: string
          file_type: string | null
          id: string
          obra_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          file_name: string
          file_type?: string | null
          id?: string
          obra_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          file_name?: string
          file_type?: string | null
          id?: string
          obra_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_anexos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_anexos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_equipamentos_permitidos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          equipamento_id: string
          id: string
          obra_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          equipamento_id: string
          id?: string
          obra_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          equipamento_id?: string
          id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_equipamentos_permitidos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_equipamentos_permitidos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_equipamentos_permitidos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_fotos: {
        Row: {
          altura: number | null
          blur_data_url: string | null
          created_at: string
          empresa_id: string
          id: string
          largura: number | null
          mime_type: string | null
          nome: string | null
          obra_id: string
          ordem: number
          storage_path: string
          tamanho_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          altura?: number | null
          blur_data_url?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          largura?: number | null
          mime_type?: string | null
          nome?: string | null
          obra_id: string
          ordem?: number
          storage_path: string
          tamanho_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          altura?: number | null
          blur_data_url?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          largura?: number | null
          mime_type?: string | null
          nome?: string | null
          obra_id?: string
          ordem?: number
          storage_path?: string
          tamanho_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_fotos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_fotos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_funcoes_permitidas: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          mao_de_obra_id: string
          obra_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          mao_de_obra_id: string
          obra_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          mao_de_obra_id?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_funcoes_permitidas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_funcoes_permitidas_mao_de_obra_id_fkey"
            columns: ["mao_de_obra_id"]
            isOneToOne: false
            referencedRelation: "mao_de_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_funcoes_permitidas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_listas_tarefas: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nome: string
          obra_id: string
          template_id: string | null
          tipo_controle: Database["public"]["Enums"]["tarefa_controle"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nome: string
          obra_id: string
          template_id?: string | null
          tipo_controle?: Database["public"]["Enums"]["tarefa_controle"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          obra_id?: string
          template_id?: string | null
          tipo_controle?: Database["public"]["Enums"]["tarefa_controle"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_listas_tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_listas_tarefas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_listas_tarefas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_tarefa_itens: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          is_etapa: boolean
          item_code: string
          obra_id: string
          parent_id: string | null
          percent_complete: number
          planned_quantity: number | null
          realized_quantity: number
          sort_order: number
          status: Database["public"]["Enums"]["tarefa_status"]
          task_list_id: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          is_etapa?: boolean
          item_code: string
          obra_id: string
          parent_id?: string | null
          percent_complete?: number
          planned_quantity?: number | null
          realized_quantity?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["tarefa_status"]
          task_list_id: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          is_etapa?: boolean
          item_code?: string
          obra_id?: string
          parent_id?: string | null
          percent_complete?: number
          planned_quantity?: number | null
          realized_quantity?: number
          sort_order?: number
          status?: Database["public"]["Enums"]["tarefa_status"]
          task_list_id?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_tarefa_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_tarefa_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_tarefa_itens_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "obra_tarefa_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_tarefa_itens_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "obra_listas_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          avanco_pct: number
          cliente: string | null
          clima_cache: Json | null
          clima_cache_at: string | null
          codigo: string | null
          created_at: string
          data_inicio: string | null
          data_previsao_fim: string | null
          descricao: string | null
          empresa_id: string
          endereco: string | null
          foto_capa_blur: string | null
          foto_capa_path: string | null
          geo_at: string | null
          geo_endereco: string | null
          geo_lat: number | null
          geo_lng: number | null
          grupo_obra: string | null
          id: string
          nome: string
          numero_contrato: string | null
          responsavel_id: string | null
          responsavel_tecnico: string | null
          status: Database["public"]["Enums"]["obra_status"]
          updated_at: string
        }
        Insert: {
          avanco_pct?: number
          cliente?: string | null
          clima_cache?: Json | null
          clima_cache_at?: string | null
          codigo?: string | null
          created_at?: string
          data_inicio?: string | null
          data_previsao_fim?: string | null
          descricao?: string | null
          empresa_id: string
          endereco?: string | null
          foto_capa_blur?: string | null
          foto_capa_path?: string | null
          geo_at?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          grupo_obra?: string | null
          id?: string
          nome: string
          numero_contrato?: string | null
          responsavel_id?: string | null
          responsavel_tecnico?: string | null
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Update: {
          avanco_pct?: number
          cliente?: string | null
          clima_cache?: Json | null
          clima_cache_at?: string | null
          codigo?: string | null
          created_at?: string
          data_inicio?: string | null
          data_previsao_fim?: string | null
          descricao?: string | null
          empresa_id?: string
          endereco?: string | null
          foto_capa_blur?: string | null
          foto_capa_path?: string | null
          geo_at?: string | null
          geo_endereco?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          grupo_obra?: string | null
          id?: string
          nome?: string
          numero_contrato?: string | null
          responsavel_id?: string | null
          responsavel_tecnico?: string | null
          status?: Database["public"]["Enums"]["obra_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      onedrive_cache_settings: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          max_age_seconds: number
          swr_seconds: number
          thumb_size: string
          ttl_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          max_age_seconds?: number
          swr_seconds?: number
          thumb_size: string
          ttl_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          max_age_seconds?: number
          swr_seconds?: number
          thumb_size?: string
          ttl_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onedrive_cache_settings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perm_role_grants: {
        Row: {
          acao: string
          allowed: boolean
          created_at: string
          empresa_id: string
          id: string
          recurso_key: string
          role: Database["public"]["Enums"]["app_role"]
          scope: Database["public"]["Enums"]["perm_scope"]
          updated_at: string
        }
        Insert: {
          acao: string
          allowed?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          recurso_key: string
          role: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["perm_scope"]
          updated_at?: string
        }
        Update: {
          acao?: string
          allowed?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          recurso_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          scope?: Database["public"]["Enums"]["perm_scope"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perm_role_grants_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perm_user_grants: {
        Row: {
          acao: string
          allowed: boolean
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          motivo: string | null
          recurso_key: string
          scope: Database["public"]["Enums"]["perm_scope"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acao: string
          allowed: boolean
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          motivo?: string | null
          recurso_key: string
          scope?: Database["public"]["Enums"]["perm_scope"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acao?: string
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          motivo?: string | null
          recurso_key?: string
          scope?: Database["public"]["Enums"]["perm_scope"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perm_user_grants_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perm_user_scopes: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          escopo_id: string | null
          escopo_key: string | null
          escopo_tipo: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          escopo_id?: string | null
          escopo_key?: string | null
          escopo_tipo: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          escopo_id?: string | null
          escopo_key?: string | null
          escopo_tipo?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perm_user_scopes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aprovado: boolean
          aprovado_em: string | null
          aprovado_por: string | null
          cargo: string | null
          created_at: string
          email: string
          empresa_id: string
          id: string
          must_change_password: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          aprovado?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          cargo?: string | null
          created_at?: string
          email: string
          empresa_id: string
          id: string
          must_change_password?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          aprovado?: boolean
          aprovado_em?: string | null
          aprovado_por?: string | null
          cargo?: string | null
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          must_change_password?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          ip_hash: string | null
          request_count: number
          route: string
          updated_at: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          ip_hash?: string | null
          request_count?: number
          route: string
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          ip_hash?: string | null
          request_count?: number
          route?: string
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_acessos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          nivel: Database["public"]["Enums"]["rdo_acesso_nivel"]
          rdo_id: string
          sujeito_id: string
          sujeito_tipo: Database["public"]["Enums"]["rdo_acesso_sujeito"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          nivel?: Database["public"]["Enums"]["rdo_acesso_nivel"]
          rdo_id: string
          sujeito_id: string
          sujeito_tipo: Database["public"]["Enums"]["rdo_acesso_sujeito"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          nivel?: Database["public"]["Enums"]["rdo_acesso_nivel"]
          rdo_id?: string
          sujeito_id?: string
          sujeito_tipo?: Database["public"]["Enums"]["rdo_acesso_sujeito"]
        }
        Relationships: [
          {
            foreignKeyName: "rdo_acessos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_acessos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_anexos: {
        Row: {
          autor_id: string | null
          contexto: string | null
          created_at: string
          empresa_id: string
          id: string
          legenda: string | null
          mime_type: string | null
          nome: string
          ocorrencia_id: string | null
          onedrive_download_url: string | null
          onedrive_item_id: string | null
          onedrive_web_url: string | null
          ordem: number
          rdo_id: string
          rdo_tarefa_avanco_id: string | null
          storage_path: string
          storage_provider: string
          tamanho_bytes: number | null
          tarefa_item_id: string | null
          task_item_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          autor_id?: string | null
          contexto?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          legenda?: string | null
          mime_type?: string | null
          nome: string
          ocorrencia_id?: string | null
          onedrive_download_url?: string | null
          onedrive_item_id?: string | null
          onedrive_web_url?: string | null
          ordem?: number
          rdo_id: string
          rdo_tarefa_avanco_id?: string | null
          storage_path: string
          storage_provider?: string
          tamanho_bytes?: number | null
          tarefa_item_id?: string | null
          task_item_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          autor_id?: string | null
          contexto?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          legenda?: string | null
          mime_type?: string | null
          nome?: string
          ocorrencia_id?: string | null
          onedrive_download_url?: string | null
          onedrive_item_id?: string | null
          onedrive_web_url?: string | null
          ordem?: number
          rdo_id?: string
          rdo_tarefa_avanco_id?: string | null
          storage_path?: string
          storage_provider?: string
          tamanho_bytes?: number | null
          tarefa_item_id?: string | null
          task_item_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_anexos_autor_id_profiles_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_anexos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_anexos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_anexos_task_item_id_fkey"
            columns: ["task_item_id"]
            isOneToOne: false
            referencedRelation: "obra_tarefa_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_anexos_hist: {
        Row: {
          acao: string
          anexo_id: string | null
          autor_id: string | null
          created_at: string
          detalhes: Json | null
          empresa_id: string
          id: string
          rdo_id: string
        }
        Insert: {
          acao: string
          anexo_id?: string | null
          autor_id?: string | null
          created_at?: string
          detalhes?: Json | null
          empresa_id: string
          id?: string
          rdo_id: string
        }
        Update: {
          acao?: string
          anexo_id?: string | null
          autor_id?: string | null
          created_at?: string
          detalhes?: Json | null
          empresa_id?: string
          id?: string
          rdo_id?: string
        }
        Relationships: []
      }
      rdo_assinaturas: {
        Row: {
          assinado_em: string
          empresa_id: string
          geo: Json | null
          hash_sha256: string | null
          id: string
          ip: string | null
          rdo_id: string
          storage_path: string
          user_agent: string | null
          user_id: string
          via_grupo_id: string | null
        }
        Insert: {
          assinado_em?: string
          empresa_id: string
          geo?: Json | null
          hash_sha256?: string | null
          id?: string
          ip?: string | null
          rdo_id: string
          storage_path: string
          user_agent?: string | null
          user_id: string
          via_grupo_id?: string | null
        }
        Update: {
          assinado_em?: string
          empresa_id?: string
          geo?: Json | null
          hash_sha256?: string | null
          id?: string
          ip?: string | null
          rdo_id?: string
          storage_path?: string
          user_agent?: string | null
          user_id?: string
          via_grupo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_assinaturas_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_assinaturas_via_grupo_id_fkey"
            columns: ["via_grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_atividades: {
        Row: {
          created_at: string
          descricao: string
          id: string
          pct_executado: number
          rdo_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          pct_executado?: number
          rdo_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          pct_executado?: number
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_atividades_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_audit_logs: {
        Row: {
          acao: string
          autor_id: string | null
          created_at: string
          empresa_id: string
          id: string
          motivo: string | null
          rdo_id: string
          status_anterior: Database["public"]["Enums"]["rdo_status"] | null
          status_novo: Database["public"]["Enums"]["rdo_status"] | null
        }
        Insert: {
          acao: string
          autor_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          motivo?: string | null
          rdo_id: string
          status_anterior?: Database["public"]["Enums"]["rdo_status"] | null
          status_novo?: Database["public"]["Enums"]["rdo_status"] | null
        }
        Update: {
          acao?: string
          autor_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          motivo?: string | null
          rdo_id?: string
          status_anterior?: Database["public"]["Enums"]["rdo_status"] | null
          status_novo?: Database["public"]["Enums"]["rdo_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_audit_logs_autor_id_profiles_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_audit_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_audit_logs_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_equipamentos: {
        Row: {
          created_at: string
          equipamento_id: string
          horas_uso: number
          id: string
          rdo_id: string
          status_uso: string | null
        }
        Insert: {
          created_at?: string
          equipamento_id: string
          horas_uso?: number
          id?: string
          rdo_id: string
          status_uso?: string | null
        }
        Update: {
          created_at?: string
          equipamento_id?: string
          horas_uso?: number
          id?: string
          rdo_id?: string
          status_uso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_equipamentos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_equipamentos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_mao_de_obra: {
        Row: {
          created_at: string
          horas: number
          id: string
          mao_de_obra_id: string
          rdo_id: string
        }
        Insert: {
          created_at?: string
          horas?: number
          id?: string
          mao_de_obra_id: string
          rdo_id: string
        }
        Update: {
          created_at?: string
          horas?: number
          id?: string
          mao_de_obra_id?: string
          rdo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_mao_de_obra_mao_de_obra_id_fkey"
            columns: ["mao_de_obra_id"]
            isOneToOne: false
            referencedRelation: "mao_de_obra"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_mao_de_obra_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_ocorrencias: {
        Row: {
          created_at: string
          descricao: string
          foto_url: string | null
          id: string
          rdo_id: string
          tipo_ocorrencia_id: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          foto_url?: string | null
          id?: string
          rdo_id: string
          tipo_ocorrencia_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          foto_url?: string | null
          id?: string
          rdo_id?: string
          tipo_ocorrencia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_ocorrencias_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_ocorrencias_tipo_ocorrencia_id_fkey"
            columns: ["tipo_ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "tipos_ocorrencia"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_signatarios_requeridos: {
        Row: {
          created_at: string
          created_by: string | null
          empresa_id: string
          id: string
          rdo_id: string
          sujeito_id: string
          sujeito_tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          empresa_id: string
          id?: string
          rdo_id: string
          sujeito_id: string
          sujeito_tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          empresa_id?: string
          id?: string
          rdo_id?: string
          sujeito_id?: string
          sujeito_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_signatarios_requeridos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_signatarios_requeridos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
        ]
      }
      rdo_tarefa_avancos: {
        Row: {
          accumulated_percent: number | null
          accumulated_realized: number | null
          comment: string | null
          created_at: string
          created_by: string | null
          descricao: string
          empresa_id: string
          end_time: string | null
          id: string
          is_extra_activity: boolean
          item_code: string | null
          obra_id: string
          percent_today: number | null
          planned_quantity: number | null
          previous_percent: number | null
          previous_realized_quantity: number | null
          rdo_id: string
          realized_today: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["tarefa_status"] | null
          task_item_id: string | null
          task_list_id: string | null
          total_hours: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          accumulated_percent?: number | null
          accumulated_realized?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          descricao: string
          empresa_id: string
          end_time?: string | null
          id?: string
          is_extra_activity?: boolean
          item_code?: string | null
          obra_id: string
          percent_today?: number | null
          planned_quantity?: number | null
          previous_percent?: number | null
          previous_realized_quantity?: number | null
          rdo_id: string
          realized_today?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"] | null
          task_item_id?: string | null
          task_list_id?: string | null
          total_hours?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_percent?: number | null
          accumulated_realized?: number | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string
          empresa_id?: string
          end_time?: string | null
          id?: string
          is_extra_activity?: boolean
          item_code?: string | null
          obra_id?: string
          percent_today?: number | null
          planned_quantity?: number | null
          previous_percent?: number | null
          previous_realized_quantity?: number | null
          rdo_id?: string
          realized_today?: number | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["tarefa_status"] | null
          task_item_id?: string | null
          task_list_id?: string | null
          total_hours?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdo_tarefa_avancos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_tarefa_avancos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_tarefa_avancos_rdo_id_fkey"
            columns: ["rdo_id"]
            isOneToOne: false
            referencedRelation: "rdos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_tarefa_avancos_task_item_id_fkey"
            columns: ["task_item_id"]
            isOneToOne: false
            referencedRelation: "obra_tarefa_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdo_tarefa_avancos_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "obra_listas_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          autor_id: string
          clima_manha: Database["public"]["Enums"]["clima"] | null
          clima_noite: Database["public"]["Enums"]["clima"] | null
          clima_tarde: Database["public"]["Enums"]["clima"] | null
          created_at: string
          data: string
          deleted_at: string | null
          deleted_by: string | null
          disabled_at: string | null
          disabled_by: string | null
          empresa_id: string
          enviado_em: string | null
          final_pdf_url: string | null
          id: string
          motivo_reprovacao: string | null
          numero: number
          obra_id: string
          observacoes: string | null
          revision_reason: string | null
          revision_requested_at: string | null
          revision_requested_by: string | null
          status: Database["public"]["Enums"]["rdo_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          autor_id: string
          clima_manha?: Database["public"]["Enums"]["clima"] | null
          clima_noite?: Database["public"]["Enums"]["clima"] | null
          clima_tarde?: Database["public"]["Enums"]["clima"] | null
          created_at?: string
          data: string
          deleted_at?: string | null
          deleted_by?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          empresa_id: string
          enviado_em?: string | null
          final_pdf_url?: string | null
          id?: string
          motivo_reprovacao?: string | null
          numero?: number
          obra_id: string
          observacoes?: string | null
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          status?: Database["public"]["Enums"]["rdo_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          autor_id?: string
          clima_manha?: Database["public"]["Enums"]["clima"] | null
          clima_noite?: Database["public"]["Enums"]["clima"] | null
          clima_tarde?: Database["public"]["Enums"]["clima"] | null
          created_at?: string
          data?: string
          deleted_at?: string | null
          deleted_by?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          empresa_id?: string
          enviado_em?: string | null
          final_pdf_url?: string | null
          id?: string
          motivo_reprovacao?: string | null
          numero?: number
          obra_id?: string
          observacoes?: string | null
          revision_reason?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          status?: Database["public"]["Enums"]["rdo_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rdos_aprovado_por_profiles_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_autor_id_profiles_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rdos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          action: Database["public"]["Enums"]["app_action"]
          allowed: boolean
          created_at: string
          empresa_id: string
          id: string
          resource: Database["public"]["Enums"]["app_resource"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["app_action"]
          allowed?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          resource: Database["public"]["Enums"]["app_resource"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["app_action"]
          allowed?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          resource?: Database["public"]["Enums"]["app_resource"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alerts: {
        Row: {
          created_at: string
          descricao: string | null
          detalhes: Json
          empresa_id: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          ip_address: string | null
          severidade: Database["public"]["Enums"]["security_alert_severity"]
          status: Database["public"]["Enums"]["security_alert_status"]
          tipo: string
          titulo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          detalhes?: Json
          empresa_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          ip_address?: string | null
          severidade?: Database["public"]["Enums"]["security_alert_severity"]
          status?: Database["public"]["Enums"]["security_alert_status"]
          tipo: string
          titulo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          detalhes?: Json
          empresa_id?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          ip_address?: string | null
          severidade?: Database["public"]["Enums"]["security_alert_severity"]
          status?: Database["public"]["Enums"]["security_alert_status"]
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      skeleton_loading_settings: {
        Row: {
          created_at: string
          effect_type: string
          id: string
          is_active: boolean
          layout_type: string
          screen_key: string
          screen_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effect_type: string
          id?: string
          is_active?: boolean
          layout_type?: string
          screen_key: string
          screen_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effect_type?: string
          id?: string
          is_active?: boolean
          layout_type?: string
          screen_key?: string
          screen_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_changelog: {
        Row: {
          change_type: Database["public"]["Enums"]["changelog_type"]
          created_at: string
          created_by: string | null
          description: string | null
          empresa_id: string | null
          help_article_id: string | null
          how_to_use: string | null
          id: string
          module_key: string | null
          route_path: string | null
          target_roles: Database["public"]["Enums"]["app_role"][]
          title: string
          version: string | null
        }
        Insert: {
          change_type?: Database["public"]["Enums"]["changelog_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          empresa_id?: string | null
          help_article_id?: string | null
          how_to_use?: string | null
          id?: string
          module_key?: string | null
          route_path?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title: string
          version?: string | null
        }
        Update: {
          change_type?: Database["public"]["Enums"]["changelog_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          empresa_id?: string | null
          help_article_id?: string | null
          how_to_use?: string | null
          id?: string
          module_key?: string | null
          route_path?: string | null
          target_roles?: Database["public"]["Enums"]["app_role"][]
          title?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_changelog_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_changelog_help_article_id_fkey"
            columns: ["help_article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_tarefa_itens: {
        Row: {
          ativo: boolean
          created_at: string
          default_percent: number | null
          default_realized_quantity: number | null
          descricao: string
          empresa_id: string
          id: string
          is_etapa: boolean
          item_code: string
          parent_id: string | null
          planned_quantity: number | null
          sort_order: number
          template_id: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          default_percent?: number | null
          default_realized_quantity?: number | null
          descricao: string
          empresa_id: string
          id?: string
          is_etapa?: boolean
          item_code: string
          parent_id?: string | null
          planned_quantity?: number | null
          sort_order?: number
          template_id: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          default_percent?: number | null
          default_realized_quantity?: number | null
          descricao?: string
          empresa_id?: string
          id?: string
          is_etapa?: boolean
          item_code?: string
          parent_id?: string | null
          planned_quantity?: number | null
          sort_order?: number
          template_id?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_tarefa_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tarefa_itens_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "template_tarefa_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tarefa_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_tarefas: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          tipo_controle: Database["public"]["Enums"]["tarefa_controle"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          tipo_controle?: Database["public"]["Enums"]["tarefa_controle"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          tipo_controle?: Database["public"]["Enums"]["tarefa_controle"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "templates_tarefas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_ocorrencia: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
          severidade: Database["public"]["Enums"]["severidade"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
          severidade?: Database["public"]["Enums"]["severidade"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          severidade?: Database["public"]["Enums"]["severidade"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_ocorrencia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          action: Database["public"]["Enums"]["app_action"]
          allowed: boolean
          created_at: string
          empresa_id: string
          id: string
          resource: Database["public"]["Enums"]["app_resource"]
          updated_at: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["app_action"]
          allowed: boolean
          created_at?: string
          empresa_id: string
          id?: string
          resource: Database["public"]["Enums"]["app_resource"]
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["app_action"]
          allowed?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          resource?: Database["public"]["Enums"]["app_resource"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_security_settings: {
        Row: {
          created_at: string
          empresa_id: string | null
          last_login_at: string | null
          last_login_ip: string | null
          last_password_change_at: string | null
          mfa_enabled: boolean
          mfa_enrolled_at: string | null
          mfa_required: boolean
          notify_new_login: boolean
          notify_password_change: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          last_password_change_at?: string | null
          mfa_enabled?: boolean
          mfa_enrolled_at?: string | null
          mfa_required?: boolean
          notify_new_login?: boolean
          notify_password_change?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          last_password_change_at?: string | null
          mfa_enabled?: boolean
          mfa_enrolled_at?: string | null
          mfa_required?: boolean
          notify_new_login?: boolean
          notify_password_change?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_security_settings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_disable_rdo: {
        Args: { _disable: boolean; _rdo_id: string }
        Returns: undefined
      }
      admin_soft_delete_rdo: { Args: { _rdo_id: string }; Returns: undefined }
      admin_update_rdo_basico: {
        Args: {
          _clima_manha: Database["public"]["Enums"]["clima"]
          _clima_noite: Database["public"]["Enums"]["clima"]
          _clima_tarde: Database["public"]["Enums"]["clima"]
          _data: string
          _obra_id: string
          _observacoes: string
          _rdo_id: string
        }
        Returns: undefined
      }
      backup_estimate: {
        Args: { _empresa: string; _since?: string; _tables: string[] }
        Returns: {
          bytes: number
          row_count: number
          table_name: string
        }[]
      }
      backup_estimate_admin: {
        Args: { _empresa: string; _since?: string; _tables: string[] }
        Returns: {
          bytes: number
          row_count: number
          table_name: string
        }[]
      }
      backup_size_alert: {
        Args: { _threshold_bytes?: number }
        Returns: {
          delta_bytes: number
          empresa_id: string
          notified: boolean
        }[]
      }
      can_access_rdo: {
        Args: {
          _nivel: Database["public"]["Enums"]["rdo_acesso_nivel"]
          _rdo: string
          _user: string
        }
        Returns: boolean
      }
      check_ai_quota: {
        Args: { _tokens?: number }
        Returns: {
          allowed: boolean
          limit_value: number
          remaining: number
          used: number
        }[]
      }
      check_ip_rate_limit: {
        Args: {
          _ip_hash: string
          _max_requests?: number
          _route: string
          _window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          limit_value: number
          reset_at: string
        }[]
      }
      check_rate_limit: {
        Args: {
          _max_requests?: number
          _route: string
          _window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          limit_value: number
          reset_at: string
        }[]
      }
      cleanup_old_backups: { Args: never; Returns: number }
      escopo_de: {
        Args: { _acao: string; _recurso: string; _user: string }
        Returns: Database["public"]["Enums"]["perm_scope"]
      }
      has_admin_access: { Args: { _user_id: string }; Returns: boolean }
      has_permission: {
        Args: {
          _action: Database["public"]["Enums"]["app_action"]
          _resource: Database["public"]["Enums"]["app_resource"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      meus_acessos: {
        Args: never
        Returns: {
          acao: string
          recurso_key: string
          scope: Database["public"]["Enums"]["perm_scope"]
        }[]
      }
      pode: {
        Args: { _acao: string; _recurso: string; _user: string }
        Returns: boolean
      }
      rdo_signatarios_pendentes: {
        Args: { _rdo_id: string }
        Returns: {
          user_id: string
        }[]
      }
      seed_equipamentos_padrao: { Args: never; Returns: number }
      seed_mao_de_obra_padrao: { Args: never; Returns: number }
      seed_tipos_ocorrencia_padrao: { Args: never; Returns: number }
      soft_delete_rdo: { Args: { _rdo_id: string }; Returns: undefined }
    }
    Enums: {
      app_action:
        | "ver"
        | "criar"
        | "editar"
        | "excluir"
        | "aprovar"
        | "exportar"
        | "importar"
        | "solicitar_revisao"
      app_resource:
        | "obras"
        | "rdos"
        | "usuarios"
        | "relatorios"
        | "equipamentos"
        | "mao_de_obra"
        | "ocorrencias"
        | "convites"
        | "empresa"
        | "permissoes"
        | "templates_tarefas"
        | "listas_tarefas"
      app_role:
        | "admin"
        | "engenheiro"
        | "mestre"
        | "visualizador"
        | "master"
        | "gestor_acessos"
      changelog_type:
        | "novo"
        | "correcao"
        | "melhoria"
        | "seguranca"
        | "integracao"
        | "visual"
      clima:
        | "ensolarado"
        | "nublado"
        | "chuvoso"
        | "chuva_forte"
        | "impraticavel"
      equipamento_status: "disponivel" | "em_uso" | "manutencao"
      export_job_format: "csv" | "xlsx" | "pdf" | "json"
      export_job_status:
        | "pendente"
        | "processando"
        | "concluido"
        | "erro"
        | "cancelado"
      grupo_tipo: "global" | "equipe_obra"
      help_article_status: "rascunho" | "publicado" | "arquivado"
      help_progress_status:
        | "nao_iniciado"
        | "em_andamento"
        | "concluido"
        | "dispensado"
      lgpd_request_status:
        | "recebido"
        | "em_analise"
        | "em_execucao"
        | "concluido"
        | "recusado"
        | "cancelado"
      lgpd_request_type:
        | "acesso"
        | "correcao"
        | "exclusao"
        | "portabilidade"
        | "anonimizacao"
        | "revogacao"
      obra_status: "planejamento" | "em_andamento" | "pausada" | "concluida"
      perm_scope: "proprio" | "equipe" | "empresa" | "global"
      rdo_acesso_nivel: "ver" | "editar" | "aprovar"
      rdo_acesso_sujeito: "user" | "grupo"
      rdo_status:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "reprovado"
        | "assinado"
        | "em_revisao"
        | "revisao_solicitada"
        | "reaberto"
        | "cancelado"
      security_alert_severity: "info" | "baixa" | "media" | "alta" | "critica"
      security_alert_status:
        | "aberto"
        | "em_analise"
        | "resolvido"
        | "falso_positivo"
      severidade: "baixa" | "media" | "alta" | "critica"
      tarefa_controle: "porcentagem" | "produtividade" | "misto"
      tarefa_status:
        | "nao_iniciada"
        | "em_andamento"
        | "concluida"
        | "paralisada"
        | "cancelada"
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
      app_action: [
        "ver",
        "criar",
        "editar",
        "excluir",
        "aprovar",
        "exportar",
        "importar",
        "solicitar_revisao",
      ],
      app_resource: [
        "obras",
        "rdos",
        "usuarios",
        "relatorios",
        "equipamentos",
        "mao_de_obra",
        "ocorrencias",
        "convites",
        "empresa",
        "permissoes",
        "templates_tarefas",
        "listas_tarefas",
      ],
      app_role: [
        "admin",
        "engenheiro",
        "mestre",
        "visualizador",
        "master",
        "gestor_acessos",
      ],
      changelog_type: [
        "novo",
        "correcao",
        "melhoria",
        "seguranca",
        "integracao",
        "visual",
      ],
      clima: [
        "ensolarado",
        "nublado",
        "chuvoso",
        "chuva_forte",
        "impraticavel",
      ],
      equipamento_status: ["disponivel", "em_uso", "manutencao"],
      export_job_format: ["csv", "xlsx", "pdf", "json"],
      export_job_status: [
        "pendente",
        "processando",
        "concluido",
        "erro",
        "cancelado",
      ],
      grupo_tipo: ["global", "equipe_obra"],
      help_article_status: ["rascunho", "publicado", "arquivado"],
      help_progress_status: [
        "nao_iniciado",
        "em_andamento",
        "concluido",
        "dispensado",
      ],
      lgpd_request_status: [
        "recebido",
        "em_analise",
        "em_execucao",
        "concluido",
        "recusado",
        "cancelado",
      ],
      lgpd_request_type: [
        "acesso",
        "correcao",
        "exclusao",
        "portabilidade",
        "anonimizacao",
        "revogacao",
      ],
      obra_status: ["planejamento", "em_andamento", "pausada", "concluida"],
      perm_scope: ["proprio", "equipe", "empresa", "global"],
      rdo_acesso_nivel: ["ver", "editar", "aprovar"],
      rdo_acesso_sujeito: ["user", "grupo"],
      rdo_status: [
        "rascunho",
        "enviado",
        "aprovado",
        "reprovado",
        "assinado",
        "em_revisao",
        "revisao_solicitada",
        "reaberto",
        "cancelado",
      ],
      security_alert_severity: ["info", "baixa", "media", "alta", "critica"],
      security_alert_status: [
        "aberto",
        "em_analise",
        "resolvido",
        "falso_positivo",
      ],
      severidade: ["baixa", "media", "alta", "critica"],
      tarefa_controle: ["porcentagem", "produtividade", "misto"],
      tarefa_status: [
        "nao_iniciada",
        "em_andamento",
        "concluida",
        "paralisada",
        "cancelada",
      ],
    },
  },
} as const
