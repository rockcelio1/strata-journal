import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailExistsIn } from "@/lib/core.functions";

/**
 * Contexto do cadastro: informa se o e-mail já existe e se há convite pendente.
 * Com convite, o usuário entra na empresa que convidou (seleção de empresa);
 * sem convite, ele cria uma nova empresa.
 */
export const getSignupContext = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const exists = await emailExistsIn(supabaseAdmin, email);

    const { data: convite } = await supabaseAdmin
      .from("convites")
      .select("id, role, empresa_id, expires_at, empresas(nome)")
      .ilike("email", email)
      .eq("aceito", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      exists,
      convite: convite
        ? {
            empresa_nome: (convite as any).empresas?.nome ?? "Empresa",
            role: (convite as any).role as string,
          }
        : null,
    };
  });

/**
 * Garante que a sessão atual esteja vinculada a uma empresa (isolamento por RLS).
 * Usado após cadastro/login social: se o perfil não existir ou estiver sem
 * empresa, cria a empresa do usuário e o vínculo de administrador.
 */
export const ensureEmpresaVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { empresa_nome?: string }) =>
    z.object({ empresa_nome: z.string().trim().min(1).max(120).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, empresa_id, nome, email")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.empresa_id) {
      return { empresa_id: profile.empresa_id as string, criada: false };
    }

    const email = (claims as any)?.email ?? profile?.email ?? "";
    const nome = profile?.nome ?? (email ? String(email).split("@")[0] : "Usuário");
    const empresaNome = data.empresa_nome ?? "Minha Empresa";

    const { data: empresa, error: empErr } = await supabaseAdmin
      .from("empresas")
      .insert({ nome: empresaNome })
      .select("id")
      .single();
    if (empErr) throw empErr;

    const empresa_id = empresa.id as string;

    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: userId, empresa_id, nome, email, aprovado: true, aprovado_em: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (profErr) throw profErr;

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, empresa_id, role: "admin" }, { onConflict: "user_id,role" });

    return { empresa_id, criada: true };
  });
