import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApiAuthError, autenticarRequisicao, respostaErro } from "@/lib/api-auth.server";

const bodySchema = z.object({
  nome: z.string().trim().min(1).max(200),
  mime_type: z.string().trim().min(3).max(120),
  base64: z.string().min(1),
  legenda: z.string().trim().max(500).optional(),
  root_folder: z.string().trim().max(200).optional(),
});

export const Route = createFileRoute("/api/rdo/$rdoId/arquivos")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const ctx = await autenticarRequisicao(request);
          const { listarArquivosRdo } = await import("@/lib/rdo-arquivos.server");
          return Response.json({ arquivos: await listarArquivosRdo(ctx, params.rdoId) });
        } catch (e) {
          if (e instanceof ApiAuthError) return respostaErro(e.status, "NAO_AUTORIZADO", e.message);
          const { respostaFalha } = await import("@/lib/rdo-arquivos.server");
          return respostaFalha(e);
        }
      },
      POST: async ({ request, params }) => {
        try {
          const ctx = await autenticarRequisicao(request);
          const payload = await request.json().catch(() => null);
          const parsed = bodySchema.safeParse(payload);
          if (!parsed.success) {
            return Response.json({ error: "VALIDACAO", issues: parsed.error.flatten() }, { status: 400 });
          }
          let bytes: Uint8Array;
          try {
            const bin = atob(parsed.data.base64);
            bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          } catch {
            return respostaErro(400, "BASE64_INVALIDO", "Conteúdo do arquivo inválido.");
          }
          const { enviarArquivoRdo } = await import("@/lib/rdo-arquivos.server");
          const criado = await enviarArquivoRdo(ctx, {
            rdoId: params.rdoId,
            nome: parsed.data.nome,
            mimeType: parsed.data.mime_type,
            bytes,
            legenda: parsed.data.legenda ?? null,
            raiz: parsed.data.root_folder,
          });
          return Response.json({ arquivo: criado }, { status: 201 });
        } catch (e) {
          if (e instanceof ApiAuthError) return respostaErro(e.status, "NAO_AUTORIZADO", e.message);
          const { respostaFalha } = await import("@/lib/rdo-arquivos.server");
          return respostaFalha(e);
        }
      },
    },
  },
});
