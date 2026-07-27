import { createFileRoute } from "@tanstack/react-router";

/**
 * Bootstrap idempotente do usuário master padrão (cpd@facom.com.br).
 *
 * Segurança:
 *  - Rota /api/public/* bypassa o auth do edge, então validamos manualmente
 *    o header `x-bootstrap-token` contra o secret BOOTSTRAP_MASTER_TOKEN.
 *  - Só cria/promove o único e-mail permitido. Nenhum input do cliente
 *    define quem vira master.
 *
 * O que faz:
 *  1. Cria o usuário no auth (email já confirmado) se não existir.
 *     O trigger `handle_new_user` cria empresa + profile + role 'admin'.
 *  2. Garante que o usuário também tenha a role 'master' em user_roles.
 *  3. Se o usuário já existir, apenas garante a role 'master'.
 *
 * Chamada:
 *   curl -X POST https://<host>/api/public/bootstrap-master \
 *        -H "x-bootstrap-token: $BOOTSTRAP_MASTER_TOKEN"
 */
const TARGET_EMAIL = "cpd@facom.com.br";
const TARGET_PASSWORD = "@Connect153624";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export const Route = createFileRoute("/api/public/bootstrap-master")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.BOOTSTRAP_MASTER_TOKEN;
        if (!expected) return json(500, { error: "bootstrap_token_missing" });
        const provided = request.headers.get("x-bootstrap-token") ?? "";
        if (!provided || !safeEqual(provided, expected)) {
          return json(401, { error: "unauthorized" });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Localiza usuário existente (paginando defensivamente).
        let userId: string | null = null;
        let page = 1;
        while (page <= 20 && !userId) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (error) return json(500, { error: "list_users_failed", detail: error.message });
          const found = data.users.find((u) => u.email?.toLowerCase() === TARGET_EMAIL);
          if (found) userId = found.id;
          if (data.users.length < 200) break;
          page++;
        }

        // 2) Cria se não existir — trigger handle_new_user cria empresa+profile+role admin.
        let created = false;
        if (!userId) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: TARGET_EMAIL,
            password: TARGET_PASSWORD,
            email_confirm: true,
          });
          if (error || !data.user) {
            return json(500, { error: "create_user_failed", detail: error?.message });
          }
          userId = data.user.id;
          created = true;
        }

        // 3) Descobre empresa_id do profile (criado pelo trigger).
        const { data: profile, error: profileErr } = await supabaseAdmin
          .from("profiles")
          .select("empresa_id")
          .eq("id", userId)
          .maybeSingle();
        if (profileErr) return json(500, { error: "profile_lookup_failed", detail: profileErr.message });
        const empresaId = profile?.empresa_id ?? null;

        // 4) Garante role master (idempotente).
        const { error: roleErr } = await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: userId, empresa_id: empresaId, role: "master" },
            { onConflict: "user_id,role" },
          );
        if (roleErr) return json(500, { error: "grant_master_failed", detail: roleErr.message });

        return json(200, {
          ok: true,
          created,
          user_id: userId,
          empresa_id: empresaId,
          email: TARGET_EMAIL,
        });
      },
    },
  },
});
