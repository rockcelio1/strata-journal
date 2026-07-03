import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_rdos",
  title: "Listar RDOs",
  description:
    "Lista Relatórios Diários de Obra (RDOs) acessíveis ao usuário autenticado. Opcionalmente filtrado por obra.",
  inputSchema: {
    obra_id: z.string().uuid().optional().describe("Filtrar por ID da obra."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de RDOs a retornar (padrão 50)."),
    status: z.string().optional().describe("Filtrar por status do RDO (ex.: rascunho, aprovado)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ obra_id, limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("rdos")
      .select("id, numero, data, status, obra_id, created_at")
      .is("deleted_at", null)
      .order("data", { ascending: false })
      .limit(limit ?? 50);
    if (obra_id) q = q.eq("obra_id", obra_id);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rdos: data ?? [] },
    };
  },
});
