import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, autenticarRequisicao, respostaErro } from "@/lib/api-auth.server";

/**
 * Diagnóstico administrativo da integração OneDrive.
 * Retorna apenas estado sanitizado — nunca segredos, tokens ou IDs internos.
 */
export const Route = createFileRoute("/api/integracoes/onedrive/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const ctx = await autenticarRequisicao(request);
          const { exigirPermissao } = await import("@/lib/security/permissao.server");
          try {
            await exigirPermissao(ctx.supabase, ctx.userId, "integracoes.onedrive", "ver");
          } catch {
            return respostaErro(403, "SEM_PERMISSAO", "Apenas administradores podem consultar o diagnóstico.");
          }
          const { statusIntegracao } = await import("@/lib/onedrive-app.server");
          const st = await statusIntegracao();
          return Response.json(
            {
              configured: st.configured,
              token: st.token,
              drive: st.drive,
              targetUser: st.targetUser,
              ...(st.missing?.length ? { missing: st.missing } : {}),
              ...(st.message ? { message: st.message } : {}),
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (e) {
          if (e instanceof ApiAuthError) return respostaErro(e.status, "NAO_AUTORIZADO", e.message);
          console.error("[onedrive] status falhou:", (e as Error)?.message);
          return respostaErro(500, "ERRO_INTERNO", "Não foi possível verificar a integração.");
        }
      },
    },
  },
});
