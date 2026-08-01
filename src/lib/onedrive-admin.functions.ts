import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "./security/permissao.server";
import { encrypt, maskSecret } from "./crypto.server";
import { obterToken, obterDriveId, chamarGraph, limparCacheGraph } from "./onedrive-app.server";

async function exigirAdmin(supabase: any, userId: string) {
  await exigirPermissao(supabase, userId, "integracoes.onedrive", "editar");
}

export const getOneDriveAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("onedrive_admin_config" as any)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const d = data as any;
    return {
      tenantId: d.tenant_id,
      clientId: maskSecret(d.client_id),
      clientSecretConfigured: true,
      targetUserId: d.target_user_id,
      targetUserEmail: d.target_user_email,
      driveId: d.drive_id,
      webUrl: d.web_url,
      status: d.status,
      lastTestAt: d.last_test_at,
      lastError: d.last_error,
    };
  });

export const saveOneDriveAdminConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      tenantId: z.string().uuid(),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      targetUserId: z.string().min(1),
      targetUserEmail: z.string().email(),
      driveId: z.string().min(1),
      webUrl: z.string().url(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    
    const secretCiphertext = encrypt(data.clientSecret);
    
    const { error } = await context.supabase
      .from("onedrive_admin_config" as any)
      .upsert({
        tenant_id: data.tenantId,
        client_id: data.clientId,
        client_secret_ciphertext: secretCiphertext,
        target_user_id: data.targetUserId,
        target_user_email: data.targetUserEmail,
        drive_id: data.driveId,
        web_url: data.webUrl,
        status: 'configurado',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' } as any);

    if (error) throw error;

    await context.supabase.from("onedrive_config_audit" as any).insert({
      user_id: context.userId,
      acao: "configuracao_atualizada",
      detalhes: { tenantId: data.tenantId, targetUser: data.targetUserEmail }
    } as any);

    limparCacheGraph();
    return { ok: true };
  });

export const testOneDriveAdminConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    
    const start = Date.now();
    try {
      await obterToken();
      const driveId = await obterDriveId();
      const testName = `.rdo-test-${Date.now()}.txt`;
      const testPath = `RDO/TESTE-INTEGRACAO/${testName}`;
      
      const putRes = await chamarGraph(`/drive/root:/${testPath}:/content`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "Teste de integridade RDO"
      }, "test:write");
      
      if (!putRes.ok) throw new Error("Falha ao criar arquivo de teste");
      const item = await putRes.json();
      await chamarGraph(`/drive/items/${item.id}`, { method: "DELETE" }, "test:delete");
      
      const latency = Date.now() - start;
      
      await context.supabase
        .from("onedrive_admin_config" as any)
        .update({
          status: 'operacional',
          last_test_at: new Date().toISOString(),
          last_error: null
        } as any)
        .neq('id' as any, '00000000-0000-0000-0000-000000000000' as any);

      return { ok: true, latency, driveId, timestamp: new Date().toISOString() };
    } catch (e: any) {
      const errorMsg = e.message || "Erro desconhecido";
      await context.supabase
        .from("onedrive_admin_config" as any)
        .update({
          status: 'erro',
          last_test_at: new Date().toISOString(),
          last_error: errorMsg
        } as any)
        .neq('id' as any, '00000000-0000-0000-0000-000000000000' as any);
        
      return { ok: false, error: errorMsg };
    }
  });

export const getOneDriveHealth = createServerFn({ method: "GET" })
  .handler(async () => {
    return { status: "ok", service: "onedrive-gateway", timestamp: new Date().toISOString() };
  });

// Funções para manter compatibilidade com componentes existentes que podem ter sido quebrados
export const onedriveHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("onedrive_config_audit" as any)
      .select("*")
      .order("created_at", { ascending: false });
    return data || [];
  });

export const onedriveListarPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    // Retorna permissões se existirem no sistema antigo ou vazio
    const { data } = await context.supabase.from("onedrive_permissoes" as any).select("*");
    return data || [];
  });

export const onedriveDefinirPermissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string(), acao: z.string(), permitido: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("onedrive_permissoes" as any)
      .upsert({ user_id: data.userId, acao: data.acao, permitido: data.permitido } as any);
    if (error) throw error;
    return { ok: true };
  });
