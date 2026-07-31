import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, autenticarRequisicao, respostaErro } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/rdo/$rdoId/arquivos/$arquivoId")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const ctx = await autenticarRequisicao(request);
          const { excluirArquivoRdo } = await import("@/lib/rdo-arquivos.server");
          return Response.json(await excluirArquivoRdo(ctx, params.rdoId, params.arquivoId));
        } catch (e) {
          if (e instanceof ApiAuthError) return respostaErro(e.status, "NAO_AUTORIZADO", e.message);
          const { respostaFalha } = await import("@/lib/rdo-arquivos.server");
          return respostaFalha(e);
        }
      },
    },
  },
});
