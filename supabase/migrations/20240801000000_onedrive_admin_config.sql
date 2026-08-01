-- Tabela para configurações administrativas globais da integração OneDrive
CREATE TABLE IF NOT EXISTS public.onedrive_admin_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret_ciphertext TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    target_user_email TEXT NOT NULL,
    drive_id TEXT NOT NULL,
    web_url TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    last_test_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Somente admins podem ver ou editar
ALTER TABLE public.onedrive_admin_config ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onedrive_admin_config TO authenticated;
GRANT ALL ON public.onedrive_admin_config TO service_role;

-- Política para administradores
CREATE POLICY "Admins podem gerenciar config OneDrive"
ON public.onedrive_admin_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER onedrive_admin_config_updated_at
    BEFORE UPDATE ON public.onedrive_admin_config
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Auditoria de mudanças na configuração
CREATE TABLE IF NOT EXISTS public.onedrive_config_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    acao TEXT NOT NULL,
    detalhes JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.onedrive_config_audit ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.onedrive_config_audit TO authenticated;
GRANT ALL ON public.onedrive_config_audit TO service_role;

CREATE POLICY "Admins podem ver auditoria de config"
ON public.onedrive_config_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
