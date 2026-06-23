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
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipamentos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          identificacao: string | null
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["equipamento_status"]
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          identificacao?: string | null
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["equipamento_status"]
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          identificacao?: string | null
          nome?: string
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
      mao_de_obra: {
        Row: {
          ativo: boolean
          contato: string | null
          created_at: string
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
          id: string
          nome: string
          responsavel_id: string | null
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
          id?: string
          nome: string
          responsavel_id?: string | null
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
          id?: string
          nome?: string
          responsavel_id?: string | null
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
      rdo_anexos: {
        Row: {
          autor_id: string | null
          created_at: string
          empresa_id: string
          id: string
          legenda: string | null
          mime_type: string | null
          nome: string
          onedrive_download_url: string | null
          onedrive_item_id: string | null
          onedrive_web_url: string | null
          rdo_id: string
          storage_path: string
          storage_provider: string
          tamanho_bytes: number | null
          thumbnail_url: string | null
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          legenda?: string | null
          mime_type?: string | null
          nome: string
          onedrive_download_url?: string | null
          onedrive_item_id?: string | null
          onedrive_web_url?: string | null
          rdo_id: string
          storage_path: string
          storage_provider?: string
          tamanho_bytes?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          legenda?: string | null
          mime_type?: string | null
          nome?: string
          onedrive_download_url?: string | null
          onedrive_item_id?: string | null
          onedrive_web_url?: string | null
          rdo_id?: string
          storage_path?: string
          storage_provider?: string
          tamanho_bytes?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
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
          empresa_id: string
          enviado_em: string | null
          id: string
          motivo_reprovacao: string | null
          numero: number
          obra_id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["rdo_status"]
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
          empresa_id: string
          enviado_em?: string | null
          id?: string
          motivo_reprovacao?: string | null
          numero?: number
          obra_id: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["rdo_status"]
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
          empresa_id?: string
          enviado_em?: string | null
          id?: string
          motivo_reprovacao?: string | null
          numero?: number
          obra_id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["rdo_status"]
          updated_at?: string
        }
        Relationships: [
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
    }
    Enums: {
      app_action:
        | "ver"
        | "criar"
        | "editar"
        | "excluir"
        | "aprovar"
        | "exportar"
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
      obra_status: "planejamento" | "em_andamento" | "pausada" | "concluida"
      rdo_status: "rascunho" | "enviado" | "aprovado" | "reprovado"
      severidade: "baixa" | "media" | "alta" | "critica"
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
      app_action: ["ver", "criar", "editar", "excluir", "aprovar", "exportar"],
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
      obra_status: ["planejamento", "em_andamento", "pausada", "concluida"],
      rdo_status: ["rascunho", "enviado", "aprovado", "reprovado"],
      severidade: ["baixa", "media", "alta", "critica"],
    },
  },
} as const
