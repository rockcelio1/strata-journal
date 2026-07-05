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
          app_android_url: string | null
          app_ios_url: string | null
          cnpj: string | null
          created_at: string
          id: string
          logo_url: string | null
          logo_wallpaper_opacity: number
          nome: string
          updated_at: string
        }
        Insert: {
          app_android_url?: string | null
          app_ios_url?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          logo_wallpaper_opacity?: number
          nome: string
          updated_at?: string
        }
        Update: {
          app_android_url?: string | null
          app_ios_url?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          logo_wallpaper_opacity?: number
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
          rdo_id: string
          rdo_tarefa_avanco_id: string | null
          storage_path: string
          storage_provider: string
          tamanho_bytes: number | null
          tarefa_item_id: string | null
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
          rdo_id: string
          rdo_tarefa_avanco_id?: string | null
          storage_path: string
          storage_provider?: string
          tamanho_bytes?: number | null
          tarefa_item_id?: string | null
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
          rdo_id?: string
          rdo_tarefa_avanco_id?: string | null
          storage_path?: string
          storage_provider?: string
          tamanho_bytes?: number | null
          tarefa_item_id?: string | null
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
        ]
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
          atividade: string | null
          created_at: string
          horas: number
          id: string
          mao_de_obra_id: string
          rdo_id: string
        }
        Insert: {
          atividade?: string | null
          created_at?: string
          horas?: number
          id?: string
          mao_de_obra_id: string
          rdo_id: string
        }
        Update: {
          atividade?: string | null
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
      can_access_rdo: {
        Args: {
          _nivel: Database["public"]["Enums"]["rdo_acesso_nivel"]
          _rdo: string
          _user: string
        }
        Returns: boolean
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
      rdo_signatarios_pendentes: {
        Args: { _rdo_id: string }
        Returns: {
          user_id: string
        }[]
      }
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
      clima:
        | "ensolarado"
        | "nublado"
        | "chuvoso"
        | "chuva_forte"
        | "impraticavel"
      equipamento_status: "disponivel" | "em_uso" | "manutencao"
      grupo_tipo: "global" | "equipe_obra"
      obra_status: "planejamento" | "em_andamento" | "pausada" | "concluida"
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
      clima: [
        "ensolarado",
        "nublado",
        "chuvoso",
        "chuva_forte",
        "impraticavel",
      ],
      equipamento_status: ["disponivel", "em_uso", "manutencao"],
      grupo_tipo: ["global", "equipe_obra"],
      obra_status: ["planejamento", "em_andamento", "pausada", "concluida"],
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
