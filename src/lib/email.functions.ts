import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminEmpresa, mascarar, garantirTemplatesPadrao, montarMensagem, enfileirar } from "@/lib/email/admin.server";
import { carregarConfig, enviarComProvedor, enviarViaEdgeFunction, processarFila, registrarLog } from "@/lib/email.server";
import { htmlParaTexto } from "@/lib/email/providers";

export const getEmailConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await garantirTemplatesPadrao(supabaseAdmin, empresaId);
    const { cfg, cred } = await carregarConfig(supabaseAdmin, empresaId);
    const { data: templates } = await supabaseAdmin
      .from("email_templates")
      .select("id, chave, nome, assunto, corpo_html, corpo_texto, ativo")
      .eq("empresa_id", empresaId)
      .order("chave");
    return {
      config: cfg ?? {
        empresa_id: empresaId,
        provider: "resend",
        modo: "server_functions",
        edge_function_name: null,
        from_name: "Sistema",
        from_email: null,
        reply_to: null,
        mailgun_domain: null,
        ses_region: null,
        ativo: false,
        max_tentativas: 5,
      },
      credenciais: { api_key: mascarar(cred.api_key), api_secret: mascarar(cred.api_secret) },
      templates: templates ?? [],
    };
  });

export const saveEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: z.enum(["resend", "sendgrid", "mailgun", "ses"]),
        modo: z.enum(["server_functions", "edge_function"]),
        edge_function_name: z.string().trim().max(80).nullable().optional(),
        from_name: z.string().trim().min(1).max(80),
        from_email: z.string().trim().email().max(160),
        reply_to: z.string().trim().email().max(160).nullable().optional(),
        mailgun_domain: z.string().trim().max(160).nullable().optional(),
        ses_region: z.string().trim().max(40).nullable().optional(),
        ativo: z.boolean(),
        max_tentativas: z.number().int().min(1).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_config")
      .upsert({ empresa_id: empresaId, ...data }, { onConflict: "empresa_id" });
    if (error) throw new Error("Não foi possível salvar a configuração.");
    await registrarLog(supabaseAdmin, {
      empresa_id: empresaId,
      evento: "config_atualizada",
      provider: data.provider,
      detalhes: { modo: data.modo, ativo: data.ativo },
    });
    return { ok: true };
  });

export const saveEmailCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        provider: z.enum(["resend", "sendgrid", "mailgun", "ses"]),
        api_key: z.string().trim().min(8).max(500).optional(),
        api_secret: z.string().trim().min(8).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      empresa_id: empresaId,
      provider: data.provider,
      updated_by: context.userId,
      ...(data.api_key ? { api_key: data.api_key } : {}),
      ...(data.api_secret ? { api_secret: data.api_secret } : {}),
    };
    const { error } = await supabaseAdmin
      .from("email_credentials")
      .upsert(patch, { onConflict: "empresa_id" });
    if (error) throw new Error("Não foi possível salvar as credenciais.");
    await registrarLog(supabaseAdmin, {
      empresa_id: empresaId,
      evento: "credenciais_atualizadas",
      provider: data.provider,
    });
    return { ok: true };
  });

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        chave: z.string().trim().min(2).max(60),
        nome: z.string().trim().min(2).max(120),
        assunto: z.string().trim().min(2).max(300),
        corpo_html: z.string().min(10).max(60000),
        ativo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("email_templates").upsert(
      {
        empresa_id: empresaId,
        chave: data.chave,
        nome: data.nome,
        assunto: data.assunto,
        corpo_html: data.corpo_html,
        corpo_texto: htmlParaTexto(data.corpo_html),
        ativo: data.ativo,
      },
      { onConflict: "empresa_id,chave" },
    );
    if (error) throw new Error("Não foi possível salvar o template.");
    return { ok: true };
  });

export const enviarEmailTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ destinatario: z.string().trim().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { cfg, cred } = await carregarConfig(supabaseAdmin, empresaId);
    if (!cfg) throw new Error("Configure o e-mail antes de testar.");
    const msg = {
      to: data.destinatario,
      subject: "Teste de envio — configuração de e-mail",
      html: "<p>Envio de teste realizado com sucesso. Sua configuração de e-mail está funcionando.</p>",
    };
    const res =
      cfg.modo === "edge_function"
        ? await enviarViaEdgeFunction(cfg, msg)
        : await enviarComProvedor(cfg, cred, msg);
    await registrarLog(supabaseAdmin, {
      empresa_id: empresaId,
      evento: "teste_envio",
      provider: cfg.provider,
      status: res.ok ? "sucesso" : "erro",
      destinatario: data.destinatario,
      detalhes: { http_status: res.status ?? null, erro: res.erro ?? null },
    });
    return { ok: res.ok, erro: res.ok ? null : (res.erro ?? "Falha no envio.") };
  });

export const listEmailFila = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [fila, logs] = await Promise.all([
      supabaseAdmin
        .from("email_queue")
        .select("id, template_chave, destinatario, assunto, status, tentativas, ultimo_erro, provider, enviado_em, created_at")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("email_logs")
        .select("id, evento, provider, status, destinatario, detalhes, created_at")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { fila: fila.data ?? [], logs: logs.data ?? [] };
  });

export const processarFilaEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return await processarFila(supabaseAdmin, empresaId);
  });

export const reenfileirarEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("email_queue")
      .update({ status: "pendente", proxima_tentativa_em: new Date().toISOString(), ultimo_erro: null })
      .eq("id", data.id)
      .eq("empresa_id", empresaId);
    if (error) throw new Error("Não foi possível reenfileirar.");
    return { ok: true };
  });

/** Enfileira e-mail de um fluxo (convite, notificação, recuperação de senha). */
export const enviarEmailFluxo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        chave: z.enum(["convite", "notificacao", "recuperacao_senha"]),
        destinatario: z.string().trim().email(),
        variaveis: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
        idempotency_key: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const empresaId = await assertAdminEmpresa(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const msg = await montarMensagem(supabaseAdmin, empresaId, data.chave, data.variaveis);
    if (!msg.ativo) return { ok: false, erro: "Template desativado." };
    const id = await enfileirar(supabaseAdmin, {
      empresa_id: empresaId,
      template_chave: data.chave,
      destinatario: data.destinatario,
      assunto: msg.assunto,
      corpo_html: msg.html,
      corpo_texto: msg.texto,
      idempotency_key: data.idempotency_key ?? null,
      created_by: context.userId,
    });
    await registrarLog(supabaseAdmin, {
      empresa_id: empresaId,
      queue_id: id ?? null,
      evento: "enfileirado",
      destinatario: data.destinatario,
      detalhes: { chave: data.chave },
    });
    const resultado = await processarFila(supabaseAdmin, empresaId, 5);
    return { ok: true, id, resultado };
  });
