import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { exigirPermissao } from "./security/permissao.server";
import { encrypt, decrypt, maskSecret } from "./crypto.server";
import { obterToken, obterDriveId, chamarGraph, limparCacheGraph } from "./onedrive-app.server";

async function exigirAdmin(supabase: any, userId: string) {
  await exigirPermissao(supabase, userId, "integracoes.onedrive", "editar");
}

export const getOneDriveAdminConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("onedrive_admin_config")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      tenantId: data.tenant_id,
      clientId: maskSecret(data.client_id),
      clientSecretConfigured: true,
      targetUserId: data.target_user_id,
      targetUserEmail: data.target_user_email,
      driveId: data.drive_id,
      webUrl: data.web_url,
      status: data.status,
      lastTestAt: data.last_test_at,
      lastError: data.last_error,
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
    
    // Criptografa o segredo
    const secretCiphertext = encrypt(data.clientSecret);
    
    const { error } = await context.supabase
      .from("onedrive_admin_config")
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
      }, { onConflict: 'id' });

    if (error) throw error;

    // Auditoria
    await context.supabase.from("onedrive_config_audit").insert({
      user_id: context.userId,
      acao: "configuracao_atualizada",
      detalhes: { tenantId: data.tenantId, targetUser: data.targetUserEmail }
    });

    limparCacheGraph();
    return { ok: true };
  });

export const testOneDriveAdminConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirAdmin(context.supabase, context.userId);
    
    const start = Date.now();
    try {
      // 1. Obter Token
      await obterToken();
      
      // 2. Resolver Drive
      const driveId = await obterDriveId();
      
      // 3. Criar arquivo de teste
      const testName = `.rdo-test-${Date.now()}.txt`;
      const testPath = `RDO/TESTE-INTEGRACAO/${testName}`;
      
      const putRes = await chamarGraph(`/drive/root:/${testPath}:/content`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: "Teste de integridade RDO"
      }, "test:write");
      
      if (!putRes.ok) throw new Error("Falha ao criar arquivo de teste");
      const item = await putRes.json();
      
      // 4. Excluir arquivo
      await chamarGraph(`/drive/items/${item.id}`, { method: "DELETE" }, "test:delete");
      
      const latency = Date.now() - start;
      
      // Atualiza status no banco
      await context.supabase
        .from("onedrive_admin_config")
        .update({
          status: 'operacional',
          last_test_at: new Date().toISOString(),
          last_error: null
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to target the single record

      return {
        ok: true,
        latency,
        driveId,
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      const errorMsg = e.message || "Erro desconhecido";
      await context.supabase
        .from("onedrive_admin_config")
        .update({
          status: 'erro',
          last_test_at: new Date().toISOString(),
          last_error: errorMsg
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
      return { ok: false, error: errorMsg };
    }
  });

export const getOneDriveHealth = createServerFn({ method: "GET" })
  .handler(async () => {
    // Endpoint público para status
    return { status: "ok", service: "onedrive-gateway", timestamp: new Date().toISOString() };
  });
