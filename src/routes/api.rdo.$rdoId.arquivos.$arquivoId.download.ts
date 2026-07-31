import { createFileRoute } from "@tanstack/react-router";
import { ApiAuthError, autenticarRequisicao, respostaErro } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/rdo/$rdoId/arquivos/$arquivoId/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const ctx = await autenticarRequisicao(request);
          const { downloadArquivoRdo } = await import("@/lib/rdo-arquivos.server");
          const r = await downloadArquivoRdo(ctx, params.rdoId, params.arquivoId);
          const url = new URL(request.url);
          if (url.searchParams.get("redirect") === "1") {
            return new Response(null, { status: 302, headers: { location: r.url, "cache-control": "no-store" } });
          }
          return Response.json(
            { url: r.url, nome: r.nome, tamanho: r.tamanho, mime_type: r.mimeType },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (e) {
          if (e instanceof ApiAuthError) return respostaErro(e.status, "NAO_AUTORIZADO", e.message);
          const { respostaFalha } = await import("@/lib/rdo-arquivos.server");
          return respostaFalha(e);
        }
      },
    },
  },
});
